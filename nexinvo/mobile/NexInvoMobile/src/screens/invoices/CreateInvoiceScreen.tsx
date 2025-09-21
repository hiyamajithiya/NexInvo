import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppDispatch, RootState } from '../../store';
import { createInvoice, addToOfflineQueue } from '../../store/slices/invoiceSlice';
import { fetchClients } from '../../store/slices/clientSlice';
import { InvoiceStackParamList } from '../../navigation/AppNavigator';
import { Invoice, InvoiceItem } from '../../store/slices/invoiceSlice';
import { Client } from '../../store/slices/clientSlice';
import { Button, Input, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

type CreateInvoiceScreenRouteProp = RouteProp<InvoiceStackParamList, 'CreateInvoice'>;
type CreateInvoiceScreenNavigationProp = StackNavigationProp<InvoiceStackParamList, 'CreateInvoice'>;

interface Props {
  route: CreateInvoiceScreenRouteProp;
  navigation: CreateInvoiceScreenNavigationProp;
}

interface InvoiceFormData {
  client_id: string;
  client_name: string;
  date: string;
  due_date: string;
  invoice_type: 'standard' | 'proforma' | 'credit_note' | 'debit_note';
  currency: string;
  items: InvoiceItem[];
}

interface ItemFormData {
  description: string;
  hsn_code: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
}

export default function CreateInvoiceScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { clients } = useSelector((state: RootState) => state.clients);
  const { isNetworkConnected } = useSelector((state: RootState) => state.ui);

  const [formData, setFormData] = useState<InvoiceFormData>({
    client_id: clientId || '',
    client_name: '',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    invoice_type: 'standard',
    currency: 'INR',
    items: [],
  });

  const [itemForm, setItemForm] = useState<ItemFormData>({
    description: '',
    hsn_code: '',
    quantity: '',
    unit_price: '',
    tax_rate: '18',
  });

  const [showClientModal, setShowClientModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);

  useEffect(() => {
    if (clientId && clients.length > 0) {
      const selectedClient = clients.find(client => client.id === clientId);
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          client_id: selectedClient.id,
          client_name: selectedClient.name,
        }));
      }
    }
  }, [clientId, clients]);

  const calculateItemTotal = (quantity: number, unitPrice: number, taxRate: number) => {
    const subtotal = quantity * unitPrice;
    const taxAmount = (subtotal * taxRate) / 100;
    return subtotal + taxAmount;
  };

  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    formData.items.forEach(item => {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemTax = (itemSubtotal * item.tax_rate) / 100;
      subtotal += itemSubtotal;
      taxAmount += itemTax;
    });

    return {
      subtotal,
      tax_amount: taxAmount,
      grand_total: subtotal + taxAmount,
    };
  };

  const handleClientSelect = (client: Client) => {
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
    }));
    setShowClientModal(false);
  };

  const handleAddItem = () => {
    const quantity = parseFloat(itemForm.quantity);
    const unitPrice = parseFloat(itemForm.unit_price);
    const taxRate = parseFloat(itemForm.tax_rate);

    if (!itemForm.description || !quantity || !unitPrice) {
      Alert.alert('Error', 'Please fill in all required item fields');
      return;
    }

    const total = calculateItemTotal(quantity, unitPrice, taxRate);

    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: itemForm.description,
      hsn_code: itemForm.hsn_code,
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      total,
    };

    if (editingItemIndex !== null) {
      const updatedItems = [...formData.items];
      updatedItems[editingItemIndex] = newItem;
      setFormData(prev => ({ ...prev, items: updatedItems }));
      setEditingItemIndex(null);
    } else {
      setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    }

    setItemForm({
      description: '',
      hsn_code: '',
      quantity: '',
      unit_price: '',
      tax_rate: '18',
    });
    setShowItemModal(false);
  };

  const handleEditItem = (index: number) => {
    const item = formData.items[index];
    setItemForm({
      description: item.description,
      hsn_code: item.hsn_code || '',
      quantity: item.quantity.toString(),
      unit_price: item.unit_price.toString(),
      tax_rate: item.tax_rate.toString(),
    });
    setEditingItemIndex(index);
    setShowItemModal(true);
  };

  const handleDeleteItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const validateForm = () => {
    if (!formData.client_id) {
      Alert.alert('Error', 'Please select a client');
      return false;
    }

    if (!formData.date || !formData.due_date) {
      Alert.alert('Error', 'Please provide invoice and due dates');
      return false;
    }

    if (formData.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const totals = calculateInvoiceTotals();
    const invoiceData: Partial<Invoice> = {
      client: formData.client_id,
      client_name: formData.client_name,
      date: formData.date,
      due_date: formData.due_date,
      invoice_type: formData.invoice_type,
      currency: formData.currency,
      items: formData.items,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      grand_total: totals.grand_total,
      payment_status: 'pending',
    };

    try {
      if (isNetworkConnected) {
        await dispatch(createInvoice(invoiceData)).unwrap();
        Alert.alert('Success', 'Invoice created successfully');
        navigation.goBack();
      } else {
        dispatch(addToOfflineQueue(invoiceData as Invoice));
        Alert.alert('Offline Mode', 'Invoice saved offline. It will sync when you reconnect.');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const totals = calculateInvoiceTotals();

  const renderClientModal = () => (
    <Modal visible={showClientModal} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Client</Text>
          <TouchableOpacity onPress={() => setShowClientModal(false)}>
            <Text style={styles.modalCloseButton}>Close</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={clients}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.clientItem}
              onPress={() => handleClientSelect(item)}
            >
              <Text style={styles.clientName}>{item.name}</Text>
              <Text style={styles.clientEmail}>{item.email}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      </SafeAreaView>
    </Modal>
  );

  const renderItemModal = () => (
    <Modal visible={showItemModal} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editingItemIndex !== null ? 'Edit Item' : 'Add Item'}
          </Text>
          <TouchableOpacity onPress={() => {
            setShowItemModal(false);
            setEditingItemIndex(null);
            setItemForm({
              description: '',
              hsn_code: '',
              quantity: '',
              unit_price: '',
              tax_rate: '18',
            });
          }}>
            <Text style={styles.modalCloseButton}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Input
            label="Description"
            placeholder="Item description"
            value={itemForm.description}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, description: text }))}
            required
          />
          <Input
            label="HSN Code"
            placeholder="HSN code (optional)"
            value={itemForm.hsn_code}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, hsn_code: text }))}
          />
          <Input
            label="Quantity"
            placeholder="Quantity"
            value={itemForm.quantity}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, quantity: text }))}
            keyboardType="numeric"
            required
          />
          <Input
            label="Unit Price"
            placeholder="Unit price"
            value={itemForm.unit_price}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, unit_price: text }))}
            keyboardType="numeric"
            required
          />
          <Input
            label="Tax Rate (%)"
            placeholder="Tax rate"
            value={itemForm.tax_rate}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, tax_rate: text }))}
            keyboardType="numeric"
          />
          <Button
            title={editingItemIndex !== null ? 'Update Item' : 'Add Item'}
            onPress={handleAddItem}
            style={styles.addItemButton}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Client Selection */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Client</Text>
          <TouchableOpacity
            style={styles.clientSelector}
            onPress={() => setShowClientModal(true)}
          >
            <Text style={formData.client_name ? styles.selectedClientText : styles.placeholderText}>
              {formData.client_name || 'Select a client'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* Invoice Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <Input
            label="Invoice Date"
            value={formData.date}
            onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
            placeholder="YYYY-MM-DD"
            required
          />
          <Input
            label="Due Date"
            value={formData.due_date}
            onChangeText={(text) => setFormData(prev => ({ ...prev, due_date: text }))}
            placeholder="YYYY-MM-DD"
            required
          />
        </Card>

        {/* Items */}
        <Card style={styles.sectionCard}>
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowItemModal(true)}
            >
              <Text style={styles.addButtonText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {formData.items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Text style={styles.emptyItemsText}>No items added yet</Text>
            </View>
          ) : (
            formData.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text style={styles.itemDetails}>
                    {item.quantity} × {formatCurrency(item.unit_price)} ({item.tax_rate}% tax)
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>
                  <View style={styles.itemButtons}>
                    <TouchableOpacity
                      style={styles.itemButton}
                      onPress={() => handleEditItem(index)}
                    >
                      <Text style={styles.itemButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.itemButton, styles.deleteButton]}
                      onPress={() => handleDeleteItem(index)}
                    >
                      <Text style={[styles.itemButtonText, styles.deleteButtonText]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Totals */}
        {formData.items.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax Amount:</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.tax_amount)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total:</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(totals.grand_total)}</Text>
            </View>
          </Card>
        )}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          {!isNetworkConnected && (
            <Text style={styles.offlineNotice}>
              You're offline. Invoice will be saved locally and synced when reconnected.
            </Text>
          )}
          <Button
            title="Create Invoice"
            onPress={handleSubmit}
            loading={isSubmitting}
            fullWidth
          />
        </View>
      </ScrollView>

      {renderClientModal()}
      {renderItemModal()}
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
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  clientSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  selectedClientText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  placeholderText: {
    fontSize: typography.fontSizes.md,
    color: colors.gray400,
  },
  chevron: {
    fontSize: typography.fontSizes.lg,
    color: colors.gray400,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
  emptyItems: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyItemsText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
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
  itemDetails: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  itemActions: {
    alignItems: 'flex-end',
  },
  itemTotal: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.semibold,
    marginBottom: spacing.sm,
  },
  itemButtons: {
    flexDirection: 'row',
  },
  itemButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray100,
  },
  deleteButton: {
    backgroundColor: colors.error + '20',
  },
  itemButtonText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  deleteButtonText: {
    color: colors.error,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  grandTotalLabel: {
    fontSize: typography.fontSizes.lg,
    color: colors.text,
    fontWeight: typography.fontWeights.bold,
  },
  grandTotalValue: {
    fontSize: typography.fontSizes.lg,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  submitContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  offlineNotice: {
    fontSize: typography.fontSizes.sm,
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontStyle: 'italic',
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
  clientItem: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clientName: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
    marginBottom: spacing.xs,
  },
  clientEmail: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  addItemButton: {
    marginTop: spacing.lg,
  },
});