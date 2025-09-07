const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Deployment script for AI Automation Browser
 * This script handles the complete build and deployment process
 */

class DeploymentManager {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.distDir = path.join(this.projectRoot, 'dist-electron');
    this.packageJson = require(path.join(this.projectRoot, 'package.json'));
  }

  log(message) {
    console.log(`[DEPLOY] ${new Date().toISOString()} - ${message}`);
  }

  error(message, error) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  }

  execCommand(command, options = {}) {
    this.log(`Executing: ${command}`);
    try {
      const result = execSync(command, {
        cwd: this.projectRoot,
        stdio: 'inherit',
        ...options
      });
      return result;
    } catch (error) {
      this.error(`Command failed: ${command}`, error);
      throw error;
    }
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    this.log(`Node.js version: ${nodeVersion}`);
    
    // Check npm version
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      this.log(`npm version: ${npmVersion}`);
    } catch (error) {
      throw new Error('npm is not installed or not accessible');
    }
    
    // Check if all dependencies are installed
    if (!fs.existsSync(path.join(this.projectRoot, 'node_modules'))) {
      throw new Error('Dependencies not installed. Run "npm install" first.');
    }
    
    this.log('Prerequisites check passed');
  }

  async cleanBuildDirectory() {
    this.log('Cleaning build directory...');
    
    if (fs.existsSync(this.distDir)) {
      this.execCommand('npm run clean');
    }
    
    this.log('Build directory cleaned');
  }

  async runTests() {
    this.log('Running tests...');
    
    try {
      this.execCommand('npm test -- --watchAll=false');
      this.log('All tests passed');
    } catch (error) {
      this.error('Tests failed', error);
      throw new Error('Tests must pass before deployment');
    }
  }

  async buildApplication() {
    this.log('Building application...');
    
    // Build main process
    this.execCommand('npm run build:main');
    
    // Build preload script
    this.execCommand('npm run build:preload');
    
    // Build renderer process
    this.execCommand('npm run build:renderer');
    
    this.log('Application build completed');
  }

  async packageApplication(targets = ['nsis', 'portable']) {
    this.log(`Packaging application for targets: ${targets.join(', ')}`);
    
    for (const target of targets) {
      switch (target) {
        case 'nsis':
          this.execCommand('npm run package:nsis');
          break;
        case 'portable':
          this.execCommand('npm run package:portable');
          break;
        case 'all':
          this.execCommand('npm run package:all');
          break;
        default:
          this.log(`Unknown target: ${target}, skipping...`);
      }
    }
    
    this.log('Application packaging completed');
  }

  async generateChecksums() {
    this.log('Generating checksums...');
    
    const crypto = require('crypto');
    const checksums = {};
    
    if (!fs.existsSync(this.distDir)) {
      this.log('No dist directory found, skipping checksum generation');
      return;
    }
    
    const files = fs.readdirSync(this.distDir).filter(file => 
      file.endsWith('.exe') || file.endsWith('.zip')
    );
    
    for (const file of files) {
      const filePath = path.join(this.distDir, file);
      const fileBuffer = fs.readFileSync(filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const hex = hashSum.digest('hex');
      checksums[file] = hex;
      this.log(`Checksum for ${file}: ${hex}`);
    }
    
    // Write checksums to file
    const checksumFile = path.join(this.distDir, 'checksums.json');
    fs.writeFileSync(checksumFile, JSON.stringify(checksums, null, 2));
    this.log(`Checksums written to ${checksumFile}`);
  }

  async createDeploymentInfo() {
    this.log('Creating deployment info...');
    
    const deploymentInfo = {
      version: this.packageJson.version,
      buildTime: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: this.packageJson.dependencies.electron,
      gitCommit: this.getGitCommit(),
      gitBranch: this.getGitBranch()
    };
    
    const infoFile = path.join(this.distDir, 'deployment-info.json');
    fs.writeFileSync(infoFile, JSON.stringify(deploymentInfo, null, 2));
    this.log(`Deployment info written to ${infoFile}`);
  }

  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  getGitBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  async validateBuild() {
    this.log('Validating build...');
    
    if (!fs.existsSync(this.distDir)) {
      throw new Error('Build directory does not exist');
    }
    
    const files = fs.readdirSync(this.distDir);
    const hasExecutable = files.some(file => file.endsWith('.exe'));
    
    if (!hasExecutable) {
      throw new Error('No executable files found in build directory');
    }
    
    this.log('Build validation passed');
  }

  async deploy(options = {}) {
    const {
      skipTests = false,
      skipClean = false,
      targets = ['nsis', 'portable'],
      validate = true
    } = options;

    try {
      this.log(`Starting deployment for version ${this.packageJson.version}`);
      
      await this.checkPrerequisites();
      
      if (!skipClean) {
        await this.cleanBuildDirectory();
      }
      
      if (!skipTests) {
        await this.runTests();
      }
      
      await this.buildApplication();
      await this.packageApplication(targets);
      await this.generateChecksums();
      await this.createDeploymentInfo();
      
      if (validate) {
        await this.validateBuild();
      }
      
      this.log('Deployment completed successfully!');
      this.log(`Build artifacts available in: ${this.distDir}`);
      
      // List generated files
      const files = fs.readdirSync(this.distDir);
      this.log('Generated files:');
      files.forEach(file => this.log(`  - ${file}`));
      
    } catch (error) {
      this.error('Deployment failed', error);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--skip-clean':
        options.skipClean = true;
        break;
      case '--no-validate':
        options.validate = false;
        break;
      case '--targets':
        options.targets = args[++i]?.split(',') || ['nsis', 'portable'];
        break;
      case '--help':
        console.log(`
AI Automation Browser Deployment Script

Usage: node scripts/deploy.js [options]

Options:
  --skip-tests     Skip running tests before deployment
  --skip-clean     Skip cleaning build directory
  --no-validate    Skip build validation
  --targets        Comma-separated list of targets (nsis,portable,all)
  --help           Show this help message

Examples:
  node scripts/deploy.js
  node scripts/deploy.js --skip-tests --targets nsis
  node scripts/deploy.js --targets all
        `);
        process.exit(0);
    }
  }
  
  const deployer = new DeploymentManager();
  deployer.deploy(options);
}

module.exports = DeploymentManager;