/**
 * Notification service for system alerts and user notifications
 */
import { Notification } from 'electron';
import { Logger } from './Logger.js';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
  timeoutType?: 'default' | 'never';
  actions?: NotificationAction[];
}

export interface NotificationAction {
  type: string;
  text: string;
}

export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
  persistent: boolean;
}

export class NotificationService {
  private logger: Logger;
  private alerts: Map<string, SystemAlert> = new Map();
  private notificationQueue: NotificationOptions[] = [];
  private isProcessingQueue: boolean = false;
  private maxQueueSize: number = 50;
  
  constructor() {
    this.logger = new Logger();
  }
  
  /**
   * Show a system notification
   */
  async showNotification(options: NotificationOptions): Promise<void> {
    try {
      // Check if notifications are supported
      if (!Notification.isSupported()) {
        this.logger.warn('System notifications are not supported');
        return;
      }
      
      // Add to queue if we're processing
      if (this.isProcessingQueue) {
        if (this.notificationQueue.length < this.maxQueueSize) {
          this.notificationQueue.push(options);
        } else {
          this.logger.warn('Notification queue is full, dropping notification');
        }
        return;
      }
      
      // Show notification immediately
      await this.displayNotification(options);
      
      // Process queue if there are pending notifications
      if (this.notificationQueue.length > 0) {
        this.processNotificationQueue();
      }
    } catch (error) {
      this.logger.error('Failed to show notification:', error);
    }
  }
  
  /**
   * Show a success notification
   */
  async showSuccess(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      body: message,
      urgency: 'low'
    });
  }
  
  /**
   * Show an info notification
   */
  async showInfo(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      body: message,
      urgency: 'normal'
    });
  }
  
  /**
   * Show a warning notification
   */
  async showWarning(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      body: message,
      urgency: 'normal'
    });
  }
  
  /**
   * Show an error notification
   */
  async showError(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      body: message,
      urgency: 'critical'
    });
  }
  
  /**
   * Add a system alert
   */
  addAlert(alert: Omit<SystemAlert, 'id' | 'timestamp' | 'dismissed'>): string {
    const id = this.generateAlertId();
    const systemAlert: SystemAlert = {
      id,
      ...alert,
      timestamp: Date.now(),
      dismissed: false
    };
    
    this.alerts.set(id, systemAlert);
    
    // Show notification for critical alerts
    if (alert.type === 'error') {
      this.showError(alert.title, alert.message);
    } else if (alert.type === 'warning') {
      this.showWarning(alert.title, alert.message);
    }
    
    this.logger.info(`Added system alert: ${alert.type} - ${alert.title}`);
    return id;
  }

  /**
   * Dismiss an alert
   */
  dismissAlert(id: string): boolean {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.dismissed = true;
      
      // Remove non-persistent alerts when dismissed
      if (!alert.persistent) {
        this.alerts.delete(id);
      }
      
      this.logger.info(`Dismissed alert: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): SystemAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.dismissed)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: SystemAlert['type']): SystemAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.type === type && !alert.dismissed)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts(): void {
    this.alerts.clear();
    this.logger.info('Cleared all alerts');
  }

  /**
   * Clear old alerts (older than specified time)
   */
  clearOldAlerts(maxAge: number = 86400000): void { // Default: 24 hours
    const now = Date.now();
    let removedCount = 0;
    
    for (const [id, alert] of this.alerts.entries()) {
      if (now - alert.timestamp > maxAge && !alert.persistent) {
        this.alerts.delete(id);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.logger.info(`Cleared ${removedCount} old alerts`);
    }
  }

  /**
   * Get notification statistics
   */
  getStats(): {
    totalAlerts: number;
    activeAlerts: number;
    alertsByType: Record<string, number>;
    queueSize: number;
  } {
    const allAlerts = Array.from(this.alerts.values());
    const activeAlerts = allAlerts.filter(alert => !alert.dismissed);
    
    const alertsByType = {
      info: 0,
      warning: 0,
      error: 0,
      success: 0
    };
    
    for (const alert of activeAlerts) {
      alertsByType[alert.type]++;
    }
    
    return {
      totalAlerts: allAlerts.length,
      activeAlerts: activeAlerts.length,
      alertsByType,
      queueSize: this.notificationQueue.length
    };
  }

  /**
   * Display a notification
   */
  private async displayNotification(options: NotificationOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: options.icon,
          silent: options.silent || false,
          urgency: options.urgency || 'normal',
          timeoutType: options.timeoutType || 'default',
          actions: options.actions || []
        });
        
        notification.on('show', () => {
          this.logger.debug(`Notification shown: ${options.title}`);
          resolve();
        });
        
        notification.on('click', () => {
          this.logger.debug(`Notification clicked: ${options.title}`);
        });
        
        notification.on('close', () => {
          this.logger.debug(`Notification closed: ${options.title}`);
        });
        
        notification.on('action', (event, index) => {
          this.logger.debug(`Notification action ${index} clicked: ${options.title}`);
        });
        
        notification.show();
      } catch (error) {
        this.logger.error('Failed to display notification:', error);
        reject(error);
      }
    });
  }

  /**
   * Process the notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift();
        if (notification) {
          await this.displayNotification(notification);
          // Small delay between notifications to avoid overwhelming the user
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      this.logger.error('Error processing notification queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Generate a unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}