from rest_framework import generics, viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import models
from django.shortcuts import get_object_or_404

from .models import Tenant, TenantMembership, Client, AuditLog
from .serializers import (
    TenantSerializer,
    TenantMembershipSerializer,
    ClientSerializer,
    AuditLogSerializer,
    TenantInviteSerializer
)


class TenantViewSet(viewsets.ModelViewSet):
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Users can only see tenants they are members of
        tenant_ids = user.tenant_memberships.values_list('tenant_id', flat=True)
        return Tenant.objects.filter(id__in=tenant_ids)

    def get_permissions(self):
        if self.action in ['create']:
            # Anyone can create a tenant
            return [permissions.IsAuthenticated()]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Only owners/admins can modify
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def check_tenant_permission(self, tenant, required_roles=['ca_owner', 'admin']):
        membership = TenantMembership.objects.filter(
            user=self.request.user,
            tenant=tenant,
            is_active=True,
            role__in=required_roles
        ).first()
        if not membership:
            return False
        return True

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self.check_tenant_permission(instance):
            return Response(
                {'error': 'You do not have permission to modify this tenant'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self.check_tenant_permission(instance, ['ca_owner']):
            return Response(
                {'error': 'Only tenant owners can delete tenants'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def invite_member(self, request, pk=None):
        tenant = self.get_object()
        if not self.check_tenant_permission(tenant):
            return Response(
                {'error': 'You do not have permission to invite members'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = TenantInviteSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            membership = serializer.save()
            return Response(
                TenantMembershipSerializer(membership).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        tenant = self.get_object()
        memberships = TenantMembership.objects.filter(tenant=tenant, is_active=True)
        serializer = TenantMembershipSerializer(memberships, many=True)
        return Response(serializer.data)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['client_type', 'state_code']
    search_fields = ['name', 'client_code', 'email', 'gstin']
    ordering_fields = ['name', 'client_code', 'created_at']

    def get_queryset(self):
        user = self.request.user
        # Users can only see clients from their tenant
        tenant_ids = user.tenant_memberships.filter(is_active=True).values_list('tenant_id', flat=True)
        return Client.objects.filter(tenant_id__in=tenant_ids)

    def check_client_permission(self, client=None, action='view'):
        user = self.request.user
        if client:
            tenant = client.tenant
        else:
            # For create actions, get tenant from user's membership
            membership = user.tenant_memberships.filter(is_active=True).first()
            if not membership:
                return False
            tenant = membership.tenant

        membership = TenantMembership.objects.filter(
            user=user,
            tenant=tenant,
            is_active=True
        ).first()

        if not membership:
            return False

        if action in ['create', 'update', 'delete']:
            return membership.role in ['ca_owner', 'admin', 'finance_user']
        return True  # Everyone can view

    def create(self, request, *args, **kwargs):
        if not self.check_client_permission(action='create'):
            return Response(
                {'error': 'You do not have permission to create clients'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self.check_client_permission(instance, 'update'):
            return Response(
                {'error': 'You do not have permission to update this client'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self.check_client_permission(instance, 'delete'):
            return Response(
                {'error': 'You do not have permission to delete this client'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class TenantMembershipViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TenantMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Users can only see memberships from their tenants
        tenant_ids = user.tenant_memberships.filter(is_active=True).values_list('tenant_id', flat=True)
        return TenantMembership.objects.filter(tenant_id__in=tenant_ids, is_active=True)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        membership = self.get_object()
        user = request.user

        # Check if user has permission to deactivate this membership
        user_membership = TenantMembership.objects.filter(
            user=user,
            tenant=membership.tenant,
            is_active=True,
            role__in=['ca_owner', 'admin']
        ).first()

        if not user_membership:
            return Response(
                {'error': 'You do not have permission to deactivate this membership'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Prevent deactivating the last owner
        if membership.role == 'ca_owner':
            owner_count = TenantMembership.objects.filter(
                tenant=membership.tenant,
                role='ca_owner',
                is_active=True
            ).count()
            if owner_count <= 1:
                return Response(
                    {'error': 'Cannot deactivate the last owner of the tenant'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        membership.is_active = False
        membership.save()

        return Response({'message': 'Membership deactivated successfully'})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['entity_type', 'action', 'is_financial_transaction', 'compliance_relevant']
    search_fields = ['entity_type', 'entity_id', 'action']
    ordering = ['-timestamp']

    def get_queryset(self):
        user = self.request.user
        # Users can only see audit logs from their tenants
        tenant_ids = user.tenant_memberships.filter(is_active=True).values_list('tenant_id', flat=True)
        return AuditLog.objects.filter(tenant_id__in=tenant_ids)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_tenant(request):
    """Get current user's primary tenant"""
    membership = request.user.tenant_memberships.filter(is_active=True).first()
    if not membership:
        return Response(
            {'error': 'User is not a member of any tenant'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = TenantSerializer(membership.tenant)
    return Response({
        'tenant': serializer.data,
        'membership': TenantMembershipSerializer(membership).data
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def tenant_setup(request):
    """Setup a new tenant for the user"""
    user = request.user

    # Check if user already has an active tenant
    if user.tenant_memberships.filter(is_active=True).exists():
        return Response(
            {'error': 'User already belongs to a tenant'},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = TenantSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        tenant = serializer.save()
        membership = TenantMembership.objects.get(user=user, tenant=tenant)

        return Response({
            'tenant': TenantSerializer(tenant).data,
            'membership': TenantMembershipSerializer(membership).data,
            'message': 'Tenant setup completed successfully'
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)