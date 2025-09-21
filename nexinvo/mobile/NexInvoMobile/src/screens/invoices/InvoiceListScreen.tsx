import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppDispatch, RootState } from '../../store';
import { fetchInvoices, setFilters } from '../../store/slices/invoiceSlice';
import { InvoiceStackParamList } from '../../navigation/AppNavigator';
import { Invoice } from '../../store/slices/invoiceSlice';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

type InvoiceListScreenNavigationProp = StackNavigationProp<InvoiceStackParamList, 'InvoiceList'>;

interface Props {
  navigation: InvoiceListScreenNavigationProp;
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

export default function InvoiceListScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { invoices, isLoading, filters } = useSelector((state: RootState) => state.invoices);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = searchQuery === '' ||
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const loadInvoices = useCallback(async () => {
    try {
      await dispatch(fetchInvoices(filters)).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load invoices');
    }
  }, [dispatch, filters]);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [loadInvoices])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  const handleInvoicePress = (invoice: Invoice) => {
    navigation.navigate('InvoiceDetail', { invoiceId: invoice.id });
  };

  const handleCreateInvoice = () => {
    navigation.navigate('CreateInvoice', {});
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
      month: 'short',
      year: 'numeric',
    });
  };

  const renderInvoiceItem = ({ item }: { item: Invoice }) => (
    <TouchableOpacity onPress={() => handleInvoicePress(item)}>
      <Card style={styles.invoiceCard} variant="elevated">
        <View style={styles.invoiceHeader}>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
            <Text style={styles.clientName}>{item.client_name}</Text>
          </View>
          <View style={styles.invoiceAmount}>
            <Text style={styles.amount}>{formatCurrency(item.grand_total)}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: STATUS_BACKGROUNDS[item.payment_status] }
            ]}>
              <Text style={[
                styles.statusText,
                { color: STATUS_COLORS[item.payment_status] }
              ]}>
                {item.payment_status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.invoiceFooter}>
          <Text style={styles.dateText}>
            Date: {formatDate(item.date)}
          </Text>
          <Text style={styles.dateText}>
            Due: {formatDate(item.due_date)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search invoices..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.gray400}
        />
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'paid', label: 'Paid' },
            { key: 'overdue', label: 'Overdue' },
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                statusFilter === item.key && styles.filterChipActive
              ]}
              onPress={() => setStatusFilter(item.key)}
            >
              <Text style={[
                styles.filterChipText,
                statusFilter === item.key && styles.filterChipTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.key}
        />
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No Invoices Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || statusFilter !== 'all'
          ? 'Try adjusting your search or filters'
          : 'Create your first invoice to get started'
        }
      </Text>
      {!searchQuery && statusFilter === 'all' && (
        <Button
          title="Create Invoice"
          onPress={handleCreateInvoice}
          style={styles.emptyButton}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Invoices</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateInvoice}
        >
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoiceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  header: {
    padding: spacing.lg,
  },
  searchContainer: {
    marginBottom: spacing.md,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    backgroundColor: colors.white,
  },
  filterContainer: {
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  invoiceCard: {
    marginBottom: spacing.md,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  clientName: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  invoiceAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
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
    marginBottom: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.md,
  },
});