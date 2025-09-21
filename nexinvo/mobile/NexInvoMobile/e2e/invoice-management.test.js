const { device, expect, element, by, waitFor } = require('detox');

describe('Invoice Management', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    await TestHelpers.login();
  });

  describe('Invoice Creation', () => {
    it('should create a new invoice successfully', async () => {
      await TestHelpers.createInvoice();

      await TestHelpers.navigateTo('Invoices');
      await expect(element(by.text('Test Service'))).toBeVisible();
    });

    it('should validate required fields in invoice creation', async () => {
      await TestHelpers.navigateTo('Dashboard');
      await element(by.id('quick-action-create-invoice')).tap();

      await element(by.id('save-invoice-button')).tap();

      await expect(element(by.id('client-error'))).toBeVisible();
      await expect(element(by.text('Please select a client'))).toBeVisible();
    });

    it('should calculate totals automatically', async () => {
      await TestHelpers.navigateTo('Dashboard');
      await element(by.id('quick-action-create-invoice')).tap();

      // Select client
      await element(by.id('client-selector')).tap();
      await element(by.text('Test Client')).tap();

      // Add multiple items
      await element(by.id('add-item-button')).tap();
      await element(by.id('item-description')).typeText('Service 1');
      await element(by.id('item-quantity')).typeText('2');
      await element(by.id('item-rate')).typeText('100');
      await element(by.id('save-item-button')).tap();

      await element(by.id('add-item-button')).tap();
      await element(by.id('item-description')).typeText('Service 2');
      await element(by.id('item-quantity')).typeText('1');
      await element(by.id('item-rate')).typeText('150');
      await element(by.id('save-item-button')).tap();

      // Check calculated totals
      await expect(element(by.id('subtotal'))).toHaveText('₹350.00');
      await expect(element(by.id('tax-amount'))).toHaveText('₹63.00');
      await expect(element(by.id('grand-total'))).toHaveText('₹413.00');
    });

    it('should save invoice as draft', async () => {
      await TestHelpers.navigateTo('Dashboard');
      await element(by.id('quick-action-create-invoice')).tap();

      await element(by.id('client-selector')).tap();
      await element(by.text('Test Client')).tap();

      await element(by.id('save-draft-button')).tap();

      await waitFor(element(by.text('Draft saved successfully')))
        .toBeVisible()
        .withTimeout(5000);

      await TestHelpers.navigateTo('Invoices');
      await element(by.id('filter-drafts')).tap();
      await expect(element(by.text('Draft'))).toBeVisible();
    });

    it('should add notes and terms to invoice', async () => {
      await TestHelpers.navigateTo('Dashboard');
      await element(by.id('quick-action-create-invoice')).tap();

      await element(by.id('client-selector')).tap();
      await element(by.text('Test Client')).tap();

      await TestHelpers.scrollToElement(by.id('notes-section'));
      await element(by.id('invoice-notes')).typeText('Thank you for your business!');
      await element(by.id('invoice-terms')).typeText('Payment due within 30 days.');

      await element(by.id('save-invoice-button')).tap();

      await waitFor(element(by.text('Invoice created successfully')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Invoice List and Filtering', () => {
    it('should display list of invoices', async () => {
      await TestHelpers.navigateTo('Invoices');

      await expect(element(by.id('invoice-list'))).toBeVisible();
      await expect(element(by.id('invoice-item-0'))).toBeVisible();
    });

    it('should filter invoices by status', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('filter-button')).tap();
      await element(by.id('filter-pending')).tap();
      await element(by.id('apply-filter')).tap();

      await expect(element(by.text('Pending'))).toBeVisible();
    });

    it('should search invoices by client name', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('search-input')).typeText('Test Client');

      await waitFor(element(by.text('Test Client')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should search invoices by invoice number', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('search-input')).typeText('INV-001');

      await waitFor(element(by.text('INV-001')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should sort invoices by date', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('sort-button')).tap();
      await element(by.id('sort-by-date-desc')).tap();

      // Verify newest invoice appears first
      await expect(element(by.id('invoice-item-0')).atIndex(0)).toBeVisible();
    });

    it('should refresh invoice list with pull to refresh', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('invoice-list')).swipe('down', 'fast');

      await waitFor(element(by.id('loading-indicator')))
        .toBeVisible()
        .withTimeout(3000);

      await TestHelpers.waitForLoadingToComplete();
    });
  });

  describe('Invoice Details and Actions', () => {
    it('should view invoice details', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await expect(element(by.id('invoice-detail-screen'))).toBeVisible();
      await expect(element(by.id('invoice-number'))).toBeVisible();
      await expect(element(by.id('client-name'))).toBeVisible();
      await expect(element(by.id('invoice-amount'))).toBeVisible();
    });

    it('should edit invoice', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('edit-invoice-button')).tap();

      await expect(element(by.id('edit-invoice-screen'))).toBeVisible();

      await element(by.id('item-description-0')).clearText();
      await element(by.id('item-description-0')).typeText('Updated Service');

      await element(by.id('save-invoice-button')).tap();

      await waitFor(element(by.text('Invoice updated successfully')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should duplicate invoice', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('duplicate-invoice-button')).tap();

      await expect(element(by.id('create-invoice-screen'))).toBeVisible();
      await expect(element(by.id('client-selector'))).toHaveText('Test Client');

      await element(by.id('save-invoice-button')).tap();

      await waitFor(element(by.text('Invoice created successfully')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should delete invoice', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('delete-invoice-button')).tap();
      await element(by.text('Confirm')).tap();

      await waitFor(element(by.text('Invoice deleted successfully')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should share invoice PDF', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('share-pdf-button')).tap();

      await TestHelpers.handlePermissions();

      await waitFor(element(by.text('PDF generated successfully')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should send invoice via email', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('send-email-button')).tap();

      await expect(element(by.id('email-dialog'))).toBeVisible();
      await element(by.id('email-subject')).typeText('Invoice INV-001');
      await element(by.id('email-body')).typeText('Please find attached invoice.');

      await element(by.id('send-email-confirm')).tap();

      await waitFor(element(by.text('Invoice sent successfully')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Invoice Status Management', () => {
    it('should mark invoice as sent', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('mark-sent-button')).tap();

      await waitFor(element(by.text('Sent')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should mark invoice as paid', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('mark-paid-button')).tap();

      await expect(element(by.id('payment-dialog'))).toBeVisible();
      await element(by.id('payment-date')).tap();
      await element(by.text('Today')).tap();
      await element(by.id('payment-method')).tap();
      await element(by.text('Bank Transfer')).tap();

      await element(by.id('confirm-payment')).tap();

      await waitFor(element(by.text('Paid')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should mark invoice as overdue', async () => {
      await TestHelpers.navigateTo('Invoices');

      // Filter for overdue invoices
      await element(by.id('filter-button')).tap();
      await element(by.id('filter-overdue')).tap();
      await element(by.id('apply-filter')).tap();

      await expect(element(by.text('Overdue'))).toBeVisible();
    });

    it('should add payment to partially paid invoice', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('add-payment-button')).tap();

      await element(by.id('payment-amount')).typeText('500');
      await element(by.id('payment-date')).tap();
      await element(by.text('Today')).tap();

      await element(by.id('save-payment')).tap();

      await waitFor(element(by.text('Partially Paid')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Bulk Operations', () => {
    it('should select multiple invoices', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('select-mode-button')).tap();

      await element(by.id('invoice-checkbox-0')).tap();
      await element(by.id('invoice-checkbox-1')).tap();

      await expect(element(by.text('2 selected'))).toBeVisible();
    });

    it('should bulk mark as sent', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('select-mode-button')).tap();
      await element(by.id('invoice-checkbox-0')).tap();
      await element(by.id('invoice-checkbox-1')).tap();

      await element(by.id('bulk-mark-sent')).tap();
      await element(by.text('Confirm')).tap();

      await waitFor(element(by.text('2 invoices marked as sent')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should bulk export to PDF', async () => {
      await TestHelpers.navigateTo('Invoices');

      await element(by.id('select-mode-button')).tap();
      await element(by.id('invoice-checkbox-0')).tap();
      await element(by.id('invoice-checkbox-1')).tap();

      await element(by.id('bulk-export-pdf')).tap();

      await waitFor(element(by.text('PDFs exported successfully')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });

  describe('Offline Invoice Management', () => {
    it('should create invoice offline', async () => {
      await TestHelpers.simulateOfflineMode();

      await TestHelpers.navigateTo('Dashboard');
      await element(by.id('quick-action-create-invoice')).tap();

      await element(by.id('client-selector')).tap();
      await element(by.text('Test Client')).tap();

      await element(by.id('add-item-button')).tap();
      await element(by.id('item-description')).typeText('Offline Service');
      await element(by.id('item-quantity')).typeText('1');
      await element(by.id('item-rate')).typeText('500');
      await element(by.id('save-item-button')).tap();

      await element(by.id('save-invoice-button')).tap();

      await expect(element(by.text('Saved offline. Will sync when online.'))).toBeVisible();
    });

    it('should sync offline invoices when back online', async () => {
      // Ensure there are offline invoices
      await TestHelpers.simulateOfflineMode();
      await TestHelpers.createInvoice('Test Client', '750');

      await TestHelpers.simulateOnlineMode();

      await waitFor(element(by.text('Syncing offline data...')))
        .toBeVisible()
        .withTimeout(5000);

      await waitFor(element(by.text('Sync completed')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Invoice Templates', () => {
    it('should create invoice from template', async () => {
      await TestHelpers.navigateTo('Dashboard');
      await element(by.id('quick-action-create-invoice')).tap();

      await element(by.id('template-selector')).tap();
      await element(by.text('Standard Service Template')).tap();

      await expect(element(by.id('item-description-0'))).toHaveText('Consulting Service');
      await expect(element(by.id('item-rate-0'))).toHaveText('100');

      await element(by.id('client-selector')).tap();
      await element(by.text('Test Client')).tap();

      await element(by.id('save-invoice-button')).tap();

      await waitFor(element(by.text('Invoice created successfully')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should save invoice as template', async () => {
      await TestHelpers.navigateTo('Invoices');
      await element(by.id('invoice-item-0')).tap();

      await element(by.id('save-as-template-button')).tap();

      await element(by.id('template-name')).typeText('Custom Service Template');
      await element(by.id('save-template')).tap();

      await waitFor(element(by.text('Template saved successfully')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle large invoice lists efficiently', async () => {
      await TestHelpers.navigateTo('Invoices');

      const scrollTime = await TestHelpers.measurePerformance(async () => {
        // Simulate scrolling through large list
        for (let i = 0; i < 10; i++) {
          await element(by.id('invoice-list')).scroll(300, 'down');
          await device.pressKey('back');
        }
      }, 'Large list scrolling');

      expect(scrollTime).toBeLessThan(3000);
    });

    it('should handle API errors gracefully', async () => {
      await TestHelpers.simulateOfflineMode();

      await TestHelpers.navigateTo('Invoices');

      await expect(element(by.text('Unable to load invoices'))).toBeVisible();
      await expect(element(by.id('retry-button'))).toBeVisible();

      await TestHelpers.simulateOnlineMode();
      await element(by.id('retry-button')).tap();

      await TestHelpers.waitForLoadingToComplete();
      await expect(element(by.id('invoice-list'))).toBeVisible();
    });
  });
});