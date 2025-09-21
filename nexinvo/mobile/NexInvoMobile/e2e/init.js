const { device, expect, element, by, waitFor } = require('detox');

// Global test timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

// Custom matchers
expect.extend({
  async toBeVisibleAndTappable(received) {
    try {
      await expect(received).toBeVisible();
      await expect(received).not.toBeNotTappable();
      return {
        pass: true,
        message: () => 'Element is visible and tappable'
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Element is not visible or tappable: ${error.message}`
      };
    }
  },

  async toHaveTextContaining(received, expectedText) {
    try {
      await expect(received).toHaveText(expect.stringContaining(expectedText));
      return {
        pass: true,
        message: () => `Element contains text: ${expectedText}`
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Element does not contain text: ${expectedText}`
      };
    }
  }
});

// Test helpers
global.TestHelpers = {
  // Login helper
  async login(email = 'test@example.com', password = 'password123') {
    await expect(element(by.id('login-screen'))).toBeVisible();

    await element(by.id('email-input')).typeText(email);
    await element(by.id('password-input')).typeText(password);
    await element(by.id('login-button')).tap();

    // Wait for dashboard to load
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(10000);
  },

  // Logout helper
  async logout() {
    await element(by.id('profile-tab')).tap();
    await element(by.id('logout-button')).tap();
    await element(by.text('Confirm')).tap();

    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(5000);
  },

  // Navigation helpers
  async navigateTo(screenName) {
    const navigationMap = {
      'Dashboard': 'dashboard-tab',
      'Invoices': 'invoices-tab',
      'Clients': 'clients-tab',
      'Reports': 'reports-tab',
      'Settings': 'settings-tab'
    };

    const tabId = navigationMap[screenName];
    if (tabId) {
      await element(by.id(tabId)).tap();
      await waitFor(element(by.id(`${screenName.toLowerCase()}-screen`)))
        .toBeVisible()
        .withTimeout(5000);
    }
  },

  // Create invoice helper
  async createInvoice(clientName = 'Test Client', amount = '1000') {
    await this.navigateTo('Dashboard');
    await element(by.id('quick-action-create-invoice')).tap();

    await waitFor(element(by.id('create-invoice-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Select client
    await element(by.id('client-selector')).tap();
    await element(by.text(clientName)).tap();

    // Add item
    await element(by.id('add-item-button')).tap();
    await element(by.id('item-description')).typeText('Test Service');
    await element(by.id('item-quantity')).typeText('1');
    await element(by.id('item-rate')).typeText(amount);
    await element(by.id('save-item-button')).tap();

    // Save invoice
    await element(by.id('save-invoice-button')).tap();

    await waitFor(element(by.text('Invoice created successfully')))
      .toBeVisible()
      .withTimeout(5000);
  },

  // Create client helper
  async createClient(name = 'New Test Client', email = 'newclient@test.com') {
    await this.navigateTo('Clients');
    await element(by.id('add-client-button')).tap();

    await waitFor(element(by.id('create-client-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('client-name')).typeText(name);
    await element(by.id('client-email')).typeText(email);
    await element(by.id('client-phone')).typeText('+1234567890');
    await element(by.id('client-address')).typeText('123 Test Street');

    await element(by.id('save-client-button')).tap();

    await waitFor(element(by.text('Client created successfully')))
      .toBeVisible()
      .withTimeout(5000);
  },

  // Wait for loading to complete
  async waitForLoadingToComplete() {
    await waitFor(element(by.id('loading-indicator')))
      .not.toBeVisible()
      .withTimeout(10000);
  },

  // Handle permissions
  async handlePermissions() {
    try {
      await device.disableSynchronization();

      // Handle camera permission
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.text('Allow')).tap();
    } catch (error) {
      // Permission dialog might not appear
      console.log('No permission dialog found');
    } finally {
      await device.enableSynchronization();
    }
  },

  // Take screenshot
  async takeScreenshot(name) {
    await device.takeScreenshot(name);
  },

  // Scroll helpers
  async scrollToElement(elementMatcher, scrollViewId = 'main-scroll-view') {
    await waitFor(element(elementMatcher))
      .toBeVisible()
      .whileElement(by.id(scrollViewId))
      .scroll(200, 'down');
  },

  // Form validation helpers
  async expectFormError(fieldId, errorMessage) {
    await expect(element(by.id(`${fieldId}-error`))).toBeVisible();
    await expect(element(by.id(`${fieldId}-error`))).toHaveText(errorMessage);
  },

  // Network helpers
  async simulateOfflineMode() {
    await device.setNetworkConnection({
      wifi: false,
      cellular: false
    });
  },

  async simulateOnlineMode() {
    await device.setNetworkConnection({
      wifi: true,
      cellular: true
    });
  },

  // Device helpers
  async rotateDevice(orientation = 'landscape') {
    await device.setOrientation(orientation);
    await device.takeScreenshot(`after-rotation-${orientation}`);
  },

  // Performance helpers
  async measurePerformance(action, name) {
    const startTime = Date.now();
    await action();
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Performance: ${name} took ${duration}ms`);
    return duration;
  }
};

// Global setup
beforeAll(async () => {
  await device.launchApp({
    permissions: {
      camera: 'YES',
      photos: 'YES',
      notifications: 'YES'
    },
    newInstance: true
  });
});

beforeEach(async () => {
  await device.reloadReactNative();
});

afterAll(async () => {
  await device.terminateApp();
});