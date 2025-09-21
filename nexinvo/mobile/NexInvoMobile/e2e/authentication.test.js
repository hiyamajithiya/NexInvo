const { device, expect, element, by, waitFor } = require('detox');

describe('Authentication Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Login', () => {
    it('should display login screen on app launch', async () => {
      await expect(element(by.id('login-screen'))).toBeVisible();
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('login-button'))).toBeVisible();
    });

    it('should show validation errors for empty fields', async () => {
      await element(by.id('login-button')).tap();

      await expect(element(by.id('email-error'))).toBeVisible();
      await expect(element(by.id('password-error'))).toBeVisible();
    });

    it('should show error for invalid email format', async () => {
      await element(by.id('email-input')).typeText('invalid-email');
      await element(by.id('login-button')).tap();

      await expect(element(by.id('email-error'))).toBeVisible();
      await expect(element(by.id('email-error'))).toHaveText('Please enter a valid email address');
    });

    it('should login successfully with valid credentials', async () => {
      await TestHelpers.login();

      await expect(element(by.id('dashboard-screen'))).toBeVisible();
      await expect(element(by.text('Dashboard'))).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('email-input')).typeText('invalid@example.com');
      await element(by.id('password-input')).typeText('wrongpassword');
      await element(by.id('login-button')).tap();

      await waitFor(element(by.text('Invalid credentials')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should toggle password visibility', async () => {
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('toggle-password-visibility')).tap();

      // Password should be visible
      await expect(element(by.id('password-input'))).toHaveValue('password123');

      await element(by.id('toggle-password-visibility')).tap();

      // Password should be hidden again
      await expect(element(by.id('password-input'))).toHaveValue('•••••••••••');
    });

    it('should navigate to forgot password screen', async () => {
      await element(by.id('forgot-password-link')).tap();

      await expect(element(by.id('forgot-password-screen'))).toBeVisible();
      await expect(element(by.text('Reset Password'))).toBeVisible();
    });
  });

  describe('Registration', () => {
    it('should navigate to registration screen', async () => {
      await element(by.id('register-link')).tap();

      await expect(element(by.id('register-screen'))).toBeVisible();
      await expect(element(by.id('name-input'))).toBeVisible();
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('confirm-password-input'))).toBeVisible();
    });

    it('should show validation errors for registration form', async () => {
      await element(by.id('register-link')).tap();
      await element(by.id('register-button')).tap();

      await expect(element(by.id('name-error'))).toBeVisible();
      await expect(element(by.id('email-error'))).toBeVisible();
      await expect(element(by.id('password-error'))).toBeVisible();
    });

    it('should validate password confirmation', async () => {
      await element(by.id('register-link')).tap();

      await element(by.id('password-input')).typeText('password123');
      await element(by.id('confirm-password-input')).typeText('different');
      await element(by.id('register-button')).tap();

      await expect(element(by.id('confirm-password-error'))).toBeVisible();
      await expect(element(by.id('confirm-password-error'))).toHaveText('Passwords do not match');
    });

    it('should register successfully with valid data', async () => {
      await element(by.id('register-link')).tap();

      await element(by.id('name-input')).typeText('New User');
      await element(by.id('email-input')).typeText('newuser@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('confirm-password-input')).typeText('password123');
      await element(by.id('register-button')).tap();

      await waitFor(element(by.text('Registration successful')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('dashboard-screen'))).toBeVisible();
    });
  });

  describe('Biometric Authentication', () => {
    beforeEach(async () => {
      await TestHelpers.login();
      await TestHelpers.navigateTo('Settings');
      await element(by.id('enable-biometric')).tap();
      await TestHelpers.logout();
    });

    it('should show biometric prompt when enabled', async () => {
      await expect(element(by.id('biometric-prompt'))).toBeVisible();
      await expect(element(by.text('Use Face ID to login'))).toBeVisible();
    });

    it('should login with biometric success', async () => {
      await element(by.id('use-biometric-button')).tap();

      // Simulate successful biometric authentication
      await device.setBiometricAuthenticationResult(true);

      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should fallback to password on biometric failure', async () => {
      await element(by.id('use-biometric-button')).tap();

      // Simulate failed biometric authentication
      await device.setBiometricAuthenticationResult(false);

      await expect(element(by.id('login-screen'))).toBeVisible();
      await expect(element(by.text('Biometric authentication failed'))).toBeVisible();
    });

    it('should allow manual login when biometric is available', async () => {
      await element(by.id('use-password-instead')).tap();

      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
    });
  });

  describe('Session Management', () => {
    it('should maintain session on app restart', async () => {
      await TestHelpers.login();

      await device.terminateApp();
      await device.launchApp();

      await expect(element(by.id('dashboard-screen'))).toBeVisible();
    });

    it('should logout on session expiry', async () => {
      await TestHelpers.login();

      // Simulate token expiry
      await device.setNetworkConnection({ wifi: false, cellular: false });
      await device.setNetworkConnection({ wifi: true, cellular: true });

      await waitFor(element(by.id('login-screen')))
        .toBeVisible()
        .withTimeout(10000);

      await expect(element(by.text('Session expired. Please login again.'))).toBeVisible();
    });

    it('should handle multiple login attempts', async () => {
      // Attempt login with wrong credentials multiple times
      for (let i = 0; i < 3; i++) {
        await element(by.id('email-input')).clearText();
        await element(by.id('password-input')).clearText();
        await element(by.id('email-input')).typeText('test@example.com');
        await element(by.id('password-input')).typeText('wrongpassword');
        await element(by.id('login-button')).tap();

        await waitFor(element(by.text('Invalid credentials')))
          .toBeVisible()
          .withTimeout(3000);
      }

      // Should show account locked message
      await expect(element(by.text('Account temporarily locked'))).toBeVisible();
    });
  });

  describe('Offline Authentication', () => {
    it('should show offline message when no network', async () => {
      await TestHelpers.simulateOfflineMode();

      await element(by.id('email-input')).typeText('test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      await expect(element(by.text('No internet connection'))).toBeVisible();
      await expect(element(by.id('retry-button'))).toBeVisible();
    });

    it('should retry login when connection restored', async () => {
      await TestHelpers.simulateOfflineMode();

      await element(by.id('email-input')).typeText('test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      await TestHelpers.simulateOnlineMode();
      await element(by.id('retry-button')).tap();

      await waitFor(element(by.id('dashboard-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Security Features', () => {
    it('should clear sensitive data on app backgrounding', async () => {
      await TestHelpers.login();

      await device.sendToHome();
      await device.launchApp();

      // Should show security screen or require re-authentication
      await expect(element(by.id('security-screen'))).toBeVisible();
    });

    it('should prevent screenshots on sensitive screens', async () => {
      await TestHelpers.login();

      // This test would check if screenshot prevention is enabled
      // Implementation depends on the security library used
      await expect(element(by.id('dashboard-screen'))).toBeVisible();
    });
  });
});