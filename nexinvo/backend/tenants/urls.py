from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'tenants'

router = DefaultRouter()
router.register(r'tenants', views.TenantViewSet, basename='tenant')
router.register(r'clients', views.ClientViewSet, basename='client')
router.register(r'memberships', views.TenantMembershipViewSet, basename='membership')
router.register(r'audit-logs', views.AuditLogViewSet, basename='auditlog')

urlpatterns = [
    path('', include(router.urls)),
    path('me/', views.current_tenant, name='current_tenant'),
    path('setup/', views.tenant_setup, name='tenant_setup'),
]