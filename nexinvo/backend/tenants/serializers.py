from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Tenant, TenantMembership, Client, AuditLog

User = get_user_model()


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'business_type', 'aato_threshold', 'e_invoice_enabled',
            'b2c_qr_enabled', 'company_details', 'gst_settings', 'subscription_plan',
            'billing_details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_company_details(self, value):
        required_fields = ['gstin', 'address', 'city', 'state', 'pincode']
        for field in required_fields:
            if field not in value:
                raise serializers.ValidationError(f"Missing required field: {field}")

        # Validate GSTIN format (15 characters)
        gstin = value.get('gstin', '')
        if gstin and len(gstin) != 15:
            raise serializers.ValidationError("GSTIN must be exactly 15 characters")

        return value

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        with transaction.atomic():
            tenant = super().create(validated_data)

            # Create owner membership for the user
            TenantMembership.objects.create(
                user=user,
                tenant=tenant,
                role='ca_owner' if user.is_ca_user else 'admin',
                invited_by=user,
                is_active=True
            )

            return tenant


class TenantMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    invited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TenantMembership
        fields = [
            'id', 'user', 'user_email', 'user_name', 'tenant', 'role',
            'permissions', 'joined_at', 'invited_by', 'invited_by_name',
            'is_active'
        ]
        read_only_fields = ['id', 'joined_at', 'user_email', 'user_name', 'invited_by_name']

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

    def get_invited_by_name(self, obj):
        if obj.invited_by:
            return f"{obj.invited_by.first_name} {obj.invited_by.last_name}".strip()
        return None


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            'id', 'tenant', 'name', 'client_code', 'client_type', 'gstin', 'pan',
            'email', 'phone', 'billing_address', 'shipping_address', 'state_code',
            'pos_default', 'credit_terms_days', 'bank_details', 'contact_persons',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

    def validate_gstin(self, value):
        if value and len(value) != 15:
            raise serializers.ValidationError("GSTIN must be exactly 15 characters")
        return value

    def validate_pan(self, value):
        if value and len(value) != 10:
            raise serializers.ValidationError("PAN must be exactly 10 characters")
        return value

    def validate_client_code(self, value):
        tenant = self.context['request'].user.tenant_memberships.first().tenant
        if self.instance:
            # Update - exclude current instance
            if Client.objects.filter(tenant=tenant, client_code=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("Client code already exists in this tenant")
        else:
            # Create - check if exists
            if Client.objects.filter(tenant=tenant, client_code=value).exists():
                raise serializers.ValidationError("Client code already exists in this tenant")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        tenant = user.tenant_memberships.first().tenant
        validated_data['tenant'] = tenant
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'tenant', 'user', 'user_name', 'entity_type', 'entity_id',
            'action', 'before_data', 'after_data', 'ip_address', 'user_agent',
            'is_financial_transaction', 'compliance_relevant', 'timestamp'
        ]
        read_only_fields = '__all__'

    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip()
        return "System"


class TenantInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=TenantMembership.ROLES)
    permissions = serializers.JSONField(default=dict)

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
            tenant = self.context['request'].user.tenant_memberships.first().tenant
            if TenantMembership.objects.filter(user=user, tenant=tenant).exists():
                raise serializers.ValidationError("User is already a member of this tenant")
        except User.DoesNotExist:
            raise serializers.ValidationError("User with this email does not exist")
        return value

    def create(self, validated_data):
        user = User.objects.get(email=validated_data['email'])
        tenant = self.context['request'].user.tenant_memberships.first().tenant
        invited_by = self.context['request'].user

        membership = TenantMembership.objects.create(
            user=user,
            tenant=tenant,
            role=validated_data['role'],
            permissions=validated_data.get('permissions', {}),
            invited_by=invited_by,
            is_active=True
        )
        return membership