"""
Financial Dashboard Analytics Service for NexInvo
Provides comprehensive financial metrics, KPIs, and chart data
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
from calendar import monthrange
import pandas as pd
from django.utils import timezone
from django.db.models import Sum, Avg, Count, Q, F, Case, When, DecimalField, Min
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek

from invoices.models import Invoice, InvoiceLine
from tenants.models import Tenant, Client

logger = logging.getLogger(__name__)


class FinancialKPICalculator:
    """
    Calculator for financial Key Performance Indicators
    """

    def __init__(self, tenant: Tenant):
        self.tenant = tenant

    def calculate_revenue_metrics(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate revenue-related KPIs"""
        try:
            # Get invoices for the period
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date]
            )

            # Calculate previous period for comparison
            period_length = (end_date - start_date).days
            prev_start = start_date - timedelta(days=period_length)
            prev_end = start_date

            prev_invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[prev_start, prev_end]
            )

            # Current period metrics
            total_revenue = invoices.aggregate(
                revenue=Sum('grand_total')
            )['revenue'] or Decimal('0')

            paid_revenue = invoices.filter(status='paid').aggregate(
                revenue=Sum('grand_total')
            )['revenue'] or Decimal('0')

            outstanding_revenue = invoices.exclude(status='paid').aggregate(
                revenue=Sum('grand_total')
            )['revenue'] or Decimal('0')

            invoice_count = invoices.count()
            avg_invoice_value = invoices.aggregate(
                avg=Avg('grand_total')
            )['avg'] or Decimal('0')

            # Previous period metrics
            prev_total_revenue = prev_invoices.aggregate(
                revenue=Sum('grand_total')
            )['revenue'] or Decimal('0')

            prev_invoice_count = prev_invoices.count()

            # Calculate growth rates
            revenue_growth = self._calculate_growth_rate(prev_total_revenue, total_revenue)
            invoice_growth = self._calculate_growth_rate(prev_invoice_count, invoice_count)

            # Collection efficiency
            collection_efficiency = (paid_revenue / total_revenue * 100) if total_revenue > 0 else 0

            return {
                'total_revenue': float(total_revenue),
                'paid_revenue': float(paid_revenue),
                'outstanding_revenue': float(outstanding_revenue),
                'invoice_count': invoice_count,
                'avg_invoice_value': float(avg_invoice_value),
                'revenue_growth_rate': revenue_growth,
                'invoice_growth_rate': invoice_growth,
                'collection_efficiency': float(collection_efficiency),
                'previous_period': {
                    'total_revenue': float(prev_total_revenue),
                    'invoice_count': prev_invoice_count
                }
            }

        except Exception as e:
            logger.error(f"Revenue metrics calculation failed: {str(e)}")
            return self._get_empty_revenue_metrics()

    def calculate_tax_metrics(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate tax-related KPIs"""
        try:
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date]
            )

            # Tax collection summary
            tax_summary = invoices.aggregate(
                total_cgst=Sum('cgst_amount'),
                total_sgst=Sum('sgst_amount'),
                total_igst=Sum('igst_amount'),
                total_cess=Sum('cess_amount'),
                total_taxable=Sum('taxable_amount')
            )

            total_tax = (
                (tax_summary['total_cgst'] or 0) +
                (tax_summary['total_sgst'] or 0) +
                (tax_summary['total_igst'] or 0) +
                (tax_summary['total_cess'] or 0)
            )

            total_taxable = tax_summary['total_taxable'] or 0

            # Effective tax rate
            effective_tax_rate = (total_tax / total_taxable * 100) if total_taxable > 0 else 0

            # Tax breakdown by type
            intra_state_tax = (tax_summary['total_cgst'] or 0) + (tax_summary['total_sgst'] or 0)
            inter_state_tax = tax_summary['total_igst'] or 0

            # Tax by invoice type
            b2b_tax = invoices.filter(client__client_type='b2b').aggregate(
                tax=Sum(F('cgst_amount') + F('sgst_amount') + F('igst_amount'))
            )['tax'] or 0

            b2c_tax = invoices.filter(client__client_type='b2c').aggregate(
                tax=Sum(F('cgst_amount') + F('sgst_amount') + F('igst_amount'))
            )['tax'] or 0

            return {
                'total_tax_collected': float(total_tax),
                'total_taxable_amount': float(total_taxable),
                'effective_tax_rate': float(effective_tax_rate),
                'tax_breakdown': {
                    'cgst': float(tax_summary['total_cgst'] or 0),
                    'sgst': float(tax_summary['total_sgst'] or 0),
                    'igst': float(tax_summary['total_igst'] or 0),
                    'cess': float(tax_summary['total_cess'] or 0)
                },
                'tax_by_jurisdiction': {
                    'intra_state': float(intra_state_tax),
                    'inter_state': float(inter_state_tax)
                },
                'tax_by_customer_type': {
                    'b2b': float(b2b_tax),
                    'b2c': float(b2c_tax)
                }
            }

        except Exception as e:
            logger.error(f"Tax metrics calculation failed: {str(e)}")
            return self._get_empty_tax_metrics()

    def calculate_client_metrics(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate client-related KPIs"""
        try:
            # Active clients (clients with invoices in period)
            active_clients = Client.objects.filter(
                tenant=self.tenant,
                invoices__date__range=[start_date, end_date]
            ).distinct().count()

            # New clients (first invoice in period)
            new_clients = Client.objects.filter(
                tenant=self.tenant,
                invoices__date__range=[start_date, end_date]
            ).annotate(
                first_invoice_date=Min('invoices__date')
            ).filter(
                first_invoice_date__range=[start_date, end_date]
            ).count()

            # Top clients by revenue
            top_clients = Client.objects.filter(
                tenant=self.tenant,
                invoices__date__range=[start_date, end_date]
            ).annotate(
                total_revenue=Sum('invoices__grand_total'),
                invoice_count=Count('invoices')
            ).order_by('-total_revenue')[:10]

            top_clients_data = []
            for client in top_clients:
                top_clients_data.append({
                    'id': str(client.id),
                    'name': client.name,
                    'total_revenue': float(client.total_revenue or 0),
                    'invoice_count': client.invoice_count,
                    'avg_invoice_value': float((client.total_revenue or 0) / client.invoice_count) if client.invoice_count > 0 else 0
                })

            # Client distribution by type
            client_distribution = Client.objects.filter(
                tenant=self.tenant,
                invoices__date__range=[start_date, end_date]
            ).values('client_type').annotate(
                count=Count('id', distinct=True),
                revenue=Sum('invoices__grand_total')
            )

            # Average revenue per client
            total_revenue = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date]
            ).aggregate(Sum('grand_total'))['grand_total__sum'] or 0

            avg_revenue_per_client = (total_revenue / active_clients) if active_clients > 0 else 0

            return {
                'active_clients': active_clients,
                'new_clients': new_clients,
                'avg_revenue_per_client': float(avg_revenue_per_client),
                'top_clients': top_clients_data,
                'client_distribution': list(client_distribution)
            }

        except Exception as e:
            logger.error(f"Client metrics calculation failed: {str(e)}")
            return self._get_empty_client_metrics()

    def calculate_payment_metrics(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate payment and collection KPIs"""
        try:
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date]
            )

            # Payment status distribution
            payment_status = invoices.values('status').annotate(
                count=Count('id'),
                amount=Sum('grand_total')
            )

            # Overdue analysis
            current_date = timezone.now().date()
            overdue_invoices = invoices.filter(
                due_date__lt=current_date,
                status__in=['sent', 'viewed']
            )

            total_overdue = overdue_invoices.aggregate(
                amount=Sum('grand_total')
            )['amount'] or 0

            # Aging analysis (30, 60, 90+ days)
            aging_30 = overdue_invoices.filter(
                due_date__gte=current_date - timedelta(days=30)
            ).aggregate(Sum('grand_total'))['grand_total__sum'] or 0

            aging_60 = overdue_invoices.filter(
                due_date__gte=current_date - timedelta(days=60),
                due_date__lt=current_date - timedelta(days=30)
            ).aggregate(Sum('grand_total'))['grand_total__sum'] or 0

            aging_90_plus = overdue_invoices.filter(
                due_date__lt=current_date - timedelta(days=60)
            ).aggregate(Sum('grand_total'))['grand_total__sum'] or 0

            # Average payment time (for paid invoices)
            paid_invoices = invoices.filter(status='paid')
            avg_payment_days = 0

            if paid_invoices.exists():
                payment_times = []
                for invoice in paid_invoices:
                    if invoice.due_date:
                        # Assume payment on update date (in real system, track actual payment date)
                        payment_days = (invoice.updated_at.date() - invoice.date).days
                        payment_times.append(payment_days)

                avg_payment_days = sum(payment_times) / len(payment_times) if payment_times else 0

            return {
                'payment_status_distribution': list(payment_status),
                'total_overdue_amount': float(total_overdue),
                'overdue_invoice_count': overdue_invoices.count(),
                'aging_analysis': {
                    '0_30_days': float(aging_30),
                    '30_60_days': float(aging_60),
                    '60_plus_days': float(aging_90_plus)
                },
                'average_payment_days': round(avg_payment_days, 1)
            }

        except Exception as e:
            logger.error(f"Payment metrics calculation failed: {str(e)}")
            return self._get_empty_payment_metrics()

    def _calculate_growth_rate(self, previous_value: Decimal, current_value: Decimal) -> float:
        """Calculate growth rate percentage"""
        if previous_value == 0:
            return 100.0 if current_value > 0 else 0.0

        return float((current_value - previous_value) / previous_value * 100)

    def _get_empty_revenue_metrics(self) -> Dict[str, Any]:
        """Return empty revenue metrics structure"""
        return {
            'total_revenue': 0.0,
            'paid_revenue': 0.0,
            'outstanding_revenue': 0.0,
            'invoice_count': 0,
            'avg_invoice_value': 0.0,
            'revenue_growth_rate': 0.0,
            'invoice_growth_rate': 0.0,
            'collection_efficiency': 0.0,
            'previous_period': {
                'total_revenue': 0.0,
                'invoice_count': 0
            }
        }

    def _get_empty_tax_metrics(self) -> Dict[str, Any]:
        """Return empty tax metrics structure"""
        return {
            'total_tax_collected': 0.0,
            'total_taxable_amount': 0.0,
            'effective_tax_rate': 0.0,
            'tax_breakdown': {
                'cgst': 0.0,
                'sgst': 0.0,
                'igst': 0.0,
                'cess': 0.0
            },
            'tax_by_jurisdiction': {
                'intra_state': 0.0,
                'inter_state': 0.0
            },
            'tax_by_customer_type': {
                'b2b': 0.0,
                'b2c': 0.0
            }
        }

    def _get_empty_client_metrics(self) -> Dict[str, Any]:
        """Return empty client metrics structure"""
        return {
            'active_clients': 0,
            'new_clients': 0,
            'avg_revenue_per_client': 0.0,
            'top_clients': [],
            'client_distribution': []
        }

    def _get_empty_payment_metrics(self) -> Dict[str, Any]:
        """Return empty payment metrics structure"""
        return {
            'payment_status_distribution': [],
            'total_overdue_amount': 0.0,
            'overdue_invoice_count': 0,
            'aging_analysis': {
                '0_30_days': 0.0,
                '30_60_days': 0.0,
                '60_plus_days': 0.0
            },
            'average_payment_days': 0.0
        }


class ChartDataGenerator:
    """
    Generator for chart data for various visualizations
    """

    def __init__(self, tenant: Tenant):
        self.tenant = tenant

    def generate_revenue_trend_chart(self, start_date: datetime, end_date: datetime, period: str = 'daily') -> Dict[str, Any]:
        """Generate revenue trend chart data"""
        try:
            invoices = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date]
            )

            if period == 'daily':
                trend_data = invoices.annotate(
                    period_date=TruncDate('date')
                ).values('period_date').annotate(
                    revenue=Sum('grand_total'),
                    count=Count('id')
                ).order_by('period_date')

            elif period == 'weekly':
                trend_data = invoices.annotate(
                    period_date=TruncWeek('date')
                ).values('period_date').annotate(
                    revenue=Sum('grand_total'),
                    count=Count('id')
                ).order_by('period_date')

            elif period == 'monthly':
                trend_data = invoices.annotate(
                    period_date=TruncMonth('date')
                ).values('period_date').annotate(
                    revenue=Sum('grand_total'),
                    count=Count('id')
                ).order_by('period_date')

            # Format data for charts
            labels = []
            revenue_data = []
            count_data = []

            for entry in trend_data:
                if period == 'daily':
                    labels.append(entry['period_date'].strftime('%Y-%m-%d'))
                elif period == 'weekly':
                    labels.append(f"Week of {entry['period_date'].strftime('%Y-%m-%d')}")
                else:  # monthly
                    labels.append(entry['period_date'].strftime('%Y-%m'))

                revenue_data.append(float(entry['revenue'] or 0))
                count_data.append(entry['count'])

            return {
                'success': True,
                'chart_type': 'line',
                'title': f'Revenue Trend ({period.title()})',
                'labels': labels,
                'datasets': [
                    {
                        'label': 'Revenue',
                        'data': revenue_data,
                        'borderColor': '#3B82F6',
                        'backgroundColor': 'rgba(59, 130, 246, 0.1)',
                        'yAxisID': 'revenue'
                    },
                    {
                        'label': 'Invoice Count',
                        'data': count_data,
                        'borderColor': '#10B981',
                        'backgroundColor': 'rgba(16, 185, 129, 0.1)',
                        'yAxisID': 'count'
                    }
                ],
                'options': {
                    'scales': {
                        'revenue': {
                            'type': 'linear',
                            'display': True,
                            'position': 'left',
                            'title': {'display': True, 'text': 'Revenue (₹)'}
                        },
                        'count': {
                            'type': 'linear',
                            'display': True,
                            'position': 'right',
                            'title': {'display': True, 'text': 'Invoice Count'},
                            'grid': {'drawOnChartArea': False}
                        }
                    }
                }
            }

        except Exception as e:
            logger.error(f"Revenue trend chart generation failed: {str(e)}")
            return {'success': False, 'error': str(e)}

    def generate_tax_breakdown_chart(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Generate tax breakdown pie chart data"""
        try:
            tax_data = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date]
            ).aggregate(
                cgst=Sum('cgst_amount'),
                sgst=Sum('sgst_amount'),
                igst=Sum('igst_amount'),
                cess=Sum('cess_amount')
            )

            labels = []
            data = []
            colors = []

            if tax_data['cgst'] and tax_data['cgst'] > 0:
                labels.append('CGST')
                data.append(float(tax_data['cgst']))
                colors.append('#EF4444')

            if tax_data['sgst'] and tax_data['sgst'] > 0:
                labels.append('SGST')
                data.append(float(tax_data['sgst']))
                colors.append('#F59E0B')

            if tax_data['igst'] and tax_data['igst'] > 0:
                labels.append('IGST')
                data.append(float(tax_data['igst']))
                colors.append('#3B82F6')

            if tax_data['cess'] and tax_data['cess'] > 0:
                labels.append('CESS')
                data.append(float(tax_data['cess']))
                colors.append('#8B5CF6')

            return {
                'success': True,
                'chart_type': 'pie',
                'title': 'Tax Collection Breakdown',
                'labels': labels,
                'datasets': [{
                    'data': data,
                    'backgroundColor': colors,
                    'borderWidth': 2,
                    'borderColor': '#FFFFFF'
                }],
                'total_tax': sum(data)
            }

        except Exception as e:
            logger.error(f"Tax breakdown chart generation failed: {str(e)}")
            return {'success': False, 'error': str(e)}

    def generate_client_revenue_chart(self, start_date: datetime, end_date: datetime, limit: int = 10) -> Dict[str, Any]:
        """Generate top clients revenue bar chart"""
        try:
            top_clients = Client.objects.filter(
                tenant=self.tenant,
                invoices__date__range=[start_date, end_date]
            ).annotate(
                total_revenue=Sum('invoices__grand_total')
            ).order_by('-total_revenue')[:limit]

            labels = []
            data = []

            for client in top_clients:
                labels.append(client.name[:20] + '...' if len(client.name) > 20 else client.name)
                data.append(float(client.total_revenue or 0))

            return {
                'success': True,
                'chart_type': 'bar',
                'title': f'Top {limit} Clients by Revenue',
                'labels': labels,
                'datasets': [{
                    'label': 'Revenue',
                    'data': data,
                    'backgroundColor': '#3B82F6',
                    'borderColor': '#1D4ED8',
                    'borderWidth': 1
                }],
                'options': {
                    'scales': {
                        'y': {
                            'beginAtZero': True,
                            'title': {'display': True, 'text': 'Revenue (₹)'}
                        }
                    }
                }
            }

        except Exception as e:
            logger.error(f"Client revenue chart generation failed: {str(e)}")
            return {'success': False, 'error': str(e)}

    def generate_payment_status_chart(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Generate payment status donut chart"""
        try:
            status_data = Invoice.objects.filter(
                tenant=self.tenant,
                date__range=[start_date, end_date]
            ).values('status').annotate(
                count=Count('id'),
                amount=Sum('grand_total')
            )

            status_colors = {
                'draft': '#6B7280',
                'sent': '#F59E0B',
                'viewed': '#EF4444',
                'paid': '#10B981',
                'cancelled': '#EF4444'
            }

            status_labels = {
                'draft': 'Draft',
                'sent': 'Sent',
                'viewed': 'Viewed',
                'paid': 'Paid',
                'cancelled': 'Cancelled'
            }

            labels = []
            count_data = []
            amount_data = []
            colors = []

            for entry in status_data:
                status = entry['status']
                labels.append(status_labels.get(status, status.title()))
                count_data.append(entry['count'])
                amount_data.append(float(entry['amount'] or 0))
                colors.append(status_colors.get(status, '#6B7280'))

            return {
                'success': True,
                'chart_type': 'doughnut',
                'title': 'Invoice Status Distribution',
                'labels': labels,
                'datasets': [
                    {
                        'label': 'Count',
                        'data': count_data,
                        'backgroundColor': colors,
                        'borderWidth': 2,
                        'borderColor': '#FFFFFF'
                    }
                ],
                'amount_data': amount_data,  # Additional data for tooltips
                'total_invoices': sum(count_data),
                'total_amount': sum(amount_data)
            }

        except Exception as e:
            logger.error(f"Payment status chart generation failed: {str(e)}")
            return {'success': False, 'error': str(e)}


class FinancialDashboardService:
    """
    Main service for financial dashboard data generation
    """

    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self.kpi_calculator = FinancialKPICalculator(tenant)
        self.chart_generator = ChartDataGenerator(tenant)

    def get_dashboard_data(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get comprehensive financial dashboard data"""
        try:
            # Calculate KPIs
            revenue_metrics = self.kpi_calculator.calculate_revenue_metrics(start_date, end_date)
            tax_metrics = self.kpi_calculator.calculate_tax_metrics(start_date, end_date)
            client_metrics = self.kpi_calculator.calculate_client_metrics(start_date, end_date)
            payment_metrics = self.kpi_calculator.calculate_payment_metrics(start_date, end_date)

            # Generate chart data
            revenue_trend = self.chart_generator.generate_revenue_trend_chart(start_date, end_date, 'daily')
            tax_breakdown = self.chart_generator.generate_tax_breakdown_chart(start_date, end_date)
            client_revenue = self.chart_generator.generate_client_revenue_chart(start_date, end_date)
            payment_status = self.chart_generator.generate_payment_status_chart(start_date, end_date)

            return {
                'success': True,
                'date_range': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                },
                'kpis': {
                    'revenue': revenue_metrics,
                    'tax': tax_metrics,
                    'clients': client_metrics,
                    'payments': payment_metrics
                },
                'charts': {
                    'revenue_trend': revenue_trend,
                    'tax_breakdown': tax_breakdown,
                    'client_revenue': client_revenue,
                    'payment_status': payment_status
                },
                'generated_at': timezone.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Financial dashboard generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_message': f"Dashboard generation failed: {str(e)}"
            }