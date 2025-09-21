from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'invoices'

router = DefaultRouter()
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'invoices', views.InvoiceViewSet, basename='invoice')
router.register(r'gst-rate-history', views.GSTRateHistoryViewSet, basename='gstratehistory')
router.register(r'templates', views.InvoiceTemplateViewSet, basename='template')
router.register(r'reminders', views.PaymentReminderViewSet, basename='reminder')

urlpatterns = [
    path('', include(router.urls)),
    path('calculate-gst/', views.calculate_gst, name='calculate_gst'),
    path('gst-rates-info/', views.gst_rates_info, name='gst_rates_info'),
    path('validate-gstin/', views.validate_gstin, name='validate_gstin'),
    path('get-hsn-rate/', views.get_hsn_rate, name='get_hsn_rate'),
    path('compliance-check/', views.compliance_check, name='compliance_check'),
    path('bulk-pdf/', views.bulk_pdf_generation, name='bulk_pdf_generation'),
    path('generate-qr/', views.generate_qr_code, name='generate_qr_code'),
    path('pdf-templates/', views.pdf_template_info, name='pdf_template_info'),
]