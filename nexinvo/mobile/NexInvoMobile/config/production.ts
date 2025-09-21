/**
 * Production Configuration for NexInvo Mobile App
 * This file contains all production-specific settings
 */

export const productionConfig = {
  // API Configuration
  api: {
    baseURL: 'https://api.nexinvo.com/v1',
    timeout: 15000,
    retryAttempts: 3,
    retryDelay: 1000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Version': '1.0.0',
      'X-Platform': 'mobile',
    },
  },

  // Security Configuration
  security: {
    tokenRefreshThreshold: 300, // 5 minutes before expiry
    maxLoginAttempts: 5,
    lockoutDuration: 900, // 15 minutes
    biometricTimeout: 30, // seconds
    sessionTimeout: 3600, // 1 hour
    encryptionEnabled: true,
    certificatePinning: true,
  },

  // App Configuration
  app: {
    name: 'NexInvo',
    version: '1.0.0',
    bundleId: {
      ios: 'com.nexinvo.mobile',
      android: 'com.nexinvo.mobile',
    },
    deepLinkScheme: 'nexinvo',
    universalLinkDomain: 'nexinvo.com',
  },

  // Storage Configuration
  storage: {
    encryptionKey: 'nexinvo_production_key_2023',
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    cacheTTL: 86400, // 24 hours
    offlineStorageLimit: 100 * 1024 * 1024, // 100MB
    autoCleanup: true,
    backupEnabled: true,
  },

  // Analytics and Monitoring
  analytics: {
    enabled: true,
    firebaseConfig: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: 'nexinvo-prod.firebaseapp.com',
      projectId: 'nexinvo-prod',
      storageBucket: 'nexinvo-prod.appspot.com',
      messagingSenderId: process.env.FIREBASE_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    },
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: 'production',
      debug: false,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 10000,
      enableAutoSessionTracking: true,
      attachStacktrace: true,
      tracesSampleRate: 0.1,
    },
    mixpanel: {
      token: process.env.MIXPANEL_TOKEN,
      trackAutomaticEvents: true,
    },
  },

  // Push Notifications
  notifications: {
    enabled: true,
    fcmConfig: {
      projectId: 'nexinvo-prod',
      appId: process.env.FCM_APP_ID,
      apiKey: process.env.FCM_API_KEY,
    },
    channels: {
      invoices: {
        id: 'invoice_notifications',
        name: 'Invoice Notifications',
        importance: 'high',
        sound: 'default',
      },
      payments: {
        id: 'payment_notifications',
        name: 'Payment Notifications',
        importance: 'high',
        sound: 'default',
      },
      reminders: {
        id: 'reminder_notifications',
        name: 'Reminders',
        importance: 'default',
        sound: 'default',
      },
      system: {
        id: 'system_notifications',
        name: 'System Updates',
        importance: 'low',
        sound: 'none',
      },
    },
  },

  // Performance Configuration
  performance: {
    enablePerformanceMonitoring: true,
    renderTimeThreshold: 16, // 60fps = 16ms per frame
    memoryThreshold: 0.8, // 80% of available memory
    bundleLoadTimeout: 10000,
    imageCache: {
      maxSize: 20 * 1024 * 1024, // 20MB
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    listOptimization: {
      windowSize: 10,
      maxToRenderPerBatch: 5,
      updateCellsBatchingPeriod: 50,
      removeClippedSubviews: true,
    },
  },

  // Logging Configuration
  logging: {
    level: 'warn', // 'error', 'warn', 'info', 'debug'
    enableRemoteLogging: true,
    maxLogSize: 5 * 1024 * 1024, // 5MB
    logRetentionDays: 7,
    sensitiveFields: ['password', 'token', 'ssn', 'creditCard'],
    logEndpoint: 'https://logs.nexinvo.com/mobile',
  },

  // Feature Flags
  features: {
    biometricAuth: true,
    offlineMode: true,
    darkMode: true,
    exportFeatures: true,
    advancedReports: true,
    integrations: true,
    multiCurrency: true,
    recurringInvoices: true,
    templates: true,
    timeTracking: false, // Coming soon
    inventory: false, // Coming soon
    projectManagement: false, // Coming soon
  },

  // External Service URLs
  services: {
    cdn: 'https://cdn.nexinvo.com',
    fileUpload: 'https://upload.nexinvo.com',
    pdfGeneration: 'https://pdf.nexinvo.com',
    emailService: 'https://email.nexinvo.com',
    smsService: 'https://sms.nexinvo.com',
    paymentGateway: 'https://payments.nexinvo.com',
    webhooks: 'https://webhooks.nexinvo.com',
  },

  // Rate Limiting
  rateLimiting: {
    apiCalls: {
      perMinute: 60,
      perHour: 1000,
      perDay: 10000,
    },
    fileUploads: {
      perMinute: 5,
      perHour: 50,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    },
    pdfGeneration: {
      perMinute: 10,
      perHour: 100,
      perDay: 500,
    },
  },

  // Localization
  localization: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'hi', 'gu', 'mr'],
    fallbackLanguage: 'en',
    currencySymbols: {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
    },
    dateFormats: {
      short: 'DD/MM/YYYY',
      medium: 'MMM DD, YYYY',
      long: 'MMMM DD, YYYY',
    },
  },

  // Validation Rules
  validation: {
    invoice: {
      maxItems: 100,
      maxNoteLength: 1000,
      maxDescriptionLength: 500,
      minAmount: 0.01,
      maxAmount: 10000000,
    },
    client: {
      maxNameLength: 100,
      maxAddressLength: 500,
      maxEmailLength: 255,
      maxPhoneLength: 20,
    },
    file: {
      allowedTypes: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    },
  },

  // Cache Configuration
  cache: {
    invoices: {
      ttl: 300, // 5 minutes
      maxSize: 100,
    },
    clients: {
      ttl: 600, // 10 minutes
      maxSize: 200,
    },
    reports: {
      ttl: 900, // 15 minutes
      maxSize: 50,
    },
    settings: {
      ttl: 3600, // 1 hour
      maxSize: 10,
    },
  },

  // Sync Configuration
  sync: {
    enabled: true,
    interval: 300, // 5 minutes
    retryAttempts: 3,
    batchSize: 50,
    conflictResolution: 'server_wins',
    compressionEnabled: true,
  },

  // Development and Testing
  development: {
    enableFlipperInRelease: false,
    enableReactotronInRelease: false,
    showPerformanceMonitor: false,
    enableHotReload: false,
    enableLiveReload: false,
    enableFastRefresh: false,
    enableDebugging: false,
  },

  // App Store Configuration
  appStore: {
    ios: {
      appId: '123456789',
      teamId: process.env.APPLE_TEAM_ID,
      bundleId: 'com.nexinvo.mobile',
      provisioningProfile: 'NexInvo Production',
      certificate: 'Apple Distribution',
    },
    android: {
      packageName: 'com.nexinvo.mobile',
      keyAlias: 'nexinvo-release',
      keystore: 'nexinvo-release.keystore',
      track: 'production', // internal, alpha, beta, production
    },
  },

  // Compliance and Privacy
  compliance: {
    gdprCompliant: true,
    ccpaCompliant: true,
    dataRetentionDays: 2555, // 7 years
    anonymizeDataAfterDays: 1095, // 3 years
    cookiePolicy: true,
    privacyPolicyUrl: 'https://nexinvo.com/privacy',
    termsOfServiceUrl: 'https://nexinvo.com/terms',
  },

  // Backup and Disaster Recovery
  backup: {
    enabled: true,
    frequency: 'daily',
    retention: 30, // days
    encryption: true,
    cloudProvider: 'aws-s3',
    region: 'us-east-1',
  },

  // CDN Configuration
  cdn: {
    enabled: true,
    baseUrl: 'https://cdn.nexinvo.com',
    imagePath: '/images',
    documentPath: '/documents',
    cacheDuration: 86400, // 24 hours
    compression: true,
  },

  // Third-party Integrations
  integrations: {
    tally: {
      enabled: true,
      timeout: 30000,
      retryAttempts: 3,
    },
    quickbooks: {
      enabled: true,
      timeout: 30000,
      retryAttempts: 3,
    },
    stripe: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      enabled: true,
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      enabled: true,
    },
  },

  // Health Check Configuration
  healthCheck: {
    enabled: true,
    endpoint: '/health',
    interval: 60000, // 1 minute
    timeout: 5000, // 5 seconds
    retries: 3,
  },
};

export default productionConfig;