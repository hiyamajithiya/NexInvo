#!/usr/bin/env node

/**
 * Deployment Automation Script for NexInvo Mobile App
 * Handles the complete deployment process for iOS and Android
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

class DeploymentManager {
  constructor(options = {}) {
    this.options = options;
    this.startTime = Date.now();
    this.deploymentId = this.generateDeploymentId();
    this.results = {
      preDeployment: null,
      build: null,
      test: null,
      deploy: null,
      postDeployment: null,
    };
  }

  log(message, color = 'white') {
    const timestamp = new Date().toISOString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  }

  logHeader(message) {
    const border = '='.repeat(80);
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

  generateDeploymentId() {
    return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const { cwd = process.cwd(), timeout = 600000 } = options;

      this.logInfo(`Executing: ${command}`);

      const child = spawn('sh', ['-c', command], {
        cwd,
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        timeout,
      });

      let stdout = '';
      let stderr = '';

      if (!this.options.verbose) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', reject);
    });
  }

  async validateEnvironment() {
    this.logHeader('Environment Validation');

    const checks = [
      { cmd: 'node --version', name: 'Node.js' },
      { cmd: 'npm --version', name: 'npm' },
      { cmd: 'git --version', name: 'Git' },
    ];

    if (this.options.platform === 'ios' || this.options.platform === 'both') {
      checks.push(
        { cmd: 'xcodebuild -version', name: 'Xcode' },
        { cmd: 'bundle --version', name: 'Bundler' },
        { cmd: 'fastlane --version', name: 'Fastlane' }
      );
    }

    if (this.options.platform === 'android' || this.options.platform === 'both') {
      checks.push(
        { cmd: 'java -version', name: 'Java' },
        { cmd: './android/gradlew --version', name: 'Gradle' }
      );
    }

    for (const check of checks) {
      try {
        await this.executeCommand(check.cmd);
        this.logSuccess(`${check.name} is available`);
      } catch (error) {
        this.logError(`${check.name} is not available or not working properly`);
        throw new Error(`Environment validation failed for ${check.name}`);
      }
    }

    // Check environment variables
    const requiredEnvVars = this.getRequiredEnvVars();
    const missingVars = [];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingVars.push(envVar);
      }
    }

    if (missingVars.length > 0) {
      this.logError(`Missing required environment variables: ${missingVars.join(', ')}`);
      throw new Error('Environment validation failed due to missing variables');
    }

    this.logSuccess('Environment validation completed');
  }

  getRequiredEnvVars() {
    const baseVars = ['NODE_ENV'];
    const iosVars = ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_FILEPATH'];
    const androidVars = [
      'ANDROID_KEYSTORE_FILE',
      'ANDROID_KEYSTORE_PASSWORD',
      'ANDROID_KEY_ALIAS',
      'ANDROID_KEY_PASSWORD',
      'GOOGLE_PLAY_JSON_KEY_FILE',
    ];

    let required = [...baseVars];

    if (this.options.platform === 'ios' || this.options.platform === 'both') {
      required.push(...iosVars);
    }

    if (this.options.platform === 'android' || this.options.platform === 'both') {
      required.push(...androidVars);
    }

    return required;
  }

  async preDeploymentChecks() {
    this.logHeader('Pre-deployment Checks');

    try {
      // Check git status
      const gitStatus = await this.executeCommand('git status --porcelain');
      if (gitStatus.stdout.trim() && !this.options.force) {
        throw new Error('Git working directory is not clean. Use --force to override.');
      }

      // Check current branch
      const currentBranch = await this.executeCommand('git rev-parse --abbrev-ref HEAD');
      const branch = currentBranch.stdout.trim();

      if (this.options.environment === 'production' && branch !== 'main' && !this.options.force) {
        throw new Error(`Production deployments must be from 'main' branch. Current: ${branch}`);
      }

      this.logInfo(`Deploying from branch: ${branch}`);

      // Update version if specified
      if (this.options.version) {
        await this.updateVersion(this.options.version);
      }

      // Run security audit
      if (this.options.audit) {
        await this.executeCommand('npm audit --audit-level moderate');
        this.logSuccess('Security audit passed');
      }

      this.results.preDeployment = { success: true, branch, version: this.options.version };
      this.logSuccess('Pre-deployment checks completed');
    } catch (error) {
      this.results.preDeployment = { success: false, error: error.message };
      throw error;
    }
  }

  async updateVersion(version) {
    this.logInfo(`Updating version to ${version}`);

    // Update package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.version = version;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

    // Update iOS version
    if (this.options.platform === 'ios' || this.options.platform === 'both') {
      await this.executeCommand(`cd ios && bundle exec fastlane update_version version_name:${version}`);
    }

    // Update Android version
    if (this.options.platform === 'android' || this.options.platform === 'both') {
      const versionCode = Math.floor(Date.now() / 1000);
      await this.executeCommand(
        `cd android && bundle exec fastlane update_version version_name:${version} version_code:${versionCode}`
      );
    }

    this.logSuccess(`Version updated to ${version}`);
  }

  async runTests() {
    this.logHeader('Running Tests');

    try {
      if (this.options.skipTests) {
        this.logWarning('Tests skipped as requested');
        this.results.test = { success: true, skipped: true };
        return;
      }

      // Run linting
      await this.executeCommand('npm run lint');
      this.logSuccess('Linting passed');

      // Run type checking
      await this.executeCommand('npm run typecheck');
      this.logSuccess('Type checking passed');

      // Run unit tests
      await this.executeCommand('npm run test:unit');
      this.logSuccess('Unit tests passed');

      // Run integration tests
      await this.executeCommand('npm run test:integration');
      this.logSuccess('Integration tests passed');

      // Run E2E tests if requested
      if (this.options.e2e) {
        if (this.options.platform === 'ios' || this.options.platform === 'both') {
          await this.executeCommand('npm run test:e2e:ios');
          this.logSuccess('iOS E2E tests passed');
        }

        if (this.options.platform === 'android' || this.options.platform === 'both') {
          await this.executeCommand('npm run test:e2e:android');
          this.logSuccess('Android E2E tests passed');
        }
      }

      this.results.test = { success: true };
      this.logSuccess('All tests passed');
    } catch (error) {
      this.results.test = { success: false, error: error.message };
      throw error;
    }
  }

  async buildApp() {
    this.logHeader('Building Application');

    try {
      const buildResults = {};

      if (this.options.platform === 'ios' || this.options.platform === 'both') {
        await this.buildIOS();
        buildResults.ios = { success: true };
      }

      if (this.options.platform === 'android' || this.options.platform === 'both') {
        await this.buildAndroid();
        buildResults.android = { success: true };
      }

      this.results.build = { success: true, platforms: buildResults };
      this.logSuccess('Application build completed');
    } catch (error) {
      this.results.build = { success: false, error: error.message };
      throw error;
    }
  }

  async buildIOS() {
    this.logInfo('Building iOS application...');

    const lane = this.options.environment === 'production' ? 'beta' : this.options.environment;

    await this.executeCommand(`cd ios && bundle exec fastlane ${lane}`, {
      timeout: 1800000, // 30 minutes
    });

    this.logSuccess('iOS build completed');
  }

  async buildAndroid() {
    this.logInfo('Building Android application...');

    const lane = this.options.environment === 'production' ? 'beta' : this.options.environment;

    await this.executeCommand(`cd android && bundle exec fastlane ${lane}`, {
      timeout: 1800000, // 30 minutes
    });

    this.logSuccess('Android build completed');
  }

  async deployApp() {
    this.logHeader('Deploying Application');

    try {
      const deployResults = {};

      if (this.options.platform === 'ios' || this.options.platform === 'both') {
        if (this.options.environment === 'production') {
          await this.deployIOSProduction();
        }
        deployResults.ios = { success: true };
      }

      if (this.options.platform === 'android' || this.options.platform === 'both') {
        if (this.options.environment === 'production') {
          await this.deployAndroidProduction();
        }
        deployResults.android = { success: true };
      }

      this.results.deploy = { success: true, platforms: deployResults };
      this.logSuccess('Application deployment completed');
    } catch (error) {
      this.results.deploy = { success: false, error: error.message };
      throw error;
    }
  }

  async deployIOSProduction() {
    this.logInfo('Deploying iOS to App Store...');

    if (this.options.autoRelease) {
      await this.executeCommand('cd ios && bundle exec fastlane release');
    } else {
      this.logInfo('iOS build is available in TestFlight for manual release');
    }

    this.logSuccess('iOS deployment completed');
  }

  async deployAndroidProduction() {
    this.logInfo('Deploying Android to Google Play...');

    if (this.options.autoRelease) {
      await this.executeCommand('cd android && bundle exec fastlane release');
    } else {
      this.logInfo('Android build is available in Play Console for manual release');
    }

    this.logSuccess('Android deployment completed');
  }

  async postDeploymentTasks() {
    this.logHeader('Post-deployment Tasks');

    try {
      // Create git tag
      if (this.options.version) {
        await this.executeCommand(`git add .`);
        await this.executeCommand(`git commit -m "chore: release v${this.options.version}"`);
        await this.executeCommand(`git tag -a v${this.options.version} -m "Release v${this.options.version}"`);

        if (this.options.pushTags) {
          await this.executeCommand('git push origin --tags');
          this.logSuccess('Git tags pushed');
        }
      }

      // Update changelog
      if (this.options.updateChangelog) {
        await this.updateChangelog();
      }

      // Send notifications
      if (this.options.notify) {
        await this.sendNotifications();
      }

      // Generate deployment report
      await this.generateDeploymentReport();

      this.results.postDeployment = { success: true };
      this.logSuccess('Post-deployment tasks completed');
    } catch (error) {
      this.results.postDeployment = { success: false, error: error.message };
      this.logWarning(`Post-deployment tasks failed: ${error.message}`);
    }
  }

  async updateChangelog() {
    // Implementation would generate changelog from git commits
    this.logInfo('Changelog update would be implemented here');
  }

  async sendNotifications() {
    const message = `🚀 NexInvo Mobile v${this.options.version} deployed successfully!
Platform: ${this.options.platform}
Environment: ${this.options.environment}
Deployment ID: ${this.deploymentId}
Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s`;

    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        });

        if (response.ok) {
          this.logSuccess('Slack notification sent');
        }
      } catch (error) {
        this.logWarning(`Failed to send Slack notification: ${error.message}`);
      }
    }

    if (process.env.EMAIL_NOTIFICATION_ENDPOINT) {
      try {
        const response = await fetch(process.env.EMAIL_NOTIFICATION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: `NexInvo Mobile Deployment - v${this.options.version}`,
            message,
            deploymentId: this.deploymentId,
          }),
        });

        if (response.ok) {
          this.logSuccess('Email notification sent');
        }
      } catch (error) {
        this.logWarning(`Failed to send email notification: ${error.message}`);
      }
    }
  }

  async generateDeploymentReport() {
    const report = {
      deploymentId: this.deploymentId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      options: this.options,
      results: this.results,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    const reportPath = `deployment-reports/${this.deploymentId}.json`;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.logSuccess(`Deployment report generated: ${reportPath}`);
  }

  async cleanup() {
    this.logHeader('Cleanup');

    try {
      // Clean build artifacts
      await this.executeCommand('npm run clean');

      // Reset git changes if needed
      if (this.options.resetGit) {
        await this.executeCommand('git reset --hard HEAD');
        this.logInfo('Git changes reset');
      }

      this.logSuccess('Cleanup completed');
    } catch (error) {
      this.logWarning(`Cleanup failed: ${error.message}`);
    }
  }

  async deploy() {
    const startTime = Date.now();

    try {
      this.logHeader(`Starting Deployment - ${this.deploymentId}`);
      this.logInfo(`Platform: ${this.options.platform}`);
      this.logInfo(`Environment: ${this.options.environment}`);
      this.logInfo(`Version: ${this.options.version || 'auto'}`);

      await this.validateEnvironment();
      await this.preDeploymentChecks();
      await this.runTests();
      await this.buildApp();
      await this.deployApp();
      await this.postDeploymentTasks();

      const duration = Math.round((Date.now() - startTime) / 1000);
      this.logSuccess(`Deployment completed successfully in ${duration} seconds! 🎉`);

      return { success: true, deploymentId: this.deploymentId, duration };
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.logError(`Deployment failed after ${duration} seconds: ${error.message}`);

      await this.generateDeploymentReport();

      return { success: false, error: error.message, deploymentId: this.deploymentId };
    } finally {
      if (this.options.cleanup) {
        await this.cleanup();
      }
    }
  }
}

// CLI setup
const argv = yargs(hideBin(process.argv))
  .option('platform', {
    alias: 'p',
    type: 'string',
    choices: ['ios', 'android', 'both'],
    description: 'Platform to deploy',
    default: 'both',
  })
  .option('environment', {
    alias: 'e',
    type: 'string',
    choices: ['development', 'staging', 'production'],
    description: 'Deployment environment',
    default: 'staging',
  })
  .option('version', {
    alias: 'v',
    type: 'string',
    description: 'Version to deploy (semver)',
  })
  .option('skip-tests', {
    type: 'boolean',
    description: 'Skip running tests',
    default: false,
  })
  .option('e2e', {
    type: 'boolean',
    description: 'Run E2E tests',
    default: false,
  })
  .option('auto-release', {
    type: 'boolean',
    description: 'Automatically release to app stores',
    default: false,
  })
  .option('force', {
    type: 'boolean',
    description: 'Force deployment ignoring warnings',
    default: false,
  })
  .option('verbose', {
    type: 'boolean',
    description: 'Verbose output',
    default: false,
  })
  .option('cleanup', {
    type: 'boolean',
    description: 'Clean up after deployment',
    default: true,
  })
  .option('audit', {
    type: 'boolean',
    description: 'Run security audit',
    default: true,
  })
  .option('notify', {
    type: 'boolean',
    description: 'Send notifications',
    default: true,
  })
  .option('push-tags', {
    type: 'boolean',
    description: 'Push git tags',
    default: false,
  })
  .option('update-changelog', {
    type: 'boolean',
    description: 'Update changelog',
    default: false,
  })
  .option('reset-git', {
    type: 'boolean',
    description: 'Reset git changes after deployment',
    default: false,
  })
  .help()
  .argv;

// Run deployment
const deployment = new DeploymentManager(argv);
deployment
  .deploy()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Deployment script error:', error);
    process.exit(1);
  });