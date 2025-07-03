/**
 * PlaygroundSearch - Search and RAG functionality for AI Playground
 * Uses shared RAG system to avoid code duplication with DeepResearch
 */
class PlaygroundSearch {
  constructor(playgroundApp) {
    this.app = playgroundApp;
    this.sharedRAG = null;
  }

  /**
   * Initialize shared RAG system
   */
  async initializeVectorStore() {
    try {
      console.log('🚀 Initializing Shared RAG System for Playground...');
      
      // Wait for SharedRAG to be available
      if (!window.SharedRAG) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!window.SharedRAG) {
          throw new Error('SharedRAG system not available');
        }
      }
      
      this.sharedRAG = window.SharedRAG;
      const success = await this.sharedRAG.initialize();
      
      if (success) {
        this.app.updateStatus('vectorStatus', 'RAG System Ready', 'success');
        console.log('✅ Shared RAG System initialized for Playground');
        return true;
      } else {
        this.app.updateStatus('vectorStatus', 'RAG System Disabled', 'warning');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Shared RAG System initialization failed:', error);
      this.app.updateStatus('vectorStatus', 'RAG System Failed', 'error');
      return false;
    }
  }

  /**
   * Check if a query is document-related and should use RAG
   */
  isDocumentQuery(message) {
    if (!this.sharedRAG) {
      return false;
    }
    
    return this.sharedRAG.isRAGQuery(message);
  }

  /**
   * Handle RAG-powered queries using uploaded documents
   */
  async handleRAGQuery(query) {
    if (!this.sharedRAG) {
      return "❌ RAG system not available. Please initialize the document store first.";
    }

    // Enhanced AI assistant validation
    let aiAssistant = this.app.aiAssistant;
    
    // If local AI assistant is null, try to get from shared connection
    if (!aiAssistant && window.SharedAIConnection && window.SharedAIConnection.isAIConnected()) {
      console.log('🔍 RAG: Local AI assistant is null, trying shared connection...');
      aiAssistant = window.SharedAIConnection.getAIAssistant();
      if (aiAssistant) {
        // Update the app's local reference
        this.app.aiAssistant = aiAssistant;
        this.app.isConnected = true;
        console.log('✅ RAG: Successfully retrieved AI assistant from shared connection');
      }
    }
    
    // Final validation
    if (!aiAssistant) {
      return "❌ AI assistant not available for document queries. Please connect an AI provider first.";
    }
    
    // Additional validation for AI assistant object
    if (!aiAssistant.generateContent || typeof aiAssistant.generateContent !== 'function') {
      return "❌ AI assistant is not properly initialized. Please reconnect your AI provider.";
    }

    return await this.sharedRAG.generateRAGResponse(query, aiAssistant);
  }

  /**
   * Trigger document upload dialog
   */
  uploadDocuments() {
    document.getElementById('documentInput').click();
  }

  /**
   * Handle file upload and processing
   */
  async handleDocumentUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    
    if (!this.sharedRAG || !this.sharedRAG.isReady()) {
      this.app.addChatMessage('system', '❌ RAG system not available for document upload');
      return;
    }
    
    try {
      this.app.addChatMessage('system', `📄 Uploading ${files.length} documents...`);
      
      for (const file of files) {
        await this.sharedRAG.addDocument(file);
        this.app.addChatMessage('system', `✅ Uploaded: ${file.name}`);
      }
      
      this.app.updateStatus('vectorStatus', `${files.length} docs added`, 'success');
      
    } catch (error) {
      console.error('❌ Document upload failed:', error);
      this.app.addChatMessage('system', `❌ Upload failed: ${error.message}`);
    }
    
    // Clear input
    event.target.value = '';
  }

  /**
   * Display document management information
   */
  async manageDocuments() {
    if (!this.sharedRAG) {
      this.app.addChatMessage('system', '❌ RAG system not available. Please wait for initialization.');
      return;
    }
    
    try {
      const summary = await this.sharedRAG.generateDocumentSummary();
      this.app.addChatMessage('assistant', summary);
    } catch (error) {
      console.error('❌ Failed to generate document summary:', error);
      this.app.addChatMessage('system', `❌ Failed to load document information: ${error.message}`);
    }
  }

  /**
   * Search documents by query and return results
   */
  async searchDocuments(query, options = {}) {
    if (!this.sharedRAG || !this.sharedRAG.isReady()) {
      throw new Error('RAG system not available');
    }
    
    return await this.sharedRAG.searchDocuments(query, options);
  }

  /**
   * Get RAG system statistics
   */
  getVectorStoreStats() {
    if (!this.sharedRAG) {
      return null;
    }
    
    return this.sharedRAG.getStats();
  }

  /**
   * Clear all documents from RAG system
   */
  async clearDocuments() {
    if (!this.sharedRAG || !this.sharedRAG.isReady()) {
      this.app.addChatMessage('system', '❌ RAG system not available');
      return;
    }
    
    try {
      await this.sharedRAG.clearDocuments();
      this.app.updateStatus('vectorStatus', 'RAG System Cleared', 'info');
      this.app.addChatMessage('system', '🗑️ All documents cleared from RAG system');
    } catch (error) {
      console.error('❌ Failed to clear documents:', error);
      this.app.addChatMessage('system', `❌ Failed to clear documents: ${error.message}`);
    }
  }

  /**
   * Export document metadata
   */
  async exportDocumentList() {
    if (!this.sharedRAG || !this.sharedRAG.isReady()) {
      this.app.addChatMessage('system', '❌ RAG system not available');
      return;
    }
    
    const exportData = await this.sharedRAG.exportDocumentList();
    this.app.addChatMessage('system', '💾 Document list exported');
    return exportData;
  }


}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PlaygroundSearch = PlaygroundSearch;
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaygroundSearch;
}
