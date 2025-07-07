'use client';

import { useState, useEffect, useRef } from 'react';
import { VectorStore, DocumentData } from '../VectorStore/VectorStore';
import { AIAssistant, AIStatus as AIConnectionStatus } from '../../lib/AIAssistant';
import { analytics } from '../../lib/analytics';

export type AIProvider = 'ollama' | 'lmstudio' | 'openai' | 'local';
export type ResearchType = 'academic' | 'market' | 'technology' | 'competitive' | 'trend' | 'literature';
export type ResearchDepth = 'overview' | 'detailed' | 'comprehensive';
export type AIStatus = AIConnectionStatus;

export interface Topic {
  id: string;
  title: string;
  description: string;
  selected: boolean;
}

export interface ResearchMetadata {
  id: string;
  title: string;
  type: ResearchType;
  depth: ResearchDepth;
  topics: string[];
  generatedAt: string;
  aiProvider: string;
  model: string;
  documentIntegration: boolean;
}

export interface ResearchItem {
  content: string;
  metadata: ResearchMetadata;
  timestamp: string;
}

export class DeepResearchApp {
  topics: Topic[] = [];
  researchResults: Record<string, string | ResearchItem | ResearchMetadata> = {};
  currentTab: 'research' | 'sources' | 'notes' = 'research';
  aiAssistant: AIAssistant | null = null;
  isGenerating = false;
  vectorStore: VectorStore | null = null;
  documentModalOpen = false;
  eventListenersSetup = false;
  isUploading = false;
  isVectorStoreLoading = true;
  
  // Modal states
  showOllamaConnectionModal = false;
  showModelSelectionModal = false;
  availableModels: any[] = [];
  selectedOllamaURL = 'http://localhost:11434';

  // React state setters (will be set in the hook)
  setTopics: ((topics: Topic[]) => void) | null = null;
  setAIStatus: ((status: AIConnectionStatus) => void) | null = null;
  setResearchType: ((type: ResearchType) => void) | null = null;
  setResearchDepth: ((depth: ResearchDepth) => void) | null = null;
  setResearchResults: ((results: string) => void) | null = null;
  setCurrentTab: ((tab: 'research' | 'sources' | 'notes') => void) | null = null;
  setStatusMessage: ((message: string) => void) | null = null;
  setIsGenerating: ((generating: boolean) => void) | null = null;
  setDocuments: ((docs: DocumentData[]) => void) | null = null;
  setDocumentStatus: ((status: { count: number; totalSize: number; vectorCount: number }) => void) | null = null;
  setShowDocumentManager: ((show: boolean) => void) | null = null;
  setShowOllamaConnectionModal: ((show: boolean) => void) | null = null;
  setShowModelSelectionModal: ((show: boolean) => void) | null = null;
  setAvailableModels: ((models: any[]) => void) | null = null;
  setSelectedOllamaURL: ((url: string) => void) | null = null;
  setIsVectorStoreLoading: ((loading: boolean) => void) | null = null;
  setIsProcessingDocuments: ((processing: boolean) => void) | null = null;
  setProcessingProgress: ((progress: {
    currentFile: string;
    progress: number;
    message: string;
    fileIndex: number;
    totalFiles: number;
  } | null) => void) | null = null;

  constructor() {
    // Make this instance globally available - only in browser
    if (typeof window !== 'undefined') {
      (window as any).deepResearchApp = this;
    }
    console.log('🚀 DeepResearchApp constructor called');
  }

  async init() {
    console.log('🚀 DeepResearchApp.init() called');
    
    // Load basic data first (topics, research results) - this is fast
    this.loadBasicDataFromStorage();
    
    // Initialize AI Assistant - this is fast
    this.initializeAIAssistant();
    
    // Load AI connection state - this is fast
    setTimeout(() => {
      this.loadAIConnectionFromStorage();
    }, 100);
    
    // Show UI immediately with ready status
    this.updateStatus('✅ DeepResearch ready - Document features loading...');
    console.log('✅ DeepResearchApp basic initialization complete - UI ready');
    
    // Initialize Vector Store asynchronously in background (non-blocking)
    this.initializeVectorStoreAsync();
  }

  private async initializeVectorStoreAsync() {
    try {
      console.log('📊 Starting background VectorStore initialization...');
      this.updateStatus('📊 Loading document processing capabilities...');
      this.isVectorStoreLoading = true;
      this.setIsVectorStoreLoading?.(true);
      
      // Check if there's already a shared VectorStore instance (only in browser)
      if (typeof window !== 'undefined' && (window as any).sharedVectorStore && (window as any).sharedVectorStore.initialized) {
        console.log('🔗 Using existing shared VectorStore instance');
        this.vectorStore = (window as any).sharedVectorStore;
        this.updateStatus('✅ Document processing ready');
        this.updateDocumentStatus();
        this.isVectorStoreLoading = false;
        this.setIsVectorStoreLoading?.(false);
        return;
      }
      
      // Create new VectorStore instance (this downloads embeddings)
      console.log('🆕 Creating new VectorStore instance - downloading embeddings...');
      this.updateStatus('⬇️ Downloading AI embeddings model (first time only)...');
      
      this.vectorStore = new VectorStore();
      await this.vectorStore.init();
      
      // Make it available globally (only in browser)
      if (typeof window !== 'undefined') {
        (window as any).sharedVectorStore = this.vectorStore;
      }
      
      console.log('✅ VectorStore background initialization complete');
      this.updateStatus('✅ Document processing ready - Upload documents to enhance research');
      this.updateDocumentStatus();
      this.isVectorStoreLoading = false;
      this.setIsVectorStoreLoading?.(false);
      
    } catch (error) {
      console.error('❌ VectorStore background initialization failed:', error);
      this.updateStatus('⚠️ Document processing unavailable - Research still works without documents');
      this.vectorStore = null;
      this.isVectorStoreLoading = false;
      this.setIsVectorStoreLoading?.(false);
      // Don't block the app - continue without vector store
    }
  }

  // Legacy method - now non-blocking
  async initializeVectorStore() {
    // Just call the async version and don't await it
    this.initializeVectorStoreAsync();
  }

  initializeAIAssistant() {
    console.log('🤖 Initializing AI Assistant...');
    this.aiAssistant = new AIAssistant();
    
    // Set up status change callback
    this.aiAssistant.setStatusChangeCallback((status) => {
      console.log('🔄 AI Status changed:', status);
      this.setAIStatus?.(status);
      
      if (status.connected) {
        this.updateStatus(`✅ Connected to ${status.provider}${status.model ? ` (${status.model})` : ''}`);
        // Save connection state when successfully connected
        this.saveToStorage();
      } else {
        this.updateStatus(`❌ AI connection failed: ${status.error || 'Unknown error'}`);
        // Also save state when disconnected to persist the disconnection
        this.saveToStorage();
      }
    });
    
    console.log('✅ AI Assistant initialized');
  }

  addTopic(title: string, description: string) {
    const newTopic: Topic = {
      id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      selected: false
    };
    
    this.topics.push(newTopic);
    this.setTopics?.(this.topics);
    this.saveToStorage();
    
    // Track topic addition
    analytics.trackTopicManagement('add_topic', this.topics.length);
  }

  deleteTopic(topicId: string) {
    this.topics = this.topics.filter(t => t.id !== topicId);
    this.setTopics?.(this.topics);
    this.saveToStorage();
    
    // Track topic deletion
    analytics.trackTopicManagement('delete_topic', this.topics.length);
  }

  selectTopic(topicId: string) {
    this.topics = this.topics.map(t => ({
      ...t,
      selected: t.id === topicId ? !t.selected : t.selected
    }));
    this.setTopics?.(this.topics);
    this.saveToStorage();
  }

  moveTopic(topicId: string, direction: 'up' | 'down') {
    const index = this.topics.findIndex(t => t.id === topicId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.topics.length) return;
    
    const newTopics = [...this.topics];
    [newTopics[index], newTopics[newIndex]] = [newTopics[newIndex], newTopics[index]];
    
    this.topics = newTopics;
    this.setTopics?.(this.topics);
    this.saveToStorage();
  }

  async connectAI() {
    this.updateStatus('🔄 Starting AI connection...');
    
    // Check if already connected
    if (this.aiAssistant?.isConnected()) {
      this.updateStatus('✅ AI is already connected');
      return;
    }
    
    // Show Ollama connection modal
    this.setShowOllamaConnectionModal?.(true);
  }

