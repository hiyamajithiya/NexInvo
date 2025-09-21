import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { integrationDiagnostics, DiagnosticReport, DiagnosticTest } from '../../services/integrationDiagnostics';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

type RouteParams = {
  integrationId: string;
  integrationType: string;
  integrationName: string;
};

export default function TroubleshootingScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { integrationId, integrationType, integrationName } = route.params;

  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [selectedTest, setSelectedTest] = useState<DiagnosticTest | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [healthScore, setHealthScore] = useState<{
    score: number;
    grade: string;
    factors: Array<{ name: string; weight: number; score: number }>;
  } | null>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const [report, health] = await Promise.all([
        integrationDiagnostics.runFullDiagnostics(integrationId, integrationType),
        integrationDiagnostics.generateHealthScore(integrationId, integrationType),
      ]);

      setDiagnosticReport(report);
      setHealthScore(health);
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
      Alert.alert('Error', 'Failed to run diagnostic tests');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'passed': return colors.success;
      case 'warning': return colors.warning;
      case 'failed': return colors.error;
      case 'running': return colors.info;
      default: return colors.gray400;
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'passed': return '✅';
      case 'warning': return '⚠️';
      case 'failed': return '❌';
      case 'running': return '🔄';
      default: return '⏸️';
    }
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return colors.success;
      case 'B': return colors.info;
      case 'C': return colors.warning;
      case 'D': return colors.warning;
      case 'F': return colors.error;
      default: return colors.gray400;
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const renderHealthScore = () => {
    if (!healthScore) return null;

    return (
      <Card style={styles.healthCard} variant="elevated">
        <View style={styles.healthHeader}>
          <Text style={styles.healthTitle}>Integration Health</Text>
          <View style={styles.scoreContainer}>
            <Text style={[
              styles.scoreValue,
              { color: getGradeColor(healthScore.grade) }
            ]}>
              {healthScore.score}
            </Text>
            <Text style={[
              styles.gradeValue,
              { color: getGradeColor(healthScore.grade) }
            ]}>
              {healthScore.grade}
            </Text>
          </View>
        </View>

        <View style={styles.factorsContainer}>
          {healthScore.factors.map((factor, index) => (
            <View key={index} style={styles.factorRow}>
              <Text style={styles.factorName}>{factor.name}</Text>
              <View style={styles.factorBar}>
                <View
                  style={[
                    styles.factorProgress,
                    {
                      width: `${factor.score}%`,
                      backgroundColor: factor.score >= 80 ? colors.success :
                                     factor.score >= 60 ? colors.warning :
                                     colors.error
                    }
                  ]}
                />
              </View>
              <Text style={styles.factorScore}>{factor.score}%</Text>
            </View>
          ))}
        </View>
      </Card>
    );
  };

  const renderDiagnosticSummary = () => {
    if (!diagnosticReport) return null;

    return (
      <Card style={styles.summaryCard} variant="elevated">
        <Text style={styles.sectionTitle}>Diagnostic Summary</Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {diagnosticReport.summary.passed}
            </Text>
            <Text style={styles.summaryLabel}>Passed</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {diagnosticReport.summary.warnings}
            </Text>
            <Text style={styles.summaryLabel}>Warnings</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              {diagnosticReport.summary.failed}
            </Text>
            <Text style={styles.summaryLabel}>Failed</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {diagnosticReport.summary.total}
            </Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
        </View>

        <View style={[
          styles.overallStatus,
          { backgroundColor: diagnosticReport.overallStatus === 'healthy' ? colors.success + '20' :
                            diagnosticReport.overallStatus === 'warning' ? colors.warning + '20' :
                            colors.error + '20' }
        ]}>
          <Text style={[
            styles.overallStatusText,
            { color: diagnosticReport.overallStatus === 'healthy' ? colors.success :
                     diagnosticReport.overallStatus === 'warning' ? colors.warning :
                     colors.error }
          ]}>
            Overall Status: {diagnosticReport.overallStatus.toUpperCase()}
          </Text>
        </View>
      </Card>
    );
  };

  const renderTestsList = () => {
    if (!diagnosticReport) return null;

    // Group tests by category
    const testsByCategory = diagnosticReport.tests.reduce((acc, test) => {
      if (!acc[test.category]) {
        acc[test.category] = [];
      }
      acc[test.category].push(test);
      return acc;
    }, {} as Record<string, DiagnosticTest[]>);

    return (
      <Card style={styles.testsCard} variant="elevated">
        <Text style={styles.sectionTitle}>Diagnostic Tests</Text>

        {Object.entries(testsByCategory).map(([category, tests]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>

            {tests.map((test) => (
              <TouchableOpacity
                key={test.id}
                style={styles.testItem}
                onPress={() => {
                  setSelectedTest(test);
                  setShowTestModal(true);
                }}
              >
                <View style={styles.testHeader}>
                  <View style={styles.testInfo}>
                    <Text style={styles.testIcon}>
                      {getStatusIcon(test.status)}
                    </Text>
                    <View style={styles.testDetails}>
                      <Text style={styles.testName}>{test.name}</Text>
                      <Text style={styles.testDescription} numberOfLines={2}>
                        {test.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.testStatus}>
                    {test.status === 'running' ? (
                      <ActivityIndicator size="small" color={colors.info} />
                    ) : (
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(test.status) }
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {test.status.toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {test.duration && (
                      <Text style={styles.testDuration}>
                        {formatDuration(test.duration)}
                      </Text>
                    )}
                  </View>
                </View>

                {(test.result || test.error) && (
                  <Text style={[
                    styles.testResult,
                    { color: test.status === 'failed' ? colors.error : colors.textSecondary }
                  ]} numberOfLines={2}>
                    {test.error || test.result}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </Card>
    );
  };

  const renderRecommendations = () => {
    if (!diagnosticReport || diagnosticReport.recommendations.length === 0) return null;

    return (
      <Card style={styles.recommendationsCard} variant="elevated">
        <Text style={styles.sectionTitle}>Recommendations</Text>

        {diagnosticReport.recommendations.map((recommendation, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>💡</Text>
            <Text style={styles.recommendationText}>{recommendation}</Text>
          </View>
        ))}
      </Card>
    );
  };

  const renderTestDetailModal = () => (
    <Modal
      visible={showTestModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {selectedTest?.name}
          </Text>
          <TouchableOpacity onPress={() => setShowTestModal(false)}>
            <Text style={styles.modalCloseButton}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {selectedTest && (
            <>
              <View style={styles.testDetailSection}>
                <Text style={styles.testDetailLabel}>Status</Text>
                <View style={styles.testDetailRow}>
                  <Text style={styles.testDetailIcon}>
                    {getStatusIcon(selectedTest.status)}
                  </Text>
                  <Text style={[
                    styles.testDetailValue,
                    { color: getStatusColor(selectedTest.status) }
                  ]}>
                    {selectedTest.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.testDetailSection}>
                <Text style={styles.testDetailLabel}>Description</Text>
                <Text style={styles.testDetailValue}>
                  {selectedTest.description}
                </Text>
              </View>

              <View style={styles.testDetailSection}>
                <Text style={styles.testDetailLabel}>Category</Text>
                <Text style={styles.testDetailValue}>
                  {selectedTest.category.charAt(0).toUpperCase() + selectedTest.category.slice(1)}
                </Text>
              </View>

              {selectedTest.duration && (
                <View style={styles.testDetailSection}>
                  <Text style={styles.testDetailLabel}>Duration</Text>
                  <Text style={styles.testDetailValue}>
                    {formatDuration(selectedTest.duration)}
                  </Text>
                </View>
              )}

              {selectedTest.result && (
                <View style={styles.testDetailSection}>
                  <Text style={styles.testDetailLabel}>Result</Text>
                  <Text style={styles.testDetailValue}>
                    {selectedTest.result}
                  </Text>
                </View>
              )}

              {selectedTest.error && (
                <View style={styles.testDetailSection}>
                  <Text style={styles.testDetailLabel}>Error</Text>
                  <Text style={[styles.testDetailValue, { color: colors.error }]}>
                    {selectedTest.error}
                  </Text>
                </View>
              )}

              {selectedTest.suggestions && selectedTest.suggestions.length > 0 && (
                <View style={styles.testDetailSection}>
                  <Text style={styles.testDetailLabel}>Suggestions</Text>
                  {selectedTest.suggestions.map((suggestion, index) => (
                    <Text key={index} style={styles.suggestionText}>
                      • {suggestion}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (isRunningDiagnostics && !diagnosticReport) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            Running diagnostics for {integrationName}...
          </Text>
          <Text style={styles.loadingSubtext}>
            This may take a few moments
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Troubleshooting</Text>
          <Text style={styles.subtitle}>
            {integrationName} • {integrationType}
          </Text>
        </View>

        {renderHealthScore()}
        {renderDiagnosticSummary()}
        {renderTestsList()}
        {renderRecommendations()}

        <View style={styles.actions}>
          <Button
            title="Run Diagnostics Again"
            onPress={runDiagnostics}
            disabled={isRunningDiagnostics}
            style={styles.runButton}
          />
        </View>
      </ScrollView>

      {renderTestDetailModal()}
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
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSizes.lg,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
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
  healthCard: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  healthTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
  },
  gradeValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    marginTop: spacing.xs,
  },
  factorsContainer: {
    gap: spacing.md,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  factorName: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  factorBar: {
    flex: 2,
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  factorProgress: {
    height: '100%',
    borderRadius: 4,
  },
  factorScore: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    minWidth: 40,
    textAlign: 'right',
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  summaryLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  overallStatus: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  overallStatusText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
  },
  testsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    paddingLeft: spacing.sm,
  },
  testItem: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  testInfo: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  testIcon: {
    fontSize: typography.fontSizes.lg,
    marginRight: spacing.sm,
  },
  testDetails: {
    flex: 1,
  },
  testName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  testDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  testStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  statusBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  testDuration: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  testResult: {
    fontSize: typography.fontSizes.sm,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  recommendationsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  recommendationBullet: {
    fontSize: typography.fontSizes.md,
    marginRight: spacing.sm,
  },
  recommendationText: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    padding: spacing.lg,
  },
  runButton: {
    width: '100%',
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
    flex: 1,
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
  testDetailSection: {
    marginBottom: spacing.lg,
  },
  testDetailLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  testDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testDetailIcon: {
    fontSize: typography.fontSizes.lg,
    marginRight: spacing.sm,
  },
  testDetailValue: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    lineHeight: 22,
  },
  suggestionText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs,
    paddingLeft: spacing.md,
  },
});