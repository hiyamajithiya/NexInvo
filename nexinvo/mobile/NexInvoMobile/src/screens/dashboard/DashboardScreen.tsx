import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { AppDispatch, RootState } from '../../store';
import { fetchInvoices } from '../../store/slices/invoiceSlice';
import { fetchClients } from '../../store/slices/clientSlice';
import { invoiceService } from '../../services/invoiceService';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

const { width } = Dimensions.get('window');

interface DashboardStats {
  total_invoices: number;
  pending_amount: number;
  paid_amount: number;
  overdue_amount: number;
  monthly_revenue: number;
}

interface RecentActivity {
  id: string;
  type: 'invoice_created' | 'invoice_paid' | 'client_added';
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
}

export default function DashboardScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { invoices } = useSelector((state: RootState) => state.invoices);
  const { clients } = useSelector((state: RootState) => state.clients);
  const { user } = useSelector((state: RootState) => state.auth);

  const [stats, setStats] = useState<DashboardStats>({
    total_invoices: 0,
    pending_amount: 0,
    paid_amount: 0,
    overdue_amount: 0,
    monthly_revenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      // Load invoices and clients
      await Promise.all([
        dispatch(fetchInvoices()).unwrap(),
        dispatch(fetchClients()).unwrap(),
      ]);

      // Try to get stats from API, fallback to calculating from local data
      try {
        const dashboardStats = await invoiceService.getDashboardStats();
        setStats(dashboardStats);
      } catch (error) {
        // Calculate stats from local data if API fails
        calculateLocalStats();
      }

      // Generate recent activity from invoices
      generateRecentActivity();
    } catch (error) {
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  const calculateLocalStats = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const totalInvoices = invoices.length;
    const pendingAmount = invoices
      .filter(inv => inv.payment_status === 'pending')
      .reduce((sum, inv) => sum + inv.grand_total, 0);

    const paidAmount = invoices
      .filter(inv => inv.payment_status === 'paid')
      .reduce((sum, inv) => sum + inv.grand_total, 0);

    const overdueAmount = invoices
      .filter(inv => inv.payment_status === 'overdue')
      .reduce((sum, inv) => sum + inv.grand_total, 0);

    const monthlyRevenue = invoices
      .filter(inv => {
        const invoiceDate = new Date(inv.date);
        return invoiceDate.getMonth() === currentMonth &&
               invoiceDate.getFullYear() === currentYear &&
               inv.payment_status === 'paid';
      })
      .reduce((sum, inv) => sum + inv.grand_total, 0);

    setStats({
      total_invoices: totalInvoices,
      pending_amount: pendingAmount,
      paid_amount: paidAmount,
      overdue_amount: overdueAmount,
      monthly_revenue: monthlyRevenue,
    });
  };

  const generateRecentActivity = () => {
    const activities: RecentActivity[] = [];

    // Get recent invoices (last 10)
    const recentInvoices = [...invoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    recentInvoices.forEach(invoice => {
      if (invoice.payment_status === 'paid') {
        activities.push({
          id: `paid_${invoice.id}`,
          type: 'invoice_paid',
          title: `Invoice ${invoice.invoice_number} paid`,
          description: `Payment received from ${invoice.client_name}`,
          timestamp: invoice.date,
          amount: invoice.grand_total,
        });
      } else {
        activities.push({
          id: `created_${invoice.id}`,
          type: 'invoice_created',
          title: `Invoice ${invoice.invoice_number} created`,
          description: `Invoice for ${invoice.client_name}`,
          timestamp: invoice.date,
          amount: invoice.grand_total,
        });
      }
    });

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setRecentActivity(activities.slice(0, 5));
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'invoice_paid': return '💰';
      case 'invoice_created': return '📄';
      case 'client_added': return '👤';
      default: return '📊';
    }
  };

  const renderMetricCard = (title: string, value: string, color: string, subtitle?: string) => (
    <Card style={[styles.metricCard, { width: (width - spacing.lg * 3) / 2 }]} variant="elevated">
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </Card>
  );

  const renderQuickAction = (title: string, onPress: () => void, color: string) => (
    <TouchableOpacity style={[styles.quickAction, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalReceivables = stats.pending_amount + stats.overdue_amount;
  const collectionRate = stats.total_invoices > 0
    ? ((stats.paid_amount / (stats.paid_amount + totalReceivables)) * 100).toFixed(1)
    : '0';

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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.metricsGrid}>
            {renderMetricCard(
              'Total Invoices',
              stats.total_invoices.toString(),
              colors.primary
            )}
            {renderMetricCard(
              'Monthly Revenue',
              formatCurrency(stats.monthly_revenue),
              colors.success
            )}
            {renderMetricCard(
              'Pending Amount',
              formatCurrency(stats.pending_amount),
              colors.warning
            )}
            {renderMetricCard(
              'Overdue Amount',
              formatCurrency(stats.overdue_amount),
              colors.error
            )}
          </View>
        </View>

        {/* Revenue Chart Placeholder */}
        <Card style={styles.chartCard} variant="elevated">
          <Text style={styles.chartTitle}>Revenue Analytics</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartValue}>{formatCurrency(stats.paid_amount)}</Text>
            <Text style={styles.chartLabel}>Total Collected</Text>
            <View style={styles.chartStats}>
              <Text style={styles.chartStat}>Collection Rate: {collectionRate}%</Text>
              <Text style={styles.chartStat}>Outstanding: {formatCurrency(totalReceivables)}</Text>
            </View>
          </View>
        </Card>

        {/* Status Overview */}
        <Card style={styles.statusCard} variant="elevated">
          <Text style={styles.sectionTitle}>Invoice Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={styles.statusLabel}>Paid</Text>
              <Text style={styles.statusValue}>
                {invoices.filter(inv => inv.payment_status === 'paid').length}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={styles.statusValue}>
                {invoices.filter(inv => inv.payment_status === 'pending').length}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
              <Text style={styles.statusLabel}>Overdue</Text>
              <Text style={styles.statusValue}>
                {invoices.filter(inv => inv.payment_status === 'overdue').length}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {renderQuickAction(
              'Create Invoice',
              () => navigation.navigate('Invoices', { screen: 'CreateInvoice' }),
              colors.primary
            )}
            {renderQuickAction(
              'Add Client',
              () => navigation.navigate('Clients', { screen: 'CreateClient' }),
              colors.secondary
            )}
            {renderQuickAction(
              'View Reports',
              () => {},
              colors.info
            )}
            {renderQuickAction(
              'Integrations',
              () => navigation.navigate('Integrations'),
              colors.success
            )}
          </View>
        </View>

        {/* Recent Activity */}
        <Card style={styles.activityCard} variant="elevated">
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>No recent activity</Text>
            </View>
          ) : (
            recentActivity.map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Text style={styles.activityEmoji}>{getActivityIcon(activity.type)}</Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityDescription}>{activity.description}</Text>
                  <Text style={styles.activityTime}>{formatDate(activity.timestamp)}</Text>
                </View>
                {activity.amount && (
                  <Text style={styles.activityAmount}>{formatCurrency(activity.amount)}</Text>
                )}
              </View>
            ))
          )}
        </Card>

        {/* Client Summary */}
        <Card style={styles.summaryCard} variant="elevated">
          <Text style={styles.sectionTitle}>Client Summary</Text>
          <View style={styles.summaryContent}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{clients.length}</Text>
              <Text style={styles.summaryLabel}>Total Clients</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {clients.filter(client => client.client_type === 'business').length}
              </Text>
              <Text style={styles.summaryLabel}>Business</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {clients.filter(client => client.client_type === 'individual').length}
              </Text>
              <Text style={styles.summaryLabel}>Individual</Text>
            </View>
          </View>
        </Card>
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
    fontSize: typography.fontSizes.lg,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    marginBottom: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  metricTitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  metricSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chartCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  chartPlaceholder: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
  },
  chartValue: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  chartLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  chartStat: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  statusCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  statusLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statusValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: (width - spacing.lg * 3) / 2,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quickActionText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.white,
  },
  activityCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyActivityText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityEmoji: {
    fontSize: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  activityDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  activityTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  activityAmount: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
});