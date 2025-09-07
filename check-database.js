/**
 * Check Database for API Keys
 * 
 * This script directly checks the SQLite database to see if API keys are stored.
 */

import sqlite3 from 'sqlite3';
import { join } from 'path';
import { existsSync } from 'fs';

async function checkDatabase() {
  console.log('🔍 Checking Database for API Keys...\n');
  
  try {
    // Find the database file
    const possiblePaths = [
      'automation.db',
      'data/automation.db',
      join(process.env.APPDATA || process.env.HOME || '.', 'ai-automation-browser', 'automation.db')
    ];
    
    let dbPath = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        dbPath = path;
        break;
      }
    }
    
    if (!dbPath) {
      console.log('❌ Database file not found in expected locations:');
      possiblePaths.forEach(path => console.log(`   - ${path}`));
      return;
    }
    
    console.log(`✅ Found database at: ${dbPath}`);
    
    // Open database
    const db = new sqlite3.Database(dbPath);
    
    // Check settings table
    console.log('\n📋 Checking settings table...');
    
    db.all("SELECT key, value FROM settings WHERE key LIKE '%api%' OR key LIKE '%provider%'", (err, rows) => {
      if (err) {
        console.error('❌ Error reading settings:', err);
        return;
      }
      
      if (rows.length === 0) {
        console.log('❌ No API-related settings found');
      } else {
        console.log('✅ Found settings:');
        rows.forEach(row => {
          if (row.key.includes('encrypted_api_key')) {
            console.log(`   ${row.key}: ${row.value ? 'encrypted data exists' : 'null'}`);
          } else {
            console.log(`   ${row.key}: ${row.value}`);
          }
        });
      }
      
      // Check all settings
      console.log('\n📋 All settings:');
      db.all("SELECT key, value FROM settings", (err, allRows) => {
        if (err) {
          console.error('❌ Error reading all settings:', err);
        } else {
          allRows.forEach(row => {
            const value = row.key.includes('encrypted') ? '[encrypted]' : row.value;
            console.log(`   ${row.key}: ${value}`);
          });
        }
        
        db.close();
        
        console.log('\n🔧 Diagnosis:');
        const hasProvider = rows.some(r => r.key === 'aiProvider');
        const hasEncryptedKey = rows.some(r => r.key.startsWith('encrypted_api_key_'));
        
        if (!hasProvider) {
          console.log('❌ No AI provider setting found');
        } else {
          console.log('✅ AI provider setting exists');
        }
        
        if (!hasEncryptedKey) {
          console.log('❌ No encrypted API key found');
          console.log('💡 Solution: Re-enter API key in Settings and save');
        } else {
          console.log('✅ Encrypted API key exists');
          console.log('💡 Issue might be in decryption or provider initialization');
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

// Run the check
checkDatabase().catch(console.error);