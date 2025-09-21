#!/usr/bin/env node

/**
 * Comprehensive test runner for NexInvo Mobile App
 * Supports multiple test types and environments
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

class TestRunner {
  constructor(options = {}) {
    this.options = options;
    this.results = {
      unit: null,
      integration: null,
      e2e: null,
      performance: null,
      coverage: null,
    };
    this.startTime = Date.now();
  }

  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    const border = '='.repeat(60);
    this.log(`\n${border}`, 'cyan');
    this.log(`${colors.bold}${message}`, 'cyan');
    this.log(`${border}\n`, 'cyan');
  }

  logSuccess(message) {
    this.log(`✅ ${message}`, 'green');
  }

  logError(message) {
    this.log(`❌ ${message}`, 'red');
  }

  logWarning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  logInfo(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  async checkPrerequisites() {
    this.logHeader('Checking Prerequisites');

    const checks = [
      { cmd: 'node --version', name: 'Node.js' },
      { cmd: 'npm --version', name: 'npm' },
      { cmd: 'npx --version', name: 'npx' },
    ];

    if (this.options.platform === 'ios' || this.options.platform === 'both') {
      checks.push(
        { cmd: 'xcodebuild -version', name: 'Xcode', optional: true },
        { cmd: 'xcrun simctl list', name: 'iOS Simulator', optional: true }
      );
    }

    if (this.options.platform === 'android' || this.options.platform === 'both') {
      checks.push(
        { cmd: 'adb version', name: 'Android Debug Bridge', optional: true },
        { cmd: 'emulator -version', name: 'Android Emulator', optional: true }
      );
    }

    for (const check of checks) {
      try {
        execSync(check.cmd, { stdio: 'pipe' });
        this.logSuccess(`${check.name} is available`);
      } catch (error) {
        if (check.optional) {
          this.logWarning(`${check.name} is not available (optional)`);
        } else {
          this.logError(`${check.name} is required but not available`);
          process.exit(1);
        }
      }
    }
  }

  async setupEnvironment() {
    this.logHeader('Setting Up Test Environment');

    // Create necessary directories
    const dirs = ['reports', 'coverage', 'e2e/artifacts'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logInfo(`Created directory: ${dir}`);
      }
    });

    // Install dependencies if needed
    if (!fs.existsSync('node_modules')) {
      this.logInfo('Installing dependencies...');
      execSync('npm ci', { stdio: 'inherit' });
    }

    // Setup test database/mock services
    if (this.options.setupMocks) {
      this.logInfo('Setting up mock services...');
      // Start mock API server, database, etc.
    }
  }

  async runUnitTests() {
    this.logHeader('Running Unit Tests');

    try {
      const cmd = [
        'npx jest',
        '--config jest.config.js',
        '--testPathPattern=".*\\.test\\.(ts|tsx|js|jsx)$"',
        '--testPathIgnorePatterns="/e2e/"',
        this.options.coverage ? '--coverage' : '',
        this.options.watch ? '--watch' : '',
        this.options.verbose ? '--verbose' : '',
        '--passWithNoTests',
      ].filter(Boolean).join(' ');

      if (this.options.watch) {
        spawn('npx', cmd.split(' ').slice(1), { stdio: 'inherit' });
        return { success: true, watch: true };
      }

      execSync(cmd, { stdio: 'inherit' });
      this.logSuccess('Unit tests passed');
      this.results.unit = { success: true, duration: Date.now() - this.startTime };
      return this.results.unit;
    } catch (error) {
      this.logError('Unit tests failed');
      this.results.unit = { success: false, error: error.message };
      if (!this.options.continueOnFailure) {
        throw error;
      }
      return this.results.unit;
    }
  }

  async runIntegrationTests() {
    this.logHeader('Running Integration Tests');

    try {
      const cmd = [
        'npx jest',
        '--config jest.config.js',
        '--testPathPattern=".*\\.integration\\.(test|spec)\\.(ts|tsx|js|jsx)$"',
        this.options.coverage ? '--coverage' : '',
        '--verbose',
        '--passWithNoTests',
      ].filter(Boolean).join(' ');

      execSync(cmd, { stdio: 'inherit' });
      this.logSuccess('Integration tests passed');
      this.results.integration = { success: true, duration: Date.now() - this.startTime };
      return this.results.integration;
    } catch (error) {
      this.logError('Integration tests failed');
      this.results.integration = { success: false, error: error.message };
      if (!this.options.continueOnFailure) {
        throw error;
      }
      return this.results.integration;
    }
  }

  async runE2ETests() {
    this.logHeader('Running E2E Tests');

    try {
      // Build the app first
      if (this.options.platform === 'ios' || this.options.platform === 'both') {
        this.logInfo('Building iOS app for E2E testing...');
        execSync('npx detox build --configuration ios.sim.debug', { stdio: 'inherit' });
      }

      if (this.options.platform === 'android' || this.options.platform === 'both') {
        this.logInfo('Building Android app for E2E testing...');
        execSync('npx detox build --configuration android.emu.debug', { stdio: 'inherit' });
      }

      // Run E2E tests
      const configs = [];
      if (this.options.platform === 'ios' || this.options.platform === 'both') {
        configs.push('ios.sim.debug');
      }
      if (this.options.platform === 'android' || this.options.platform === 'both') {
        configs.push('android.emu.debug');
      }

      for (const config of configs) {
        this.logInfo(`Running E2E tests on ${config}...`);
        execSync(`npx detox test --configuration ${config} --cleanup`, { stdio: 'inherit' });
      }

      this.logSuccess('E2E tests passed');
      this.results.e2e = { success: true, duration: Date.now() - this.startTime };
      return this.results.e2e;
    } catch (error) {
      this.logError('E2E tests failed');
      this.results.e2e = { success: false, error: error.message };
      if (!this.options.continueOnFailure) {
        throw error;
      }
      return this.results.e2e;
    }
  }

  async runPerformanceTests() {
    this.logHeader('Running Performance Tests');

    try {
      const cmd = [
        'npx jest',
        '--config jest.config.js',
        '--testPathPattern=".*performance.*\\.test\\.(ts|tsx|js|jsx)$"',
        '--verbose',
        '--passWithNoTests',
      ].join(' ');

      execSync(cmd, { stdio: 'inherit' });
      this.logSuccess('Performance tests passed');
      this.results.performance = { success: true, duration: Date.now() - this.startTime };
      return this.results.performance;
    } catch (error) {
      this.logError('Performance tests failed');
      this.results.performance = { success: false, error: error.message };
      if (!this.options.continueOnFailure) {
        throw error;
      }
      return this.results.performance;
    }
  }

  async generateCoverageReport() {
    this.logHeader('Generating Coverage Report');

    try {
      // Merge coverage reports
      execSync('npx nyc merge coverage/tmp coverage/merged.json', { stdio: 'pipe' });
      execSync('npx nyc report --reporter=html --reporter=lcov --reporter=text', { stdio: 'inherit' });

      // Generate coverage badge
      const coverage = this.getCoveragePercentage();
      this.generateCoverageBadge(coverage);

      this.logSuccess(`Coverage report generated (${coverage}%)`);
      this.results.coverage = { success: true, percentage: coverage };
      return this.results.coverage;
    } catch (error) {
      this.logError('Coverage report generation failed');
      this.results.coverage = { success: false, error: error.message };
      return this.results.coverage;
    }
  }

  getCoveragePercentage() {
    try {
      const coverageFile = 'coverage/coverage-summary.json';
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        return Math.round(coverage.total.statements.pct);
      }
    } catch (error) {
      this.logWarning('Could not determine coverage percentage');
    }
    return 0;
  }

  generateCoverageBadge(percentage) {
    const color = percentage >= 80 ? 'brightgreen' : percentage >= 60 ? 'yellow' : 'red';
    const badge = `https://img.shields.io/badge/coverage-${percentage}%25-${color}`;

    const badgeMarkdown = `![Coverage](${badge})`;
    fs.writeFileSync('coverage/badge.md', badgeMarkdown);
  }

  async runLinting() {
    this.logHeader('Running Linting and Code Quality Checks');

    try {
      // ESLint
      execSync('npx eslint src --ext .ts,.tsx,.js,.jsx', { stdio: 'inherit' });
      this.logSuccess('ESLint passed');

      // Prettier
      execSync('npx prettier --check "src/**/*.{ts,tsx,js,jsx,json}"', { stdio: 'inherit' });
      this.logSuccess('Prettier check passed');

      // TypeScript
      execSync('npx tsc --noEmit', { stdio: 'inherit' });
      this.logSuccess('TypeScript check passed');

      return { success: true };
    } catch (error) {
      this.logError('Linting failed');
      if (!this.options.continueOnFailure) {
        throw error;
      }
      return { success: false, error: error.message };
    }
  }

  generateTestReport() {
    this.logHeader('Generating Test Report');

    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      results: this.results,
      summary: this.generateSummary(),
    };

    fs.writeFileSync('reports/test-report.json', JSON.stringify(report, null, 2));
    this.generateHTMLReport(report);

    this.logSuccess('Test report generated: reports/test-report.html');
  }

  generateSummary() {
    const passed = Object.values(this.results).filter(r => r?.success).length;
    const failed = Object.values(this.results).filter(r => r?.success === false).length;
    const skipped = Object.values(this.results).filter(r => r === null).length;

    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
      success: failed === 0,
    };
  }

  generateHTMLReport(report) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>NexInvo Mobile Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .card { padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .skipped { background: #fff3cd; color: #856404; }
        .results { margin-top: 20px; }
        .result-item { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .success { background: #d4edda; }
        .error { background: #f8d7da; }
        .null { background: #e2e3e5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>NexInvo Mobile Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <p>Duration: ${Math.round(report.duration / 1000)}s</p>
    </div>

    <div class="summary">
        <div class="card passed">
            <h3>${report.summary.passed}</h3>
            <p>Passed</p>
        </div>
        <div class="card failed">
            <h3>${report.summary.failed}</h3>
            <p>Failed</p>
        </div>
        <div class="card skipped">
            <h3>${report.summary.skipped}</h3>
            <p>Skipped</p>
        </div>
    </div>

    <div class="results">
        <h2>Detailed Results</h2>
        ${Object.entries(report.results).map(([type, result]) => `
            <div class="result-item ${result === null ? 'null' : result.success ? 'success' : 'error'}">
                <strong>${type.toUpperCase()}</strong>:
                ${result === null ? 'Skipped' : result.success ? 'Passed' : 'Failed'}
                ${result?.duration ? ` (${Math.round(result.duration / 1000)}s)` : ''}
                ${result?.error ? `<br><small>${result.error}</small>` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;

    fs.writeFileSync('reports/test-report.html', html);
  }

  async cleanup() {
    this.logHeader('Cleaning Up');

    try {
      // Stop mock services
      if (this.options.setupMocks) {
        // Stop mock API server, database, etc.
      }

      // Clean up temporary files
      const tempDirs = ['coverage/tmp', 'e2e/artifacts'];
      tempDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      });

      this.logSuccess('Cleanup completed');
    } catch (error) {
      this.logWarning('Cleanup failed: ' + error.message);
    }
  }

  async run() {
    try {
      await this.checkPrerequisites();
      await this.setupEnvironment();

      if (this.options.lint) {
        await this.runLinting();
      }

      if (this.options.unit) {
        await this.runUnitTests();
      }

      if (this.options.integration) {
        await this.runIntegrationTests();
      }

      if (this.options.e2e) {
        await this.runE2ETests();
      }

      if (this.options.performance) {
        await this.runPerformanceTests();
      }

      if (this.options.coverage) {
        await this.generateCoverageReport();
      }

      this.generateTestReport();

      const summary = this.generateSummary();
      if (summary.success) {
        this.logSuccess(`All tests passed! (${summary.passed}/${summary.total})`);
      } else {
        this.logError(`${summary.failed} test(s) failed! (${summary.passed}/${summary.total})`);
        process.exit(1);
      }
    } catch (error) {
      this.logError('Test execution failed: ' + error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// CLI setup
const argv = yargs(hideBin(process.argv))
  .option('unit', {
    alias: 'u',
    type: 'boolean',
    description: 'Run unit tests',
    default: true,
  })
  .option('integration', {
    alias: 'i',
    type: 'boolean',
    description: 'Run integration tests',
    default: false,
  })
  .option('e2e', {
    alias: 'e',
    type: 'boolean',
    description: 'Run E2E tests',
    default: false,
  })
  .option('performance', {
    alias: 'p',
    type: 'boolean',
    description: 'Run performance tests',
    default: false,
  })
  .option('lint', {
    alias: 'l',
    type: 'boolean',
    description: 'Run linting and code quality checks',
    default: true,
  })
  .option('coverage', {
    alias: 'c',
    type: 'boolean',
    description: 'Generate coverage report',
    default: false,
  })
  .option('watch', {
    alias: 'w',
    type: 'boolean',
    description: 'Watch mode for unit tests',
    default: false,
  })
  .option('platform', {
    type: 'string',
    choices: ['ios', 'android', 'both'],
    description: 'Platform for E2E tests',
    default: 'both',
  })
  .option('continue-on-failure', {
    type: 'boolean',
    description: 'Continue running tests even if some fail',
    default: false,
  })
  .option('setup-mocks', {
    type: 'boolean',
    description: 'Setup mock services',
    default: false,
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Verbose output',
    default: false,
  })
  .help()
  .argv;

// Run the test runner
const runner = new TestRunner(argv);
runner.run();