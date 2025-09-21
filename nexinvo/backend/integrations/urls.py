from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'integrations', views.IntegrationViewSet, basename='integration')

app_name = 'integrations'

urlpatterns = [
    path('', include(router.urls)),

    # Dashboard
    path('dashboard/', views.integration_dashboard, name='integration_dashboard'),

    # Tally Integration
    path('tally/export/', views.export_tally_xml, name='tally_export'),

    # Zoho Integration
    path('zoho/setup/', views.zoho_oauth_setup, name='zoho_oauth_setup'),
    path('zoho/sync/customers/', views.sync_zoho_customers, name='sync_zoho_customers'),

    # Dynamics 365 Integration
    path('dynamics365/sync/', views.sync_dynamics365, name='sync_dynamics365'),

    # Webhook System
    path('webhooks/<uuid:tenant_id>/', views.webhook_endpoint, name='webhook_endpoint'),
    path('webhooks/trigger/', views.trigger_webhook, name='trigger_webhook'),
]