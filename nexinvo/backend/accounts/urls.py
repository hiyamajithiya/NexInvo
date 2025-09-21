from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = 'accounts'

urlpatterns = [
    # Health check
    path('health/', views.health_check, name='health_check'),

    # Authentication
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', views.LogoutView.as_view(), name='logout'),

    # User profile
    path('profile/', views.UserProfileView.as_view(), name='profile'),
    path('me/', views.user_profile, name='me'),
    path('password/change/', views.PasswordChangeView.as_view(), name='password_change'),
    path('2fa/toggle/', views.TwoFactorToggleView.as_view(), name='2fa_toggle'),

    # Admin
    path('users/', views.UserListView.as_view(), name='user_list'),
]