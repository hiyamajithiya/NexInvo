import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  isNetworkConnected: boolean;
  theme: 'light' | 'dark';
  activeTab: string;
  loading: {
    global: boolean;
    [key: string]: boolean;
  };
  notifications: Notification[];
  modals: {
    [key: string]: boolean;
  };
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: number;
}

const initialState: UIState = {
  isNetworkConnected: true,
  theme: 'light',
  activeTab: 'dashboard',
  loading: {
    global: false,
  },
  notifications: [],
  modals: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setNetworkStatus: (state, action: PayloadAction<boolean>) => {
      state.isNetworkConnected = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload;
    },
    setLoading: (state, action: PayloadAction<{ key: string; value: boolean }>) => {
      state.loading[action.payload.key] = action.payload.value;
    },
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setModal: (state, action: PayloadAction<{ key: string; value: boolean }>) => {
      state.modals[action.payload.key] = action.payload.value;
    },
  },
});

export const {
  setNetworkStatus,
  setTheme,
  setActiveTab,
  setLoading,
  setGlobalLoading,
  addNotification,
  removeNotification,
  clearNotifications,
  setModal,
} = uiSlice.actions;

export default uiSlice.reducer;