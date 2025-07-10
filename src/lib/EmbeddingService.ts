/**
 * EmbeddingService for main thread ML operations
 * Handles Xenova transformers.js loading and embedding generation
 * Optimized for immediate background download
 */

import { pipeline, env } from '@xenova/transformers';

export interface EmbeddingProgress {
  message: string;
  progress: number;
}

export type EmbeddingProgressCallback = (progress: EmbeddingProgress) => void;

class EmbeddingService {
  private static instance: EmbeddingService | null = null;
  private model: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Configure Xenova environment for immediate download
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    
    // Enable persistent caching across browser sessions
    env.cacheDir = '.cache/xenova'; // Browser cache directory
    env.allowLocalModels = true; // Allow loading from cache
    env.allowRemoteModels = true; // Allow downloading if needed
  }

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  async init(onProgress?: EmbeddingProgressCallback): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start immediate initialization
    this.isInitializing = true;
    this.initializationPromise = this.performImmediateInitialization(onProgress);
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
    }
  }

  private async performImmediateInitialization(onProgress?: EmbeddingProgressCallback): Promise<void> {
    try {
      console.log('🧠 Starting Xenova embedding service initialization...');
      
      onProgress?.({
        message: 'Checking for cached model...',
        progress: 5
      });

      // Check if model is already cached
      const cacheKey = 'xenova-embeddings-model-cached';
      const isCached = localStorage.getItem(cacheKey) === 'true';
      
      if (isCached) {
        console.log('🎯 Model appears to be cached, attempting to load from cache...');
        onProgress?.({
          message: 'Loading model from cache...',
          progress: 20
        });
      } else {
        console.log('📦 Model not cached, starting download...');
        onProgress?.({
          message: 'Downloading Xenova transformers.js...',
          progress: 10
        });
      }

      // Load the embedding model with enhanced caching
      console.log('📦 Loading Xenova/all-MiniLM-L6-v2 model...');
      
      onProgress?.({
        message: isCached ? 'Loading from cache...' : 'Loading embedding model...',
        progress: 30
      });

      let downloadDetected = false;
      
      // Use dynamic import with pipeline for cached/download loading
      this.model = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          cache_dir: '.cache/xenova', // Explicit cache directory
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              downloadDetected = true;
              const downloadProgress = Math.round(30 + (progress.progress || 0) * 0.6); // Scale to 30-90%
              onProgress?.({
                message: `Downloading model: ${progress.file} (${Math.round((progress.progress || 0) * 100)}%)`,
                progress: downloadProgress
              });
              console.log(`📊 Model download: ${progress.file} - ${Math.round((progress.progress || 0) * 100)}%`);
            } else if (progress.status === 'ready') {
              onProgress?.({
                message: 'Model loaded from cache',
                progress: 95
              });
              console.log('✅ Model loaded from browser cache');
            }
          }
        }
      );

      // Mark as cached for future sessions
      if (downloadDetected) {
        localStorage.setItem(cacheKey, 'true');
        console.log('💾 Model cached for future sessions');
      }

      onProgress?.({
        message: 'Embedding model ready',
        progress: 100
      });

      this.isInitialized = true;
      console.log('✅ EmbeddingService initialized successfully');

    } catch (error) {
      console.error('❌ EmbeddingService initialization failed:', error);
      this.isInitialized = false;
      this.model = null;
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Ensure initialized (should be immediate since we pre-load)
    if (!this.isInitialized) {
      throw new Error('EmbeddingService not initialized. Call init() first.');
    }

    if (!this.model) {
      throw new Error('EmbeddingService model not loaded.');
    }

    try {
      console.log(`🔍 Generating embedding for text (${text.length} chars)...`);
      
      const startTime = Date.now();
      
      // Generate embedding using Xenova
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to regular array
      const embedding = Array.from(output.data as number[]);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Generated embedding: ${embedding.length} dimensions in ${processingTime}ms`);
      
      return embedding;

    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  async generateEmbeddings(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new Error('EmbeddingService not initialized. Call init() first.');
    }

    if (!this.model) {
      throw new Error('EmbeddingService model not loaded.');
    }

    console.log(`🔍 Generating embeddings for ${texts.length} texts...`);
    
    const embeddings: number[][] = [];
    const startTime = Date.now();

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      
      try {
        console.log(`🔍 Generating embedding ${i + 1}/${texts.length}...`);
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
        
        console.log(`✅ Generated embedding ${i + 1}/${texts.length}`);
        
        // Call progress callback AFTER successful generation
        onProgress?.(i + 1, texts.length);
        
        // Yield control to UI after EVERY embedding using requestAnimationFrame
        console.log(`⏸️ Yielding control to UI after embedding ${i + 1}/${texts.length}`);
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 20); // Additional 20ms after frame
          });
        });
        
      } catch (error) {
        console.error(`❌ Failed to generate embedding for text ${i + 1}:`, error);
        // Use zero vector as fallback
        const dimension = embeddings.length > 0 ? embeddings[0].length : 384;
        embeddings.push(new Array(dimension).fill(0));
        
        // Still report progress even on error
        onProgress?.(i + 1, texts.length);
        
        // Yield control even on error using requestAnimationFrame
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 20);
          });
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ Generated ${embeddings.length} embeddings in ${totalTime}ms`);

    return embeddings;
  }

  get available(): boolean {
    return this.isInitialized && this.model !== null;
  }

  get status(): 'uninitialized' | 'initializing' | 'ready' | 'error' {
    if (this.isInitialized) return 'ready';
    if (this.isInitializing) return 'initializing';
    return 'uninitialized';
  }

  destroy(): void {
    this.model = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationPromise = null;
  }

  // Clear cache marker if needed (for debugging or cache invalidation)
  static clearCacheMarker(): void {
    localStorage.removeItem('xenova-embeddings-model-cached');
    console.log('🗑️ Xenova cache marker cleared');
  }
}

// Export singleton instance
export const getEmbeddingService = (): EmbeddingService => {
  return EmbeddingService.getInstance();
};

export default EmbeddingService; 