  async testOllamaConnection(url: string) {
    if (!this.aiAssistant) {
      this.updateStatus('❌ AI Assistant not initialized');
      return;
    }

    this.updateStatus('🔍 Testing Ollama connection...');
    
    try {
      const result = await this.aiAssistant.testOllamaConnection(url);
      
      if (result.success) {
        this.availableModels = result.models || [];
        this.setAvailableModels?.(this.availableModels);
        this.selectedOllamaURL = url;
        this.setSelectedOllamaURL?.(url);
        
        // Close connection modal and show model selection
        this.setShowOllamaConnectionModal?.(false);
        this.setShowModelSelectionModal?.(true);
        
        this.updateStatus(`✅ Found ${this.availableModels.length} available models`);
      } else {
        this.updateStatus(`❌ Connection failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Ollama connection test failed:', error);
      this.updateStatus(`❌ Connection test failed: ${(error as Error).message}`);
    }
  }

  async selectModel(modelName: string) {
    if (!this.aiAssistant) {
      this.updateStatus('❌ AI Assistant not initialized');
      return;
    }

    this.updateStatus(`🔄 Connecting to ${modelName}...`);
    
    try {
      const success = await this.aiAssistant.connectToOllama(this.selectedOllamaURL, modelName);
      
      if (success) {
        this.setShowModelSelectionModal?.(false);
        this.updateStatus(`✅ Connected to ${modelName} successfully`);
        // Save connection state to localStorage
        this.saveToStorage();
        
        // Track successful AI connection
        analytics.trackAIConnection('ollama', modelName, 'connected');
      } else {
        this.updateStatus(`❌ Failed to connect to ${modelName}`);
        // Track failed AI connection
        analytics.trackAIConnection('ollama', modelName, 'failed');
      }
    } catch (error) {
      console.error('❌ Model selection failed:', error);
      this.updateStatus(`❌ Model selection failed: ${(error as Error).message}`);
      // Track connection error
      analytics.trackAIConnection('ollama', modelName, 'error');
    }
  }

  cancelConnection() {
    this.setShowOllamaConnectionModal?.(false);
    this.setShowModelSelectionModal?.(false);
    this.updateStatus('🔄 Connection cancelled');
  }

  disconnectAI() {
    if (this.aiAssistant && this.aiAssistant.isConnected()) {
      console.log('🔌 Disconnecting AI...');
      this.aiAssistant.disconnect();
      this.updateStatus('🔌 AI disconnected');
      // State will be saved automatically via the status change callback
    }
  }

  async generateResearch(researchType: ResearchType, researchDepth: ResearchDepth) {
    if (this.isGenerating) return;
    
    const selectedTopics = this.topics.filter(t => t.selected);
    if (selectedTopics.length === 0) {
      this.updateStatus('❌ Please select at least one research topic');
      return;
    }

    // Check if AI is connected
    if (!this.aiAssistant?.isConnected()) {
      this.updateStatus('❌ Please connect to AI first');
      return;
    }

    this.isGenerating = true;
    this.setIsGenerating?.(true);
    this.updateStatus('🔄 Generating research with AI...');

    // Track research generation start
    const aiSession = this.aiAssistant.getSession();
    analytics.trackResearchGeneration(
      researchType,
      researchDepth,
      aiSession?.provider || 'unknown',
      selectedTopics.length
    );

    try {
      // Step 1: Perform RAG - Search for relevant documents
      let relevantDocuments: any[] = [];
      if (this.vectorStore && !this.isVectorStoreLoading) {
        this.updateStatus('🔍 Searching knowledge base for relevant documents...');
        relevantDocuments = await this.searchRelevantDocuments(selectedTopics);
      } else {
        console.log('⚠️ VectorStore not ready, generating research without document context');
        this.updateStatus('🔍 Generating research (document search unavailable)...');
      }
      
      // Step 2: Build research prompt with RAG context
      const researchPrompt = await this.buildResearchPrompt(selectedTopics, researchType, researchDepth, relevantDocuments);
      
      // Step 3: Generate research using AI with RAG context
      this.updateStatus('🤖 Generating comprehensive research report...');
      const rawContent = await this.aiAssistant.generateContent(researchPrompt, 'research');
      
      // Filter out <think> tags and any other unwanted content
      const researchContent = this.cleanResearchOutput(rawContent);
      
      // Step 4: Create research metadata
      const researchId = `research-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const researchMetadata = {
        id: researchId,
        title: `${researchType.charAt(0).toUpperCase() + researchType.slice(1)} Research: ${selectedTopics.map(t => t.title).join(', ')}`,
        type: researchType,
        depth: researchDepth,
        topics: selectedTopics.map(t => t.title),
        generatedAt: new Date().toISOString(),
        aiProvider: this.aiAssistant.getSession()?.provider || 'unknown',
        model: this.aiAssistant.getSession()?.model || 'unknown',
        documentIntegration: relevantDocuments.length > 0
      };
      
             // Step 5: Save to vector store with research metadata
       if (this.vectorStore) {
         await this.vectorStore.addGeneratedDocument(
           researchMetadata.title, 
           researchContent,
           // Progress callback for research document
           (progress) => {
             this.updateStatus(`💾 Saving research: ${progress.message} (${progress.progress}%)`);
           }
         );
         this.updateStatus('✅ Research saved to knowledge base');
         this.updateDocumentStatus();
       }
       
       // Step 6: Store research results with metadata for persistence
       this.researchResults[researchId] = {
         content: researchContent,
         metadata: researchMetadata,
         timestamp: new Date().toISOString()
       } as ResearchItem;
       
       // Set current research as the most recent one
       this.researchResults['current'] = researchContent;
       this.researchResults['currentMetadata'] = researchMetadata as ResearchMetadata;
      
      // Update React state and save to storage
      this.setResearchResults?.(researchContent);
      this.saveToStorage();
      
      this.updateStatus('✅ Research generated and saved successfully');
      
    } catch (error) {
      console.error('❌ Research generation failed:', error);
      this.updateStatus('❌ Research generation failed: ' + (error as Error).message);
      
      // Fall back to demo content on error
      const demoContent = this.generateDemoResearch(selectedTopics, researchType, researchDepth);
      const demoId = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const demoMetadata = {
        id: demoId,
        title: `Demo ${researchType.charAt(0).toUpperCase() + researchType.slice(1)} Research: ${selectedTopics.map(t => t.title).join(', ')}`,
        type: researchType,
        depth: researchDepth,
        topics: selectedTopics.map(t => t.title),
        generatedAt: new Date().toISOString(),
        aiProvider: 'demo',
        model: 'demo',
        documentIntegration: false
      };
      
             // Store demo content with metadata
       this.researchResults[demoId] = {
         content: demoContent,
         metadata: demoMetadata,
         timestamp: new Date().toISOString()
       } as ResearchItem;
       
       this.researchResults['current'] = demoContent;
       this.researchResults['currentMetadata'] = demoMetadata as ResearchMetadata;
      
      this.setResearchResults?.(demoContent);
      this.saveToStorage();
      
      this.updateStatus('⚠️ Using demo content - AI generation failed');
    } finally {
      this.isGenerating = false;
      this.setIsGenerating?.(false);
    }
  }

  // RAG Search for relevant documents
  private async searchRelevantDocuments(selectedTopics: Topic[]): Promise<any[]> {
    if (!this.vectorStore) {
      console.log('⚠️ No vector store available for RAG search');
      return [];
    }

    const allResults: any[] = [];
    
    try {
      // Search for documents related to each topic
      for (const topic of selectedTopics) {
        const searchQuery = `${topic.title} ${topic.description}`;
        console.log(`🔍 RAG Search: "${searchQuery}"`);
        
        const results = await this.vectorStore.searchSimilar(searchQuery, 0.1, 10);
        console.log(`📊 Found ${results.length} relevant documents for "${topic.title}"`);
        
        // Add topic context to results
        results.forEach(result => {
          (result as any).relatedTopic = topic.title;
        });
        
        allResults.push(...results);
      }
      
      // Remove duplicates and sort by similarity
      const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.document.id === result.document.id && r.chunk.index === result.chunk.index)
      );
      
      const sortedResults = uniqueResults.sort((a, b) => b.similarity - a.similarity);
      
      console.log(`📊 RAG Search Summary: ${sortedResults.length} unique relevant documents found`);
      return sortedResults.slice(0, 20); // Limit to top 20 results
      
    } catch (error) {
      console.error('❌ RAG search failed:', error);
      return [];
    }
  }

  private async buildResearchPrompt(selectedTopics: Topic[], type: ResearchType, depth: ResearchDepth, relevantDocuments: any[]): Promise<string> {
    const topics = selectedTopics.map(t => `${t.title}: ${t.description}`).join('\n');
    
    let prompt = `You are a professional researcher. Generate a comprehensive ${depth} ${type} research report based on the provided topics and supporting documents.\n\n`;
    
    prompt += `## Research Topics:\n${topics}\n\n`;
    
    // Add RAG context if documents are available
    if (relevantDocuments.length > 0) {
      prompt += `## Supporting Documents & Evidence:\n`;
      prompt += `The following documents from the knowledge base are relevant to your research:\n\n`;
      
      relevantDocuments.forEach((result, index) => {
        const matchPercentage = (result.similarity * 100).toFixed(1);
        prompt += `### Document ${index + 1}: "${result.document.title}" (${matchPercentage}% match)\n`;
        prompt += `**Related to:** ${(result as any).relatedTopic}\n`;
        prompt += `**Content:** ${result.chunk.content.substring(0, 500)}${result.chunk.content.length > 500 ? '...' : ''}\n`;
        prompt += `**Source:** Document ID ${result.document.id}, Chunk ${result.chunk.index + 1}\n\n`;
      });
      
      prompt += `## Research Requirements:\n`;
      prompt += `- **IMPORTANT**: Use the provided documents as evidence and cite them in your report\n`;
      prompt += `- Include specific quotes from documents with citations (Document X, Y% match)\n`;
      prompt += `- Reference statistical data and metrics found in the documents\n`;
      prompt += `- Create a comprehensive analysis that connects document evidence to research topics\n`;
    } else {
      prompt += `## Research Requirements:\n`;
      prompt += `- **Note**: No supporting documents found in knowledge base - generate based on AI knowledge\n`;
    }
    
    prompt += `- Research Type: ${type}\n`;
    prompt += `- Research Depth: ${depth}\n`;
    prompt += `- Format: Professional markdown with proper headers and structure\n\n`;
    
    prompt += `## Required Report Structure:\n`;
    prompt += `1. **🎯 Executive Summary** - Key findings and primary insights\n`;
    prompt += `2. **📊 Individual Topic Analysis** - Detailed analysis per topic with:\n`;
    prompt += `   - Topic Background\n`;
    prompt += `   - Key Findings\n`;
    prompt += `   - Supporting Evidence (with citations if documents available)\n`;
    prompt += `   - Analysis and Implications\n`;
    prompt += `3. **🔗 Cross-Topic Insights & Connections** - How topics relate to each other\n`;
    prompt += `4. **📈 Key Findings & Evidence** - Statistical data, quotes, and concrete evidence\n`;
    prompt += `5. **💡 Implications & Impact Assessment** - What this means for the field\n`;
    prompt += `6. **🎯 Actionable Recommendations** - Specific next steps and recommendations\n`;
    prompt += `7. **📚 Source Integration Summary** - How documents informed the research\n\n`;
    
    if (depth === 'overview') {
      prompt += `## Depth Guidelines:\n`;
      prompt += `- Keep sections concise with high-level insights\n`;
      prompt += `- Focus on 3-5 key points per topic\n`;
      prompt += `- Emphasize actionable takeaways\n`;
    } else if (depth === 'detailed') {
      prompt += `## Depth Guidelines:\n`;
      prompt += `- Provide comprehensive analysis with supporting data\n`;
      prompt += `- Include market analysis, technology assessment, and competitive landscape\n`;
      prompt += `- Add specific metrics and quantitative insights\n`;
    } else { // comprehensive
      prompt += `## Depth Guidelines:\n`;
      prompt += `- Provide in-depth analysis with detailed methodology\n`;
      prompt += `- Include extensive findings, strategic recommendations, and next steps\n`;
      prompt += `- Add specific metrics, market sizing, and implementation timelines\n`;
      prompt += `- Cross-reference multiple sources and provide detailed evidence\n`;
    }
    
    prompt += `\n## Critical Output Requirements:\n`;
    prompt += `- **IMPORTANT**: Generate ONLY the final research report - NO thinking process, reasoning, or analysis tags\n`;
    prompt += `- **NO** <think>, <reasoning>, or <analysis> tags - output must be clean markdown only\n`;
    prompt += `- Start directly with the report title and content\n`;
    prompt += `- Use professional markdown formatting with proper headers, lists, and emphasis\n`;
    prompt += `- Make it comprehensive, evidence-based, and actionable\n`;
    
    if (relevantDocuments.length > 0) {
      prompt += `- Include document citations in format: (Document X, Y% match)\n`;
      prompt += `- Reference specific quotes and data from the provided documents\n`;
    }
    
    prompt += `\n## Example Output Structure:\n`;
    prompt += `# Research Report Title\n\n`;
    prompt += `## 🎯 Executive Summary\n[key findings]\n\n`;
    prompt += `## 📊 Individual Topic Analysis\n[detailed analysis per topic]\n\n`;
    prompt += `[... continue with remaining sections ...]\n\n`;
    prompt += `**Generate the report now in clean markdown format:**`;
    
    return prompt;
  }

  private cleanResearchOutput(rawContent: string): string {
    let cleanContent = rawContent;
    
    // Remove <think> tags and their content
    cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Remove any other unwanted XML-like tags that might appear
    cleanContent = cleanContent.replace(/<\/?reasoning>/gi, '');
    cleanContent = cleanContent.replace(/<\/?analysis>/gi, '');
    
    // Clean up extra whitespace and newlines
    cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanContent = cleanContent.trim();
    
    // Ensure proper markdown formatting
    cleanContent = this.improveMarkdownFormatting(cleanContent);
    
    return cleanContent;
  }

