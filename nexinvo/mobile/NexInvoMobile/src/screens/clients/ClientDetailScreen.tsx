import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppDispatch, RootState } from '../../store';
import { fetchClients, setCurrentClient } from '../../store/slices/clientSlice';
import { clientService } from '../../services/clientService';
import { ClientStackParamList } from '../../navigation/AppNavigator';
import { Client } from '../../store/slices/clientSlice';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

type ClientDetailScreenRouteProp = RouteProp<ClientStackParamList, 'ClientDetail'>;
type ClientDetailScreenNavigationProp = StackNavigationProp<ClientStackParamList, 'ClientDetail'>;

interface Props {
  route: ClientDetailScreenRouteProp;
  navigation: ClientDetailScreenNavigationProp;
}

interface ClientInvoice {
  id: string;
  invoice_number: string;
  date: string;
  grand_total: number;
  payment_status: string;
}

export default function ClientDetailScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { clients, currentClient } = useSelector((state: RootState) => state.clients);

  const [client, setClient] = useState<Client | null>(null);
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      // First try to find client in existing list
      const existingClient = clients.find(c => c.id === clientId);
      if (existingClient) {
        setClient(existingClient);
        dispatch(setCurrentClient(existingClient));
      } else {
        // If not found, fetch all clients
        await dispatch(fetchClients()).unwrap();
        const foundClient = clients.find(c => c.id === clientId);
        if (foundClient) {
          setClient(foundClient);
          dispatch(setCurrentClient(foundClient));
        }
      }

      // Load client invoices
      await loadClientInvoices();
    } catch (error) {
      Alert.alert('Error', 'Failed to load client details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const invoices = await clientService.getClientInvoices(clientId);
      setClientInvoices(invoices.slice(0, 5)); // Show only recent 5 invoices
    } catch (error) {
      console.error('Failed to load client invoices:', error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleEditClient = () => {
    navigation.navigate('EditClient', { clientId });
  };

  const handleCreateInvoice = () => {
    // Navigate to invoice creation with pre-selected client
    navigation.navigate('CreateInvoice', { clientId });
  };

  const handleCallClient = async () => {
    if (!client?.phone) {
      Alert.alert('No Phone Number', 'No phone number available for this client');
      return;
    }

    const phoneUrl = `tel:${client.phone}`;
    try {
      await Linking.openURL(phoneUrl);
    } catch (error) {
      Alert.alert('Error', 'Unable to make phone call');
    }
  };

  const handleEmailClient = async () => {
    if (!client?.email) {
      Alert.alert('No Email', 'No email address available for this client');
      return;
    }

    const emailUrl = `mailto:${client.email}`;
    try {
      await Linking.openURL(emailUrl);
    } catch (error) {
      Alert.alert('Error', 'Unable to open email app');
    }
  };

  const handleShareClient = async () => {
    if (!client) return;

    try {
      await Share.share({
        message: `${client.name}\n${client.email}\n${client.phone || ''}\n${client.billing_address}`,
        title: `Contact: ${client.name}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getClientInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getClientTypeLabel = (type: string) => {
    return type === 'individual' ? 'Individual' : 'Business';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'pending': return colors.warning;
      case 'overdue': return colors.error;
      default: return colors.textSecondary;
    }
  };

  if (isLoading || !client) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading client...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalInvoiceAmount = clientInvoices.reduce((sum, invoice) => sum + invoice.grand_total, 0);
  const paidInvoices = clientInvoices.filter(inv => inv.payment_status === 'paid');
  const pendingInvoices = clientInvoices.filter(inv => inv.payment_status === 'pending');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Card style={styles.headerCard} variant="elevated">
          <View style={styles.clientHeader}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientInitials}>{getClientInitials(client.name)}</Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientType}>{getClientTypeLabel(client.client_type)}</Text>
              <Text style={styles.clientCode}>Client Code: {client.client_code}</Text>
            </View>
          </View>
        </Card>

        {/* Contact Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Email:</Text>
            <TouchableOpacity onPress={handleEmailClient}>
              <Text style={styles.contactValue}>{client.email}</Text>
            </TouchableOpacity>
          </View>
          {client.phone && (
            <View style={styles.contactRow}>
              <Text style={styles.contactLabel}>Phone:</Text>
              <TouchableOpacity onPress={handleCallClient}>
                <Text style={styles.contactValue}>{client.phone}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Address Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Address Information</Text>
          <View style={styles.addressContainer}>
            <Text style={styles.addressTitle}>Billing Address:</Text>
            <Text style={styles.addressText}>{client.billing_address}</Text>
            <Text style={styles.addressText}>
              {client.city}, {client.state} - {client.pincode}
            </Text>
            <Text style={styles.addressText}>{client.country}</Text>
          </View>

          {client.shipping_address && (
            <View style={styles.addressContainer}>
              <Text style={styles.addressTitle}>Shipping Address:</Text>
              <Text style={styles.addressText}>{client.shipping_address}</Text>
            </View>
          )}
        </Card>

        {/* Tax Information */}
        {(client.gstin || client.pan) && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tax Information</Text>
            {client.gstin && (
              <View style={styles.taxRow}>
                <Text style={styles.taxLabel}>GSTIN:</Text>
                <Text style={styles.taxValue}>{client.gstin}</Text>
              </View>
            )}
            {client.pan && (
              <View style={styles.taxRow}>
                <Text style={styles.taxLabel}>PAN:</Text>
                <Text style={styles.taxValue}>{client.pan}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Invoice Summary */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Invoice Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Invoices:</Text>
            <Text style={styles.summaryValue}>{clientInvoices.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paid Invoices:</Text>
            <Text style={styles.summaryValue}>{paidInvoices.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pending Invoices:</Text>
            <Text style={styles.summaryValue}>{pendingInvoices.length}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalInvoiceAmount)}</Text>
          </View>
        </Card>

        {/* Recent Invoices */}
        <Card style={styles.sectionCard}>
          <View style={styles.invoicesHeader}>
            <Text style={styles.sectionTitle}>Recent Invoices</Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {isLoadingInvoices ? (
            <Text style={styles.loadingText}>Loading invoices...</Text>
          ) : clientInvoices.length === 0 ? (
            <View style={styles.emptyInvoices}>
              <Text style={styles.emptyInvoicesText}>No invoices yet</Text>
              <Button
                title="Create First Invoice"
                onPress={handleCreateInvoice}
                size="sm"
                style={styles.createInvoiceButton}
              />
            </View>
          ) : (
            clientInvoices.map((invoice, index) => (
              <View key={index} style={styles.invoiceRow}>
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                  <Text style={styles.invoiceDate}>{formatDate(invoice.date)}</Text>
                </View>
                <View style={styles.invoiceAmount}>
                  <Text style={styles.invoiceTotal}>{formatCurrency(invoice.grand_total)}</Text>
                  <Text style={[
                    styles.invoiceStatus,
                    { color: getStatusColor(invoice.payment_status) }
                  ]}>
                    {invoice.payment_status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Button
            title="Create Invoice"
            onPress={handleCreateInvoice}
            style={styles.actionButton}
          />

          <Button
            title="Edit Client"
            onPress={handleEditClient}
            variant="outline"
            style={styles.actionButton}
          />

          <View style={styles.contactActions}>
            <Button
              title="Call"
              onPress={handleCallClient}
              variant="outline"
              size="sm"
              style={styles.contactButton}
            />
            <Button
              title="Email"
              onPress={handleEmailClient}
              variant="outline"
              size="sm"
              style={styles.contactButton}
            />
            <Button
              title="Share"
              onPress={handleShareClient}
              variant="ghost"
              size="sm"
              style={styles.contactButton}
            />
          </View>
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
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  clientInitials: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  clientType: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
    marginBottom: spacing.xs,
  },
  clientCode: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
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
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  contactLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  contactValue: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  addressContainer: {
    marginBottom: spacing.md,
  },
  addressTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  addressText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  taxLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  taxValue: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
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
  invoicesHeader: {
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
  emptyInvoices: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyInvoicesText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  createInvoiceButton: {
    marginTop: spacing.sm,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
    marginBottom: spacing.xs,
  },
  invoiceDate: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  invoiceAmount: {
    alignItems: 'flex-end',
  },
  invoiceTotal: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: typography.fontWeights.semibold,
    marginBottom: spacing.xs,
  },
  invoiceStatus: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
  },
  actionContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
});