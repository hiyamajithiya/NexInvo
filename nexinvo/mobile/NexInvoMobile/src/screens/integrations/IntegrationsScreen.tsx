import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { AppDispatch, RootState } from '../../store';
import { fetchIntegrations, testConnection, exportToTally, setSyncStatus } from '../../store/slices/integrationSlice';
import { fetchInvoices } from '../../store/slices/invoiceSlice';
import { Integration } from '../../store/slices/integrationSlice';
import { integrationService } from '../../services/integrationService';
import { tallyService } from '../../services/tallyService';
import { zohoService } from '../../services/zohoService';
import { webhookService } from '../../services/webhookService';
import { Button, Card, Input } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface IntegrationConfig {
  [key: string]: any;
}

const INTEGRATION_ICONS = {
  tally: '📊',
  zoho: '☁️',
  dynamics365: '💼',
  webhook: '🔗',
};

const INTEGRATION_COLORS = {
  tally: '#FFB900',
  zoho: '#E44C2C',
  dynamics365: '#0078D4',
  webhook: '#6B7280',
};

export default function IntegrationsScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { integrations, isLoading, syncStatus } = useSelector((state: RootState) => state.integrations);
  const { invoices } = useSelector((state: RootState) => state.invoices);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configForm, setConfigForm] = useState<IntegrationConfig>({});
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showTallyExport, setShowTallyExport] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadIntegrations();
      dispatch(fetchInvoices());
    }, [])
  );

  const loadIntegrations = async () => {
    try {
      await dispatch(fetchIntegrations()).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load integrations');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadIntegrations();
    setRefreshing(false);
  };

  const handleToggleIntegration = async (integration: Integration) => {
    try {
      const newStatus = !integration.is_active;
      await integrationService.toggleIntegration(integration.id, newStatus);

      Alert.alert(
        'Success',
        `${integration.name} has been ${newStatus ? 'enabled' : 'disabled'}`
      );

      loadIntegrations();
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle integration');
    }
  };

  const handleTestConnection = async (integration: Integration) => {
    setIsTesting(integration.id);

    try {
      const result = await dispatch(testConnection(integration.id)).unwrap();

      Alert.alert(
        result.result.success ? 'Success' : 'Failed',
        result.result.message
      );
    } catch (error) {
      Alert.alert('Connection Test Failed', 'Unable to test connection');
    } finally {
      setIsTesting(null);
    }
  };

  const handleConfigureIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConfigForm(integration.configuration || {});
    setShowConfigModal(true);
  };

  const handleSaveConfiguration = async () => {
    if (!selectedIntegration) return;

    try {
      await integrationService.updateIntegration(selectedIntegration.id, configForm);

      Alert.alert('Success', 'Configuration updated successfully');
      setShowConfigModal(false);
      loadIntegrations();
    } catch (error) {
      Alert.alert('Error', 'Failed to update configuration');
    }
  };

  const handleTallyExport = async () => {
    if (selectedInvoices.length === 0) {
      Alert.alert('No Selection', 'Please select invoices to export');
      return;
    }

    setIsSyncing('tally');

    try {
      // Validate selected invoices
      const selectedInvoiceData = invoices.filter(inv => selectedInvoices.includes(inv.id));
      const validation = await tallyService.validateData(selectedInvoiceData);

      if (!validation.isValid) {
        Alert.alert(
          'Validation Failed',
          `Please fix the following errors:\n${validation.errors.join('\n')}`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        Alert.alert(
          'Warnings',
          `Please note:\n${validation.warnings.join('\n')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => proceedWithExport() }
          ]
        );
      } else {
        await proceedWithExport();
      }
    } catch (error) {
      Alert.alert('Export Failed', 'Failed to export invoices to Tally');
    } finally {
      setIsSyncing(null);
    }
  };

  const proceedWithExport = async () => {
    try {
      const result = await tallyService.exportToTally(selectedInvoices, {
        company: 'Default Company',
        exportFormat: 'xml',
        includeClients: true,
        includeInvoices: true,
        groupByCategory: true
      });

      if (result.success) {
        Alert.alert(
          'Export Complete',
          `Successfully exported ${result.recordCount} records to Tally.\n\nFile size: ${Math.round((result.fileSize || 0) / 1024)} KB`,
          [
            { text: 'OK' },
            result.downloadUrl && { text: 'Download', onPress: () => {} }
          ].filter(Boolean)
        );
        setShowTallyExport(false);
        setSelectedInvoices([]);
      } else {
        Alert.alert('Export Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      Alert.alert('Export Failed', 'Failed to export invoices to Tally');
    }
  };

  const handleZohoSync = async () => {
    setIsSyncing('zoho');

    try {
      // Test connection first
      const config = await zohoService.getConfiguration();
      if (!config) {
        Alert.alert('Configuration Missing', 'Please configure Zoho credentials first');
        return;
      }

      const connectionStatus = await zohoService.testConnection(config);
      if (!connectionStatus.isConnected) {
        Alert.alert('Connection Failed', connectionStatus.error || 'Unable to connect to Zoho');
        return;
      }

      // Show sync options
      Alert.alert(
        'Sync Options',
        'What would you like to sync?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sync to Zoho',
            onPress: () => syncToZoho()
          },
          {
            text: 'Sync from Zoho',
            onPress: () => syncFromZoho()
          }
        ]
      );
    } catch (error) {
      Alert.alert('Sync Failed', 'Failed to sync with Zoho');
    } finally {
      setIsSyncing(null);
    }
  };

  const syncToZoho = async () => {
    try {
      const result = await zohoService.syncToZoho({
        syncCustomers: true,
        syncInvoices: true,
        syncItems: true,
        syncPayments: true,
        overwriteExisting: false
      });

      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Successfully synced:\n• ${result.syncedCustomers} customers\n• ${result.syncedInvoices} invoices\n• ${result.syncedItems} items\n• ${result.syncedPayments} payments`
        );
      } else {
        Alert.alert(
          'Sync Completed with Errors',
          `Errors: ${result.errors.join(', ')}`
        );
      }
    } catch (error) {
      Alert.alert('Sync Failed', 'Failed to sync data to Zoho');
    }
  };

  const syncFromZoho = async () => {
    try {
      const result = await zohoService.syncFromZoho({
        syncCustomers: true,
        syncInvoices: true,
        syncItems: true
      });

      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Successfully imported:\n• ${result.syncedCustomers} customers\n• ${result.syncedInvoices} invoices\n• ${result.syncedItems} items`
        );
      } else {
        Alert.alert(
          'Sync Completed with Errors',
          `Errors: ${result.errors.join(', ')}`
        );
      }
    } catch (error) {
      Alert.alert('Sync Failed', 'Failed to sync data from Zoho');
    }
  };

  const getIntegrationStatus = (integration: Integration) => {
    if (syncStatus[integration.id]) {
      return 'syncing';
    }
    if (integration.last_sync_at) {
      const lastSync = new Date(integration.last_sync_at);
      const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

      if (hoursSinceSync < 1) {
        return 'recent';
      } else if (hoursSinceSync < 24) {
        return 'good';
      } else {
        return 'stale';
      }
    }
    return 'never';
  };

  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return 'Never synced';

    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  const renderIntegrationCard = (integration: Integration) => {
    const status = getIntegrationStatus(integration);
    const isProcessing = isTesting === integration.id || isSyncing === integration.id;

    return (
      <Card key={integration.id} style={styles.integrationCard} variant="elevated">
        <View style={styles.cardHeader}>
          <View style={styles.integrationInfo}>
            <View style={[
              styles.iconContainer,
              { backgroundColor: INTEGRATION_COLORS[integration.integration_type] + '20' }
            ]}>
              <Text style={styles.integrationIcon}>
                {INTEGRATION_ICONS[integration.integration_type]}
              </Text>
            </View>
            <View style={styles.integrationDetails}>
              <Text style={styles.integrationName}>{integration.name}</Text>
              <Text style={styles.integrationType}>
                {integration.integration_type.charAt(0).toUpperCase() + integration.integration_type.slice(1)}
              </Text>
            </View>
          </View>
          <Switch
            value={integration.is_active}
            onValueChange={() => handleToggleIntegration(integration)}
            trackColor={{ false: colors.gray300, true: colors.success }}
            thumbColor={integration.is_active ? colors.white : colors.gray100}
          />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot,
                { backgroundColor: status === 'recent' ? colors.success :
                                  status === 'good' ? colors.warning :
                                  status === 'syncing' ? colors.info :
                                  colors.gray400 }
              ]} />
              <Text style={styles.statusText}>
                {status === 'syncing' ? 'Syncing...' : formatLastSync(integration.last_sync_at)}
              </Text>
            </View>
          </View>

          {integration.sync_status && (
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncStatusText}>{integration.sync_status}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.configButton]}
            onPress={() => handleConfigureIntegration(integration)}
            disabled={isProcessing}
          >
            <Text style={styles.actionButtonText}>Configure</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.testButton]}
            onPress={() => handleTestConnection(integration)}
            disabled={!integration.is_active || isProcessing}
          >
            {isTesting === integration.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>Test</Text>
            )}
          </TouchableOpacity>

          {integration.integration_type === 'tally' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.syncButton]}
              onPress={() => setShowTallyExport(true)}
              disabled={!integration.is_active || isProcessing}
            >
              {isSyncing === 'tally' ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.actionButtonText}>Export</Text>
              )}
            </TouchableOpacity>
          )}

          {integration.integration_type === 'zoho' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.syncButton]}
              onPress={handleZohoSync}
              disabled={!integration.is_active || isProcessing}
            >
              {isSyncing === 'zoho' ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.actionButtonText}>Sync</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  const renderConfigModal = () => (
    <Modal
      visible={showConfigModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Configure {selectedIntegration?.name}
          </Text>
          <TouchableOpacity onPress={() => setShowConfigModal(false)}>
            <Text style={styles.modalCloseButton}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {selectedIntegration?.integration_type === 'tally' && (
            <>
              <Input
                label="Tally Server URL"
                placeholder="http://localhost:9000"
                value={configForm.server_url || ''}
                onChangeText={(text) => setConfigForm({ ...configForm, server_url: text })}
              />
              <Input
                label="Company Name"
                placeholder="Your Company Name"
                value={configForm.company_name || ''}
                onChangeText={(text) => setConfigForm({ ...configForm, company_name: text })}
              />
            </>
          )}

          {selectedIntegration?.integration_type === 'zoho' && (
            <>
              <Input
                label="Organization ID"
                placeholder="Your Zoho Organization ID"
                value={configForm.organization_id || ''}
                onChangeText={(text) => setConfigForm({ ...configForm, organization_id: text })}
              />
              <Input
                label="Auth Token"
                placeholder="Your Zoho Auth Token"
                value={configForm.auth_token || ''}
                onChangeText={(text) => setConfigForm({ ...configForm, auth_token: text })}
                secureTextEntry
                showPasswordToggle
              />
            </>
          )}

          {selectedIntegration?.integration_type === 'webhook' && (
            <>
              <Input
                label="Webhook URL"
                placeholder="https://your-webhook-url.com"
                value={configForm.webhook_url || ''}
                onChangeText={(text) => setConfigForm({ ...configForm, webhook_url: text })}
              />
              <Input
                label="Secret Key"
                placeholder="Your webhook secret"
                value={configForm.secret_key || ''}
                onChangeText={(text) => setConfigForm({ ...configForm, secret_key: text })}
                secureTextEntry
                showPasswordToggle
              />
            </>
          )}

          <Button
            title="Save Configuration"
            onPress={handleSaveConfiguration}
            style={styles.saveButton}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderTallyExportModal = () => (
    <Modal
      visible={showTallyExport}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Export to Tally</Text>
          <TouchableOpacity onPress={() => {
            setShowTallyExport(false);
            setSelectedInvoices([]);
          }}>
            <Text style={styles.modalCloseButton}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.exportDescription}>
            Select invoices to export to Tally Prime
          </Text>

          {invoices.map(invoice => (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceItem}
              onPress={() => {
                if (selectedInvoices.includes(invoice.id)) {
                  setSelectedInvoices(selectedInvoices.filter(id => id !== invoice.id));
                } else {
                  setSelectedInvoices([...selectedInvoices, invoice.id]);
                }
              }}
            >
              <View style={styles.checkboxContainer}>
                <View style={[
                  styles.checkbox,
                  selectedInvoices.includes(invoice.id) && styles.checkboxChecked
                ]}>
                  {selectedInvoices.includes(invoice.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
              </View>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                <Text style={styles.invoiceClient}>{invoice.client_name}</Text>
              </View>
              <Text style={styles.invoiceAmount}>
                ₹{invoice.grand_total.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.exportActions}>
            <Button
              title={`Export ${selectedInvoices.length} Invoice${selectedInvoices.length !== 1 ? 's' : ''}`}
              onPress={handleTallyExport}
              disabled={selectedInvoices.length === 0}
              style={styles.exportButton}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (isLoading && integrations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading integrations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Integrations</Text>
          <Text style={styles.subtitle}>
            Connect NexInvo with your favorite business tools
          </Text>
        </View>

        <View style={styles.content}>
          {integrations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Integrations Available</Text>
              <Text style={styles.emptySubtitle}>
                Integrations will appear here once configured
              </Text>
            </View>
          ) : (
            integrations.map(integration => renderIntegrationCard(integration))
          )}
        </View>
      </ScrollView>

      {renderConfigModal()}
      {renderTallyExportModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  integrationCard: {
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  integrationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  integrationIcon: {
    fontSize: 24,
  },
  integrationDetails: {
    flex: 1,
  },
  integrationName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  integrationType: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  cardContent: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  syncStatusRow: {
    marginTop: spacing.sm,
  },
  syncStatusText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  configButton: {
    backgroundColor: colors.gray500,
  },
  testButton: {
    backgroundColor: colors.info,
  },
  syncButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.white,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  modalCloseButton: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  saveButton: {
    marginTop: spacing.xl,
  },
  exportDescription: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  invoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkboxContainer: {
    marginRight: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontWeight: typography.fontWeights.bold,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  invoiceClient: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  invoiceAmount: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  exportActions: {
    marginTop: spacing.xl,
  },
  exportButton: {
    width: '100%',
  },
});