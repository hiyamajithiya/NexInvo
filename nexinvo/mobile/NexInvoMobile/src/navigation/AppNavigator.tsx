import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Main Screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import InvoiceListScreen from '../screens/invoices/InvoiceListScreen';
import InvoiceDetailScreen from '../screens/invoices/InvoiceDetailScreen';
import CreateInvoiceScreen from '../screens/invoices/CreateInvoiceScreen';
import ClientListScreen from '../screens/clients/ClientListScreen';
import ClientDetailScreen from '../screens/clients/ClientDetailScreen';
import CreateClientScreen from '../screens/clients/CreateClientScreen';
import IntegrationsScreen from '../screens/integrations/IntegrationsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

// Navigation Types
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Invoices: undefined;
  Clients: undefined;
  Integrations: undefined;
  Settings: undefined;
};

export type InvoiceStackParamList = {
  InvoiceList: undefined;
  InvoiceDetail: { invoiceId: string };
  CreateInvoice: { clientId?: string };
  EditInvoice: { invoiceId: string };
};

export type ClientStackParamList = {
  ClientList: undefined;
  ClientDetail: { clientId: string };
  CreateClient: undefined;
  EditClient: { clientId: string };
};

const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const InvoiceStack = createStackNavigator<InvoiceStackParamList>();
const ClientStack = createStackNavigator<ClientStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function InvoiceNavigator() {
  return (
    <InvoiceStack.Navigator>
      <InvoiceStack.Screen
        name="InvoiceList"
        component={InvoiceListScreen}
        options={{ title: 'Invoices' }}
      />
      <InvoiceStack.Screen
        name="InvoiceDetail"
        component={InvoiceDetailScreen}
        options={{ title: 'Invoice Details' }}
      />
      <InvoiceStack.Screen
        name="CreateInvoice"
        component={CreateInvoiceScreen}
        options={{ title: 'Create Invoice' }}
      />
    </InvoiceStack.Navigator>
  );
}

function ClientNavigator() {
  return (
    <ClientStack.Navigator>
      <ClientStack.Screen
        name="ClientList"
        component={ClientListScreen}
        options={{ title: 'Clients' }}
      />
      <ClientStack.Screen
        name="ClientDetail"
        component={ClientDetailScreen}
        options={{ title: 'Client Details' }}
      />
      <ClientStack.Screen
        name="CreateClient"
        component={CreateClientScreen}
        options={{ title: 'Add Client' }}
      />
    </ClientStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
      }}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="dashboard" size={size} color={color} />
          // ),
        }}
      />
      <MainTab.Screen
        name="Invoices"
        component={InvoiceNavigator}
        options={{
          tabBarLabel: 'Invoices',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="receipt" size={size} color={color} />
          // ),
        }}
      />
      <MainTab.Screen
        name="Clients"
        component={ClientNavigator}
        options={{
          tabBarLabel: 'Clients',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="people" size={size} color={color} />
          // ),
        }}
      />
      <MainTab.Screen
        name="Integrations"
        component={IntegrationsScreen}
        options={{
          tabBarLabel: 'Integrations',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="link" size={size} color={color} />
          // ),
        }}
      />
      <MainTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="settings" size={size} color={color} />
          // ),
        }}
      />
    </MainTab.Navigator>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}