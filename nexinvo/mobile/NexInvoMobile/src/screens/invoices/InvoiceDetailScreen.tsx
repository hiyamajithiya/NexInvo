import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppDispatch, RootState } from '../../store';
import { fetchInvoiceById, updateInvoice } from '../../store/slices/invoiceSlice';
import { InvoiceStackParamList } from '../../navigation/AppNavigator';
import { Invoice, InvoiceItem } from '../../store/slices/invoiceSlice';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

type InvoiceDetailScreenRouteProp = RouteProp<InvoiceStackParamList, 'InvoiceDetail'>;
type InvoiceDetailScreenNavigationProp = StackNavigationProp<InvoiceStackParamList, 'InvoiceDetail'>;

interface Props {
  route: InvoiceDetailScreenRouteProp;
  navigation: InvoiceDetailScreenNavigationProp;
}

const STATUS_COLORS = {
  pending: colors.warning,
  partial: colors.info,
  paid: colors.success,
  overdue: colors.error,
};

const STATUS_BACKGROUNDS = {
  pending: colors.pendingBackground,
  partial: colors.info + '20',
  paid: colors.paidBackground,
  overdue: colors.overdueBackground,
};

export default function InvoiceDetailScreen({ route, navigation }: Props) {
  const { invoiceId } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { currentInvoice, isLoading } = useSelector((state: RootState) => state.invoices);

  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  useEffect(() => {
    if (currentInvoice && currentInvoice.id === invoiceId) {
      setInvoice(currentInvoice);
    }
  }, [currentInvoice, invoiceId]);

  const loadInvoice = async () => {
    try {
      await dispatch(fetchInvoiceById(invoiceId)).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load invoice details');
      navigation.goBack();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleStatusChange = async (newStatus: 'pending' | 'paid' | 'overdue') => {
    if (!invoice) return;

    try {
      await dispatch(updateInvoice({
        id: invoice.id,
        data: { payment_status: newStatus }
      })).unwrap();

      setInvoice(prev => prev ? { ...prev, payment_status: newStatus } : null);
      Alert.alert('Success', `Invoice marked as ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update invoice status');
    }
  };

  const handleGeneratePDF = async () => {
    if (!invoice) return;

    Alert.alert('PDF Generation', 'PDF generation will be implemented in the next phase');
  };

  const handleSendEmail = async () => {
    if (!invoice) return;

    Alert.alert('Send Email', 'Email sending will be implemented in the next phase');
  };

  const handleShare = async () => {
    if (!invoice) return;

    try {
      await Share.share({
        message: `Invoice ${invoice.invoice_number} for ${formatCurrency(invoice.grand_total)}`,
        title: `Invoice ${invoice.invoice_number}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const renderInvoiceItem = ({ item, index }: { item: InvoiceItem; index: number }) => (
    <View key={index} style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemDescription}>{item.description}</Text>
        {item.hsn_code && (
          <Text style={styles.itemHsn}>HSN: {item.hsn_code}</Text>
        )}
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.itemQuantity}>{item.quantity} × {formatCurrency(item.unit_price)}</Text>
        <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>
      </View>
    </View>
  );

  if (isLoading || !invoice) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading invoice...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Card style={styles.headerCard} variant="elevated">
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
              <Text style={styles.invoiceType}>{invoice.invoice_type?.toUpperCase() || 'STANDARD'}</Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: STATUS_BACKGROUNDS[invoice.payment_status] }
            ]}>
              <Text style={[
                styles.statusText,
                { color: STATUS_COLORS[invoice.payment_status] }
              ]}>
                {invoice.payment_status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>{formatCurrency(invoice.grand_total)}</Text>
          </View>
        </Card>

        {/* Client Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <Text style={styles.clientName}>{invoice.client_name}</Text>
        </Card>

        {/* Invoice Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice Date:</Text>
            <Text style={styles.detailValue}>{formatDate(invoice.date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={styles.detailValue}>{formatDate(invoice.due_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Currency:</Text>
            <Text style={styles.detailValue}>{invoice.currency || 'INR'}</Text>
          </View>
        </Card>

        {/* Items */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Items</Text>
          {invoice.items.map((item, index) => renderInvoiceItem({ item, index }))}
        </Card>

        {/* Amount Breakdown */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Amount Breakdown</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Subtotal:</Text>
            <Text style={styles.amountValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Tax Amount:</Text>
            <Text style={styles.amountValue}>{formatCurrency(invoice.tax_amount)}</Text>
          </View>
          <View style={[styles.amountRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Grand Total:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.grand_total)}</Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {invoice.payment_status !== 'paid' && (
            <Button
              title="Mark as Paid"
              onPress={() => handleStatusChange('paid')}
              style={styles.actionButton}
            />
          )}

          {invoice.payment_status === 'pending' && (
            <Button
              title="Mark as Overdue"
              onPress={() => handleStatusChange('overdue')}
              variant="outline"
              style={styles.actionButton}
            />
          )}

          <Button
            title="Generate PDF"
            onPress={handleGeneratePDF}
            variant="outline"
            style={styles.actionButton}
          />

          <Button
            title="Send Email"
            onPress={handleSendEmail}
            variant="outline"
            style={styles.actionButton}
          />

          <Button
            title="Share"
            onPress={handleShare}
            variant="ghost"
            style={styles.actionButton}
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
    padding: spacing.md,
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
  headerCard: {
    marginBottom: spacing.md,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  invoiceType: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  amountLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  clientName: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemDescription: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
    marginBottom: spacing.xs,
  },
  itemHsn: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  itemDetails: {
    alignItems: 'flex-end',
  },
  itemQuantity: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  itemTotal: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.semibold,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.fontSizes.lg,
    color: colors.text,
    fontWeight: typography.fontWeights.bold,
  },
  totalValue: {
    fontSize: typography.fontSizes.lg,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  actionContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
});