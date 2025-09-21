"""
URL patterns for Reports app
"""

from django.urls import path
from . import views

urlpatterns = [
    # GST Returns
    path('gst/generate/', views.generate_gst_return, name='generate_gst_return'),
    path('gst/returns/', views.list_gst_returns, name='list_gst_returns'),
    path('gst/returns/<uuid:return_id>/', views.get_gst_return, name='get_gst_return'),
    path('gst/returns/<uuid:return_id>/validate/', views.validate_gst_return, name='validate_gst_return'),
    path('gst/returns/<uuid:return_id>/file/', views.file_gst_return, name='file_gst_return'),
    path('gst/returns/<uuid:return_id>/download/', views.download_gst_return, name='download_gst_return'),
    path('gst/summary/<str:return_period>/', views.get_return_summary, name='get_return_summary'),
    path('gst/dashboard/', views.get_gst_dashboard, name='get_gst_dashboard'),

    # Financial Dashboard
    path('financial-dashboard/', views.get_financial_dashboard, name='get_financial_dashboard'),
    path('revenue-chart/', views.get_revenue_chart, name='get_revenue_chart'),
    path('kpi-summary/', views.get_kpi_summary, name='get_kpi_summary'),
]