  private improveMarkdownFormatting(content: string): string {
    let formatted = content;
    
    // Ensure proper heading hierarchy
    formatted = formatted.replace(/^#{7,}/gm, '######'); // Max 6 levels
    
    // Ensure space after hash symbols in headings
    formatted = formatted.replace(/^(#+)([^\s#])/gm, '$1 $2');
    
    // Improve list formatting
    formatted = formatted.replace(/^(\s*)-([^\s])/gm, '$1- $2');
    formatted = formatted.replace(/^(\s*)\*([^\s])/gm, '$1* $2');
    formatted = formatted.replace(/^(\s*)\d+\.([^\s])/gm, '$1$&');
    
    // Ensure proper spacing around code blocks
    formatted = formatted.replace(/```/g, '\n```\n');
    formatted = formatted.replace(/\n\n```\n/g, '\n```\n');
    formatted = formatted.replace(/\n```\n\n/g, '\n```\n');
    
    // Improve table formatting if present
    formatted = formatted.replace(/\|([^|\n]*)\|/g, (match, content) => {
      return '| ' + content.trim() + ' |';
    });
    
    // Ensure consistent emphasis formatting
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '**$1**');
    formatted = formatted.replace(/\*([^*]+)\*/g, '*$1*');
    
    // Clean up multiple consecutive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    return formatted.trim();
  }

  private generateDemoResearch(selectedTopics: Topic[], type: ResearchType, depth: ResearchDepth): string {
    const topics = selectedTopics.map(t => t.title).join(', ');
    
    let content = `# ${type.charAt(0).toUpperCase() + type.slice(1)} Research Report\n\n`;
    content += `**Research Depth:** ${depth}\n`;
    content += `**Topics:** ${topics}\n`;
    content += `**Generated:** ${new Date().toLocaleDateString()}\n`;
    content += `**Note:** This is demo content - AI generation failed\n\n`;
    
    content += `## Executive Summary\n\n`;
    content += `This ${depth} ${type} research analysis covers ${topics}. `;
    
    if (depth === 'overview') {
      content += `This overview provides key insights and high-level findings.\n\n`;
      content += `## Key Findings\n\n`;
      selectedTopics.forEach((topic, i) => {
        content += `### ${i + 1}. ${topic.title}\n\n`;
        content += `${topic.description}\n\n`;
        content += `**Key Points:**\n`;
        content += `- Market opportunity identified\n`;
        content += `- Technological feasibility confirmed\n`;
        content += `- Competitive landscape assessed\n\n`;
      });
    } else if (depth === 'detailed') {
      content += `This detailed analysis provides comprehensive insights with supporting data.\n\n`;
      content += `## Detailed Analysis\n\n`;
      selectedTopics.forEach((topic, i) => {
        content += `### ${i + 1}. ${topic.title}\n\n`;
        content += `**Background:** ${topic.description}\n\n`;
        content += `**Market Analysis:**\n`;
        content += `- Market size: $X.X billion\n`;
        content += `- Growth rate: X% CAGR\n`;
        content += `- Key drivers: Innovation, demand, regulation\n\n`;
        content += `**Technology Assessment:**\n`;
        content += `- Maturity level: High\n`;
        content += `- Implementation complexity: Medium\n`;
        content += `- Required resources: Moderate\n\n`;
        content += `**Competitive Landscape:**\n`;
        content += `- Number of competitors: X-Y major players\n`;
        content += `- Market leader: Company ABC\n`;
        content += `- Differentiation opportunities: Innovation, cost, service\n\n`;
      });
    } else { // comprehensive
      content += `This comprehensive research provides in-depth analysis with detailed methodology and extensive findings.\n\n`;
      content += `## Methodology\n\n`;
      content += `- Literature review of 50+ sources\n`;
      content += `- Market data analysis\n`;
      content += `- Expert interviews\n`;
      content += `- Competitive intelligence\n\n`;
      content += `## Comprehensive Analysis\n\n`;
      selectedTopics.forEach((topic, i) => {
        content += `### ${i + 1}. ${topic.title}\n\n`;
        content += `**Executive Summary:** ${topic.description}\n\n`;
        content += `**Market Dynamics:**\n`;
        content += `- Total Addressable Market (TAM): $X.X billion\n`;
        content += `- Serviceable Addressable Market (SAM): $X.X billion\n`;
        content += `- Serviceable Obtainable Market (SOM): $X.X million\n`;
        content += `- Market growth drivers: Technology adoption, regulatory support\n`;
        content += `- Market constraints: Technical challenges, cost barriers\n\n`;
        content += `**Technology Deep Dive:**\n`;
        content += `- Current state: Mature/Emerging/Early stage\n`;
        content += `- Technical requirements: High performance computing, specialized algorithms\n`;
        content += `- Implementation timeline: 6-18 months\n`;
        content += `- Risk factors: Technical complexity, resource requirements\n\n`;
        content += `**Competitive Intelligence:**\n`;
        content += `- Market leaders: Company A (25%), Company B (20%), Company C (15%)\n`;
        content += `- Competitive advantages: Patent portfolio, market presence, technical expertise\n`;
        content += `- Competitive gaps: Cost optimization, user experience, integration capabilities\n\n`;
        content += `**Strategic Recommendations:**\n`;
        content += `- Investment priority: High/Medium/Low\n`;
        content += `- Recommended approach: Partnership, acquisition, internal development\n`;
        content += `- Success metrics: Revenue growth, market share, technical milestones\n\n`;
      });
    }
    
    content += `## Conclusion\n\n`;
    content += `Based on this ${depth} ${type} analysis, the research indicates significant opportunities in ${topics}. `;
    content += `Key recommendations include strategic investment, technology development, and market positioning initiatives.\n\n`;
    content += `## Next Steps\n\n`;
    content += `1. Detailed market entry strategy\n`;
    content += `2. Technical feasibility assessment\n`;
    content += `3. Partnership and collaboration opportunities\n`;
    content += `4. Investment and resource planning\n\n`;
    content += `---\n\n`;
    content += `*This research was generated by DeepResearch TimeCapsule (Demo Mode)*`;
    
    return content;
  }

  async handleFileUpload(files: FileList) {
    if (!this.vectorStore) {
      this.updateStatus('❌ Vector Store not available');
      return;
    }

    if (this.isUploading) {
      this.updateStatus('⚠️ Upload already in progress');
      return;
    }

    this.isUploading = true;
    this.setIsProcessingDocuments?.(true);
    console.log(`📊 Processing ${files.length} documents...`);
    
    let successCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📄 Processing file ${i + 1}/${files.length}: ${file.name}`);
        this.updateStatus(`📄 Processing ${file.name} (${i + 1}/${files.length})...`);
        
        // Update processing progress state for modal
        this.setProcessingProgress?.({
          currentFile: file.name,
          progress: 0,
          message: 'Starting processing...',
          fileIndex: i + 1,
          totalFiles: files.length
        });
        
        try {
          const content = await this.readFileContent(file);
          await this.vectorStore.addDocument(
            file, 
            content,
            // Progress callback for each file
            (progress) => {
              this.updateStatus(`📄 ${file.name}: ${progress.message} (${progress.progress}%)`);
              
              // Update modal progress in real-time
              this.setProcessingProgress?.({
                currentFile: file.name,
                progress: progress.progress,
                message: progress.message,
                fileIndex: i + 1,
                totalFiles: files.length
              });
            }
          );
          successCount++;
          console.log(`✅ Successfully processed: ${file.name}`);
          
          // Clear progress for this file
          this.setProcessingProgress?.({
            currentFile: file.name,
            progress: 100,
            message: '✅ Processing complete',
            fileIndex: i + 1,
            totalFiles: files.length
          });
          
          // Brief pause to show completion
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (fileError) {
          console.error(`❌ Failed to process ${file.name}:`, fileError);
          failedCount++;
          this.updateStatus(`❌ Failed to process ${file.name}: ${(fileError as Error).message}`);
          
          // Show error in progress
          this.setProcessingProgress?.({
            currentFile: file.name,
            progress: 0,
            message: `❌ Error: ${(fileError as Error).message}`,
            fileIndex: i + 1,
            totalFiles: files.length
          });
          
          // Continue processing other files instead of stopping
          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause before next file
        }
      }
      
      if (successCount > 0) {
        this.updateStatus(`✅ Successfully uploaded ${successCount} file(s)${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
        this.updateDocumentStatus();
        
        // Track successful document uploads
        analytics.trackDocumentManagement('upload_documents', successCount);
      } else {
        this.updateStatus(`❌ All uploads failed`);
        // Track failed uploads
        analytics.trackDocumentManagement('upload_failed', 0);
      }
      
      console.log(`📊 Upload process completed: ${successCount} successful, ${failedCount} failed`);
      
    } catch (error) {
      console.error('❌ Upload process failed:', error);
      this.updateStatus('❌ Upload process failed: ' + (error as Error).message);
    } finally {
      this.isUploading = false;
      this.setIsProcessingDocuments?.(false);
      this.setProcessingProgress?.(null);
      
      // Clear file input to allow re-uploading same files
      if (typeof document !== 'undefined') {
        const fileInput = document.getElementById('documentUpload') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
          console.log(`📄 File input cleared successfully`);
        }
      }
      
      console.log(`📄 Upload process completed, state reset`);
    }
  }

  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check file size to prevent freezing (following reference implementation)
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error(`File too large: ${file.name} (${this.formatFileSize(file.size)}). Please use files under 10MB.`));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async showDocumentManager() {
    if (!this.vectorStore) {
      this.updateStatus('❌ Vector Store not initialized');
      return;
    }

    this.setShowDocumentManager?.(true);
    this.updateStatus('📚 Opening document manager...');
    
    // Track manage knowledge event
    try {
      const stats = await this.vectorStore.getStats();
      analytics.trackEvent('knowledge_management', {
        action: 'manage_knowledge_opened',
        document_count: stats.documentCount,
        vector_count: stats.vectorCount,
        event_category: 'knowledge',
        event_label: 'manage_knowledge_opened'
      });
    } catch (error) {
      analytics.trackEvent('knowledge_management', {
        action: 'manage_knowledge_opened',
        document_count: 0,
        vector_count: 0,
        event_category: 'knowledge',
        event_label: 'manage_knowledge_opened'
      });
    }
  }

  hideDocumentManager() {
    this.setShowDocumentManager?.(false);
  }

  async deleteDocument(docId: string) {
    if (!this.vectorStore) {
      this.updateStatus('❌ Vector Store not available');
      return;
    }

    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await this.vectorStore.deleteDocument(docId);
        this.updateStatus('✅ Document deleted successfully');
        this.updateDocumentStatus();
      } catch (error) {
        console.error('Failed to delete document:', error);
        this.updateStatus('❌ Failed to delete document: ' + (error as Error).message);
      }
    }
  }

  async previewDocument(docId: string) {
    if (!this.vectorStore) {
      this.updateStatus('❌ Vector Store not available');
      return null;
    }

    try {
      const document = await this.vectorStore.getDocument(docId);
      if (!document) {
        this.updateStatus('❌ Document not found');
        return null;
      }

      this.updateStatus('📄 Document preview loaded');
      return document;
    } catch (error) {
      console.error('Failed to preview document:', error);
      this.updateStatus('❌ Failed to preview document: ' + (error as Error).message);
      return null;
    }
  }

