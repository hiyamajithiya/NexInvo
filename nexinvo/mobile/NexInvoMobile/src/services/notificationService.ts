import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';
import { addNotification } from '../store/slices/uiSlice';

interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
  type?: 'invoice_overdue' | 'payment_received' | 'client_added' | 'reminder' | 'system';
}

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  scheduledTime: Date;
  type: string;
  data?: any;
}

class NotificationService {
  private notificationPermission: boolean = false;
  private scheduledNotifications: ScheduledNotification[] = [];

  async initialize() {
    await this.requestPermissions();
    await this.loadScheduledNotifications();
    this.setupNotificationHandlers();
  }

  async requestPermissions(): Promise<boolean> {
    try {
      // For now, we'll simulate permission request
      // In a real implementation, you would use @react-native-async-storage/async-storage
      // or @react-native-community/push-notification-ios for iOS
      // and react-native-push-notification for Android

      const hasPermission = await AsyncStorage.getItem('notification_permission');
      if (hasPermission === null) {
        // Simulate permission request dialog
        Alert.alert(
          'Enable Notifications',
          'Allow NexInvo to send you notifications about important invoice updates?',
          [
            {
              text: 'Don\'t Allow',
              onPress: () => {
                this.notificationPermission = false;
                AsyncStorage.setItem('notification_permission', 'denied');
              },
            },
            {
              text: 'Allow',
              onPress: () => {
                this.notificationPermission = true;
                AsyncStorage.setItem('notification_permission', 'granted');
              },
            },
          ]
        );
      } else {
        this.notificationPermission = hasPermission === 'granted';
      }

      return this.notificationPermission;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async sendLocalNotification(payload: NotificationPayload) {
    if (!this.notificationPermission) {
      console.log('Notifications not permitted');
      return;
    }

    // Add to in-app notification system
    store.dispatch(addNotification({
      type: payload.type === 'payment_received' ? 'success' :
            payload.type === 'invoice_overdue' ? 'warning' : 'info',
      message: `${payload.title}: ${payload.body}`,
    }));

    // In a real implementation, you would use:
    // PushNotification.localNotification({
    //   title: payload.title,
    //   message: payload.body,
    //   userInfo: payload.data,
    // });

    console.log('Local notification sent:', payload);
  }

  async scheduleNotification(
    id: string,
    title: string,
    body: string,
    scheduledTime: Date,
    type: string = 'reminder',
    data?: any
  ) {
    if (!this.notificationPermission) {
      console.log('Notifications not permitted');
      return;
    }

    const notification: ScheduledNotification = {
      id,
      title,
      body,
      scheduledTime,
      type,
      data,
    };

    this.scheduledNotifications.push(notification);
    await this.saveScheduledNotifications();

    // In a real implementation, you would use:
    // PushNotification.localNotificationSchedule({
    //   id,
    //   title,
    //   message: body,
    //   date: scheduledTime,
    //   userInfo: data,
    // });

    console.log('Notification scheduled:', notification);
  }

  async cancelNotification(id: string) {
    this.scheduledNotifications = this.scheduledNotifications.filter(
      notification => notification.id !== id
    );
    await this.saveScheduledNotifications();

    // In a real implementation:
    // PushNotification.cancelLocalNotifications({ id });

    console.log('Notification cancelled:', id);
  }

  async scheduleInvoiceReminder(invoiceId: string, invoiceNumber: string, dueDate: Date) {
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3); // 3 days before due date

    if (reminderDate > new Date()) {
      await this.scheduleNotification(
        `invoice_reminder_${invoiceId}`,
        'Invoice Due Soon',
        `Invoice ${invoiceNumber} is due in 3 days`,
        reminderDate,
        'reminder',
        { invoiceId, invoiceNumber }
      );
    }

    // Schedule overdue notification
    const overdueDate = new Date(dueDate);
    overdueDate.setDate(overdueDate.getDate() + 1); // 1 day after due date

    await this.scheduleNotification(
      `invoice_overdue_${invoiceId}`,
      'Invoice Overdue',
      `Invoice ${invoiceNumber} is now overdue`,
      overdueDate,
      'invoice_overdue',
      { invoiceId, invoiceNumber }
    );
  }

  async notifyPaymentReceived(invoiceNumber: string, amount: number, clientName: string) {
    await this.sendLocalNotification({
      title: 'Payment Received',
      body: `₹${amount.toLocaleString()} received for Invoice ${invoiceNumber} from ${clientName}`,
      type: 'payment_received',
      data: { invoiceNumber, amount, clientName },
    });
  }

  async notifyNewClient(clientName: string) {
    await this.sendLocalNotification({
      title: 'New Client Added',
      body: `${clientName} has been added to your client list`,
      type: 'client_added',
      data: { clientName },
    });
  }

  async notifyInvoiceCreated(invoiceNumber: string, clientName: string, amount: number) {
    await this.sendLocalNotification({
      title: 'Invoice Created',
      body: `Invoice ${invoiceNumber} for ₹${amount.toLocaleString()} created for ${clientName}`,
      type: 'system',
      data: { invoiceNumber, clientName, amount },
    });
  }

  async notifyBackupCompleted() {
    await this.sendLocalNotification({
      title: 'Data Backup Complete',
      body: 'Your invoice data has been successfully backed up',
      type: 'system',
    });
  }

  async notifyOfflineSync(syncedItems: number) {
    await this.sendLocalNotification({
      title: 'Offline Data Synced',
      body: `${syncedItems} items have been synced to the server`,
      type: 'system',
      data: { syncedItems },
    });
  }

  private setupNotificationHandlers() {
    // In a real implementation, you would set up handlers for:
    // - Notification tapped while app is in background
    // - Notification received while app is in foreground
    // - Deep linking from notifications

    console.log('Notification handlers set up');
  }

  private async loadScheduledNotifications() {
    try {
      const stored = await AsyncStorage.getItem('scheduled_notifications');
      if (stored) {
        this.scheduledNotifications = JSON.parse(stored).map((item: any) => ({
          ...item,
          scheduledTime: new Date(item.scheduledTime),
        }));
      }
    } catch (error) {
      console.error('Error loading scheduled notifications:', error);
    }
  }

  private async saveScheduledNotifications() {
    try {
      await AsyncStorage.setItem(
        'scheduled_notifications',
        JSON.stringify(this.scheduledNotifications)
      );
    } catch (error) {
      console.error('Error saving scheduled notifications:', error);
    }
  }

  async getScheduledNotifications(): Promise<ScheduledNotification[]> {
    return this.scheduledNotifications;
  }

  async clearAllNotifications() {
    this.scheduledNotifications = [];
    await this.saveScheduledNotifications();

    // In a real implementation:
    // PushNotification.cancelAllLocalNotifications();

    console.log('All notifications cleared');
  }

  async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      return settings ? JSON.parse(settings) : {
        invoiceReminders: true,
        paymentNotifications: true,
        overdueAlerts: true,
        systemNotifications: true,
        clientUpdates: true,
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  }

  async updateNotificationSettings(settings: {
    invoiceReminders?: boolean;
    paymentNotifications?: boolean;
    overdueAlerts?: boolean;
    systemNotifications?: boolean;
    clientUpdates?: boolean;
  }) {
    try {
      const currentSettings = await this.getNotificationSettings();
      const newSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem('notification_settings', JSON.stringify(newSettings));
      return newSettings;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return null;
    }
  }

  async openNotificationSettings() {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('Error opening notification settings:', error);
      Alert.alert(
        'Settings Unavailable',
        'Unable to open notification settings. Please check your device settings manually.'
      );
    }
  }
}

export const notificationService = new NotificationService();