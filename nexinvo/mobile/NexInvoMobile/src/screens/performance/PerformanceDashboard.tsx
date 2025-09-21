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
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { performanceMonitor } from '../../services/performanceMonitor';
import { memoryManager } from '../../services/memoryManager';
import { cacheManager } from '../../services/cacheManager';
import { imageOptimization } from '../../services/imageOptimization';
import { bundleOptimizer } from '../../utils/bundleOptimization';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

const { width } = Dimensions.get('window');

interface PerformanceOverview {
  performanceScore: number;
  memoryUsage: number;
  cacheHitRate: number;
  avgFrameRate: number;
  bundleSize: string;
  startupTime: number;
}

export default function PerformanceDashboard() {
  const [overview, setOverview] = useState<PerformanceOverview>({
    performanceScore: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    avgFrameRate: 0,
    bundleSize: '0 MB',
    startupTime: 0,
  });

  const [selectedCategory, setSelectedCategory] = useState<'overview' | 'memory' | 'cache' | 'rendering' | 'bundle'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOptimizations, setShowOptimizations] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPerformanceData();
    }, [])
  );

  const loadPerformanceData = async () => {
    try {
      // Gather data from all performance services
      const [
        memoryStats,
        cacheStats,
        renderingMetrics,
        bundleAnalysis,
        performanceReport,
      ] = await Promise.all([
        memoryManager.getMemoryStats(),
        cacheManager.getStats(),
        performanceMonitor.getRenderingMetrics(),
        bundleOptimizer.analyzeBundleSize(),
        performanceMonitor.generateReport(),
      ]);

      // Calculate performance score (0-100)
      const performanceScore = Math.round(
        (performanceReport.summary.averageAppPerformance +
         (cacheStats.hitRate * 100) +
         Math.min(renderingMetrics.averageFPS / 60 * 100, 100) +
         Math.max(100 - (memoryStats.current?.percentage || 0), 0)) / 4
      );

      setOverview({
        performanceScore,
        memoryUsage: memoryStats.current?.percentage || 0,
        cacheHitRate: cacheStats.hitRate,
        avgFrameRate: renderingMetrics.averageFPS,
        bundleSize: bundleOptimizer.formatSize(bundleAnalysis.totalSize),
        startupTime: bundleOptimizer.getOptimizationConfig().enableCodeSplitting ? 1200 : 1800,
      });
    } catch (error) {
      console.error('Failed to load performance data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPerformanceData();
    setIsRefreshing(false);
  };

  const handleOptimizePerformance = async () => {
    Alert.alert(
      'Optimize Performance',
      'This will run all available optimization strategies. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Optimize',
          onPress: async () => {
            try {
              const [memoryCleanup, bundleOptimization] = await Promise.all([
                memoryManager.performManualCleanup(),
                bundleOptimizer.optimizeStartupTime(),
              ]);

              Alert.alert(
                'Optimization Complete',
                `Memory cleanup: ${memoryCleanup.strategiesExecuted} strategies executed\n` +
                `Bundle optimization: ${bundleOptimization.optimizationsApplied.length} optimizations applied\n` +
                `Estimated improvement: ${bundleOptimization.estimatedImprovement}ms`
              );

              await loadPerformanceData();
            } catch (error) {
              Alert.alert('Optimization Failed', 'Some optimizations could not be completed');
            }
          }
        }
      ]
    );
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  const renderOverviewCards = () => (
    <View style={styles.overviewGrid}>
      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: getScoreColor(overview.performanceScore) }]}>
          {overview.performanceScore}
        </Text>
        <Text style={styles.overviewLabel}>Performance Score</Text>
        <Text style={styles.overviewSubtext}>Overall app health</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: getScoreColor(100 - overview.memoryUsage) }]}>
          {overview.memoryUsage.toFixed(1)}%
        </Text>
        <Text style={styles.overviewLabel}>Memory Usage</Text>
        <Text style={styles.overviewSubtext}>Current consumption</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: getScoreColor(overview.cacheHitRate * 100) }]}>
          {(overview.cacheHitRate * 100).toFixed(1)}%
        </Text>
        <Text style={styles.overviewLabel}>Cache Hit Rate</Text>
        <Text style={styles.overviewSubtext}>Data efficiency</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: getScoreColor(overview.avgFrameRate / 60 * 100) }]}>
          {overview.avgFrameRate.toFixed(1)}
        </Text>
        <Text style={styles.overviewLabel}>Avg FPS</Text>
        <Text style={styles.overviewSubtext}>Rendering smoothness</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={styles.overviewValue}>{overview.bundleSize}</Text>
        <Text style={styles.overviewLabel}>Bundle Size</Text>
        <Text style={styles.overviewSubtext}>App download size</Text>
      </Card>

      <Card style={styles.overviewCard} variant="elevated">
        <Text style={[styles.overviewValue, { color: getScoreColor(Math.max(0, 100 - overview.startupTime / 20)) }]}>
          {overview.startupTime}ms
        </Text>
        <Text style={styles.overviewLabel}>Startup Time</Text>
        <Text style={styles.overviewSubtext}>Time to interactive</Text>
      </Card>
    </View>
  );

  const renderCategoryTabs = () => (
    <View style={styles.categoryTabs}>
      {[
        { key: 'overview', label: 'Overview' },
        { key: 'memory', label: 'Memory' },
        { key: 'cache', label: 'Cache' },
        { key: 'rendering', label: 'Rendering' },
        { key: 'bundle', label: 'Bundle' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.categoryTab,
            selectedCategory === tab.key && styles.categoryTabActive
          ]}
          onPress={() => setSelectedCategory(tab.key as any)}
        >
          <Text style={[
            styles.categoryTabText,
            selectedCategory === tab.key && styles.categoryTabTextActive
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMemoryDetails = () => (
    <Card style={styles.detailCard} variant="elevated">
      <Text style={styles.detailTitle}>Memory Management</Text>

      <View style={styles.memoryProgressContainer}>
        <View style={styles.memoryProgressBar}>
          <View
            style={[
              styles.memoryProgressFill,
              {
                width: `${overview.memoryUsage}%`,
                backgroundColor: getScoreColor(100 - overview.memoryUsage),
              }
            ]}
          />
        </View>
        <Text style={styles.memoryProgressText}>
          {overview.memoryUsage.toFixed(1)}% of available memory
        </Text>
      </View>

      <View style={styles.memoryStats}>
        <View style={styles.memoryStatItem}>
          <Text style={styles.memoryStatLabel}>Status</Text>
          <Text style={[
            styles.memoryStatValue,
            { color: getScoreColor(100 - overview.memoryUsage) }
          ]}>
            {overview.memoryUsage < 70 ? 'Good' : overview.memoryUsage < 85 ? 'Warning' : 'Critical'}
          </Text>
        </View>

        <View style={styles.memoryStatItem}>
          <Text style={styles.memoryStatLabel}>Cleanup Available</Text>
          <Text style={styles.memoryStatValue}>
            {overview.memoryUsage > 50 ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      <Button
        title="Run Memory Cleanup"
        onPress={async () => {
          const result = await memoryManager.performManualCleanup();
          Alert.alert(
            'Cleanup Complete',
            `Executed ${result.strategiesExecuted} cleanup strategies`
          );
          await loadPerformanceData();
        }}
        style={styles.actionButton}
        disabled={overview.memoryUsage < 50}
      />
    </Card>
  );

  const renderCacheDetails = () => (
    <Card style={styles.detailCard} variant="elevated">
      <Text style={styles.detailTitle}>Cache Performance</Text>

      <View style={styles.cacheStats}>
        <View style={styles.cacheStatRow}>
          <Text style={styles.cacheStatLabel}>Hit Rate</Text>
          <Text style={[
            styles.cacheStatValue,
            { color: getScoreColor(overview.cacheHitRate * 100) }
          ]}>
            {(overview.cacheHitRate * 100).toFixed(1)}%
          </Text>
        </View>

        <View style={styles.cacheStatRow}>
          <Text style={styles.cacheStatLabel}>Status</Text>
          <Text style={styles.cacheStatValue}>
            {overview.cacheHitRate > 0.8 ? 'Excellent' :
             overview.cacheHitRate > 0.6 ? 'Good' :
             overview.cacheHitRate > 0.4 ? 'Fair' : 'Poor'}
          </Text>
        </View>
      </View>

      <View style={styles.cacheActions}>
        <Button
          title="Clear Cache"
          onPress={async () => {
            await cacheManager.clear();
            Alert.alert('Cache Cleared', 'All cached data has been removed');
            await loadPerformanceData();
          }}
          style={[styles.actionButton, styles.clearButton]}
        />

        <Button
          title="View Cache Keys"
          onPress={() => {
            const keys = cacheManager.getCacheKeys();
            Alert.alert('Cache Keys', `${keys.length} items cached`);
          }}
          style={styles.actionButton}
        />
      </View>
    </Card>
  );

  const renderRenderingDetails = () => (
    <Card style={styles.detailCard} variant="elevated">
      <Text style={styles.detailTitle}>Rendering Performance</Text>

      <View style={styles.renderingStats}>
        <View style={styles.renderingStatRow}>
          <Text style={styles.renderingStatLabel}>Average FPS</Text>
          <Text style={[
            styles.renderingStatValue,
            { color: getScoreColor(overview.avgFrameRate / 60 * 100) }
          ]}>
            {overview.avgFrameRate.toFixed(1)}
          </Text>
        </View>

        <View style={styles.renderingStatRow}>
          <Text style={styles.renderingStatLabel}>Performance</Text>
          <Text style={styles.renderingStatValue}>
            {overview.avgFrameRate >= 55 ? 'Smooth' :
             overview.avgFrameRate >= 45 ? 'Good' :
             overview.avgFrameRate >= 30 ? 'Fair' : 'Poor'}
          </Text>
        </View>
      </View>

      <View style={styles.fpsContainer}>
        <Text style={styles.fpsLabel}>Frame Rate Indicator</Text>
        <View style={styles.fpsBar}>
          <View
            style={[
              styles.fpsBarFill,
              {
                width: `${Math.min(overview.avgFrameRate / 60 * 100, 100)}%`,
                backgroundColor: getScoreColor(overview.avgFrameRate / 60 * 100),
              }
            ]}
          />
        </View>
        <Text style={styles.fpsTarget}>Target: 60 FPS</Text>
      </View>
    </Card>
  );

  const renderBundleDetails = () => (
    <Card style={styles.detailCard} variant="elevated">
      <Text style={styles.detailTitle}>Bundle Analysis</Text>

      <View style={styles.bundleStats}>
        <View style={styles.bundleStatRow}>
          <Text style={styles.bundleStatLabel}>Total Size</Text>
          <Text style={styles.bundleStatValue}>{overview.bundleSize}</Text>
        </View>

        <View style={styles.bundleStatRow}>
          <Text style={styles.bundleStatLabel}>Startup Time</Text>
          <Text style={[
            styles.bundleStatValue,
            { color: getScoreColor(Math.max(0, 100 - overview.startupTime / 20)) }
          ]}>
            {overview.startupTime}ms
          </Text>
        </View>
      </View>

      <Button
        title="Analyze Bundle"
        onPress={async () => {
          const analysis = await bundleOptimizer.analyzeBundleSize();
          Alert.alert(
            'Bundle Analysis',
            `Total: ${bundleOptimizer.formatSize(analysis.totalSize)}\n` +
            `JS: ${bundleOptimizer.formatSize(analysis.jsSize)}\n` +
            `Assets: ${bundleOptimizer.formatSize(analysis.assetsSize)}\n` +
            `Chunks: ${analysis.chunksCount}`
          );
        }}
        style={styles.actionButton}
      />
    </Card>
  );

  const renderOptimizationSuggestions = () => (
    <Card style={styles.detailCard} variant="elevated">
      <Text style={styles.detailTitle}>Optimization Suggestions</Text>

      <View style={styles.suggestions}>
        {overview.performanceScore < 80 && (
          <View style={styles.suggestionItem}>
            <Text style={styles.suggestionBullet}>💡</Text>
            <Text style={styles.suggestionText}>
              Performance score is below optimal. Consider running optimization.
            </Text>
          </View>
        )}

        {overview.memoryUsage > 70 && (
          <View style={styles.suggestionItem}>
            <Text style={styles.suggestionBullet}>🧹</Text>
            <Text style={styles.suggestionText}>
              Memory usage is high. Run memory cleanup to free resources.
            </Text>
          </View>
        )}

        {overview.cacheHitRate < 0.6 && (
          <View style={styles.suggestionItem}>
            <Text style={styles.suggestionBullet}>📦</Text>
            <Text style={styles.suggestionText}>
              Cache hit rate is low. Check caching strategies for frequently accessed data.
            </Text>
          </View>
        )}

        {overview.avgFrameRate < 50 && (
          <View style={styles.suggestionItem}>
            <Text style={styles.suggestionBullet}>🎬</Text>
            <Text style={styles.suggestionText}>
              Frame rate is below optimal. Consider optimizing rendering performance.
            </Text>
          </View>
        )}

        {overview.startupTime > 2000 && (
          <View style={styles.suggestionItem}>
            <Text style={styles.suggestionBullet}>🚀</Text>
            <Text style={styles.suggestionText}>
              Startup time is slow. Enable code splitting and lazy loading.
            </Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderDetailContent = () => {
    switch (selectedCategory) {
      case 'memory':
        return renderMemoryDetails();
      case 'cache':
        return renderCacheDetails();
      case 'rendering':
        return renderRenderingDetails();
      case 'bundle':
        return renderBundleDetails();
      default:
        return renderOptimizationSuggestions();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Performance Dashboard</Text>
          <Text style={styles.subtitle}>
            Monitor and optimize app performance
          </Text>
        </View>

        {renderOverviewCards()}
        {renderCategoryTabs()}
        {renderDetailContent()}

        <View style={styles.actions}>
          <Button
            title="Run Full Optimization"
            onPress={handleOptimizePerformance}
            style={styles.optimizeButton}
          />
        </View>
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
    textAlign: 'center',
  },
  overviewSubtext: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  categoryTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  categoryTabTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeights.medium,
  },
  detailCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  detailTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  memoryProgressContainer: {
    marginBottom: spacing.lg,
  },
  memoryProgressBar: {
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  memoryProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  memoryProgressText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  memoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  memoryStatItem: {
    alignItems: 'center',
  },
  memoryStatLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  memoryStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  cacheStats: {
    marginBottom: spacing.lg,
  },
  cacheStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cacheStatLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  cacheStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  cacheActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  renderingStats: {
    marginBottom: spacing.lg,
  },
  renderingStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  renderingStatLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  renderingStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  fpsContainer: {
    marginBottom: spacing.lg,
  },
  fpsLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  fpsBar: {
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  fpsBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  fpsTarget: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  bundleStats: {
    marginBottom: spacing.lg,
  },
  bundleStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  bundleStatLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  bundleStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  suggestions: {
    gap: spacing.md,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  suggestionBullet: {
    fontSize: typography.fontSizes.md,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    padding: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  clearButton: {
    backgroundColor: colors.warning,
  },
  optimizeButton: {
    width: '100%',
  },
});