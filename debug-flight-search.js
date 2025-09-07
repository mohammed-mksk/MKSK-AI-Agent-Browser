// Debug script to test flight search command parsing
import { AIProviderManager } from './dist/main/main/services/AIProviderManager.js';

async function testFlightSearch() {
  const aiProvider = new AIProviderManager();
  
  try {
    // Initialize with OpenAI
    await aiProvider.initialize();
    await aiProvider.setProvider('openai', {
      apiKey: process.env.OPENAI_API_KEY || (() => { throw new Error('OPENAI_API_KEY missing'); })(),
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 4000
    });
    
    console.log('AI Provider initialized successfully');
    
    // Test flight search command
    const command = "Search for cheapest flights from LHR to Mumbai on September 2nd returning September 15th";
    console.log(`\nTesting command: ${command}`);
    
    const result = await aiProvider.parseCommand(command);
    console.log('\nParsed result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check if suggestedActions are present
    if (result.suggestedActions && result.suggestedActions.length > 0) {
      console.log(`\n✅ Found ${result.suggestedActions.length} suggested actions`);
      result.suggestedActions.forEach((action, index) => {
        console.log(`Action ${index + 1}: ${action.type} - ${action.value || action.target?.text || 'No value'}`);
      });
    } else {
      console.log('\n❌ No suggested actions found!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFlightSearch();
