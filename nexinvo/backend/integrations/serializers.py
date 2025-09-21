"""
Serializers for Integrations app
"""

from rest_framework import serializers
from .models import Integration


class IntegrationSerializer(serializers.ModelSerializer):
    """Serializer for Integration model"""

    class Meta:
        model = Integration
        fields = [
            'id', 'name', 'integration_type', 'configuration',
            'is_active', 'last_sync_at', 'sync_status', 'error_log',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_sync_at']

    def validate_configuration(self, value):
        """Validate configuration based on integration type"""
        integration_type = self.initial_data.get('integration_type')

        if integration_type == 'webhook':
            if not value.get('webhook_url'):
                raise serializers.ValidationError("webhook_url is required for webhook integrations")

        elif integration_type == 'zoho':
            # Zoho-specific validation
            pass

        elif integration_type == 'tally':
            # Tally-specific validation
            pass

        return value

    def create(self, validated_data):
        """Create integration with default configuration"""
        integration_type = validated_data.get('integration_type')

        # Set default configuration based on type
        if integration_type == 'webhook' and not validated_data.get('configuration'):
            validated_data['configuration'] = {
                'events': ['invoice.created', 'invoice.updated'],
                'platform': 'generic'
            }

        return super().create(validated_data)


class IntegrationStatusSerializer(serializers.ModelSerializer):
    """Serializer for Integration status updates"""

    class Meta:
        model = Integration
        fields = ['sync_status', 'error_log', 'last_sync_at']
        read_only_fields = ['last_sync_at']