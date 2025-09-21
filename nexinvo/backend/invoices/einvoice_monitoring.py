"""
e-Invoice Status Tracking and Monitoring System
Provides real-time monitoring, alerts, and analytics for e-Invoice operations
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Count, Q, Sum
from django.core.cache import cache
from django.conf import settings

from .models import Invoice, EInvoiceDetails, QRCodePayment
from tenants.models import Tenant
from .einvoice_irp import EInvoiceService

logger = logging.getLogger(__name__)


class EInvoiceStatusTracker:
    """
    Real-time status tracking for e-Invoice operations
    """

    def __init__(self):
        self.einvoice_service = EInvoiceService()

    def get_comprehensive_status(self, invoice: Invoice) -> Dict[str, Any]:
        """Get comprehensive e-Invoice status with all related information"""
        try:
            # Get basic e-Invoice status
            einvoice_status = self.einvoice_service.get_einvoice_status(invoice)

            # Get QR code information
            qr_codes = QRCodePayment.objects.filter(invoice=invoice).order_by('-created_at')
            qr_data = []

            for qr in qr_codes:
                qr_data.append({
                    'id': str(qr.id),
                    'payment_method': qr.payment_method,
                    'amount': float(qr.amount),
                    'status': qr.qr_status,
                    'transaction_reference': qr.transaction_reference,
                    'expiry_time': qr.expiry_time.isoformat(),
                    'scan_count': qr.scan_count,
                    'created_at': qr.created_at.isoformat(),
                    'is_active': qr.is_active,
                    'is_expired': qr.is_expired
                })

            # Get compliance status
            compliance_status = self._check_compliance_status(invoice)

            # Get payment status
            payment_status = self._get_payment_status(invoice)

            # Calculate processing timeline
            timeline = self._build_processing_timeline(invoice)

            return {
                'success': True,
                'invoice_id': str(invoice.id),
                'invoice_number': invoice.number,
                'einvoice_status': einvoice_status,
                'qr_codes': qr_data,
                'compliance_status': compliance_status,
                'payment_status': payment_status,
                'processing_timeline': timeline,
                'last_updated': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Comprehensive status check failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def monitor_bulk_status(self, tenant: Tenant, invoice_ids: List[str]) -> Dict[str, Any]:
        """Monitor status of multiple invoices"""
        try:
            results = []
            summary = {
                'total_invoices': len(invoice_ids),
                'einvoice_generated': 0,
                'einvoice_failed': 0,
                'einvoice_pending': 0,
                'qr_codes_active': 0,
                'payments_received': 0
            }

            invoices = Invoice.objects.filter(
                id__in=invoice_ids,
                tenant=tenant
            )

            for invoice in invoices:
                status = self.get_comprehensive_status(invoice)
                results.append(status)

                # Update summary
                if status['success']:
                    einvoice_status = status['einvoice_status']['status']
                    if einvoice_status == 'generated':
                        summary['einvoice_generated'] += 1
                    elif einvoice_status == 'failed':
                        summary['einvoice_failed'] += 1
                    elif einvoice_status == 'pending':
                        summary['einvoice_pending'] += 1

                    # Count active QR codes
                    active_qr_count = sum(1 for qr in status['qr_codes'] if qr['is_active'])
                    summary['qr_codes_active'] += active_qr_count

                    # Count payments
                    if status['payment_status']['is_paid']:
                        summary['payments_received'] += 1

            return {
                'success': True,
                'summary': summary,
                'results': results,
                'generated_at': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Bulk status monitoring failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_real_time_alerts(self, tenant: Tenant) -> Dict[str, Any]:
        """Get real-time alerts for e-Invoice issues"""
        try:
            alerts = []

            # Check for failed e-Invoices in last 24 hours
            failed_einvoices = EInvoiceDetails.objects.filter(
                tenant=tenant,
                irp_status='failed',
                created_at__gte=timezone.now() - timedelta(hours=24)
            ).count()

            if failed_einvoices > 0:
                alerts.append({
                    'type': 'error',
                    'severity': 'high',
                    'title': 'e-Invoice Generation Failures',
                    'message': f'{failed_einvoices} e-Invoice(s) failed to generate in the last 24 hours',
                    'action_required': True,
                    'details': {
                        'count': failed_einvoices,
                        'timeframe': '24 hours'
                    }
                })

            # Check for expiring QR codes (next 2 hours)
            expiring_qr_codes = QRCodePayment.objects.filter(
                tenant=tenant,
                qr_status='active',
                expiry_time__lte=timezone.now() + timedelta(hours=2),
                expiry_time__gte=timezone.now()
            ).count()

            if expiring_qr_codes > 0:
                alerts.append({
                    'type': 'warning',
                    'severity': 'medium',
                    'title': 'QR Codes Expiring Soon',
                    'message': f'{expiring_qr_codes} QR code(s) will expire in the next 2 hours',
                    'action_required': False,
                    'details': {
                        'count': expiring_qr_codes,
                        'timeframe': '2 hours'
                    }
                })

            # Check for pending e-Invoice cancellations
            pending_cancellations = EInvoiceDetails.objects.filter(
                tenant=tenant,
                irp_status='generated',
                created_at__lte=timezone.now() - timedelta(hours=20)  # Close to 24h limit
            ).count()

            if pending_cancellations > 0:
                alerts.append({
                    'type': 'info',
                    'severity': 'low',
                    'title': 'e-Invoices Near Cancellation Deadline',
                    'message': f'{pending_cancellations} e-Invoice(s) are approaching the 24-hour cancellation deadline',
                    'action_required': False,
                    'details': {
                        'count': pending_cancellations,
                        'deadline': '24 hours from generation'
                    }
                })

            # Check compliance issues
            compliance_alerts = self._check_compliance_alerts(tenant)
            alerts.extend(compliance_alerts)

            return {
                'success': True,
                'alert_count': len(alerts),
                'alerts': alerts,
                'last_checked': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Alert generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _check_compliance_status(self, invoice: Invoice) -> Dict[str, Any]:
        """Check e-Invoice compliance status"""
        compliance_issues = []

        # Check GST requirements
        if invoice.grand_total > 50000000:  # ₹50 Cr
            compliance_issues.append({
                'type': 'error',
                'message': 'Invoice amount exceeds e-Invoice limit (₹50 Cr)'
            })

        # Check B2B requirements
        if invoice.client.client_type == 'b2b' and not invoice.client.gstin:
            compliance_issues.append({
                'type': 'error',
                'message': 'B2B invoice requires client GSTIN'
            })

        # Check supplier GSTIN
        supplier_gstin = invoice.tenant.company_details.get('gstin')
        if not supplier_gstin:
            compliance_issues.append({
                'type': 'error',
                'message': 'Supplier GSTIN not configured'
            })

        # Check mandatory fields
        if not invoice.place_of_supply:
            compliance_issues.append({
                'type': 'warning',
                'message': 'Place of supply not specified'
            })

        return {
            'is_compliant': len([issue for issue in compliance_issues if issue['type'] == 'error']) == 0,
            'issues': compliance_issues,
            'warnings_count': len([issue for issue in compliance_issues if issue['type'] == 'warning']),
            'errors_count': len([issue for issue in compliance_issues if issue['type'] == 'error'])
        }

    def _get_payment_status(self, invoice: Invoice) -> Dict[str, Any]:
        """Get comprehensive payment status"""
        return {
            'is_paid': invoice.status == 'paid',
            'amount_due': float(invoice.grand_total),
            'payment_method': 'pending',  # Would be updated based on actual payment
            'payment_date': None,
            'qr_scans_total': sum(qr.scan_count for qr in invoice.qr_payments.all()),
            'active_qr_codes': invoice.qr_payments.filter(qr_status='active').count()
        }

    def _build_processing_timeline(self, invoice: Invoice) -> List[Dict[str, Any]]:
        """Build processing timeline for invoice"""
        timeline = []

        # Invoice creation
        timeline.append({
            'event': 'Invoice Created',
            'timestamp': invoice.created_at.isoformat(),
            'status': 'completed',
            'details': f'Invoice {invoice.number} created'
        })

        # e-Invoice events
        einvoice_details = EInvoiceDetails.objects.filter(invoice=invoice).first()
        if einvoice_details:
            timeline.append({
                'event': 'e-Invoice Submitted',
                'timestamp': einvoice_details.created_at.isoformat(),
                'status': 'completed',
                'details': 'e-Invoice submitted to IRP'
            })

            if einvoice_details.ack_date:
                timeline.append({
                    'event': 'e-Invoice Generated',
                    'timestamp': einvoice_details.ack_date.isoformat(),
                    'status': 'completed',
                    'details': f'IRN: {einvoice_details.irn}'
                })

            if einvoice_details.cancellation_date:
                timeline.append({
                    'event': 'e-Invoice Cancelled',
                    'timestamp': einvoice_details.cancellation_date.isoformat(),
                    'status': 'completed',
                    'details': f'Reason: {einvoice_details.cancellation_reason}'
                })

        # QR Code events
        qr_codes = QRCodePayment.objects.filter(invoice=invoice).order_by('created_at')
        for qr in qr_codes:
            timeline.append({
                'event': 'QR Code Generated',
                'timestamp': qr.created_at.isoformat(),
                'status': 'completed',
                'details': f'Payment method: {qr.payment_method}'
            })

        # Payment events
        if invoice.status == 'paid':
            timeline.append({
                'event': 'Payment Received',
                'timestamp': invoice.updated_at.isoformat(),  # Approximate
                'status': 'completed',
                'details': f'Amount: ₹{invoice.grand_total}'
            })

        return sorted(timeline, key=lambda x: x['timestamp'])

    def _check_compliance_alerts(self, tenant: Tenant) -> List[Dict[str, Any]]:
        """Check for compliance-related alerts"""
        alerts = []

        # Check for invoices missing e-Invoice generation
        missing_einvoices = Invoice.objects.filter(
            tenant=tenant,
            status__in=['draft', 'sent'],
            grand_total__gte=Decimal('500'),  # Threshold for e-Invoice requirement
            created_at__gte=timezone.now() - timedelta(days=7)
        ).exclude(
            einvoice_details__isnull=False
        ).count()

        if missing_einvoices > 0:
            alerts.append({
                'type': 'warning',
                'severity': 'medium',
                'title': 'Missing e-Invoice Generation',
                'message': f'{missing_einvoices} eligible invoice(s) do not have e-Invoice generated',
                'action_required': True,
                'details': {
                    'count': missing_einvoices,
                    'threshold': '₹500',
                    'timeframe': '7 days'
                }
            })

        return alerts


class EInvoiceAnalytics:
    """
    Analytics and reporting for e-Invoice operations
    """

    def __init__(self):
        pass

    def get_dashboard_metrics(self, tenant: Tenant, date_range: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Get dashboard metrics for e-Invoice operations"""
        try:
            # Set default date range (last 30 days)
            if not date_range:
                end_date = timezone.now()
                start_date = end_date - timedelta(days=30)
            else:
                start_date = datetime.fromisoformat(date_range['start_date'])
                end_date = datetime.fromisoformat(date_range['end_date'])

            # Basic metrics
            total_einvoices = EInvoiceDetails.objects.filter(
                tenant=tenant,
                created_at__range=[start_date, end_date]
            ).count()

            generated_count = EInvoiceDetails.objects.filter(
                tenant=tenant,
                irp_status='generated',
                created_at__range=[start_date, end_date]
            ).count()

            failed_count = EInvoiceDetails.objects.filter(
                tenant=tenant,
                irp_status='failed',
                created_at__range=[start_date, end_date]
            ).count()

            cancelled_count = EInvoiceDetails.objects.filter(
                tenant=tenant,
                irp_status='cancelled',
                created_at__range=[start_date, end_date]
            ).count()

            # Success rate
            success_rate = (generated_count / total_einvoices * 100) if total_einvoices > 0 else 0

            # QR Code metrics
            total_qr_codes = QRCodePayment.objects.filter(
                tenant=tenant,
                created_at__range=[start_date, end_date]
            ).count()

            active_qr_codes = QRCodePayment.objects.filter(
                tenant=tenant,
                qr_status='active',
                created_at__range=[start_date, end_date]
            ).count()

            total_scans = QRCodePayment.objects.filter(
                tenant=tenant,
                created_at__range=[start_date, end_date]
            ).aggregate(total_scans=Sum('scan_count'))['total_scans'] or 0

            # Daily trend data
            daily_trends = self._get_daily_trends(tenant, start_date, end_date)

            # Status distribution
            status_distribution = EInvoiceDetails.objects.filter(
                tenant=tenant,
                created_at__range=[start_date, end_date]
            ).values('irp_status').annotate(count=Count('irp_status'))

            return {
                'success': True,
                'date_range': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'metrics': {
                    'total_einvoices': total_einvoices,
                    'generated_count': generated_count,
                    'failed_count': failed_count,
                    'cancelled_count': cancelled_count,
                    'success_rate': round(success_rate, 2),
                    'total_qr_codes': total_qr_codes,
                    'active_qr_codes': active_qr_codes,
                    'total_qr_scans': total_scans
                },
                'trends': daily_trends,
                'status_distribution': list(status_distribution),
                'generated_at': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Dashboard metrics generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_daily_trends(self, tenant: Tenant, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Get daily trend data for e-Invoice operations"""
        trends = []
        current_date = start_date.date()
        end_date_only = end_date.date()

        while current_date <= end_date_only:
            day_start = timezone.make_aware(datetime.combine(current_date, datetime.min.time()))
            day_end = day_start + timedelta(days=1)

            daily_generated = EInvoiceDetails.objects.filter(
                tenant=tenant,
                irp_status='generated',
                created_at__range=[day_start, day_end]
            ).count()

            daily_failed = EInvoiceDetails.objects.filter(
                tenant=tenant,
                irp_status='failed',
                created_at__range=[day_start, day_end]
            ).count()

            daily_qr_codes = QRCodePayment.objects.filter(
                tenant=tenant,
                created_at__range=[day_start, day_end]
            ).count()

            trends.append({
                'date': current_date.isoformat(),
                'generated': daily_generated,
                'failed': daily_failed,
                'qr_codes': daily_qr_codes
            })

            current_date += timedelta(days=1)

        return trends


class EInvoiceMonitoringService:
    """
    Main service for e-Invoice monitoring and tracking
    """

    def __init__(self):
        self.status_tracker = EInvoiceStatusTracker()
        self.analytics = EInvoiceAnalytics()

    def get_monitoring_dashboard(self, tenant: Tenant) -> Dict[str, Any]:
        """Get comprehensive monitoring dashboard data"""
        try:
            # Get alerts
            alerts = self.status_tracker.get_real_time_alerts(tenant)

            # Get analytics
            analytics = self.analytics.get_dashboard_metrics(tenant)

            # Get recent activity (last 10 e-Invoices)
            recent_einvoices = EInvoiceDetails.objects.filter(
                tenant=tenant
            ).order_by('-created_at')[:10]

            recent_activity = []
            for detail in recent_einvoices:
                recent_activity.append({
                    'invoice_number': detail.invoice.number,
                    'irn': detail.irn,
                    'status': detail.irp_status,
                    'created_at': detail.created_at.isoformat(),
                    'ack_date': detail.ack_date.isoformat() if detail.ack_date else None
                })

            return {
                'success': True,
                'alerts': alerts,
                'analytics': analytics,
                'recent_activity': recent_activity,
                'dashboard_updated_at': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Monitoring dashboard generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }