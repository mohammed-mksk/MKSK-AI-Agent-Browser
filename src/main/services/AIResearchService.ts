import { Logger } from './Logger.js';
import { AIProviderManager } from './AIProviderManager.js';
import { ExtractedData, AutomationResult } from '../../shared/types.js';

export interface ResearchResult {
  summary: string;
  structuredData: any;
  keyFindings: string[];
  sources: string[];
  confidence: number;
}

export class AIResearchService {
  private logger: Logger;
  private aiProvider: AIProviderManager;

  constructor(aiProvider: AIProviderManager) {
    this.logger = new Logger();
    this.aiProvider = aiProvider;
  }

  async analyzeAndSynthesizeResults(command: string, extractedData: ExtractedData[]): Promise<ResearchResult> {
    this.logger.info('Starting AI-powered research analysis...');

    try {
      // Step 1: Analyze each piece of extracted data
      const analyzedData = await this.analyzeExtractedContent(extractedData);
      
      // Step 2: Synthesize findings based on the original command
      const synthesis = await this.synthesizeFindings(command, analyzedData);
      
      // Step 3: Structure the final result
      const structuredResult = await this.structureResult(command, synthesis, analyzedData);
      
      return structuredResult;
    } catch (error) {
      this.logger.error('Failed to analyze and synthesize results:', error);
      throw error;
    }
  }

  private async analyzeExtractedContent(extractedData: ExtractedData[]): Promise<any[]> {
    const analyzedData = [];

    for (const data of extractedData.slice(0, 10)) { // Limit to first 10 for performance
      try {
        const analysisPrompt = this.createContentAnalysisPrompt(data);
        const analysis = await this.aiProvider.generateCompletion(analysisPrompt);
        
        const parsedAnalysis = JSON.parse(analysis);
        analyzedData.push({
          original: data,
          analysis: parsedAnalysis
        });
      } catch (error) {
        this.logger.warn('Failed to analyze content piece:', error);
        // Include original data even if analysis fails
        analyzedData.push({
          original: data,
          analysis: { relevance: 0.5, summary: data.content.text || 'Content analysis failed' }
        });
      }
    }

    return analyzedData;
  }

  private async synthesizeFindings(command: string, analyzedData: any[]): Promise<string> {
    const synthesisPrompt = this.createSynthesisPrompt(command, analyzedData);
    return await this.aiProvider.generateCompletion(synthesisPrompt);
  }

  private async structureResult(command: string, synthesis: string, analyzedData: any[]): Promise<ResearchResult> {
    const structuringPrompt = this.createStructuringPrompt(command, synthesis, analyzedData);
    const structuredResponse = await this.aiProvider.generateCompletion(structuringPrompt);
    
    try {
      const parsed = JSON.parse(structuredResponse);
      return {
        summary: parsed.summary || synthesis,
        structuredData: parsed.structuredData || {},
        keyFindings: parsed.keyFindings || [],
        sources: analyzedData.map(d => d.original.source.url).filter((url, index, arr) => arr.indexOf(url) === index),
        confidence: parsed.confidence || 0.7
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        summary: synthesis,
        structuredData: {},
        keyFindings: [synthesis],
        sources: analyzedData.map(d => d.original.source.url),
        confidence: 0.6
      };
    }
  }

  private createContentAnalysisPrompt(data: ExtractedData): string {
    return `
Analyze this web content and extract key information:

Content: "${data.content.text || JSON.stringify(data.content)}"
Source: ${data.source.url}

Return a JSON response with:
{
  "relevance": 0.0-1.0,
  "summary": "Brief summary of key information",
  "keyPoints": ["array", "of", "key", "points"],
  "entityType": "company|product|service|person|other",
  "factualClaims": ["verifiable facts from this content"]
}

Focus on extracting factual, useful information. Return only valid JSON.`;
  }

  private createSynthesisPrompt(command: string, analyzedData: any[]): string {
    const contentSummaries = analyzedData
      .filter(d => d.analysis.relevance > 0.3)
      .map(d => `- ${d.analysis.summary}`)
      .join('\n');

    return `
You are a research analyst. Synthesize the following information to answer this query:

Query: "${command}"

Information gathered:
${contentSummaries}

Provide a comprehensive, well-structured response that:
1. Directly answers the user's question
2. Synthesizes information from multiple sources
3. Provides specific, actionable insights
4. Maintains factual accuracy

Write a clear, professional response (200-400 words).`;
  }

  private createStructuringPrompt(command: string, synthesis: string, analyzedData: any[]): string {
    return `
Structure this research into a comprehensive response:

Original Query: "${command}"
Research Summary: "${synthesis}"

Create a JSON response with:
{
  "summary": "Executive summary (2-3 sentences)",
  "structuredData": {
    // If query asks for competitors, create: {"competitors": [{"name": "", "description": ""}]}
    // If query asks for comparison, create: {"comparison": {...}}
    // If query asks for list, create: {"items": [...]}
    // Adapt structure based on the query type
  },
  "keyFindings": ["3-5 most important findings"],
  "confidence": 0.0-1.0
}

Make the structuredData field highly relevant to the specific query. For competitor research, include company names, descriptions, and key differentiators. For product research, include features and benefits. Adapt the structure to best serve the user's intent.

Return only valid JSON.`;
  }

  async enhanceAutomationResult(result: AutomationResult, command: string): Promise<AutomationResult> {
    try {
      if (result.extractedData.length === 0) {
        return result;
      }

      this.logger.info('Enhancing automation result with AI analysis...');
      
      // Perform AI analysis and synthesis
      const researchResult = await this.analyzeAndSynthesizeResults(command, result.extractedData);
      
      // Add AI-enhanced data to the result
      const enhancedData: ExtractedData = {
        id: `ai_synthesis_${Date.now()}`,
        type: 'structured',
        content: {
          aiSynthesis: researchResult.summary,
          structuredFindings: researchResult.structuredData,
          keyInsights: researchResult.keyFindings,
          researchQuality: researchResult.confidence,
          sourcesAnalyzed: researchResult.sources.length,
          enhancedBy: 'AI Research Service'
        },
        source: {
          url: 'AI Analysis',
          selector: 'ai-synthesis',
          timestamp: new Date()
        },
        confidence: researchResult.confidence
      };

      // Add the AI synthesis as the first item
      result.extractedData.unshift(enhancedData);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to enhance automation result:', error);
      return result; // Return original result if enhancement fails
    }
  }
}