/**
 * Configuration Script for AI Browser Engine
 * 
 * This script configures the AI-Automation-Browser to use the AI-driven browser engine
 * by default and tests its functionality.
 */

import path from 'path';
import fs from 'fs/promises';

// Import the services we need
async function configureAIEngine() {
  console.log('🚀 Configuring AI Browser Engine...');
  
  try {
    // Import the required modules from the compiled JavaScript files
    const { DatabaseService } = await import('./dist/main/main/services/DatabaseService.js');
    const { BrowserEngineFactory } = await import('./dist/main/main/factories/BrowserEngineFactory.js');
    const { BrowserEngineType } = await import('./dist/main/main/interfaces/IBrowserEngine.js');
    
    // Initialize database service
    const db = new DatabaseService();
    await db.initialize();
    
    console.log('📊 Database initialized');
    
    // Set the browser engine to AI Browser
    await db.setSetting('browserEngine', 'ai-browser');
    console.log('✅ Browser engine set to AI Browser');
    
    // Check available engines
    const availableEngines = await BrowserEngineFactory.getAvailableEngines();
    console.log('🔍 Available engines:', availableEngines);
    
    // Get recommended engine
    const recommendedEngine = await BrowserEngineFactory.getRecommendedEngine();
    console.log('💡 Recommended engine:', recommendedEngine);
    
    // Test AI Browser engine availability
    const factory = new BrowserEngineFactory();
    const isAIAvailable = await factory.isEngineAvailable(BrowserEngineType.AI_BROWSER);
    console.log('🧠 AI Browser engine available:', isAIAvailable);
    
    if (isAIAvailable) {
      console.log('✨ AI Browser engine is ready to use!');
      
      // Test creating an AI engine instance
      try {
        const config = {
          headless: false,
          timeout: 60000,
          viewport: { width: 1366, height: 768 },
          apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY,
          aiProvider: 'openai',
          enableLearning: true,
          enableMultiSite: true,
          performanceOptimization: true
        };
        
        console.log('🔧 Creating AI Browser engine instance...');
        const aiEngine = await factory.createEngine(BrowserEngineType.AI_BROWSER, config);
        
        console.log('🧪 Testing AI Browser engine...');
        const testResult = await aiEngine.testEngine();
        
        if (testResult) {
          console.log('✅ AI Browser engine test passed!');
        } else {
          console.log('❌ AI Browser engine test failed');
        }
        
        // Clean up
        await aiEngine.cleanup();
        console.log('🧹 AI Browser engine cleaned up');
        
      } catch (engineError) {
        console.error('❌ Failed to test AI Browser engine:', engineError.message);
        console.log('💡 This might be due to missing API keys or dependencies');
      }
    } else {
      console.log('⚠️  AI Browser engine is not available');
      console.log('💡 Falling back to recommended engine:', recommendedEngine);
      await db.setSetting('browserEngine', recommendedEngine.toLowerCase().replace('_', ''));
    }
    
    // Close database
    await db.close();
    console.log('📊 Database closed');
    
    console.log('\n🎉 Configuration complete!');
    console.log('📝 Next steps:');
    console.log('   1. Make sure you have API keys configured in Settings');
    console.log('   2. Start the application and test automation');
    console.log('   3. The system will now use AI-driven browser automation');
    
  } catch (error) {
    console.error('❌ Configuration failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure all dependencies are installed: npm install');
    console.log('   2. Check that the database is accessible');
    console.log('   3. Verify that AI services are properly implemented');
  }
}

// Run the configuration
configureAIEngine().catch(console.error);