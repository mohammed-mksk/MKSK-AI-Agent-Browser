/**
 * Debug API Key Loading
 * 
 * This script diagnoses why the AI Provider Manager isn't loading
 * the stored API key properly during initialization.
 */

import { DatabaseService } from './dist/main/main/services/DatabaseService.js';
import { SecureStorage } from './dist/main/main/services/SecureStorage.js';
import { AIProviderManager } from './dist/main/main/services/AIProviderManager.js';

async function debugApiKeyLoading() {
  console.log('🔍 Debugging API Key Loading...\n');
  
  try {
    // Step 1: Check database
    console.log('1️⃣  Checking Database...');
    const db = new DatabaseService();
    await db.initialize();
    console.log('✅ Database initialized');
    
    // Check stored settings
    const aiProvider = await db.getSetting('aiProvider');
    const aiModel = await db.getSetting('aiModel');
    console.log(`   AI Provider setting: ${aiProvider || 'not set'}`);
    console.log(`   AI Model setting: ${aiModel || 'not set'}`);
    
    // Check for encrypted API keys
    const openaiKey = await db.getSetting('encrypted_api_key_openai');
    const anthropicKey = await db.getSetting('encrypted_api_key_anthropic');
    console.log(`   OpenAI encrypted key: ${openaiKey ? 'exists' : 'not found'}`);
    console.log(`   Anthropic encrypted key: ${anthropicKey ? 'exists' : 'not found'}`);
    
    // Step 2: Check secure storage
    console.log('\n2️⃣  Checking Secure Storage...');
    const secureStorage = new SecureStorage();
    console.log('✅ Secure storage initialized');
    
    if (openaiKey) {
      try {
        const encryptedData = Buffer.from(openaiKey, 'base64');
        const decryptedData = secureStorage.retrieveAPIKey(encryptedData);
        console.log(`   OpenAI key decryption: ${decryptedData.apiKey ? 'success' : 'failed'}`);
        console.log(`   Decrypted provider: ${decryptedData.provider}`);
      } catch (error) {
        console.log(`   OpenAI key decryption failed: ${error.message}`);
      }
    }
    
    // Step 3: Test AI Provider Manager initialization
    console.log('\n3️⃣  Testing AI Provider Manager...');
    const aiProviderManager = new AIProviderManager();
    
    // Inject dependencies
    aiProviderManager.setSecureStorage(secureStorage);
    aiProviderManager.setDatabaseService(db);
    console.log('✅ Dependencies injected');
    
    // Initialize
    console.log('🔄 Initializing AI Provider Manager...');
    await aiProviderManager.initialize();
    
    // Check current provider
    const currentProvider = aiProviderManager.getCurrentProvider();
    console.log(`   Current provider: ${currentProvider || 'none'}`);
    
    // Test if provider is available
    if (currentProvider) {
      try {
        const testResult = await aiProviderManager.parseCommand('test command');
        console.log('✅ AI provider is working');
      } catch (error) {
        console.log(`❌ AI provider test failed: ${error.message}`);
      }
    } else {
      console.log('❌ No AI provider configured');
    }
    
    // Step 4: Check environment variables
    console.log('\n4️⃣  Checking Environment Variables...');
    const envOpenAI = process.env.OPENAI_API_KEY;
    const envAnthropic = process.env.ANTHROPIC_API_KEY;
    console.log(`   OPENAI_API_KEY: ${envOpenAI ? 'set' : 'not set'}`);
    console.log(`   ANTHROPIC_API_KEY: ${envAnthropic ? 'set' : 'not set'}`);
    
    await db.close();
    
    console.log('\n📋 Diagnosis Summary:');
    console.log(`   Database: ${db ? 'OK' : 'FAILED'}`);
    console.log(`   Secure Storage: ${secureStorage ? 'OK' : 'FAILED'}`);
    console.log(`   Stored API Key: ${openaiKey || anthropicKey ? 'EXISTS' : 'MISSING'}`);
    console.log(`   AI Provider: ${currentProvider || 'NOT CONFIGURED'}`);
    
    if (!currentProvider) {
      console.log('\n🔧 Possible Issues:');
      console.log('   1. API key not properly stored in database');
      console.log('   2. Secure storage decryption failing');
      console.log('   3. AI Provider Manager initialization timing issue');
      console.log('   4. Dependencies not properly injected');
      
      console.log('\n💡 Solutions to Try:');
      console.log('   1. Re-enter API key in Settings and save');
      console.log('   2. Check that API key is valid');
      console.log('   3. Restart the application');
      console.log('   4. Check console for detailed error messages');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.log('\n🔧 This indicates a fundamental issue with:');
    console.log('   - Database connectivity');
    console.log('   - Service initialization');
    console.log('   - File permissions');
  }
}

// Run the debug
debugApiKeyLoading().catch(console.error);