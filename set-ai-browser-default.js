/**
 * Set AI Browser as Default Engine
 * 
 * This script directly sets the AI browser engine as the default
 * by creating/updating the application configuration.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

async function setAIBrowserDefault() {
  console.log('🔧 Setting AI Browser as default engine...\n');
  
  try {
    // Create data directory if it doesn't exist
    const dataDir = 'data';
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
      console.log('📁 Created data directory');
    }
    
    // Create a simple SQLite-compatible settings file
    // This will be read by the DatabaseService when it initializes
    const settingsPath = path.join(dataDir, 'settings.json');
    
    let settings = {};
    
    // Read existing settings if they exist
    if (existsSync(settingsPath)) {
      try {
        const existingSettings = await readFile(settingsPath, 'utf8');
        settings = JSON.parse(existingSettings);
        console.log('📖 Loaded existing settings');
      } catch (error) {
        console.log('⚠️  Could not read existing settings, creating new ones');
      }
    }
    
    // Update settings with AI browser configuration
    settings = {
      ...settings,
      browserEngine: 'ai-browser',
      aiProvider: 'openai',
      aiModel: 'gpt-4',
      temperature: 0.1,
      maxTokens: 4000,
      browserHeadless: false,
      maxConcurrentBrowsers: 3,
      logLevel: 'info',
      autoSaveWorkflows: true,
      lastUpdated: new Date().toISOString(),
      configuredBy: 'ai-setup-script'
    };
    
    // Save settings
    await writeFile(settingsPath, JSON.stringify(settings, null, 2));
    console.log('✅ Settings saved to', settingsPath);
    
    // Also update the main config file
    const mainConfigPath = 'ai-browser-config.json';
    const mainConfig = {
      defaultEngine: 'ai-browser',
      enginePriority: ['ai-browser', 'browseruse', 'puppeteer'],
      aiConfiguration: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 4000,
        enableLearning: true,
        enableMultiSite: true,
        performanceOptimization: true
      },
      browserConfiguration: {
        headless: false,
        timeout: 60000,
        viewport: { width: 1366, height: 768 },
        enableStealth: true
      },
      features: {
        aiReasoning: true,
        elementDiscovery: true,
        adaptivePlanning: true,
        memorySystem: true,
        errorRecovery: true,
        multiSiteCoordination: true,
        naturalLanguageProcessing: true
      },
      timestamp: new Date().toISOString()
    };
    
    await writeFile(mainConfigPath, JSON.stringify(mainConfig, null, 2));
    console.log('✅ Main configuration updated');
    
    // Create a startup script hint
    const startupHintPath = 'STARTUP_INSTRUCTIONS.md';
    const startupInstructions = `# AI Browser Automation - Startup Instructions

## Current Configuration
- **Browser Engine**: AI Browser (Advanced AI-Driven)
- **Status**: ✅ Configured and Ready

## How to Start

1. **Install Dependencies** (if not already done):
   \`\`\`bash
   npm install
   \`\`\`

2. **Set API Key** (choose one method):
   
   **Method A: Environment Variable**
   \`\`\`bash
   set OPENAI_API_KEY=your_openai_api_key_here
   npm start
   \`\`\`
   
   **Method B: Through Application Settings**
   - Start the app: \`npm start\`
   - Go to Settings tab
   - Enter your OpenAI or Anthropic API key
   - Select "AI Browser (Advanced AI-Driven)" as browser engine
   - Save settings

3. **Test the System**:
   - Go to the Automation tab
   - Try a command like: "Search for flight prices from New York to London"
   - The AI system will intelligently navigate and extract data

## Features Available

✨ **AI-Powered Automation**:
- Intelligent element discovery
- Dynamic action planning
- Context-aware reasoning
- Advanced error recovery

🧠 **Smart Capabilities**:
- Natural language task processing
- Multi-site coordination
- Learning from interactions
- Adaptive problem solving

🔧 **Configuration**:
- Engine: AI Browser (set as default)
- Provider: OpenAI GPT-4 (recommended)
- Learning: Enabled
- Multi-site: Enabled
- Performance optimization: Enabled

## Troubleshooting

If you encounter issues:
1. Check that your API key is valid
2. Ensure all dependencies are installed
3. Try restarting the application
4. Check the console for error messages

Generated: ${new Date().toISOString()}
`;
    
    await writeFile(startupHintPath, startupInstructions);
    console.log('✅ Startup instructions created');
    
    console.log('\n🎉 AI Browser Engine Configuration Complete!');
    console.log('\n📋 Summary:');
    console.log('   • Default engine set to: AI Browser');
    console.log('   • Configuration files created');
    console.log('   • Settings prepared for first run');
    console.log('   • Startup instructions generated');
    
    console.log('\n🚀 Ready to Start:');
    console.log('   1. Set your API key (see STARTUP_INSTRUCTIONS.md)');
    console.log('   2. Run: npm start');
    console.log('   3. The system will use AI-driven automation by default');
    
    console.log('\n💡 The AI browser engine provides:');
    console.log('   • Intelligent reasoning about web pages');
    console.log('   • Dynamic element discovery');
    console.log('   • Adaptive action planning');
    console.log('   • Context-aware memory');
    console.log('   • Advanced error recovery');
    console.log('   • Multi-site coordination');
    
  } catch (error) {
    console.error('❌ Configuration failed:', error.message);
    console.log('\n🔧 Try:');
    console.log('   1. Make sure you have write permissions');
    console.log('   2. Check that you\'re in the correct directory');
    console.log('   3. Ensure the application is not running');
  }
}

// Run the configuration
setAIBrowserDefault().catch(console.error);