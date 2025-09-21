import React, { useState, useCallback } from 'react';
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
import { fetchClients } from '../../store/slices/clientSlice';
import { ClientStackParamList } from '../../navigation/AppNavigator';
import { Client } from '../../store/slices/clientSlice';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, borderRadius } from '../../theme';

type ClientListScreenNavigationProp = StackNavigationProp<ClientStackParamList, 'ClientList'>;

interface Props {
  navigation: ClientListScreenNavigationProp;
}

export default function ClientListScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { clients, isLoading } = useSelector((state: RootState) => state.clients);

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filteredClients = clients.filter(client => {
    const matchesSearch = searchQuery === '' ||
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const loadClients = useCallback(async () => {
    try {
      await dispatch(fetchClients()).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load clients');
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  };

  const handleClientPress = (client: Client) => {
    navigation.navigate('ClientDetail', { clientId: client.id });
  };

  const handleCreateClient = () => {
    navigation.navigate('CreateClient');
  };

  const handleCreateInvoiceForClient = (client: Client) => {
    // Navigate to invoice creation with pre-selected client
    navigation.navigate('CreateInvoice', { clientId: client.id });
  };

  const getClientTypeLabel = (type: string) => {
    return type === 'individual' ? 'Individual' : 'Business';
  };

  const getClientInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const renderClientItem = ({ item }: { item: Client }) => (
    <TouchableOpacity onPress={() => handleClientPress(item)}>
      <Card style={styles.clientCard} variant="elevated">
        <View style={styles.clientHeader}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientInitials}>{getClientInitials(item.name)}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{item.name}</Text>
            <Text style={styles.clientType}>{getClientTypeLabel(item.client_type)}</Text>
            <Text style={styles.clientEmail}>{item.email}</Text>
            {item.phone && <Text style={styles.clientPhone}>{item.phone}</Text>}
          </View>
          <View style={styles.clientActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleCreateInvoiceForClient(item)}
            >
              <Text style={styles.quickActionText}>Invoice</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.clientFooter}>
          <View style={styles.clientLocation}>
            <Text style={styles.locationText}>
              {item.city}, {item.state}
            </Text>
          </View>
          {(item.gstin || item.pan) && (
            <View style={styles.clientIdentifiers}>
              {item.gstin && (
                <Text style={styles.identifierText}>GSTIN: {item.gstin}</Text>
              )}
              {item.pan && (
                <Text style={styles.identifierText}>PAN: {item.pan}</Text>
              )}
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.gray400}
        />
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No Clients Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try adjusting your search terms'
          : 'Add your first client to get started'
        }
      </Text>
      {!searchQuery && (
        <Button
          title="Add Client"
          onPress={handleCreateClient}
          style={styles.emptyButton}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Clients</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateClient}
        >
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredClients}
        renderItem={renderClientItem}
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
    marginBottom: spacing.sm,
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
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  clientCard: {
    marginBottom: spacing.md,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  clientInitials: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  clientInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  clientName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  clientType: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
    marginBottom: spacing.xs,
  },
  clientEmail: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  clientPhone: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  clientActions: {
    alignItems: 'flex-end',
  },
  quickActionButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  quickActionText: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    fontWeight: typography.fontWeights.medium,
  },
  clientFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  clientLocation: {
    marginBottom: spacing.xs,
  },
  locationText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  clientIdentifiers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  identifierText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginRight: spacing.md,
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