  async downloadDocument(docId: string) {
    if (!this.vectorStore) {
      this.updateStatus('❌ Vector Store not available');
      return;
    }

    try {
      const document = await this.vectorStore.getDocument(docId);
      if (!document) {
        this.updateStatus('❌ Document not found');
        return;
      }

      const blob = new Blob([document.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.updateStatus('✅ Document downloaded successfully');
    } catch (error) {
      console.error('Failed to download document:', error);
      this.updateStatus('❌ Failed to download document: ' + (error as Error).message);
    }
  }

  async searchDocuments(query: string, threshold: number = 0.3, limit: number = 20) {
    if (!this.vectorStore) {
      this.updateStatus('❌ Vector Store not available');
      return [];
    }

    if (!query.trim()) {
      this.updateStatus('❌ Please enter a search query');
      return [];
    }

    try {
      this.updateStatus('🔍 Searching documents...');
      const results = await this.vectorStore.searchSimilar(query, threshold, limit);
      
      if (results.length === 0) {
        this.updateStatus('❌ No documents found matching your query');
        analytics.trackSearch(query, 0, 'knowledge_base');
        return [];
      }

      this.updateStatus(`✅ Found ${results.length} relevant results`);
      // Track successful search
      analytics.trackSearch(query, results.length, 'knowledge_base');
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      this.updateStatus('❌ Search failed: ' + (error as Error).message);
      // Track search error
      analytics.trackError('search_error', (error as Error).message, 'searchDocuments');
      return [];
    }
  }

  async updateDocumentStatus() {
    if (!this.vectorStore) {
      this.setDocumentStatus?.({ count: 0, totalSize: 0, vectorCount: 0 });
      return;
    }

    try {
      const stats = await this.vectorStore.getStats();
      const documents = await this.vectorStore.getAllDocuments();
      const totalSize = documents.reduce((sum, doc) => sum + doc.metadata.filesize, 0);
      
      this.setDocumentStatus?.({
        count: stats.documentCount,
        totalSize: totalSize,
        vectorCount: stats.vectorCount
      });
      
      this.setDocuments?.(documents);
    } catch (error) {
      console.error('Failed to update document status:', error);
    }
  }

  exportResults() {
    const data = {
      topics: this.topics,
      researchResults: this.researchResults,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deepresearch_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.updateStatus('✅ Research exported successfully');
    
    // Track export event
    analytics.trackExport('research_results', blob.size);
  }

  // TimeCapsule export - comprehensive data export including vector store
  async exportTimeCapsule() {
    try {
      this.updateStatus('📦 Preparing TimeCapsule export...');
      
      const timeCapsuleData = {
        metadata: {
          version: '4.0.0',
          exportedAt: new Date().toISOString(),
          platform: 'Next.js',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        },
        research: {
          topics: this.topics,
          researchResults: this.researchResults,
          currentTab: this.currentTab
        },
        vectorStore: null as any
      };

      // Export vector store data if available
      if (this.vectorStore) {
        try {
          const documents = await this.vectorStore.getAllDocuments();
          const stats = await this.vectorStore.getStats();
          
          timeCapsuleData.vectorStore = {
            documents: documents,
            stats: stats,
            exportedAt: new Date().toISOString()
          };
          
          this.updateStatus('📊 Vector store data included in export');
        } catch (vectorError) {
          console.warn('⚠️ Could not export vector store data:', vectorError);
          this.updateStatus('⚠️ Research data exported without vector store');
        }
      }

      const blob = new Blob([JSON.stringify(timeCapsuleData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timecapsule_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.updateStatus('✅ TimeCapsule exported successfully');
    } catch (error) {
      console.error('❌ TimeCapsule export failed:', error);
      this.updateStatus('❌ TimeCapsule export failed: ' + (error as Error).message);
    }
  }

  // TimeCapsule import - restore from exported data
  async importTimeCapsule(file: File) {
    try {
      this.updateStatus('📦 Importing TimeCapsule...');
      
      const content = await this.readFileContent(file);
      const timeCapsuleData = JSON.parse(content);
      
      // Validate TimeCapsule format
      if (!timeCapsuleData.metadata || !timeCapsuleData.research) {
        throw new Error('Invalid TimeCapsule format');
      }
      
      // Restore research data
      if (timeCapsuleData.research.topics) {
        this.topics = timeCapsuleData.research.topics;
        this.setTopics?.(this.topics);
      }
      
      if (timeCapsuleData.research.researchResults) {
        this.researchResults = timeCapsuleData.research.researchResults;
        this.setResearchResults?.(this.getCurrentResearchContent());
      }
      
      // Restore vector store data
      if (timeCapsuleData.vectorStore && this.vectorStore) {
        try {
          this.updateStatus('📊 Restoring vector store data...');
          
          // Clear existing data
          await this.vectorStore.clear();
          
          // Import documents
          const documents = timeCapsuleData.vectorStore.documents || [];
          for (const doc of documents) {
            try {
              // Re-insert document into vector store
              await this.vectorStore.insertDocument(doc);
            } catch (docError) {
              console.warn(`⚠️ Could not restore document ${doc.id}:`, docError);
            }
          }
          
          this.updateDocumentStatus();
          this.updateStatus('✅ Vector store data restored');
        } catch (vectorError) {
          console.warn('⚠️ Could not restore vector store data:', vectorError);
          this.updateStatus('⚠️ Research data restored without vector store');
        }
      }
      
      this.saveToStorage();
      this.updateStatus('✅ TimeCapsule imported successfully');
      
    } catch (error) {
      console.error('❌ TimeCapsule import failed:', error);
      this.updateStatus('❌ TimeCapsule import failed: ' + (error as Error).message);
    }
  }

  // Advanced search with filters
  async searchDocumentsAdvanced(options: {
    query: string;
    threshold?: number;
    limit?: number;
    documentTypes?: string[];
    dateRange?: { start: Date; end: Date };
  }) {
    if (!this.vectorStore) {
      this.updateStatus('❌ Vector Store not available');
      return [];
    }

    try {
      const { query, threshold = 0.3, limit = 20 } = options;
      
      this.updateStatus('🔍 Performing advanced search...');
      console.log('🔍 Advanced search parameters:', options);
      
      const results = await this.vectorStore.searchSimilar(query, threshold, limit);
      
      // Apply additional filters if specified
      let filteredResults = results;
      
      if (options.documentTypes && options.documentTypes.length > 0) {
        filteredResults = filteredResults.filter(result => 
          options.documentTypes!.includes(result.document.metadata.filetype)
        );
      }
      
      if (options.dateRange) {
        const { start, end } = options.dateRange;
        filteredResults = filteredResults.filter(result => {
          const uploadDate = new Date(result.document.metadata.uploadedAt);
          return uploadDate >= start && uploadDate <= end;
        });
      }
      
      this.updateStatus(`✅ Advanced search completed: ${filteredResults.length} results`);
      return filteredResults;
      
    } catch (error) {
      console.error('❌ Advanced search failed:', error);
      this.updateStatus('❌ Advanced search failed: ' + (error as Error).message);
      return [];
    }
  }

  clearAll() {
    if (confirm('Are you sure you want to clear all research data?')) {
      this.topics = [];
      this.researchResults = {};
      this.setTopics?.([]);
      this.setResearchResults?.('');
      this.saveToStorage();
      this.updateStatus('🧹 All data cleared');
    }
  }

  saveToStorage() {
    try {
      const data = {
        topics: this.topics,
        researchResults: this.researchResults,
        aiConnection: {
          provider: this.aiAssistant?.getSession()?.provider || 'ollama',
          connected: this.aiAssistant?.isConnected() || false,
          model: this.aiAssistant?.getSession()?.model || null,
          baseURL: this.aiAssistant?.getSession()?.baseURL || this.selectedOllamaURL,
          ollamaURL: this.selectedOllamaURL
        }
      };
      localStorage.setItem('deepresearch_data', JSON.stringify(data));
      console.log('💾 Saved state to localStorage:', data.aiConnection);
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  }

  loadBasicDataFromStorage() {
    try {
      const data = localStorage.getItem('deepresearch_data');
      if (data) {
        const parsed = JSON.parse(data);
        this.topics = parsed.topics || [];
        this.researchResults = parsed.researchResults || {};
        
        // Update React state if setters are available
        this.setTopics?.(this.topics);
        this.setResearchResults?.(this.getCurrentResearchContent());
        
        console.log('📋 Loaded basic data from storage:', { 
          topics: this.topics.length, 
          hasResearchResults: Object.keys(this.researchResults).length > 0 
        });
      }
    } catch (error) {
      console.error('Failed to load basic data from storage:', error);
    }
  }

  loadAIConnectionFromStorage() {
    try {
      const data = localStorage.getItem('deepresearch_data');
      if (data) {
        const parsed = JSON.parse(data);
        
        // Restore AI connection state
        if (parsed.aiConnection) {
          console.log('🔄 Loading AI connection state from storage:', parsed.aiConnection);
          this.restoreAIConnection(parsed.aiConnection);
        } else {
          console.log('📋 No saved AI connection state found');
        }
      }
    } catch (error) {
      console.error('Failed to load AI connection from storage:', error);
    }
  }

  // Legacy method for backward compatibility
  loadFromStorage() {
    this.loadBasicDataFromStorage();
    this.loadAIConnectionFromStorage();
  }

  private getCurrentResearchContent(): string {
    const current = this.researchResults['current'];
    if (typeof current === 'string') {
      return current;
    }
    return '';
  }

  getResearchHistory(): ResearchItem[] {
    const history: ResearchItem[] = [];
    
    for (const [key, value] of Object.entries(this.researchResults)) {
      if (key !== 'current' && key !== 'currentMetadata' && typeof value === 'object' && 'content' in value) {
        history.push(value as ResearchItem);
      }
    }
    
    // Sort by timestamp (newest first)
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  loadResearchFromHistory(researchId: string) {
    const research = this.researchResults[researchId];
    if (research && typeof research === 'object' && 'content' in research) {
      const researchItem = research as ResearchItem;
      this.researchResults['current'] = researchItem.content;
      this.researchResults['currentMetadata'] = researchItem.metadata;
      this.setResearchResults?.(researchItem.content);
      this.saveToStorage();
      this.updateStatus(`✅ Loaded research: ${researchItem.metadata.title}`);
    }
  }

  private async restoreAIConnection(savedConnection: any) {
    if (!savedConnection || !this.aiAssistant) return;
    
    try {
      // Restore basic settings
      if (savedConnection.ollamaURL) {
        this.selectedOllamaURL = savedConnection.ollamaURL;
        this.setSelectedOllamaURL?.(savedConnection.ollamaURL);
      }
      
      // Set initial status to show the saved provider
      const initialStatus = {
        connected: false,
        provider: savedConnection.provider || 'ollama',
        model: undefined,
        baseURL: undefined
      };
      this.setAIStatus?.(initialStatus);
      
      // If it was previously connected, attempt to reconnect
      if (savedConnection.connected && savedConnection.model) {
        console.log(`🔄 Attempting to restore connection to ${savedConnection.provider} with model ${savedConnection.model}`);
        this.updateStatus(`🔄 Restoring AI connection to ${savedConnection.model}...`);
        
        if (savedConnection.provider === 'ollama') {
          const baseURL = savedConnection.baseURL || savedConnection.ollamaURL || this.selectedOllamaURL;
          const success = await this.aiAssistant.connectToOllama(baseURL, savedConnection.model);
          
          if (success) {
            console.log('✅ AI connection restored successfully');
            this.updateStatus(`✅ AI connection restored: ${savedConnection.model}`);
          } else {
            console.log('⚠️ Failed to restore AI connection - model may no longer be available');
            this.updateStatus(`⚠️ Could not restore AI connection to ${savedConnection.model}`);
          }
        }
      } else {
        console.log('📋 AI was not previously connected, showing disconnected state');
        this.updateStatus(`🤖 AI ready to connect (${savedConnection.provider})`);
      }
    } catch (error) {
      console.error('❌ Failed to restore AI connection:', error);
      this.updateStatus(`❌ Failed to restore AI connection: ${(error as Error).message}`);
    }
  }

  updateStatus(message: string) {
    console.log(`📋 Status: ${message}`);
    this.setStatusMessage?.(message);
  }
}

// Utility function for markdown to HTML conversion
function formatMarkdownToHTML(markdown: string): string {
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^#{6}\s(.+)$/gm, '<h6 style="color: #4facfe; margin: 20px 0 10px 0; font-weight: 600; font-size: 14px;">$1</h6>');
  html = html.replace(/^#{5}\s(.+)$/gm, '<h5 style="color: #4facfe; margin: 20px 0 10px 0; font-weight: 600; font-size: 16px;">$1</h5>');
  html = html.replace(/^#{4}\s(.+)$/gm, '<h4 style="color: #4facfe; margin: 20px 0 10px 0; font-weight: 600; font-size: 18px;">$1</h4>');
  html = html.replace(/^#{3}\s(.+)$/gm, '<h3 style="color: #4facfe; margin: 25px 0 15px 0; font-weight: 700; font-size: 20px;">$1</h3>');
  html = html.replace(/^#{2}\s(.+)$/gm, '<h2 style="color: #00f2fe; margin: 30px 0 20px 0; font-weight: 700; font-size: 24px;">$1</h2>');
  html = html.replace(/^#{1}\s(.+)$/gm, '<h1 style="color: #00f2fe; margin: 30px 0 20px 0; font-weight: 800; font-size: 28px; border-bottom: 2px solid rgba(79, 172, 254, 0.3); padding-bottom: 10px;">$1</h1>');
  
  // Convert bold text
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #4facfe; font-weight: 600;">$1</strong>');
  
  // Convert italic text
  html = html.replace(/\*(.+?)\*/g, '<em style="color: rgba(255, 255, 255, 0.8); font-style: italic;">$1</em>');
  
  // Convert unordered lists
  html = html.replace(/^[\s]*[-*+]\s(.+)$/gm, '<li style="margin: 5px 0; color: rgba(255, 255, 255, 0.9);">$1</li>');
  
  // Convert ordered lists  
  html = html.replace(/^[\s]*\d+\.\s(.+)$/gm, '<li style="margin: 5px 0; color: rgba(255, 255, 255, 0.9);">$1</li>');
  
  // Wrap consecutive list items in ul/ol tags
  html = html.replace(/(<li[^>]*>.*?<\/li>[\s\S]*?)+/g, (match) => {
    if (match.includes('- ') || match.includes('* ') || match.includes('+ ')) {
      return `<ul style="margin: 15px 0; padding-left: 20px; list-style-type: disc;">${match}</ul>`;
    } else {
      return `<ol style="margin: 15px 0; padding-left: 20px; list-style-type: decimal;">${match}</ol>`;
    }
  });
  
  // Convert code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```/g, '').trim();
    return `<pre style="background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 15px; margin: 15px 0; overflow-x: auto; font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; color: #a8f7a8;"><code>${code}</code></pre>`;
  });
  
  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 2px 6px; font-family: Monaco, Menlo, monospace; font-size: 12px; color: #a8f7a8;">$1</code>');
  
  // Convert line breaks
  html = html.replace(/\n\n/g, '</p><p style="margin: 15px 0; color: rgba(255, 255, 255, 0.9); line-height: 1.8;">');
  html = html.replace(/\n/g, '<br/>');
  
  // Wrap in paragraph tags
  html = `<p style="margin: 15px 0; color: rgba(255, 255, 255, 0.9); line-height: 1.8;">${html}</p>`;
  
  // Convert blockquotes
  html = html.replace(/^>\s(.+)$/gm, '<blockquote style="border-left: 4px solid #4facfe; margin: 20px 0; padding: 15px 20px; background: rgba(79, 172, 254, 0.1); color: rgba(255, 255, 255, 0.8); font-style: italic;">$1</blockquote>');
  
  // Convert tables (basic support)
  html = html.replace(/\|(.+?)\|/g, (match) => {
    const cells = match.split('|').filter(cell => cell.trim());
    const tableCells = cells.map(cell => `<td style="padding: 8px 12px; border: 1px solid rgba(255, 255, 255, 0.2);">${cell.trim()}</td>`).join('');
    return `<tr>${tableCells}</tr>`;
  });
  
  // Simple table wrapping
  if (html.includes('<tr>')) {
    html = html.replace(/(<tr>.*?<\/tr>)/g, '<table style="border-collapse: collapse; margin: 20px 0; width: 100%;">$1</table>');
  }
  
  return html;
}

// Client-only time component to avoid hydration issues
function ClientOnlyTime() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
        --:--:--
      </div>
    );
  }

  return (
    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
      {currentTime}
    </div>
  );
}

// React Component Hook
export function DeepResearchComponent() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [aiStatus, setAIStatus] = useState<AIConnectionStatus>({ connected: false, provider: 'ollama' });
  const [researchType, setResearchType] = useState<ResearchType>('academic');
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>('overview');
  const [researchResults, setResearchResults] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'research' | 'sources' | 'notes'>('research');
  const [statusMessage, setStatusMessage] = useState<string>('🚀 DeepResearch TimeCapsule ready');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [documentStatus, setDocumentStatus] = useState({ count: 0, totalSize: 0, vectorCount: 0 });
  const [showDocumentManager, setShowDocumentManager] = useState<boolean>(false);
  const [isVectorStoreLoading, setIsVectorStoreLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchThreshold, setSearchThreshold] = useState<number>(0.1);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>('');
  const [previewDocument, setPreviewDocument] = useState<DocumentData | null>(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState<boolean>(false);
  const [showChunkView, setShowChunkView] = useState<boolean>(false);
  const [currentChunk, setCurrentChunk] = useState<any>(null);
  const [showAddTopicModal, setShowAddTopicModal] = useState<boolean>(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string>('');
  const [newTopicDescription, setNewTopicDescription] = useState<string>('');
  
  // Document processing progress states
  const [isProcessingDocuments, setIsProcessingDocuments] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<{
    currentFile: string;
    progress: number;
    message: string;
    fileIndex: number;
    totalFiles: number;
  } | null>(null);
  
  // AI Connection Modal States
  const [showOllamaConnectionModal, setShowOllamaConnectionModal] = useState<boolean>(false);
  const [showModelSelectionModal, setShowModelSelectionModal] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedOllamaURL, setSelectedOllamaURL] = useState<string>('http://localhost:11434');
  
  const appRef = useRef<DeepResearchApp | null>(null);

  useEffect(() => {
    // Always create the app instance immediately
    const app = new DeepResearchApp();
    appRef.current = app;
    
    // Set React state setters
    app.setTopics = setTopics;
    app.setAIStatus = setAIStatus;
    app.setResearchType = setResearchType;
    app.setResearchDepth = setResearchDepth;
    app.setResearchResults = setResearchResults;
    app.setCurrentTab = setCurrentTab;
    app.setStatusMessage = setStatusMessage;
    app.setIsGenerating = setIsGenerating;
    app.setDocuments = setDocuments;
    app.setDocumentStatus = setDocumentStatus;
    app.setShowDocumentManager = setShowDocumentManager;
    app.setShowOllamaConnectionModal = setShowOllamaConnectionModal;
    app.setShowModelSelectionModal = setShowModelSelectionModal;
    app.setAvailableModels = setAvailableModels;
    app.setSelectedOllamaURL = setSelectedOllamaURL;
    app.setIsVectorStoreLoading = setIsVectorStoreLoading;
    app.setIsProcessingDocuments = setIsProcessingDocuments;
    app.setProcessingProgress = setProcessingProgress;
    
    // Initialize the app asynchronously (non-blocking)
    app.init();
  }, []);

  const app = appRef.current!; // Non-null assertion since we create it immediately in useEffect

  const handleSearch = async () => {
    if (!app || !searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    try {
      const results = await app.searchDocuments(searchQuery, searchThreshold, 20);
      setSearchResults(results);
      console.log('Search completed, results:', results.length);
      if (results.length > 0) {
        setCurrentSearchQuery(searchQuery);
        setShowSearchResults(true);
        setShowDocumentManager(false); // Close document manager when showing search results
        console.log('Opening search results modal with', results.length, 'results');
      }
    } catch (error) {
      console.error('Search failed:', error);
      app.updateStatus('❌ Search failed: ' + (error as Error).message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePreviewDocument = async (docId: string) => {
    const doc = await app.previewDocument(docId);
    if (doc) {
      setPreviewDocument(doc);
      setShowDocumentPreview(true);
    }
  };

  const closeSearchResults = () => {
    setShowSearchResults(false);
    setSearchResults([]);
    setCurrentSearchQuery('');
  };

  const closeDocumentPreview = () => {
    setShowDocumentPreview(false);
    setPreviewDocument(null);
  };

  const handleViewChunk = (chunk: any, document: DocumentData) => {
    setCurrentChunk({ ...chunk, document });
    setShowChunkView(true);
  };

  const closeChunkView = () => {
    setShowChunkView(false);
    setCurrentChunk(null);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.85;
              transform: scale(1.01);
            }
          }
          
          @keyframes gentlePulse {
            0%, 100% {
              background: rgba(79, 172, 254, 0.1);
              border-color: rgba(79, 172, 254, 0.3);
            }
            50% {
              background: rgba(79, 172, 254, 0.15);
              border-color: rgba(79, 172, 254, 0.4);
            }
          }
          
          @keyframes pulseGlow {
            0%, 100% {
              box-shadow: 0 0 5px rgba(79, 172, 254, 0.3);
            }
            50% {
              box-shadow: 0 0 20px rgba(79, 172, 254, 0.6);
            }
          }
          
          @keyframes float {
            0%, 100% {
              transform: translateY(0px) rotate(0deg);
            }
            25% {
              transform: translateY(-2px) rotate(1deg);
            }
            50% {
              transform: translateY(-4px) rotate(0deg);
            }
            75% {
              transform: translateY(-2px) rotate(-1deg);
            }
          }
          
                      @keyframes spin {
             0% { transform: rotate(0deg); }
             100% { transform: rotate(360deg); }
            }
            
            @keyframes gentleSpin {
             0% { transform: rotate(0deg); }
             100% { transform: rotate(360deg); }
            }
          
          .logo-container {
            animation: float 6s ease-in-out infinite;
          }
          
          .logo-glow:hover {
            opacity: 0.6 !important;
          }
          
          input::placeholder, textarea::placeholder {
            color: rgba(255, 255, 255, 0.6) !important;
          }
          input:focus::placeholder, textarea:focus::placeholder {
            color: rgba(255, 255, 255, 0.4) !important;
          }
          .research-output h1 {
            color: #00f2fe !important;
            border-bottom: 2px solid rgba(79, 172, 254, 0.3) !important;
            padding-bottom: 10px !important;
            margin: 30px 0 20px 0 !important;
          }
          .research-output h2 {
            color: #00f2fe !important;
            margin: 30px 0 20px 0 !important;
          }
          .research-output h3 {
            color: #4facfe !important;
            margin: 25px 0 15px 0 !important;
          }
          .research-output h4, .research-output h5, .research-output h6 {
            color: #4facfe !important;
            margin: 20px 0 10px 0 !important;
          }
          .research-output strong {
            color: #4facfe !important;
            font-weight: 600 !important;
          }
          .research-output code {
            background: rgba(0, 0, 0, 0.4) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            border-radius: 4px !important;
            padding: 2px 6px !important;
            color: #a8f7a8 !important;
          }
          .research-output pre {
            background: rgba(0, 0, 0, 0.5) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            border-radius: 8px !important;
            padding: 15px !important;
            margin: 15px 0 !important;
            overflow-x: auto !important;
          }
          .research-output ul, .research-output ol {
            margin: 15px 0 !important;
            padding-left: 20px !important;
          }
          .research-output li {
            margin: 5px 0 !important;
            color: rgba(255, 255, 255, 0.9) !important;
          }
          .research-output blockquote {
            border-left: 4px solid #4facfe !important;
            margin: 20px 0 !important;
            padding: 15px 20px !important;
            background: rgba(79, 172, 254, 0.1) !important;
            color: rgba(255, 255, 255, 0.8) !important;
            font-style: italic !important;
          }
        `}
      </style>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr 6px 2fr',
        gridTemplateRows: '140px 1fr',
        height: 'calc(100vh - 40px)',
        gap: '15px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          gridColumn: '1 / -1',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          padding: '20px 30px',
          color: 'white',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
          border: '1px solid rgba(255, 255, 255, 0.18)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
            <div 
            className="logo-container"
            style={{ 
              position: 'relative',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLElement;
              const glow = target.querySelector('.logo-glow') as HTMLElement;
              target.style.animationPlayState = 'paused';
              target.style.transform = 'scale(1.15) rotate(8deg)';
              target.style.filter = 'drop-shadow(0 12px 30px rgba(79, 172, 254, 0.5)) drop-shadow(0 0 25px rgba(255, 255, 255, 0.4))';
              if (glow) glow.style.opacity = '0.7';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLElement;
              const glow = target.querySelector('.logo-glow') as HTMLElement;
              target.style.animationPlayState = 'running';
              target.style.transform = '';
              target.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))';
              if (glow) glow.style.opacity = '0';
            }}
            onClick={(e) => {
              const target = e.currentTarget as HTMLElement;
              // Create a delightful "press" animation
              target.style.animationPlayState = 'paused';
              target.style.transform = 'scale(0.9) rotate(-3deg)';
              target.style.filter = 'drop-shadow(0 4px 15px rgba(79, 172, 254, 0.6)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.5))';
              
              setTimeout(() => {
                target.style.transform = 'scale(1.2) rotate(10deg)';
                target.style.filter = 'drop-shadow(0 15px 35px rgba(79, 172, 254, 0.6)) drop-shadow(0 0 35px rgba(255, 255, 255, 0.5))';
              }, 100);
              
              setTimeout(() => {
                target.style.animationPlayState = 'running';
                target.style.transform = '';
                target.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))';
              }, 300);
              
              // Track logo interaction
              analytics.trackEngagement('logo_clicked');
            }}
            >
              <img 
                src="/Media/TimeCapsule_04.png" 
                alt="TimeCapsule Logo" 
                style={{ 
                  height: '80px', 
                  width: 'auto',
                  filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  borderRadius: '12px',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                  padding: '8px',
                  backdropFilter: 'blur(10px)'
                }} 
              />
              {/* Animated glow ring */}
              <div style={{
                position: 'absolute',
                top: '-4px',
                left: '-4px',
                right: '-4px',
                bottom: '-4px',
                borderRadius: '16px',
                background: 'linear-gradient(45deg, #4facfe, #00f2fe, #4facfe)',
                opacity: '0',
                zIndex: '-1',
                transition: 'opacity 0.3s ease',
                animation: 'pulse 2s infinite'
              }} 
              className="logo-glow"
              />
            </div>
            <div>
              <h1 style={{
                fontSize: '36px',
                fontWeight: '800',
                margin: '0',
                textShadow: '0 4px 8px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: '1.2'
              }}>
                DeepResearch TimeCapsule
              </h1>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.8)',
                margin: '4px 0 0 0',
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                🔬 AI-powered research and analysis platform
              </p>
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '25px',
          color: 'white',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          overflowY: 'auto'
        }}>
          <h3 style={{ marginBottom: '25px', fontSize: '20px', textAlign: 'center' }}>
            🎛️ Research Controls
          </h3>

          {/* AI Connection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
              AI Provider
            </label>
            <select 
              value={aiStatus.provider}
              onChange={(e) => {
                const newProvider = e.target.value as AIProvider;
                setAIStatus({...aiStatus, provider: newProvider, connected: false});
                // Save provider change to storage
                app.saveToStorage();
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                color: 'white',
                marginBottom: '10px'
              }}
            >
              <option value="ollama">🦙 Ollama</option>
              <option value="lmstudio">🏠 LM Studio</option>
              <option value="openai">🤖 OpenAI</option>
              <option value="local">💻 Local</option>
            </select>
            <button 
              onClick={() => app.connectAI()}
              style={{
                width: '100%',
                padding: '14px',
                background: aiStatus.connected ? 
                  'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)' :
                  'linear-gradient(45deg, #fa709a 0%, #fee140 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {aiStatus.connected ? `✅ Connected (${aiStatus.model})` : '🔌 Connect AI'}
            </button>
            {aiStatus.connected && (
              <button 
                onClick={() => app.disconnectAI()}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 69, 0, 0.3)',
                  border: '1px solid rgba(255, 69, 0, 0.5)',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                🔌 Disconnect
              </button>
            )}
          </div>

          {/* Research Type */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
              Research Type
            </label>
            <select 
              value={researchType}
              onChange={(e) => setResearchType(e.target.value as ResearchType)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                color: 'white'
              }}
            >
              <option value="academic">📚 Academic</option>
              <option value="market">📈 Market</option>
              <option value="technology">💻 Technology</option>
              <option value="competitive">⚔️ Competitive</option>
              <option value="trend">📊 Trend</option>
              <option value="literature">📖 Literature</option>
            </select>
          </div>

          {/* Research Depth */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
              Research Depth
            </label>
            <select 
              value={researchDepth}
              onChange={(e) => setResearchDepth(e.target.value as ResearchDepth)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                color: 'white'
              }}
            >
              <option value="overview">👀 Overview</option>
              <option value="detailed">🔍 Detailed</option>
              <option value="comprehensive">📋 Comprehensive</option>
            </select>
          </div>

          {/* Add Topic */}
          <div style={{ marginBottom: '20px' }}>
            <button 
              onClick={() => setShowAddTopicModal(true)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '700',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              ➕ Add Topic
            </button>
          </div>

          {/* Generate Research */}
          <button 
            onClick={() => {
              const selectedTopics = topics.filter(t => t.selected);
              if (selectedTopics.length === 0) {
                app.updateStatus('❌ Please select at least one topic first');
                return;
              }
              if (!aiStatus.connected) {
                app.updateStatus('❌ Please connect to AI first');
                return;
              }
              app.generateResearch(researchType, researchDepth);
            }}
            disabled={isGenerating || !aiStatus.connected}
            style={{
              width: '100%',
              padding: '14px',
              background: (isGenerating || !aiStatus.connected) ? 
                'rgba(255, 255, 255, 0.3)' :
                'linear-gradient(45deg, #fa709a 0%, #fee140 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '700',
              cursor: (isGenerating || !aiStatus.connected) ? 'not-allowed' : 'pointer',
              opacity: (isGenerating || !aiStatus.connected) ? 0.5 : 1,
              marginBottom: '20px',
              boxShadow: (isGenerating || !aiStatus.connected) ? 'none' : '0 4px 15px rgba(250, 112, 154, 0.4)',
              transition: 'all 0.3s ease'
            }}
          >
            {isGenerating ? '🔄 Generating...' : 
             !aiStatus.connected ? '❌ Connect AI First' : 
             isVectorStoreLoading ? '🚀 Generate Research*' :
             '🚀 Generate Research'}
          </button>
          {isVectorStoreLoading && (
            <div style={{ 
              fontSize: '11px', 
              color: 'rgba(255,255,255,0.6)', 
              marginTop: '5px', 
              textAlign: 'center' 
            }}>
              *Research will work without documents while embeddings load
            </div>
          )}

          {/* Document Management */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '10px' }}>📚 Knowledge Base</h4>
            <div style={{ fontSize: '12px', marginBottom: '10px', color: 'rgba(255,255,255,0.8)' }}>
              {isVectorStoreLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #4facfe',
                    borderRadius: '50%',
                    animation: 'gentleSpin 1.5s linear infinite'
                  }}></div>
                  Loading embeddings...
                </div>
              ) : (
                <>Documents: {documentStatus.count} | Size: {formatFileSize(documentStatus.totalSize)} | Vectors: {documentStatus.vectorCount}</>
              )}
            </div>
            <input 
              type="file" 
              id="documentUpload"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && app.handleFileUpload(e.target.files)}
            />
            <button 
              onClick={() => document.getElementById('documentUpload')?.click()}
              disabled={isVectorStoreLoading}
              style={{
                width: '100%',
                padding: '12px',
                background: isVectorStoreLoading ? 
                  'rgba(255, 255, 255, 0.3)' : 
                  'linear-gradient(45deg, #a8edea 0%, #fed6e3 100%)',
                border: 'none',
                borderRadius: '12px',
                color: isVectorStoreLoading ? 'rgba(255,255,255,0.6)' : '#333',
                fontWeight: '600',
                cursor: isVectorStoreLoading ? 'not-allowed' : 'pointer',
                marginBottom: '10px',
                opacity: isVectorStoreLoading ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {isVectorStoreLoading ? '⏳ Loading...' : '📄 Upload Documents'}
            </button>
            <button 
              onClick={() => app.showDocumentManager()}
              disabled={isVectorStoreLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: isVectorStoreLoading ? 
                  'rgba(255, 255, 255, 0.3)' : 
                  'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '700',
                cursor: isVectorStoreLoading ? 'not-allowed' : 'pointer',
                marginBottom: '10px',
                boxShadow: isVectorStoreLoading ? 'none' : '0 4px 15px rgba(79, 172, 254, 0.4)',
                transition: 'all 0.3s ease',
                opacity: isVectorStoreLoading ? 0.5 : 1
              }}
            >
              {isVectorStoreLoading ? '⏳ Loading...' : '📚 Manage Knowledge'}
            </button>
          </div>

          {/* Export */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>📤 Export/Import</h4>
            <button 
              onClick={() => app.exportResults()}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              📥 Export Results
            </button>
            <button 
              onClick={() => app.exportTimeCapsule()}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              📦 Export TimeCapsule
            </button>
            <input 
              type="file" 
              id="timeCapsuleImport"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && e.target.files[0] && app.importTimeCapsule(e.target.files[0])}
            />
            <button 
              onClick={() => document.getElementById('timeCapsuleImport')?.click()}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(45deg, #a8edea 0%, #fed6e3 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#333',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              📦 Import TimeCapsule
            </button>
          </div>

          <button 
            onClick={() => app.clearAll()}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255, 69, 0, 0.3)',
              border: '1px solid rgba(255, 69, 0, 0.5)',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🗑️ Clear All
          </button>
        </div>

        {/* Topics Panel */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '25px',
          color: 'white',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          overflowY: 'auto'
        }}>
          <h3 style={{ marginBottom: '20px', fontSize: '18px', textAlign: 'center' }}>
            🎯 Research Topics
          </h3>
          
          {topics.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', padding: '20px' }}>
              No topics added yet.<br />Click "➕ Add Topic" to start.
            </div>
          ) : (
            topics.map((topic) => (
              <div key={topic.id} style={{
                background: topic.selected ? 'rgba(79, 172, 254, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '15px',
                padding: '15px',
                marginBottom: '15px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => app.selectTopic(topic.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '5px' }}>
                      {topic.selected ? '✅' : '⭕'} {topic.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                      {topic.description}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); app.moveTopic(topic.id, 'up'); }}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '5px',
                        color: 'white',
                        padding: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      ⬆️
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); app.moveTopic(topic.id, 'down'); }}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '5px',
                        color: 'white',
                        padding: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      ⬇️
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); app.deleteTopic(topic.id); }}
                      style={{
                        background: 'rgba(255,69,0,0.3)',
                        border: 'none',
                        borderRadius: '5px',
                        color: 'white',
                        padding: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resize Handle */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '3px',
          cursor: 'col-resize'
        }} />

        {/* Results Panel */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '25px',
          color: 'white',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', margin: 0 }}>📄 Research Output</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['research', 'sources', 'notes'] as const).map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setCurrentTab(tab)}
                  style={{
                    padding: '8px 16px',
                    background: currentTab === tab ? 'rgba(79, 172, 254, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '20px',
                    color: 'white',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          {researchResults ? (
            <div className="research-output" style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '15px',
              padding: '25px',
              minHeight: 'calc(100% - 80px)',
              fontSize: '14px',
              lineHeight: '1.8',
              color: 'rgba(255, 255, 255, 0.95)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              overflow: 'auto'
            }}>
              <div dangerouslySetInnerHTML={{ __html: formatMarkdownToHTML(researchResults) }} />
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.7)',
              padding: '40px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '15px',
              minHeight: 'calc(100% - 80px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔬</div>
                <div style={{ fontSize: '18px', marginBottom: '10px' }}>No research generated yet</div>
                <div style={{ fontSize: '14px' }}>Add topics and click "Generate Research" to start</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Manager Modal - Redesigned to match reference */}
      {showDocumentManager && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{ margin: 0, color: '#4facfe', fontSize: '24px' }}>📚 Knowledge Base Manager</h2>
              <button 
                onClick={() => app.hideDocumentManager()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '5px',
                  transition: 'background 0.3s ease'
                }}
                                 onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)'}
                 onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'none'}
              >
                ✕
              </button>
            </div>

            {/* Vector Statistics */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '25px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h3 style={{ color: '#4facfe', marginBottom: '15px', fontSize: '16px' }}>📊 Vector Store Statistics</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '15px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4facfe', marginBottom: '5px' }}>
                    {documentStatus.count}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Documents
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4facfe', marginBottom: '5px' }}>
                    {documentStatus.vectorCount}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Embeddings
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4facfe', marginBottom: '5px' }}>
                    {(() => {
                      const generatedDocs = documents.filter(doc => doc.metadata.isGenerated);
                      return generatedDocs.length;
                    })()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Images
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4facfe', marginBottom: '5px' }}>
                    0
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Repositories
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4facfe', marginBottom: '5px' }}>
                    {app.getResearchHistory().length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Research Outputs
                  </div>
                </div>
              </div>
            </div>

            {/* Search Interface */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '25px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h3 style={{ color: '#4facfe', marginBottom: '15px', fontSize: '16px' }}>🔍 Search Knowledge Base</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter search query..."
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px'
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <select
                  value={searchThreshold}
                  onChange={(e) => setSearchThreshold(parseFloat(e.target.value))}
                  style={{
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px'
                  }}
                >
                  <option value={0.1}>Low (0.1)</option>
                  <option value={0.3}>Medium (0.3)</option>
                  <option value={0.5}>High (0.5)</option>
                  <option value={0.7}>Very High (0.7)</option>
                </select>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  style={{
                    padding: '12px 20px',
                    background: isSearching ? 'rgba(255, 255, 255, 0.3)' : 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    cursor: isSearching ? 'not-allowed' : 'pointer',
                    opacity: isSearching ? 0.5 : 1
                  }}
                >
                  {isSearching ? '🔄' : '🔍'} Search
                </button>
                {searchResults.length > 0 && (
                  <button
                    onClick={clearSearch}
                    style={{
                      padding: '12px 20px',
                      background: 'rgba(255, 69, 0, 0.3)',
                      border: '1px solid rgba(255, 69, 0, 0.5)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  padding: '15px',
                  marginTop: '15px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  <h4 style={{ color: '#4facfe', marginBottom: '10px', fontSize: '14px' }}>
                    🎯 Search Results ({searchResults.length})
                  </h4>
                  {searchResults.map((result, index) => (
                    <div key={index} style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      padding: '10px',
                      marginBottom: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <span style={{ fontWeight: '600', color: '#4facfe', fontSize: '12px' }}>
                          📄 {result.document.title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          {(result.similarity * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                        {result.chunk.content.substring(0, 150)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Processing Progress Section */}
            {isProcessingDocuments && processingProgress && (
              <div style={{
                background: 'rgba(79, 172, 254, 0.1)',
                border: '1px solid rgba(79, 172, 254, 0.3)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '25px',
                animation: 'gentlePulse 4s ease-in-out infinite'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '3px solid rgba(79, 172, 254, 0.3)',
                    borderTop: '3px solid #4facfe',
                    borderRadius: '50%',
                    animation: 'gentleSpin 1.5s linear infinite'
                  }}></div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#4facfe' }}>
                      📄 Processing Documents
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '500' }}>
                      File {processingProgress.fileIndex} of {processingProgress.totalFiles}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div style={{ 
                    fontSize: '14px', 
                    marginBottom: '8px',
                    color: 'rgba(255, 255, 255, 0.95)',
                    fontWeight: '600'
                  }}>
                    📄 {processingProgress.currentFile}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    marginBottom: '10px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: '500'
                  }}>
                    {processingProgress.message}
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: `${processingProgress.progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                  
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'rgba(255, 255, 255, 0.8)',
                    textAlign: 'right',
                    fontWeight: '500'
                  }}>
                    {processingProgress.progress}% complete
                  </div>
                </div>

                {processingProgress.totalFiles > 1 && (
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    textAlign: 'center',
                    padding: '10px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    fontWeight: '500'
                  }}>
                    🔄 Processing {processingProgress.totalFiles} files in background - UI remains responsive
                  </div>
                )}
              </div>
            )}

            {/* Upload Area */}
            <div style={{
              border: '2px dashed rgba(255, 255, 255, 0.3)',
              borderRadius: '10px',
              padding: '30px',
              textAlign: 'center',
              marginBottom: '25px',
              transition: 'all 0.3s ease',
              cursor: isProcessingDocuments ? 'not-allowed' : 'pointer',
              opacity: isProcessingDocuments ? 0.6 : 1
            }}
            onClick={() => !isProcessingDocuments && document.getElementById('documentUpload')?.click()}
                         onMouseEnter={(e) => {
               if (!isProcessingDocuments) {
                 const target = e.target as HTMLElement;
                 target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                 target.style.background = 'rgba(255, 255, 255, 0.05)';
               }
             }}
             onMouseLeave={(e) => {
               if (!isProcessingDocuments) {
                 const target = e.target as HTMLElement;
                 target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                 target.style.background = 'transparent';
               }
             }}
            >
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>
                {isProcessingDocuments ? '⏳' : '📁'}
              </div>
              <div style={{ fontSize: '18px', marginBottom: '10px' }}>
                {isProcessingDocuments ? 'Processing Documents...' : 'Click to Upload Documents'}
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                {isProcessingDocuments 
                  ? 'Please wait while documents are being processed'
                  : 'Supports: PDF, DOCX, TXT, MD, and more'
                }
              </div>
            </div>

            {/* Document List */}
            {documents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '15px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📄</div>
                <div style={{ fontSize: '18px', marginBottom: '10px' }}>No documents uploaded yet</div>
                <div style={{ fontSize: '14px' }}>Upload documents to build your knowledge base</div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '15px',
                marginBottom: '25px'
              }}>
                {documents.map((doc) => (
                  <div key={doc.id} style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '10px',
                    padding: '15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.3s ease'
                  }}
                                     onMouseEnter={(e) => {
                     const target = e.target as HTMLElement;
                     target.style.background = 'rgba(255, 255, 255, 0.15)';
                     target.style.transform = 'translateY(-2px)';
                   }}
                   onMouseLeave={(e) => {
                     const target = e.target as HTMLElement;
                     target.style.background = 'rgba(255, 255, 255, 0.1)';
                     target.style.transform = 'translateY(0)';
                   }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', marginBottom: '5px', color: '#4facfe' }}>
                        📄 {doc.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                        <strong>Type:</strong> {doc.metadata.filetype} | 
                        <strong> Size:</strong> {formatFileSize(doc.metadata.filesize)} | 
                        <strong> Uploaded:</strong> {new Date(doc.metadata.uploadedAt).toLocaleDateString()} |
                        <strong> Chunks:</strong> {doc.chunks.length} |
                        <strong> Vectors:</strong> {doc.vectors.length}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handlePreviewDocument(doc.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          border: 'none',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        👁️ Preview
                      </button>
                      <button 
                        onClick={() => app.downloadDocument(doc.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          border: 'none',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        📥 Download
                      </button>
                      <button 
                        onClick={() => app.deleteDocument(doc.id)}
                        style={{
                          background: 'rgba(255, 69, 0, 0.3)',
                          border: 'none',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Research History Section */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '25px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h3 style={{ color: '#4facfe', marginBottom: '15px', fontSize: '16px' }}>🔬 Generated Research Outputs</h3>
              
              {(() => {
                const researchHistory = app.getResearchHistory();
                return researchHistory.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: 'rgba(255,255,255,0.7)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔬</div>
                    <div style={{ fontSize: '14px' }}>No research outputs generated yet</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {researchHistory.map((research) => (
                      <div key={research.metadata.id} style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', marginBottom: '4px', color: '#4facfe', fontSize: '13px' }}>
                            🔬 {research.metadata.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                            <strong>Type:</strong> {research.metadata.type} | 
                            <strong> Depth:</strong> {research.metadata.depth} | 
                            <strong> Topics:</strong> {research.metadata.topics.length} | 
                            <strong> Generated:</strong> {new Date(research.metadata.generatedAt).toLocaleDateString()} |
                            <strong> AI:</strong> {research.metadata.aiProvider}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => app.loadResearchFromHistory(research.metadata.id)}
                            style={{
                              background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                              border: 'none',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                          >
                            📄 Load
                          </button>
                          <button 
                            onClick={() => {
                              const blob = new Blob([research.content], { type: 'text/markdown' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${research.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.2)',
                              border: 'none',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                          >
                            📥 Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div style={{
              display: 'flex',
              gap: '15px',
              marginTop: '25px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              justifyContent: 'center'
            }}>
              <button 
                onClick={() => !isProcessingDocuments && document.getElementById('documentUpload')?.click()}
                disabled={isProcessingDocuments}
                style={{
                  padding: '12px 24px',
                  background: isProcessingDocuments ? 
                    'rgba(255, 255, 255, 0.3)' : 
                    'linear-gradient(45deg, #a8edea 0%, #fed6e3 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: isProcessingDocuments ? 'rgba(255,255,255,0.6)' : '#333',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isProcessingDocuments ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isProcessingDocuments ? 0.5 : 1
                }}
              >
                {isProcessingDocuments ? '⏳ Processing...' : '📄 Upload More Documents'}
              </button>
              <button 
                onClick={() => app.exportTimeCapsule()}
                disabled={isProcessingDocuments}
                style={{
                  padding: '12px 24px',
                  background: isProcessingDocuments ? 
                    'rgba(79, 172, 254, 0.3)' : 
                    'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isProcessingDocuments ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isProcessingDocuments ? 0.5 : 1
                }}
              >
                📦 Export TimeCapsule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results Modal - Like Reference Design */}
      {showSearchResults && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '1000px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Search Results Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{ margin: 0, color: '#4facfe', fontSize: '24px' }}>
                ⚡ Quick Search Results for "{currentSearchQuery}"
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)' }}>
                  Found {searchResults.length} results • Threshold: {(searchThreshold * 100).toFixed(0)}% (Quick Mode)
                </span>
                <button 
                  onClick={closeSearchResults}
                  style={{
                    background: 'rgba(255, 69, 0, 0.7)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '35px',
                    height: '35px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Search Results List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {searchResults.map((result, index) => (
                <div key={index} style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '15px',
                  padding: '20px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s ease'
                }}>
                  {/* Document Title and Match Info */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#4facfe',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      📄 {result.document.title}
                      <span style={{
                        fontSize: '14px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontWeight: 'normal'
                      }}>
                        • Chunk {result.chunk.index + 1} • {(result.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleViewChunk(result.chunk, result.document)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          border: 'none',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        👁️ View Chunk
                      </button>
                      <button
                        onClick={() => handlePreviewDocument(result.document.id)}
                        style={{
                          background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                          border: 'none',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        📄 Full Doc
                      </button>
                    </div>
                  </div>

                  {/* Relevant Excerpt */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '10px',
                    padding: '15px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      color: '#4facfe',
                      marginBottom: '8px',
                      fontWeight: '600'
                    }}>
                      Relevant Excerpt:
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      lineHeight: '1.6'
                    }}>
                      "{result.chunk.content.length > 300 
                        ? result.chunk.content.substring(0, 300) + '...' 
                        : result.chunk.content}"
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {showDocumentPreview && previewDocument && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '1000px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Document Preview Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div>
                <h2 style={{ margin: 0, color: '#4facfe', fontSize: '24px', marginBottom: '10px' }}>
                  📄 Document: {previewDocument.title}
                </h2>
                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <span><strong>Type:</strong> {previewDocument.metadata.filetype}</span>
                  <span><strong>Size:</strong> {formatFileSize(previewDocument.metadata.filesize)}</span>
                  <span><strong>Uploaded:</strong> {new Date(previewDocument.metadata.uploadedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button 
                onClick={closeDocumentPreview}
                style={{
                  background: 'rgba(255, 69, 0, 0.7)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '35px',
                  height: '35px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            </div>

            {/* Document Content */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '15px',
              padding: '25px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxHeight: '60vh',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
              lineHeight: '1.6',
              color: 'rgba(255, 255, 255, 0.9)',
              fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace'
            }}>
              {previewDocument.content}
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '15px',
              marginTop: '25px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              justifyContent: 'center'
            }}>
              <button 
                onClick={closeDocumentPreview}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button 
                onClick={() => app.downloadDocument(previewDocument.id)}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📥 Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        padding: '15px 30px',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        zIndex: 40
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>📋 {statusMessage}</div>
          <ClientOnlyTime />
        </div>
      </div>

      {/* Chunk View Modal */}
      {showChunkView && currentChunk && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '1000px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Chunk View Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{ margin: 0, color: '#4facfe', fontSize: '24px' }}>
                📄 Chunk: {currentChunk.document.title}
              </h2>
              <button 
                onClick={closeChunkView}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '5px',
                  transition: 'background 0.3s ease'
                }}
                                 onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)'}
                 onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'none'}
              >
                ✕
              </button>
            </div>

            {/* Chunk Content */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '15px',
              padding: '25px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxHeight: '60vh',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
              lineHeight: '1.6',
              color: 'rgba(255, 255, 255, 0.9)',
              fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace'
            }}>
              {currentChunk.content}
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '15px',
              marginTop: '25px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              justifyContent: 'center'
            }}>
              <button 
                onClick={closeChunkView}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button 
                onClick={() => app.downloadDocument(currentChunk.document.id)}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📥 Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {showAddTopicModal && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{ margin: 0, color: '#4facfe', fontSize: '24px' }}>Add New Topic</h2>
              <button 
                onClick={() => setShowAddTopicModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '5px',
                  transition: 'background 0.3s ease'
                }}
                                 onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)'}
                 onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'none'}
              >
                ✕
              </button>
            </div>

            {/* Topic Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' }}>
                  Topic Title
                </label>
                <input
                  type="text"
                  placeholder="Enter a descriptive topic title..."
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(79, 172, 254, 0.6)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' }}>
                  Topic Description
                </label>
                <textarea
                  placeholder="Provide a detailed description of what you want to research about this topic..."
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    height: '120px',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(79, 172, 254, 0.6)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  onClick={() => {
                    setShowAddTopicModal(false);
                    setNewTopicTitle('');
                    setNewTopicDescription('');
                  }}
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newTopicTitle.trim() && newTopicDescription.trim()) {
                      app.addTopic(newTopicTitle.trim(), newTopicDescription.trim());
                      setShowAddTopicModal(false);
                      setNewTopicTitle('');
                      setNewTopicDescription('');
                    } else {
                      app.updateStatus('❌ Please fill in both title and description');
                    }
                  }}
                  disabled={!newTopicTitle.trim() || !newTopicDescription.trim()}
                  style={{
                    padding: '12px 24px',
                    background: (!newTopicTitle.trim() || !newTopicDescription.trim()) 
                      ? 'rgba(255, 255, 255, 0.3)'
                      : 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (!newTopicTitle.trim() || !newTopicDescription.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (!newTopicTitle.trim() || !newTopicDescription.trim()) ? 0.5 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  ➕ Add Topic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ollama Connection Modal */}
      {showOllamaConnectionModal && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #00d4aa 0%, #00a67d 100%)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px' }}>🦙 Ollama Connection</h2>
              <button 
                onClick={() => app.cancelConnection()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '5px'
                }}
              >
                ✕
              </button>
            </div>

            {/* URL Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'white', fontWeight: '600' }}>
                Ollama Server URL:
              </label>
              <input
                type="text"
                value={selectedOllamaURL}
                onChange={(e) => setSelectedOllamaURL(e.target.value)}
                placeholder="http://localhost:11434"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  marginBottom: '10px'
                }}
              />
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginBottom: '15px' }}>
                💡 Examples: http://localhost:11434, http://192.168.1.100:11434, https://my-ollama-server.com
              </p>
            </div>

            {/* Requirements */}
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
              📋 Requirements:<br/>
              • Ollama must be installed and running<br/>
              • At least one model must be available<br/>
              • Example: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px' }}>ollama pull qwen2.5:0.5b</code><br/>
              • No API key required - fully local
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={() => app.cancelConnection()}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => app.testOllamaConnection(selectedOllamaURL)}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔌 Connect to Ollama
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Selection Modal */}
      {showModelSelectionModal && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '24px',
            padding: '35px',
            maxWidth: '800px',
            width: '95%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(20px)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              paddingBottom: '20px',
              borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>🤖 Choose Your Model</h2>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  Select the AI model that best fits your research needs
                </p>
              </div>
              <button 
                onClick={() => app.cancelConnection()}
                style={{
                  background: 'rgba(255, 69, 0, 0.8)',
                  border: 'none',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '10px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 69, 0, 1)'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 69, 0, 0.8)'}
              >
                ✕
              </button>
            </div>

            {/* Connection Info */}
            <div style={{ 
              marginBottom: '25px', 
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '15px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', margin: 0, fontWeight: '600' }}>
                🔗 Connected to: <span style={{ color: '#4facfe' }}>{selectedOllamaURL}</span>
              </p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '5px 0 0 0' }}>
                Found {availableModels.length} available models
              </p>
            </div>

            {/* Recommendation Note */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%)',
              border: '2px solid rgba(79, 172, 254, 0.4)',
              borderRadius: '15px',
              padding: '18px',
              marginBottom: '25px',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: '700', 
                color: '#4facfe', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                ⭐ Default Recommended Model
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: '500'
              }}>
                <strong style={{ color: '#4facfe' }}>Qwen 3 0.6B</strong> is our recommended default model for research tasks. 
                It offers the best balance of speed, efficiency, and quality for document analysis and content generation.
              </div>
            </div>

            {/* Model Cards Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
              marginBottom: '25px'
            }}>
              {(() => {
                // Sort models to put Qwen 3 0.6B first
                const sortedModels = [...availableModels].sort((a, b) => {
                  const aIsQwen3 = a.name.toLowerCase().includes('qwen3') && a.name.includes('0.6');
                  const bIsQwen3 = b.name.toLowerCase().includes('qwen3') && b.name.includes('0.6');
                  
                  if (aIsQwen3 && !bIsQwen3) return -1; // a comes first
                  if (!aIsQwen3 && bIsQwen3) return 1;  // b comes first
                  return 0; // keep original order for others
                });
                
                return sortedModels.map((model, index) => {
                  const isQwen3 = model.name.toLowerCase().includes('qwen3') && model.name.includes('0.6');
                  const isRecommended = isQwen3;
                
                return (
                  <div 
                    key={index} 
                    style={{
                      background: isRecommended 
                        ? 'linear-gradient(135deg, rgba(79, 172, 254, 0.3) 0%, rgba(0, 242, 254, 0.3) 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      padding: '20px',
                      border: isRecommended 
                        ? '2px solid rgba(79, 172, 254, 0.6)'
                        : '1px solid rgba(255, 255, 255, 0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onClick={() => app.selectModel(model.name)}
                    onMouseEnter={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.transform = 'translateY(-5px)';
                      target.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)';
                      if (isRecommended) {
                        target.style.borderColor = 'rgba(79, 172, 254, 0.8)';
                        target.style.background = 'linear-gradient(135deg, rgba(79, 172, 254, 0.4) 0%, rgba(0, 242, 254, 0.4) 100%)';
                      } else {
                        target.style.background = 'rgba(255, 255, 255, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.transform = 'translateY(0)';
                      target.style.boxShadow = 'none';
                      if (isRecommended) {
                        target.style.borderColor = 'rgba(79, 172, 254, 0.6)';
                        target.style.background = 'linear-gradient(135deg, rgba(79, 172, 254, 0.3) 0%, rgba(0, 242, 254, 0.3) 100%)';
                      } else {
                        target.style.background = 'rgba(255, 255, 255, 0.1)';
                      }
                    }}
                  >
                    {/* Recommended Badge */}
                    {isRecommended && (
                      <>
                        <div style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-5px',
                          background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          boxShadow: '0 4px 12px rgba(79, 172, 254, 0.4)',
                          animation: 'pulseGlow 2s ease-in-out infinite',
                          zIndex: 1
                        }}>
                          ⭐ RECOMMENDED
                        </div>
                        <div style={{
                          position: 'absolute',
                          top: '-5px',
                          left: '-5px',
                          background: 'linear-gradient(45deg, #00d4aa 0%, #00a67d 100%)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '700',
                          boxShadow: '0 4px 12px rgba(0, 212, 170, 0.4)',
                          zIndex: 1
                        }}>
                          #1 DEFAULT
                        </div>
                      </>
                    )}
                    
                    {/* Model Icon & Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        background: isRecommended 
                          ? 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)'
                          : 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        boxShadow: isRecommended ? '0 8px 20px rgba(79, 172, 254, 0.4)' : 'none'
                      }}>
                        {model.name.toLowerCase().includes('qwen') ? '🧠' : 
                         model.name.toLowerCase().includes('llama') ? '🦙' : 
                         model.name.toLowerCase().includes('tiny') ? '🐁' : '🤖'}
                      </div>
                      <div>
                        <div style={{ 
                          fontWeight: '700', 
                          fontSize: '18px', 
                          marginBottom: '4px',
                          color: isRecommended ? '#4facfe' : 'white'
                        }}>
                          {model.name}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'rgba(255, 255, 255, 0.7)',
                          display: 'flex',
                          gap: '8px'
                        }}>
                          <span>📊 {model.size ? `${Math.round(model.size / 1024 / 1024 / 1024 * 10) / 10}GB` : 'Unknown'}</span>
                          <span>📅 {model.modified ? new Date(model.modified).toLocaleDateString() : 'Unknown'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Model Description */}
                    <div style={{
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      lineHeight: '1.4',
                      marginBottom: '15px'
                    }}>
                      {model.name.toLowerCase().includes('qwen3') && model.name.includes('0.6') ? 
                        '🎯 Optimized for research tasks. Fast, efficient, and perfect for document analysis and content generation.' :
                       model.name.toLowerCase().includes('llama') ? 
                        '🦙 Powerful general-purpose model. Great for complex reasoning and detailed analysis.' :
                       model.name.toLowerCase().includes('tiny') ? 
                        '⚡ Ultra-fast lightweight model. Perfect for quick responses and low-resource environments.' :
                        '🤖 Advanced AI model for comprehensive research and analysis tasks.'
                      }
                    </div>

                    {/* Performance Indicators */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '15px'
                    }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {model.name.toLowerCase().includes('0.6') ? '⚡ Fast' : 
                         model.name.toLowerCase().includes('1.') ? '🔥 Balanced' : 
                         model.name.toLowerCase().includes('3.') ? '🎯 Powerful' : '🔮 Advanced'}
                      </div>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {model.size && model.size < 1024 * 1024 * 1024 ? '💚 Low Resource' : 
                         model.size && model.size < 2 * 1024 * 1024 * 1024 ? '💛 Medium Resource' : 
                         '🔴 High Resource'}
                      </div>
                    </div>

                    {/* Select Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        app.selectModel(model.name);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: isRecommended
                          ? 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)'
                          : 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: isRecommended ? '0 4px 15px rgba(79, 172, 254, 0.3)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        const target = e.target as HTMLElement;
                        if (isRecommended) {
                          target.style.boxShadow = '0 6px 20px rgba(79, 172, 254, 0.5)';
                        } else {
                          target.style.background = 'rgba(255, 255, 255, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const target = e.target as HTMLElement;
                        if (isRecommended) {
                          target.style.boxShadow = '0 4px 15px rgba(79, 172, 254, 0.3)';
                        } else {
                          target.style.background = 'rgba(255, 255, 255, 0.2)';
                        }
                      }}
                    >
                      {isRecommended ? '⭐ Select Recommended' : '🚀 Select Model'}
                                         </button>
                   </div>
                 );
               });
              })()}
            </div>

            {/* No Models Message */}
            {availableModels.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '50px',
                color: 'rgba(255,255,255,0.9)',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '20px',
                border: '2px dashed rgba(255, 255, 255, 0.3)'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🤖</div>
                <div style={{ fontSize: '24px', marginBottom: '15px', fontWeight: '600' }}>No models found</div>
                <div style={{ fontSize: '16px', marginBottom: '25px', color: 'rgba(255,255,255,0.8)' }}>
                  Please install a model first. Here are some recommended options:
                </div>
                <div style={{ 
                  background: 'rgba(0,0,0,0.4)', 
                  padding: '20px', 
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>💡 Quick Setup:</div>
                  <code style={{ 
                    background: 'rgba(79, 172, 254, 0.2)', 
                    padding: '8px 12px', 
                    borderRadius: '6px',
                    display: 'block',
                    marginBottom: '8px',
                    color: '#4facfe',
                    fontWeight: '600'
                  }}>
                    ollama pull qwen3:0.6b
                  </code>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                    ⭐ Recommended for research tasks
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ 
              display: 'flex', 
              gap: '15px', 
              justifyContent: 'center', 
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <button
                onClick={() => app.cancelConnection()}
                style={{
                  padding: '14px 28px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                ❌ Cancel
              </button>
              <button
                onClick={() => app.testOllamaConnection(selectedOllamaURL)}
                style={{
                  padding: '14px 28px',
                  background: 'linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(79, 172, 254, 0.3)'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.boxShadow = '0 6px 20px rgba(79, 172, 254, 0.5)'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.boxShadow = '0 4px 15px rgba(79, 172, 254, 0.3)'}
              >
                🔄 Refresh Models
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 