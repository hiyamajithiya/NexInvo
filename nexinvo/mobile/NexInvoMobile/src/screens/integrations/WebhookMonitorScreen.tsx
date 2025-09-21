import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { webhookService, WebhookEndpoint, WebhookLog, WebhookStats, WEBHOOK_EVENTS } from '../../services/webhookService';
import { Button, Card, Input } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

export default function WebhookMonitorScreen() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<{ [key: string]: WebhookLog[] }>({});
  const [stats, setStats] = useState<WebhookStats>({
    totalEndpoints: 0,
    activeEndpoints: 0,
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    averageResponseTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Form state for creating/editing webhooks
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    method: 'POST' as 'POST' | 'PUT' | 'PATCH',
    events: [] as string[],
    secret: '',
    maxRetries: 3,
    retryDelay: 5000,
    isActive: true,
    headers: {} as Record<string, string>,
  });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [webhooksData, statsData] = await Promise.all([
        webhookService.getWebhooks(),
        webhookService.getWebhookStats(),
      ]);

      setWebhooks(webhooksData);
      setStats(statsData);

      // Load recent logs for each webhook
      const logsPromises = webhooksData.map(async (webhook) => {
        const { logs } = await webhookService.getWebhookLogs(webhook.id, { limit: 10 });
        return { webhookId: webhook.id, logs };
      });

      const logsResults = await Promise.all(logsPromises);
      const logsMap = logsResults.reduce((acc, { webhookId, logs }) => {
        acc[webhookId] = logs;
        return acc;
      }, {} as { [key: string]: WebhookLog[] });

      setWebhookLogs(logsMap);
    } catch (error) {
      console.error('Failed to load webhook data:', error);
      Alert.alert('Error', 'Failed to load webhook data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateWebhook = async () => {
    try {
      if (!webhookForm.name.trim() || !webhookForm.url.trim()) {
        Alert.alert('Validation Error', 'Name and URL are required');
        return;
      }

      // Validate URL
      const validation = await webhookService.validateWebhookUrl(webhookForm.url);
      if (!validation.isValid) {
        Alert.alert('Invalid URL', validation.error || 'The provided URL is not valid');
        return;
      }

      if (!validation.isReachable) {
        Alert.alert(
          'URL Not Reachable',
          'The webhook URL is not reachable. Do you want to continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => proceedWithCreation() }
          ]
        );
        return;
      }

      await proceedWithCreation();
    } catch (error) {
      console.error('Failed to create webhook:', error);
      Alert.alert('Error', 'Failed to create webhook');
    }
  };

  const proceedWithCreation = async () => {
    try {
      const result = await webhookService.createWebhook({
        name: webhookForm.name,
        url: webhookForm.url,
        method: webhookForm.method,
        headers: webhookForm.headers,
        events: webhookForm.events.map(eventName => ({
          id: eventName,
          name: eventName,
          description: '',
          payload: { event: eventName, data: {}, timestamp: new Date(), version: '1.0' }
        })),
        isActive: webhookForm.isActive,
        secret: webhookForm.secret || undefined,
        retryPolicy: {
          maxRetries: webhookForm.maxRetries,
          retryDelay: webhookForm.retryDelay,
          backoffMultiplier: 2,
        },
      });

      if (result.success) {
        Alert.alert('Success', 'Webhook created successfully');
        setShowCreateModal(false);
        resetForm();
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to create webhook');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create webhook');
    }
  };

  const handleTestWebhook = async (webhook: WebhookEndpoint) => {
    try {
      const result = await webhookService.testWebhook(webhook.id);

      if (result.success) {
        Alert.alert(
          'Test Successful',
          `Webhook responded with status ${result.status} in ${result.responseTime}ms`
        );
      } else {
        Alert.alert('Test Failed', result.error || 'Test failed');
      }
    } catch (error) {
      Alert.alert('Test Failed', 'Failed to test webhook');
    }
  };

  const handleToggleWebhook = async (webhook: WebhookEndpoint) => {
    try {
      const result = await webhookService.updateWebhook(webhook.id, {
        isActive: !webhook.isActive,
      });

      if (result.success) {
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to update webhook');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update webhook');
    }
  };

  const handleDeleteWebhook = (webhook: WebhookEndpoint) => {
    Alert.alert(
      'Delete Webhook',
      `Are you sure you want to delete "${webhook.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await webhookService.deleteWebhook(webhook.id);
            if (success) {
              loadData();
            } else {
              Alert.alert('Error', 'Failed to delete webhook');
            }
          }
        }
      ]
    );
  };

  const handleRetryFailedDelivery = async (log: WebhookLog) => {
    try {
      const result = await webhookService.retryFailedDelivery(log.id);
      if (result.success) {
        Alert.alert('Success', 'Delivery retried successfully');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to retry delivery');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to retry delivery');
    }
  };

  const resetForm = () => {
    setWebhookForm({
      name: '',
      url: '',
      method: 'POST',
      events: [],
      secret: '',
      maxRetries: 3,
      retryDelay: 5000,
      isActive: true,
      headers: {},
    });
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (success: boolean): string => {
    return success ? colors.success : colors.error;
  };

  const renderStatsCard = () => (
    <Card style={styles.statsCard} variant="elevated">
      <Text style={styles.statsTitle}>Webhook Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalEndpoints}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {stats.activeEndpoints}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalDeliveries}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {stats.successfulDeliveries}
          </Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.error }]}>
            {stats.failedDeliveries}
          </Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatDuration(stats.averageResponseTime)}
          </Text>
          <Text style={styles.statLabel}>Avg Time</Text>
        </View>
      </View>
    </Card>
  );

  const renderWebhookCard = (webhook: WebhookEndpoint) => {
    const logs = webhookLogs[webhook.id] || [];
    const isExpanded = expandedCard === webhook.id;
    const recentLogs = logs.slice(0, 3);

    return (
      <Card key={webhook.id} style={styles.webhookCard} variant="elevated">
        <TouchableOpacity
          onPress={() => setExpandedCard(isExpanded ? null : webhook.id)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.webhookInfo}>
              <Text style={styles.webhookName}>{webhook.name}</Text>
              <Text style={styles.webhookUrl} numberOfLines={1}>
                {webhook.url}
              </Text>
              <Text style={styles.webhookEvents}>
                Events: {webhook.events.length} configured
              </Text>
            </View>
            <View style={styles.webhookStatus}>
              <Switch
                value={webhook.isActive}
                onValueChange={() => handleToggleWebhook(webhook)}
                trackColor={{ false: colors.gray300, true: colors.success }}
                thumbColor={webhook.isActive ? colors.white : colors.gray100}
              />
              <Text style={[
                styles.statusText,
                { color: webhook.isActive ? colors.success : colors.gray500 }
              ]}>
                {webhook.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.webhookDetails}>
              <Text style={styles.detailLabel}>Method:</Text>
              <Text style={styles.detailValue}>{webhook.method}</Text>
            </View>

            <View style={styles.webhookDetails}>
              <Text style={styles.detailLabel}>Retry Policy:</Text>
              <Text style={styles.detailValue}>
                {webhook.retryPolicy.maxRetries} retries, {webhook.retryPolicy.retryDelay}ms delay
              </Text>
            </View>

            <View style={styles.webhookDetails}>
              <Text style={styles.detailLabel}>Last Triggered:</Text>
              <Text style={styles.detailValue}>
                {webhook.lastTriggered ? webhook.lastTriggered.toLocaleString() : 'Never'}
              </Text>
            </View>

            {recentLogs.length > 0 && (
              <View style={styles.recentLogs}>
                <Text style={styles.logsTitle}>Recent Deliveries</Text>
                {recentLogs.map((log) => (
                  <View key={log.id} style={styles.logItem}>
                    <View style={[
                      styles.logStatus,
                      { backgroundColor: getStatusColor(log.success) }
                    ]} />
                    <View style={styles.logDetails}>
                      <Text style={styles.logEvent}>{log.event}</Text>
                      <Text style={styles.logTimestamp}>
                        {log.timestamp.toLocaleString()} • {formatDuration(log.duration)}
                      </Text>
                    </View>
                    <Text style={[
                      styles.logStatusCode,
                      { color: getStatusColor(log.success) }
                    ]}>
                      {log.responseStatus}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.testButton]}
                onPress={() => handleTestWebhook(webhook)}
                disabled={!webhook.isActive}
              >
                <Text style={styles.actionButtonText}>Test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.logsButton]}
                onPress={() => {
                  setSelectedWebhook(webhook);
                  setShowLogsModal(true);
                }}
              >
                <Text style={styles.actionButtonText}>View Logs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeleteWebhook(webhook)}
              >
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Webhook</Text>
          <TouchableOpacity onPress={() => {
            setShowCreateModal(false);
            resetForm();
          }}>
            <Text style={styles.modalCloseButton}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Input
            label="Webhook Name"
            placeholder="e.g., Slack Notifications"
            value={webhookForm.name}
            onChangeText={(text) => setWebhookForm({ ...webhookForm, name: text })}
          />

          <Input
            label="Webhook URL"
            placeholder="https://hooks.slack.com/services/..."
            value={webhookForm.url}
            onChangeText={(text) => setWebhookForm({ ...webhookForm, url: text })}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>HTTP Method</Text>
            <View style={styles.methodButtons}>
              {(['POST', 'PUT', 'PATCH'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.methodButton,
                    webhookForm.method === method && styles.methodButtonActive
                  ]}
                  onPress={() => setWebhookForm({ ...webhookForm, method })}
                >
                  <Text style={[
                    styles.methodButtonText,
                    webhookForm.method === method && styles.methodButtonTextActive
                  ]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Events to Monitor</Text>
            {Object.values(WEBHOOK_EVENTS).map((event) => (
              <TouchableOpacity
                key={event}
                style={styles.eventItem}
                onPress={() => {
                  const newEvents = webhookForm.events.includes(event)
                    ? webhookForm.events.filter(e => e !== event)
                    : [...webhookForm.events, event];
                  setWebhookForm({ ...webhookForm, events: newEvents });
                }}
              >
                <View style={[
                  styles.checkbox,
                  webhookForm.events.includes(event) && styles.checkboxChecked
                ]}>
                  {webhookForm.events.includes(event) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.eventName}>{event}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Secret Key (Optional)"
            placeholder="For webhook signature verification"
            value={webhookForm.secret}
            onChangeText={(text) => setWebhookForm({ ...webhookForm, secret: text })}
            secureTextEntry
            showPasswordToggle
          />

          <View style={styles.formGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.formLabel}>Active</Text>
              <Switch
                value={webhookForm.isActive}
                onValueChange={(value) => setWebhookForm({ ...webhookForm, isActive: value })}
                trackColor={{ false: colors.gray300, true: colors.success }}
                thumbColor={webhookForm.isActive ? colors.white : colors.gray100}
              />
            </View>
          </View>

          <Button
            title="Create Webhook"
            onPress={handleCreateWebhook}
            style={styles.createButton}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading webhooks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Webhook Monitor</Text>
          <Text style={styles.subtitle}>
            Monitor and manage your webhook endpoints
          </Text>
        </View>

        {renderStatsCard()}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Webhook Endpoints</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {webhooks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Webhooks Configured</Text>
              <Text style={styles.emptySubtitle}>
                Create your first webhook to start receiving notifications
              </Text>
            </View>
          ) : (
            webhooks.map(webhook => renderWebhookCard(webhook))
          )}
        </View>
      </ScrollView>

      {renderCreateModal()}
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
  statsCard: {
    margin: spacing.lg,
  },
  statsTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.white,
  },
  webhookCard: {
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  webhookInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  webhookName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  webhookUrl: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  webhookEvents: {
    fontSize: typography.fontSizes.sm,
    color: colors.info,
  },
  webhookStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    marginTop: spacing.xs,
  },
  expandedContent: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  webhookDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  recentLogs: {
    marginTop: spacing.lg,
  },
  logsTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  logDetails: {
    flex: 1,
  },
  logEvent: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  logTimestamp: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  logStatusCode: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: colors.info,
  },
  logsButton: {
    backgroundColor: colors.warning,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.lg,
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
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  methodButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  methodButtonTextActive: {
    color: colors.white,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  eventName: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createButton: {
    marginTop: spacing.xl,
  },
});