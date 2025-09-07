/**
 * Diagnostic script to check AI provider status and configuration
 */

import { DatabaseService } from './dist/main/main/services/DatabaseService.js';
import { AIProviderManager } from './dist/main/main/services/AIProviderManager.js';
import { SecureStorage } from './dist/main/main/services/SecureStorage.js';

async function diagnoseAIProvider() {
  console.log('=== AI Provider Diagnostic ===');
  
  try {
    // Initialize services
    const database = new DatabaseService();
    const secureStorage = new SecureStorage();
    const aiProviderManager = new AIProviderManager();
    
    await database.initialize();
    
    aiProviderManager.setSecureStorage(secureStorage);
    aiProviderManager.setDatabaseService(database);
    await aiProviderManager.initialize();
    
    console.log('✓ Services initialized');
    
    // Check current provider
    const currentProvider = aiProviderManager.getCurrentProvider();
    console.log(`Current AI provider: ${currentProvider || 'NONE'}`);
    
    if (!currentProvider) {
      console.log('❌ No AI provider configured - this is why AI Browser engine falls back to Puppeteer');
      
      // Check available providers
      const availableProviders = await aiProviderManager.getAvailableProviders();
      console.log('Available providers:', availableProviders);
      
      // Check for stored API keys
      console.log('\nChecking for stored API keys...');
      const providers = ['openai', 'anthropic', 'gemini'];
      
      for (const provider of providers) {
        try {
          const encryptedKey = await database.getSetting(`encrypted_api_key_${provider}`);
          if (encryptedKey) {
            console.log(`✓ ${provider}: API key found in database`);
            try {
              const decryptedData = secureStorage.retrieveAPIKey(Buffer.from(encryptedKey, 'base64'));
              console.log(`  Provider: ${decryptedData.provider}, Has key: true`);
            } catch (decryptError) {
              console.log(`  ❌ Failed to decrypt ${provider} key: ${decryptError.message}`);
            }
          } else {
            console.log(`❌ ${provider}: No API key found`);
          }
        } catch (error) {
          console.log(`❌ ${provider}: Error checking key: ${error.message}`);
        }
      }
      
      console.log('\n🔧 To fix this:');
      console.log('1. Open the application');
      console.log('2. Go to Settings');
      console.log('3. Configure an AI provider (OpenAI, Anthropic, or Gemini)');
      console.log('4. Enter your API key');
      console.log('5. The AI Browser engine will then use AI features instead of falling back to Puppeteer');
      
    } else {
      console.log('✓ AI provider is configured');
      
      // Test the provider
      try {
        const testResult = await aiProviderManager.parseCommand('test command');
        console.log('✓ AI provider is working');
        console.log(`Test result confidence: ${testResult.confidence}`);
      } catch (testError) {
        console.log(`❌ AI provider test failed: ${testError.message}`);
      }
    }
    
    // Check browser engine setting
    const browserEngine = await database.getSetting('browserEngine');
    console.log(`\nBrowser engine setting: ${browserEngine || 'default (puppeteer)'}`);
    
    if (browserEngine === 'ai-browser' && !currentProvider) {
      console.log('⚠️  WARNING: AI Browser engine is selected but no AI provider is configured!');
      console.log('   This will cause the system to fall back to Puppeteer automation.');
    }
    
    await database.close();
    
  } catch (error) {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  }
}

diagnoseAIProvider().catch(console.error);