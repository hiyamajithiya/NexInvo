import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock React Native modules
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
    name: 'TestScreen',
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// Mock React Native Vector Icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/Feather', () => 'Icon');

// Mock React Native Permissions
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
  },
  request: jest.fn(() => Promise.resolve('granted')),
  check: jest.fn(() => Promise.resolve('granted')),
}));

// Mock React Native Keychain
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(() => Promise.resolve()),
  getInternetCredentials: jest.fn(() =>
    Promise.resolve({
      username: 'testuser',
      password: 'testpass',
    })
  ),
  resetInternetCredentials: jest.fn(() => Promise.resolve()),
  getSupportedBiometryType: jest.fn(() => Promise.resolve('FaceID')),
}));

// Mock React Native Device Info
jest.mock('react-native-device-info', () => ({
  getDeviceId: jest.fn(() => 'test-device-id'),
  getSystemVersion: jest.fn(() => '14.0'),
  getBrand: jest.fn(() => 'Apple'),
  getModel: jest.fn(() => 'iPhone'),
  getUniqueId: jest.fn(() => 'unique-id'),
  getBuildNumber: jest.fn(() => '1'),
  getVersion: jest.fn(() => '1.0.0'),
  getBundleId: jest.fn(() => 'com.example.app'),
  getApplicationName: jest.fn(() => 'Test App'),
}));

// Mock Image picker
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn((options, callback) => {
    callback({
      assets: [
        {
          uri: 'file://test-image.jpg',
          type: 'image/jpeg',
          fileName: 'test-image.jpg',
          fileSize: 1024,
        },
      ],
    });
  }),
  launchCamera: jest.fn((options, callback) => {
    callback({
      assets: [
        {
          uri: 'file://test-camera.jpg',
          type: 'image/jpeg',
          fileName: 'test-camera.jpg',
          fileSize: 2048,
        },
      ],
    });
  }),
}));

// Mock RN Gesture Handler
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  State: {
    BEGAN: 'BEGAN',
    FAILED: 'FAILED',
    ACTIVE: 'ACTIVE',
    END: 'END',
    CANCELLED: 'CANCELLED',
    UNDETERMINED: 'UNDETERMINED',
  },
}));

// Mock Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((platform) => platform.ios),
}));

// Mock Dimensions
jest.mock('react-native/Libraries/Utilities/Dimensions', () => ({
  get: jest.fn(() => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
  prompt: jest.fn(),
}));

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openSettings: jest.fn(() => Promise.resolve()),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock AppState
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  currentState: 'active',
  addEventListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  removeEventListener: jest.fn(),
}));

// Global test utilities
global.fetch = jest.fn();

// Mock performance.now() for performance testing
global.performance = {
  now: jest.fn(() => Date.now()),
} as any;

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup global test environment
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Custom matchers for React Native Testing Library
expect.extend({
  toBeOnTheScreen() {
    return {
      pass: true,
      message: () => 'Element is on the screen',
    };
  },
  toHaveDisplayValue(received: any, expected: string) {
    const pass = received?.props?.value === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected element not to have display value ${expected}`
          : `Expected element to have display value ${expected}, but got ${received?.props?.value}`,
    };
  },
});

// Mock our custom services
jest.mock('../services/cacheManager', () => ({
  cacheManager: {
    initialize: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(() => ({
      totalItems: 0,
      totalSize: 0,
      hitRate: 0.85,
    })),
  },
}));

jest.mock('../services/performanceMonitor', () => ({
  performanceMonitor: {
    initialize: jest.fn(),
    recordNavigationMetric: jest.fn(),
    recordAPIMetric: jest.fn(),
    startTimer: jest.fn(),
    endTimer: jest.fn(),
    generateReport: jest.fn(() => Promise.resolve({
      summary: { averageAppPerformance: 85 },
    })),
  },
}));

jest.mock('../services/memoryManager', () => ({
  memoryManager: {
    initialize: jest.fn(),
    getMemoryStats: jest.fn(() => ({
      current: { percentage: 45 },
    })),
    performManualCleanup: jest.fn(() => Promise.resolve({
      strategiesExecuted: 3,
      totalFreed: 1024000,
      errors: [],
    })),
  },
}));

// Mock image optimization service
jest.mock('../services/imageOptimization', () => ({
  imageOptimization: {
    optimizeImage: jest.fn(() => Promise.resolve({
      uri: 'file://optimized-image.jpg',
      width: 300,
      height: 200,
      size: 50000,
      originalSize: 100000,
      compressionRatio: 0.5,
      format: 'JPEG',
    })),
    getStats: jest.fn(() => ({
      cachedImages: 5,
      totalCacheSize: 1024000,
    })),
  },
}));

// Mock bundle optimizer
jest.mock('../utils/bundleOptimization', () => ({
  bundleOptimizer: {
    initialize: jest.fn(),
    analyzeBundleSize: jest.fn(() => Promise.resolve({
      totalSize: 2500000,
      jsSize: 1800000,
      assetsSize: 700000,
      chunksCount: 5,
      duplicateModules: [],
      largestModules: [],
      recommendations: [],
    })),
    formatSize: jest.fn((bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`),
  },
}));

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOnTheScreen(): R;
      toHaveDisplayValue(expected: string): R;
    }
  }
}