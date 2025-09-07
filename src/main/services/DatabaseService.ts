import sqlite3 from 'sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { 
  AutomationResult, 
  SavedWorkflow, 
  AutomationHistory,
  ExtractedData 
} from '../../shared/types.js';
import { Logger } from './Logger.js';

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private logger: Logger;
  private dbPath: string;

  constructor() {
    this.logger = new Logger();
    this.dbPath = join(app.getPath('userData'), 'automation.db');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          this.logger.error('Failed to open database:', err);
          reject(err);
          return;
        }
        
        this.logger.info('Database connected successfully');
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS automation_results (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        intent TEXT NOT NULL,
        execution_plan TEXT NOT NULL,
        extracted_data TEXT NOT NULL,
        screenshots BLOB,
        duration INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        errors TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        command TEXT NOT NULL,
        parameters TEXT NOT NULL,
        execution_plan TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        use_count INTEGER DEFAULT 0
      )`,
      
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      await this.runQuery(sql);
    }
    
    this.logger.info('Database tables created successfully');
  }

  private runQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  private getQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async saveAutomationResult(result: AutomationResult): Promise<void> {
    const sql = `
      INSERT INTO automation_results 
      (id, command, intent, execution_plan, extracted_data, screenshots, duration, success, errors, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      result.id,
      result.command,
      JSON.stringify(result.intent),
      JSON.stringify(result.executionPlan),
      JSON.stringify(result.extractedData),
      Buffer.concat(result.screenshots),
      result.duration,
      result.success,
      JSON.stringify(result.errors),
      JSON.stringify(result.metadata)
    ];

    await this.runQuery(sql, params);
    this.logger.info(`Automation result saved: ${result.id}`);
  }

  async getAutomationHistory(): Promise<AutomationHistory[]> {
    const sql = `
      SELECT * FROM automation_results 
      ORDER BY timestamp DESC 
      LIMIT 100
    `;
    
    const rows = await this.allQuery(sql);
    
    return rows.map(row => ({
      id: row.id,
      command: row.command,
      result: {
        id: row.id,
        command: row.command,
        intent: JSON.parse(row.intent),
        executionPlan: JSON.parse(row.execution_plan),
        extractedData: JSON.parse(row.extracted_data),
        screenshots: row.screenshots ? [row.screenshots] : [],
        duration: row.duration,
        success: row.success,
        errors: JSON.parse(row.errors || '[]'),
        timestamp: new Date(row.timestamp),
        metadata: JSON.parse(row.metadata || '{}')
      },
      timestamp: new Date(row.timestamp)
    }));
  }

  async saveWorkflow(workflow: SavedWorkflow): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO workflows 
      (id, name, description, command, parameters, execution_plan, tags, last_used, use_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      workflow.id,
      workflow.name,
      workflow.description,
      workflow.command,
      JSON.stringify(workflow.parameters),
      JSON.stringify(workflow.executionPlan),
      JSON.stringify(workflow.tags),
      workflow.lastUsed.toISOString(),
      workflow.useCount
    ];

    await this.runQuery(sql, params);
    this.logger.info(`Workflow saved: ${workflow.name}`);
  }

  async getWorkflows(): Promise<SavedWorkflow[]> {
    const sql = `
      SELECT * FROM workflows 
      ORDER BY last_used DESC
    `;
    
    const rows = await this.allQuery(sql);
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      command: row.command,
      parameters: JSON.parse(row.parameters),
      executionPlan: JSON.parse(row.execution_plan),
      tags: JSON.parse(row.tags || '[]'),
      createdAt: new Date(row.created_at),
      lastUsed: new Date(row.last_used),
      useCount: row.use_count
    }));
  }

  async getSetting(key: string): Promise<any> {
    const sql = 'SELECT value FROM settings WHERE key = ?';
    const row = await this.getQuery(sql, [key]);
    
    if (row) {
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }
    
    return null;
  }

  async setSetting(key: string, value: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    await this.runQuery(sql, [key, serializedValue]);
  }

  async cacheResults(key: string, data: any, ttl: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttl);
    const sql = `
      INSERT OR REPLACE INTO cache (key, value, expires_at)
      VALUES (?, ?, ?)
    `;
    
    await this.runQuery(sql, [key, JSON.stringify(data), expiresAt.toISOString()]);
  }

  async getCachedResults(key: string): Promise<any | null> {
    const sql = `
      SELECT value FROM cache 
      WHERE key = ? AND expires_at > CURRENT_TIMESTAMP
    `;
    
    const row = await this.getQuery(sql, [key]);
    
    if (row) {
      try {
        return JSON.parse(row.value);
      } catch {
        return null;
      }
    }
    
    return null;
  }

  async cleanExpiredCache(): Promise<void> {
    const sql = 'DELETE FROM cache WHERE expires_at <= CURRENT_TIMESTAMP';
    await this.runQuery(sql);
  }

  // Alias methods for compatibility with MemorySystem
  async run(sql: string, params: any[] = []): Promise<any> {
    return this.runQuery(sql, params);
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    return this.getQuery(sql, params);
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return this.allQuery(sql, params);
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            this.logger.error('Error closing database:', err);
          } else {
            this.logger.info('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}