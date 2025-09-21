module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js'
    },
    jest: {
      setupFilesAfterEnv: ['<rootDir>/e2e/init.js']
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/NexInvoMobile.app',
      build: 'xcodebuild -workspace ios/NexInvoMobile.xcworkspace -scheme NexInvoMobile -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/NexInvoMobile.app',
      build: 'xcodebuild -workspace ios/NexInvoMobile.xcworkspace -scheme NexInvoMobile -configuration Release -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug'
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14',
        os: 'iOS 16.0'
      }
    },
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*'
      }
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_3_API_30'
      }
    },
    genymotion: {
      type: 'android.genycloud',
      device: {
        recipeUUID: 'b8b6c7d1-e3d2-4bfb-a8e1-6c5d4e3f2a1b'
      }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release'
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release'
    },
    'android.attached.debug': {
      device: 'attached',
      app: 'android.debug'
    }
  },
  behavior: {
    init: {
      reinstallApp: true,
      exposeGlobals: false
    },
    cleanup: {
      shutdownDevice: false
    }
  },
  artifacts: {
    rootDir: './e2e/artifacts',
    plugins: {
      log: 'failing',
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
        takeWhen: {
          testStart: false,
          testDone: true,
          appNotReady: true
        }
      },
      video: {
        android: 'failing',
        ios: 'failing'
      },
      instruments: {
        location: './e2e/artifacts/instruments'
      },
      timeline: {
        enabled: true
      }
    }
  },
  logger: {
    level: 'info',
    overrideConsole: true
  }
};