module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './e2e/reports',
      filename: 'e2e-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'NexInvo Mobile E2E Test Report',
      logoImgPath: undefined,
      inlineSource: false
    }]
  ],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{js,jsx,ts,tsx}'
  ],
  coverageDirectory: 'e2e/coverage',
  coverageReporters: ['html', 'text', 'lcov'],
  bail: 1,
  forceExit: true,
  detectOpenHandles: true
};