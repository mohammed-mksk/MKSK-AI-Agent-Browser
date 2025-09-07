import { autoUpdater } from 'electron-updater';
import { app, dialog, BrowserWindow } from 'electron';
import { logger } from './Logger.js';

export class UpdateService {
  private mainWindow: BrowserWindow | null = null;
  private updateCheckInProgress = false;

  constructor() {
    this.setupAutoUpdater();
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Set update server URL (GitHub releases by default)
    if (process.env.NODE_ENV === 'development') {
      // In development, disable auto-updater
      autoUpdater.updateConfigPath = null;
    }

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for updates...');
      this.sendStatusToWindow('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      logger.info('Update available:', info);
      this.sendStatusToWindow('Update available');
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info('Update not available:', info);
      this.sendStatusToWindow('Update not available');
      if (this.updateCheckInProgress) {
        this.showNoUpdateDialog();
      }
    });

    autoUpdater.on('error', (err) => {
      logger.error('Error in auto-updater:', err);
      this.sendStatusToWindow('Error in auto-updater');
      if (this.updateCheckInProgress) {
        this.showUpdateErrorDialog(err);
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      logger.info(logMessage);
      this.sendStatusToWindow(`Downloading update: ${Math.round(progressObj.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded:', info);
      this.sendStatusToWindow('Update downloaded');
      this.showUpdateDownloadedDialog();
    });
  }

  async checkForUpdates(manual = false): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      logger.info('Auto-updater disabled in development mode');
      if (manual) {
        this.showDevelopmentModeDialog();
      }
      return;
    }

    this.updateCheckInProgress = manual;

    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      if (manual) {
        this.showUpdateErrorDialog(error);
      }
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('Failed to download update:', error);
      this.showUpdateErrorDialog(error);
    }
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  private sendStatusToWindow(message: string): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-status', message);
    }
  }

  private async showUpdateAvailableDialog(info: any): Promise<void> {
    if (!this.mainWindow) return;

    const response = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: `Current version: ${app.getVersion()}\nNew version: ${info.version}\n\nWould you like to download it now?`,
      buttons: ['Download Now', 'Download Later', 'View Release Notes'],
      defaultId: 0,
      cancelId: 1
    });

    switch (response.response) {
      case 0: // Download Now
        await this.downloadUpdate();
        break;
      case 1: // Download Later
        logger.info('User chose to download update later');
        break;
      case 2: // View Release Notes
        // Open release notes URL if available
        if (info.releaseNotes) {
          const { shell } = require('electron');
          shell.openExternal(`https://github.com/your-github-username/ai-automation-browser/releases/tag/v${info.version}`);
        }
        break;
    }
  }

  private async showUpdateDownloadedDialog(): Promise<void> {
    if (!this.mainWindow) return;

    const response = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: 'The update will be installed when you restart the application. Would you like to restart now?',
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      this.quitAndInstall();
    }
  }

  private async showNoUpdateDialog(): Promise<void> {
    if (!this.mainWindow) return;

    await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'No Updates',
      message: 'You are running the latest version!',
      detail: `Current version: ${app.getVersion()}`,
      buttons: ['OK']
    });
  }

  private async showUpdateErrorDialog(error: any): Promise<void> {
    if (!this.mainWindow) return;

    await dialog.showMessageBox(this.mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: `Error: ${error.message || error}`,
      buttons: ['OK']
    });
  }

  private async showDevelopmentModeDialog(): Promise<void> {
    if (!this.mainWindow) return;

    await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Development Mode',
      message: 'Auto-updater is disabled in development mode',
      detail: 'Updates are only available in production builds.',
      buttons: ['OK']
    });
  }

  // Schedule automatic update checks
  scheduleUpdateChecks(): void {
    // Check for updates every 4 hours
    setInterval(() => {
      this.checkForUpdates(false);
    }, 4 * 60 * 60 * 1000);

    // Initial check after 30 seconds
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 30000);
  }

  // Get current version info
  getVersionInfo(): { current: string; platform: string; arch: string } {
    return {
      current: app.getVersion(),
      platform: process.platform,
      arch: process.arch
    };
  }
}