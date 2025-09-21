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
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { integrationService } from '../../services/integrationService';
import { tallyService } from '../../services/tallyService';
import { zohoService } from '../../services/zohoService';
import { webhookService } from '../../services/webhookService';
import { syncService } from '../../services/syncService';
import { Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

const { width } = Dimensions.get('window');

interface IntegrationHealth {
  id: string;
  name: string;
  type: string;
  status: 'healthy' | 'warning' | 'error' | 'offline';
  lastSync: Date | null;
  nextSync: Date | null;
  errorCount: number;
  successRate: number;
  avgResponseTime: number;
  totalRequests: number;
  configuration: any;
  isActive: boolean;
}

interface SyncActivity {
  id: string;
  type: string;
  status: 'completed' | 'failed' | 'in_progress';
  recordCount: number;
  timestamp: Date;
  duration: number;
  error?: string;
}

export default function IntegrationDashboard() {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [syncActivities, setSyncActivities] = useState<SyncActivity[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalIntegrations: 0,
    activeIntegrations: 0,
    healthyIntegrations: 0,
    syncedToday: 0,
    pendingSync: 0,
    lastFullSync: null as Date | null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [selectedTimeframe])
  );

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadIntegrationHealth(),
        loadSyncActivities(),
        loadOverallStats(),
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      Alert.alert('Error', 'Failed to load integration dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const loadIntegrationHealth = async () => {
    try {
      // Load basic integration data
      const integrationsData = await integrationService.getIntegrations();

      // Enhance with health data
      const healthPromises = integrationsData.map(async (integration) => {
        let health: IntegrationHealth = {
          id: integration.id,
          name: integration.name,
          type: integration.integration_type,
          status: 'offline',
          lastSync: integration.last_sync_at ? new Date(integration.last_sync_at) : null,
          nextSync: null,
          errorCount: 0,
          successRate: 0,
          avgResponseTime: 0,
          totalRequests: 0,
          configuration: integration.configuration,
          isActive: integration.is_active,
        };

        if (!integration.is_active) {
          health.status = 'offline';
          return health;
        }

        try {
          // Test connection and get metrics based on integration type
          switch (integration.integration_type) {
            case 'tally':
              const tallyConfig = await tallyService.getConfiguration();
              if (tallyConfig) {
                const connectionStatus = await tallyService.testConnection(tallyConfig);
                health.status = connectionStatus.isConnected ? 'healthy' : 'error';
                if (!connectionStatus.isConnected) {
                  health.errorCount = 1;
                }
              }
              break;

            case 'zoho':
              const zohoConfig = await zohoService.getConfiguration();
              if (zohoConfig) {
                const connectionStatus = await zohoService.testConnection(zohoConfig);
                health.status = connectionStatus.isConnected ? 'healthy' : 'error';
                if (!connectionStatus.isConnected) {
                  health.errorCount = 1;
                }
              }
              break;

            case 'webhook':
              const webhookStats = await webhookService.getWebhookStats();
              const successRate = webhookStats.totalDeliveries > 0
                ? (webhookStats.successfulDeliveries / webhookStats.totalDeliveries) * 100
                : 100;

              health.successRate = successRate;
              health.totalRequests = webhookStats.totalDeliveries;
              health.avgResponseTime = webhookStats.averageResponseTime;
              health.errorCount = webhookStats.failedDeliveries;

              if (successRate >= 95) {
                health.status = 'healthy';
              } else if (successRate >= 80) {
                health.status = 'warning';
              } else {
                health.status = 'error';
              }
              break;

            default:
              health.status = 'healthy'; // Default for unknown types
          }

          // Calculate next sync time (example: every 4 hours)
          if (health.lastSync) {
            health.nextSync = new Date(health.lastSync.getTime() + 4 * 60 * 60 * 1000);
          }

        } catch (error) {
          console.error(`Error checking health for ${integration.name}:`, error);
          health.status = 'error';
          health.errorCount = 1;
        }

        return health;
      });

      const healthData = await Promise.all(healthPromises);
      setIntegrations(healthData);
    } catch (error) {
      console.error('Failed to load integration health:', error);
    }
  };

  const loadSyncActivities = async () => {
    try {
      // Get sync status from sync service
      const syncStatus = await syncService.getSyncStatus();

      // Mock recent sync activities (in real implementation, these would come from API)
      const activities: SyncActivity[] = [
        {
          id: '1',
          type: 'tally_export',
          status: 'completed',
          recordCount: 25,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          duration: 3500,
        },
        {
          id: '2',
          type: 'zoho_sync',
          status: 'completed',
          recordCount: 12,
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          duration: 2100,
        },
        {
          id: '3',
          type: 'webhook_delivery',
          status: 'failed',
          recordCount: 1,
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
          duration: 30000,
          error: 'Connection timeout',
        },
      ];

      // Filter by timeframe
      const cutoffTime = new Date();
      switch (selectedTimeframe) {
        case '24h':
          cutoffTime.setHours(cutoffTime.getHours() - 24);
          break;
        case '7d':
          cutoffTime.setDate(cutoffTime.getDate() - 7);
          break;
        case '30d':
          cutoffTime.setDate(cutoffTime.getDate() - 30);
          break;
      }

      const filteredActivities = activities.filter(
        activity => activity.timestamp >= cutoffTime
      );

      setSyncActivities(filteredActivities.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      ));
    } catch (error) {
      console.error('Failed to load sync activities:', error);
    }
  };

  const loadOverallStats = async () => {
    try {
      const syncStatus = await syncService.getSyncStatus();

      // Calculate stats from integration health data
      const stats = {
        totalIntegrations: integrations.length,
        activeIntegrations: integrations.filter(i => i.isActive).length,
        healthyIntegrations: integrations.filter(i => i.status === 'healthy').length,
        syncedToday: syncActivities.filter(a =>
          a.status === 'completed' &&
          a.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        pendingSync: syncStatus.pendingItems,
        lastFullSync: syncStatus.lastSyncTime,
      };

      setOverallStats(stats);
    } catch (error) {
      console.error('Failed to load overall stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleForceSyncAll = async () => {
    Alert.alert(
      'Force Sync All',
      'This will trigger sync for all active integrations. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: async () => {
            try {
              const result = await syncService.forcSync();
              Alert.alert(
                'Sync Complete',
                `Synced ${result.syncedItems} items. ${result.failedItems} failed.`
              );
              loadDashboardData();
            } catch (error) {
              Alert.alert('Sync Failed', 'Failed to sync all integrations');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return colors.success;
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      case 'offline': return colors.gray400;
      default: return colors.gray400;
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderOverviewCards = () => (
    <View style={styles.overviewGrid}>
      <Card style={styles.overviewCard} variant="elevated">
        <Text style={styles.overviewValue}>{overallStats.totalIntegrations}</Text>
        <Text style={styles.overviewLabel}>Total</Text>
        <Text style={styles.overviewSubtext}>Integrations</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: colors.success }]}>
          {overallStats.activeIntegrations}
        </Text>
        <Text style={styles.overviewLabel}>Active</Text>
        <Text style={styles.overviewSubtext}>Running</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: colors.success }]}>
          {overallStats.healthyIntegrations}
        </Text>
        <Text style={styles.overviewLabel}>Healthy</Text>
        <Text style={styles.overviewSubtext}>Status</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: colors.info }]}>
          {overallStats.syncedToday}
        </Text>
        <Text style={styles.overviewLabel}>Synced</Text>
        <Text style={styles.overviewSubtext}>Today</Text>
      </Card>
    </View>
  );

  const renderIntegrationHealth = () => (
    <Card style={styles.sectionCard} variant="elevated">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Integration Health</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleForceSyncAll}
        >
          <Text style={styles.syncButtonText}>Sync All</Text>
        </TouchableOpacity>
      </View>

      {integrations.map((integration) => (
        <View key={integration.id} style={styles.integrationItem}>
          <View style={styles.integrationInfo}>
            <View style={styles.integrationHeader}>
              <Text style={styles.integrationName}>{integration.name}</Text>
              <View style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(integration.status) }
              ]}>
                <Text style={styles.statusText}>
                  {integration.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.integrationType}>{integration.type}</Text>

            <View style={styles.integrationMetrics}>
              {integration.successRate > 0 && (
                <Text style={styles.metricText}>
                  Success Rate: {integration.successRate.toFixed(1)}%
                </Text>
              )}

              {integration.avgResponseTime > 0 && (
                <Text style={styles.metricText}>
                  Avg Response: {formatDuration(integration.avgResponseTime)}
                </Text>
              )}

              {integration.lastSync && (
                <Text style={styles.metricText}>
                  Last Sync: {formatRelativeTime(integration.lastSync)}
                </Text>
              )}

              {integration.errorCount > 0 && (
                <Text style={[styles.metricText, { color: colors.error }]}>
                  Errors: {integration.errorCount}
                </Text>
              )}
            </View>
          </View>
        </View>
      ))}
    </Card>
  );

  const renderTimeframeSelector = () => (
    <View style={styles.timeframeSelector}>
      {(['24h', '7d', '30d'] as const).map((timeframe) => (
        <TouchableOpacity
          key={timeframe}
          style={[
            styles.timeframeButton,
            selectedTimeframe === timeframe && styles.timeframeButtonActive
          ]}
          onPress={() => setSelectedTimeframe(timeframe)}
        >
          <Text style={[
            styles.timeframeButtonText,
            selectedTimeframe === timeframe && styles.timeframeButtonTextActive
          ]}>
            {timeframe}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRecentActivity = () => (
    <Card style={styles.sectionCard} variant="elevated">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {renderTimeframeSelector()}
      </View>

      {syncActivities.length === 0 ? (
        <View style={styles.emptyActivity}>
          <Text style={styles.emptyActivityText}>
            No sync activities in the selected timeframe
          </Text>
        </View>
      ) : (
        syncActivities.map((activity) => (
          <View key={activity.id} style={styles.activityItem}>
            <View style={[
              styles.activityStatus,
              { backgroundColor: activity.status === 'completed' ? colors.success :
                                activity.status === 'failed' ? colors.error :
                                colors.warning }
            ]} />

            <View style={styles.activityDetails}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityType}>
                  {activity.type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.activityTime}>
                  {formatRelativeTime(activity.timestamp)}
                </Text>
              </View>

              <Text style={styles.activityDescription}>
                {activity.status === 'completed'
                  ? `Processed ${activity.recordCount} records`
                  : activity.status === 'failed'
                  ? `Failed: ${activity.error}`
                  : `Processing ${activity.recordCount} records...`
                }
              </Text>

              <Text style={styles.activityDuration}>
                Duration: {formatDuration(activity.duration)}
              </Text>
            </View>
          </View>
        ))
      )}
    </Card>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
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
          <Text style={styles.title}>Integration Dashboard</Text>
          <Text style={styles.subtitle}>
            Monitor the health and performance of your integrations
          </Text>
        </View>

        {renderOverviewCards()}
        {renderIntegrationHealth()}
        {renderRecentActivity()}
      </ScrollView>
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
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  overviewCard: {
    width: (width - spacing.lg * 3) / 2,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  overviewLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginTop: spacing.xs,
  },
  overviewSubtext: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  sectionCard: {
    margin: spacing.lg,
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
  syncButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  syncButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.white,
  },
  integrationItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  integrationInfo: {
    flex: 1,
  },
  integrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  integrationName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  statusIndicator: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  integrationType: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  integrationMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  timeframeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  timeframeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  timeframeButtonActive: {
    backgroundColor: colors.primary,
  },
  timeframeButtonText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  timeframeButtonTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeights.medium,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyActivityText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityStatus: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  activityDetails: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  activityType: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  activityTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  activityDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  activityDuration: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
});