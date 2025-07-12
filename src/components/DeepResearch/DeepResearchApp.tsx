"use client";

import { useState, useEffect, useRef } from "react";
import { VectorStore, DocumentData } from "../VectorStore/VectorStore";
import { useVectorStore } from "../providers/VectorStoreProvider";
import {
  AIAssistant,
  AIStatus as AIConnectionStatus,
} from "../../lib/AIAssistant";
import { 
  AgentCoordinator, 
  AgentProgress, 
  AgentTask 
} from "../../lib/AgentCoordinator";
import { analytics } from "../../lib/analytics";
import { usePageAnalytics } from "../analytics/Analytics";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ControlsPanel } from "./ControlsPanel";
import { StructureBuilder } from "./StructureBuilder";
import { ResearchOutput } from "./ResearchOutput";
import { StatusBar } from "./StatusBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wifi,
  WifiOff,
  Bot,
  Server,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Trash2,
  Search,
  Eye,
  X,
  Plus,
  Edit3,
  Package,
  FolderPlus,
  Upload,
  Loader2,
  Settings,
} from "lucide-react";

// Import Metadata Management
import { BubblSpaceDialog } from "@/components/ui/bubblspace-dialog";
import { TimeCapsuleDialog } from "@/components/ui/timecapsule-dialog";
import { SafeImportDialog } from "@/components/ui/safe-import-dialog";
import { 
  getMetadataManager, 
  MetadataManager 
} from "@/lib/MetadataManager";
import {
  BubblSpace,
  TimeCapsuleMetadata,
  EnhancedTimeCapsule,
  ImportOptions,
  ImportResult,
  MetadataUtils
} from "@/types/timecapsule";

export type AIProvider = "ollama" | "lmstudio" | "openai" | "local";
export type ResearchType =
  | "academic"
  | "market"
  | "technology"
  | "competitive"
  | "trend"
  | "literature"
  | "learning";
export type ResearchDepth = "overview" | "detailed" | "comprehensive";
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
  researchResults: Record<string, string | ResearchItem | ResearchMetadata> =
    {};
  currentTab: "research" | "sources" | "notes" = "research";
  aiAssistant: AIAssistant | null = null;
  isGenerating = false;
  vectorStore: VectorStore | null = null;
  documentModalOpen = false;
  eventListenersSetup = false;
  isUploading = false;
  isVectorStoreLoading = true;

  // Agent Coordination System
  agentCoordinator: AgentCoordinator | null = null;
  currentAgentProgress: AgentProgress | null = null;
  showAgentProgress = false;

  // Modal states
  showOllamaConnectionModal = false;
  showModelSelectionModal = false;
  availableModels: any[] = [];
  selectedOllamaURL = "http://localhost:11434";

  // Firecrawl integration
  firecrawlApiKey: string = "";
  showFirecrawlModal = false;
  isScrapingUrl = false;
  scrapingUrl = "";
  scrapingProgress = { message: "", progress: 0 };

  // Metadata Management
  metadataManager: MetadataManager | null = null;
  currentBubblSpace: BubblSpace | null = null;
  currentTimeCapsule: TimeCapsuleMetadata | null = null;
  showBubblSpaceDialog = false;
  showTimeCapsuleDialog = false;
  showSafeImportDialog = false;
  bubblSpaces: BubblSpace[] = [];
  timeCapsules: TimeCapsuleMetadata[] = [];
  editingBubblSpace: BubblSpace | null = null;
  editingTimeCapsule: TimeCapsuleMetadata | null = null;
  importFile: File | null = null;
  isMetadataLoading = false;

  // Learning Research Document Attachments
  attachedDocuments: DocumentData[] = [];

  // Initialization state to prevent double initialization
  private static initializationPromise: Promise<void> | null = null;
  private static isInitializing = false;
  private initialized = false;

  // React state setters (will be set in the hook)
  setTopics: ((topics: Topic[]) => void) | null = null;
  setAIStatus: ((status: AIConnectionStatus) => void) | null = null;
  setResearchType: ((type: ResearchType) => void) | null = null;
  setResearchDepth: ((depth: ResearchDepth) => void) | null = null;
  setResearchResults: ((results: string) => void) | null = null;
  setCurrentTab: ((tab: "research" | "sources" | "notes") => void) | null =
    null;
  setStatusMessage: ((message: string) => void) | null = null;
  setIsGenerating: ((generating: boolean) => void) | null = null;
  setDocuments: ((docs: DocumentData[]) => void) | null = null;
  setDocumentStatus:
    | ((status: {
        count: number;
        totalSize: number;
        vectorCount: number;
      }) => void)
    | null = null;
  setShowDocumentManager: ((show: boolean) => void) | null = null;
  setShowOllamaConnectionModal: ((show: boolean) => void) | null = null;
  setShowModelSelectionModal: ((show: boolean) => void) | null = null;
  setAvailableModels: ((models: any[]) => void) | null = null;
  setSelectedOllamaURL: ((url: string) => void) | null = null;
  setIsVectorStoreLoading: ((loading: boolean) => void) | null = null;
  setIsProcessingDocuments: ((processing: boolean) => void) | null = null;
  setProcessingProgress:
    | ((
        progress: {
          currentFile: string;
          progress: number;
          message: string;
          fileIndex: number;
          totalFiles: number;
        } | null
      ) => void)
    | null = null;

  // Metadata Management React state setters
  setCurrentBubblSpace: ((space: BubblSpace | null) => void) | null = null;
  setCurrentTimeCapsule: ((capsule: TimeCapsuleMetadata | null) => void) | null = null;
  setShowBubblSpaceDialog: ((show: boolean) => void) | null = null;
  setShowTimeCapsuleDialog: ((show: boolean) => void) | null = null;
  setShowSafeImportDialog: ((show: boolean) => void) | null = null;
  setBubblSpaces: ((spaces: BubblSpace[]) => void) | null = null;
  setTimeCapsules: ((capsules: TimeCapsuleMetadata[]) => void) | null = null;
  setEditingBubblSpace: ((space: BubblSpace | null) => void) | null = null;
  setEditingTimeCapsule: ((capsule: TimeCapsuleMetadata | null) => void) | null = null;
  setIsMetadataLoading: ((loading: boolean) => void) | null = null;

  // Firecrawl state setters
  setShowFirecrawlModal: ((show: boolean) => void) | null = null;
  setIsScrapingUrl: ((scraping: boolean) => void) | null = null;
  setScrapingProgress: ((progress: { message: string; progress: number }) => void) | null = null;

  // Agent Progress state setters
  setCurrentAgentProgress: ((progress: AgentProgress | null) => void) | null = null;
  setShowAgentProgress: ((show: boolean) => void) | null = null;

  constructor() {
    // Make this instance globally available - only in browser
    if (typeof window !== "undefined") {
      (window as any).deepResearchApp = this;
    }
    console.log("🚀 DeepResearchApp constructor called");
  }

  async init() {
    console.log("🚀 DeepResearchApp.init() called");

    // Prevent double initialization using static flag
    if (this.initialized) {
      console.log("⚠️ DeepResearchApp already initialized, skipping");
      return;
    }

    // If another instance is already initializing, wait for it
    if (DeepResearchApp.isInitializing && DeepResearchApp.initializationPromise) {
      console.log("⏳ Another instance is initializing, waiting...");
      await DeepResearchApp.initializationPromise;
      this.initialized = true;
      return;
    }

    // Mark as initializing and create promise
    DeepResearchApp.isInitializing = true;
    DeepResearchApp.initializationPromise = this.performInitialization();

    try {
      await DeepResearchApp.initializationPromise;
      this.initialized = true;
    } finally {
      DeepResearchApp.isInitializing = false;
      DeepResearchApp.initializationPromise = null;
    }
  }

  private async performInitialization() {
    // Load basic data first (topics, research results) - this is fast
    this.loadBasicDataFromStorage();

    // Initialize AI Assistant - this is fast
    this.initializeAIAssistant();

    // Load AI connection state - this is fast
    setTimeout(() => {
      this.loadAIConnectionFromStorage();
    }, 100);

    // Load Firecrawl API key if available
    this.loadFirecrawlApiKey();

    // Show UI immediately with ready status
    this.updateStatus("✅ DeepResearch ready - Document features loading...");
    console.log("✅ DeepResearchApp basic initialization complete - UI ready");

    // Initialize Vector Store asynchronously in background (non-blocking)
    this.initializeVectorStoreAsync();

    // Initialize Metadata Manager asynchronously
    this.initializeMetadataManagerAsync();

    // Load saved Firecrawl API key
    this.loadFirecrawlApiKey();
  }

  private async initializeVectorStoreAsync() {
    // VectorStore will be provided by VectorStoreProvider
    console.log("📊 VectorStore will be initialized by VectorStoreProvider...");
    this.updateStatus("📊 Waiting for VectorStore from provider...");
    
    // The VectorStore will be set by the React component when the provider initializes it
    // This method is now primarily for backwards compatibility
  }

  // Monitor Xenova download progress
  private monitorXenovaDownloadProgress() {
    if (!this.vectorStore) return;

    const checkProgress = () => {
      const downloadStatus = (this.vectorStore as any).downloadStatus;
      const downloadProgress = (this.vectorStore as any).downloadProgress || 0;
      const downloadError = (this.vectorStore as any).downloadError;

      switch (downloadStatus) {
        case 'downloading':
          this.updateStatus(`🧠 AI models downloading: ${downloadProgress}% (background process)`);
          setTimeout(checkProgress, 2000); // Check every 2 seconds
          break;
          
        case 'ready':
          this.updateStatus("✅ AI models ready - Full document processing and search available");
          console.log("🎉 Xenova download completed successfully");
          break;
          
        case 'error':
          this.updateStatus("⚠️ AI model download failed - Basic document management still available");
          console.error("❌ Xenova download error:", downloadError);
          break;
          
        default:
          // Keep checking if status is unclear
          setTimeout(checkProgress, 1000);
      }
    };

    // Start monitoring
    setTimeout(checkProgress, 1000);
  }

  // Sync AI-Frames data to Knowledge Base
  async syncAIFramesToKB() {
    if (!this.vectorStore) {
      console.log("⚠️ VectorStore not available, skipping AI-Frames sync");
      return;
    }

    try {
      console.log("🔄 Checking for AI-Frames data to sync with Knowledge Base...");
      
      // Check localStorage for AI-Frames data with correct keys
      const aiFramesTimeCapsule = localStorage.getItem('ai_frames_timecapsule');
      const timeCapsuleCombined = localStorage.getItem('timecapsule_combined');
      
      let aiFramesData = null;
      
      // Try to parse AI-Frames TimeCapsule data first
      if (aiFramesTimeCapsule) {
        try {
          const parsedTimeCapsule = JSON.parse(aiFramesTimeCapsule);
          if (parsedTimeCapsule.data && parsedTimeCapsule.data.frames) {
            aiFramesData = parsedTimeCapsule.data.frames;
            console.log(`📊 Found ${aiFramesData.length} AI-Frames from ai_frames_timecapsule`);
          }
        } catch (parseError) {
          console.warn("⚠️ Failed to parse ai_frames_timecapsule:", parseError);
        }
      }
      
      // Fallback to combined TimeCapsule data
      if (!aiFramesData && timeCapsuleCombined) {
        try {
          const parsedCombined = JSON.parse(timeCapsuleCombined);
          if (parsedCombined.data && parsedCombined.data.frames) {
            aiFramesData = parsedCombined.data.frames;
            console.log(`📊 Found ${aiFramesData.length} AI-Frames from timecapsule_combined`);
          }
        } catch (parseError) {
          console.warn("⚠️ Failed to parse timecapsule_combined:", parseError);
        }
      }

      if (!aiFramesData || aiFramesData.length === 0) {
        console.log("ℹ️ No AI-Frames data found to sync");
        return;
      }

      this.updateStatus(`🔄 Syncing ${aiFramesData.length} AI-Frames to Knowledge Base...`);

      let syncedCount = 0;
      const totalFrames = aiFramesData.length;

      for (const frame of aiFramesData) {
        try {
          // Skip empty frames
          if (!frame.title || !frame.informationText) continue;

          // Create document title and content from AI-Frame structure
          const title = `AI-Frame: ${frame.title}`;
          const content = `
Goal: ${frame.goal}

Information:
${frame.informationText}

After Video Text:
${frame.afterVideoText || 'No additional text'}

AI Concepts: ${frame.aiConcepts ? frame.aiConcepts.join(', ') : 'None'}

Video URL: ${frame.videoUrl || 'No video'}
Start Time: ${frame.startTime || 0}s
Duration: ${frame.duration || 0}s
          `.trim();

          // Check if this AI-Frame is already in the KB using enhanced duplicate detection
          const existingDocs = await this.vectorStore.getAllDocuments();
          const existingDoc = existingDocs.find(doc => 
            (doc.metadata.source === 'ai-frames' && 
             (doc.metadata as any).aiFrameId === frame.id) ||
            (doc.title === title && doc.metadata.source === 'ai-frames')
          );

          if (existingDoc) {
            console.log(`⚠️ AI-Frame "${frame.title}" already exists in KB, skipping`);
            continue;
          }

          // Add to Knowledge Base
          await this.vectorStore.addGeneratedDocument(
            title,
            content,
            (progress) => {
              this.updateStatus(`🔄 Syncing AI-Frame ${syncedCount + 1}/${totalFrames}: ${progress.message}`);
            }
          );

          // Update the document metadata to mark it as from AI-Frames
          const allDocs = await this.vectorStore.getAllDocuments();
          const newDoc = allDocs.find(doc => doc.title === title && !(doc.metadata as any).aiFrameId);
          if (newDoc) {
            newDoc.metadata.source = 'ai-frames';
            (newDoc.metadata as any).aiFrameId = frame.id;
            (newDoc.metadata as any).aiFrameType = 'learning-frame';
            (newDoc.metadata as any).videoUrl = frame.videoUrl;
            (newDoc.metadata as any).startTime = frame.startTime;
            (newDoc.metadata as any).duration = frame.duration;
            await this.vectorStore.insertDocument(newDoc);
          }

          syncedCount++;
          console.log(`✅ Synced AI-Frame: ${frame.title}`);

        } catch (frameError) {
          console.warn(`⚠️ Failed to sync AI-Frame "${frame.title}":`, frameError);
        }
      }

      if (syncedCount > 0) {
        this.updateStatus(`✅ Successfully synced ${syncedCount} AI-Frames to Knowledge Base`);
        this.updateDocumentStatus();
        
        // Set up periodic sync to keep AI-Frames and KB in sync
        this.setupAIFramesSync();
      } else {
        this.updateStatus("ℹ️ AI-Frames data already synced with Knowledge Base");
      }

    } catch (error) {
      console.error("❌ Failed to sync AI-Frames to KB:", error);
      this.updateStatus("❌ Failed to sync AI-Frames to Knowledge Base");
    }
  }

  // Set up periodic sync to keep AI-Frames and KB in sync
  private setupAIFramesSync() {
    if (typeof window === "undefined") return;

    // Check if sync is already set up
    if ((window as any).aiFramesSyncSetup) {
      console.log("🔄 AI-Frames sync already set up");
      return;
    }

    // Set up storage event listener to detect AI-Frames changes
    const handleStorageChange = (event: StorageEvent) => {
      if ((event.key === 'ai_frames_timecapsule' || event.key === 'timecapsule_combined') && event.newValue) {
        console.log("🔄 AI-Frames data changed, syncing to Knowledge Base...");
        setTimeout(() => this.syncAIFramesToKB(), 1000); // Small delay to ensure data is saved
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Set up periodic sync (every 30 seconds)
    const syncInterval = setInterval(async () => {
      if (this.vectorStore && this.vectorStore.initialized) {
        await this.syncAIFramesToKB();
      }
    }, 30000); // 30 seconds

    // Store cleanup function
    (window as any).aiFramesSyncCleanup = () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(syncInterval);
      (window as any).aiFramesSyncSetup = false;
    };

    // Mark as set up
    (window as any).aiFramesSyncSetup = true;

    console.log("🔄 AI-Frames sync monitoring established");
  }

  // Legacy method - now non-blocking
  async initializeVectorStore() {
    // Just call the async version and don't await it
    this.initializeVectorStoreAsync();
  }

  private async initializeMetadataManagerAsync() {
    try {
      console.log("📝 Starting metadata manager initialization...");
      this.isMetadataLoading = true;
      this.setIsMetadataLoading?.(true);

      // Get metadata manager singleton (it auto-initializes)
      this.metadataManager = getMetadataManager();

      // Wait for vector store to be ready before linking it
      const maxWaitTime = 10000; // 10 seconds
      const checkInterval = 100; // 100ms
      let waitTime = 0;
      
      while (!this.vectorStore && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
      }

      // Link vector store to metadata manager
      if (this.vectorStore) {
        this.metadataManager.setVectorStore(this.vectorStore);
        console.log("🔗 Metadata manager linked to vector store");
      } else {
        console.warn("⚠️ Vector store not available, metadata manager running without vector store");
      }

      // Load existing metadata
      await this.loadMetadata();

      console.log("✅ Metadata manager initialization complete");
      this.isMetadataLoading = false;
      this.setIsMetadataLoading?.(false);
    } catch (error) {
      console.error("❌ Metadata manager initialization failed:", error);
      this.isMetadataLoading = false;
      this.setIsMetadataLoading?.(false);
    }
  }

  async loadMetadata() {
    if (!this.metadataManager) return;

    try {
      console.log(`🔄 DeepResearch.loadMetadata called`);
      
      // Load BubblSpaces and TimeCapsules
      const bubblSpaces = await this.metadataManager.loadBubblSpaces();
      const timeCapsules = await this.metadataManager.loadTimeCapsules();

      console.log(`📝 Loaded metadata:`, {
        bubblSpaces: bubblSpaces.map(b => ({ id: b.id, name: b.name })),
        timeCapsules: timeCapsules.map(t => ({ id: t.id, name: t.name }))
      });

      this.bubblSpaces = bubblSpaces;
      this.timeCapsules = timeCapsules;

      // Set current BubblSpace and TimeCapsule
      this.currentBubblSpace = this.metadataManager.getDefaultBubblSpace();
      
      // Get the most recent TimeCapsule for the current BubblSpace or create one
      if (this.currentBubblSpace) {
        const recentTimeCapsules = this.metadataManager
          .getTimeCapsulesByBubblSpace(this.currentBubblSpace.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        if (recentTimeCapsules.length > 0) {
          this.currentTimeCapsule = recentTimeCapsules[0];
        } else {
          // Create default TimeCapsule for this BubblSpace
          this.currentTimeCapsule = this.metadataManager.createTimeCapsule(
            'Research Session',
            'Deep research and analysis',
            this.currentBubblSpace.id,
            { category: 'research' }
          );
        }
      }

      // Update React state
      this.setBubblSpaces?.(bubblSpaces);
      this.setTimeCapsules?.(timeCapsules);
      this.setCurrentBubblSpace?.(this.currentBubblSpace);
      this.setCurrentTimeCapsule?.(this.currentTimeCapsule);

      console.log(`✅ Metadata loaded - Current BubblSpace: ${this.currentBubblSpace?.name}`);
    } catch (error) {
      console.error('❌ Failed to load metadata:', error);
    }
  }

  initializeAIAssistant() {
    console.log("🤖 Initializing AI Assistant...");
    this.aiAssistant = new AIAssistant();

    // Set up status change callback
    this.aiAssistant.setStatusChangeCallback((status) => {
      console.log("🔄 AI Status changed:", status);
      this.setAIStatus?.(status);

      if (status.connected) {
        this.updateStatus(
          `✅ Connected to ${status.provider}${
            status.model ? ` (${status.model})` : ""
          }`
        );
        // Save connection state when successfully connected
        this.saveToStorage();
        
        // Initialize AgentCoordinator when AI is connected
        this.initializeAgentCoordinator();
      } else {
        this.updateStatus(
          `❌ AI connection failed: ${status.error || "Unknown error"}`
        );
        // Also save state when disconnected to persist the disconnection
        this.saveToStorage();
      }
    });

    console.log("✅ AI Assistant initialized");
  }

  initializeAgentCoordinator() {
    if (this.aiAssistant && this.aiAssistant.isConnected()) {
      console.log("🤖 Initializing Agent Coordinator...");
      this.agentCoordinator = new AgentCoordinator(this.aiAssistant, this.vectorStore);
      
      // Set up progress callback
      this.agentCoordinator.setProgressCallback((progress) => {
        this.currentAgentProgress = progress;
        this.setCurrentAgentProgress?.(progress);
        
        // Update status message with current agent activity
        const activeTasks = progress.tasks.filter(t => t.status === 'in_progress');
        if (activeTasks.length > 0) {
          const activeTask = activeTasks[0];
          this.updateStatus(`🤖 ${activeTask.taskName}... (${activeTask.progress || 0}%)`);
        }
      });
      
      console.log("✅ Agent Coordinator initialized");
    }
  }

  addTopic(title: string, description: string) {
    const newTopic: Topic = {
      id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      selected: false,
    };

    this.topics.push(newTopic);
    this.setTopics?.(this.topics);
    this.saveToStorage();

    // Track topic addition with enhanced analytics
    analytics.trackTopicManagement("add_topic", this.topics.length);

    const pageAnalytics = (this as any).pageAnalytics;
    if (pageAnalytics) {
      pageAnalytics.trackFeatureUsage("topic_added", {
        topic_title: title,
        topic_description_length: description.length,
        total_topics: this.topics.length,
      });
    }
  }

  deleteTopic(topicId: string) {
    this.topics = this.topics.filter((t) => t.id !== topicId);
    this.setTopics?.(this.topics);
    this.saveToStorage();

    // Track topic deletion with enhanced analytics
    analytics.trackTopicManagement("delete_topic", this.topics.length);

    const pageAnalytics = (this as any).pageAnalytics;
    if (pageAnalytics) {
      pageAnalytics.trackFeatureUsage("topic_deleted", {
        topic_id: topicId,
        remaining_topics: this.topics.length,
      });
    }
  }

  selectTopic(topicId: string) {
    const topic = this.topics.find((t) => t.id === topicId);
    const wasSelected = topic?.selected || false;

    this.topics = this.topics.map((t) => ({
      ...t,
      selected: t.id === topicId ? !t.selected : t.selected,
    }));
    this.setTopics?.(this.topics);
    this.saveToStorage();

    // Track topic selection with enhanced analytics
    const pageAnalytics = (this as any).pageAnalytics;
    if (pageAnalytics) {
      const selectedCount = this.topics.filter((t) => t.selected).length;
      pageAnalytics.trackFeatureUsage("topic_selected", {
        topic_id: topicId,
        topic_title: topic?.title || "unknown",
        action: wasSelected ? "deselected" : "selected",
        total_selected: selectedCount,
        total_topics: this.topics.length,
      });
    }
  }

  moveTopic(topicId: string, direction: "up" | "down") {
    const index = this.topics.findIndex((t) => t.id === topicId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.topics.length) return;

    const newTopics = [...this.topics];
    [newTopics[index], newTopics[newIndex]] = [
      newTopics[newIndex],
      newTopics[index],
    ];

    this.topics = newTopics;
    this.setTopics?.(this.topics);
    this.saveToStorage();
  }

  async connectAI() {
    this.updateStatus("🔄 Starting AI connection...");

    // Check if already connected
    if (this.aiAssistant?.isConnected()) {
      this.updateStatus("✅ AI is already connected");
      return;
    }

    // Show Ollama connection modal
    this.setShowOllamaConnectionModal?.(true);
  }

  async testOllamaConnection(url: string) {
    if (!this.aiAssistant) {
      this.updateStatus("❌ AI Assistant not initialized");
      return;
    }

    this.updateStatus("🔍 Testing Ollama connection...");

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

        this.updateStatus(
          `✅ Found ${this.availableModels.length} available models`
        );
      } else {
        this.updateStatus(`❌ Connection failed: ${result.error}`);
      }
    } catch (error) {
      console.error("❌ Ollama connection test failed:", error);
      this.updateStatus(
        `❌ Connection test failed: ${(error as Error).message}`
      );
    }
  }

  async selectModel(modelName: string) {
    if (!this.aiAssistant) {
      this.updateStatus("❌ AI Assistant not initialized");
      return;
    }

    this.updateStatus(`🔄 Connecting to ${modelName}...`);

    try {
      const success = await this.aiAssistant.connectToOllama(
        this.selectedOllamaURL,
        modelName
      );

      if (success) {
        this.setShowModelSelectionModal?.(false);
        this.updateStatus(`✅ Connected to ${modelName} successfully`);
        // Save connection state to localStorage
        this.saveToStorage();

        // Track successful AI connection
        analytics.trackAIConnection("ollama", modelName, "connected");
      } else {
        this.updateStatus(`❌ Failed to connect to ${modelName}`);
        // Track failed AI connection
        analytics.trackAIConnection("ollama", modelName, "failed");
      }
    } catch (error) {
      console.error("❌ Model selection failed:", error);
      this.updateStatus(
        `❌ Model selection failed: ${(error as Error).message}`
      );
      // Track connection error
      analytics.trackAIConnection("ollama", modelName, "error");
    }
  }

  cancelConnection() {
    this.setShowOllamaConnectionModal?.(false);
    this.setShowModelSelectionModal?.(false);
    this.updateStatus("🔄 Connection cancelled");
  }

  disconnectAI() {
    if (this.aiAssistant && this.aiAssistant.isConnected()) {
      console.log("🔌 Disconnecting AI...");
      this.aiAssistant.disconnect();
      this.updateStatus("🔌 AI disconnected");
      // State will be saved automatically via the status change callback
    }
  }

  async generateResearch(
    researchType: ResearchType,
    researchDepth: ResearchDepth
  ) {
    if (this.isGenerating) return;

    const selectedTopics = this.topics.filter((t) => t.selected);
    if (selectedTopics.length === 0) {
      this.updateStatus("❌ Please select at least one research topic");
      return;
    }

    // Check if AI is connected
    if (!this.aiAssistant?.isConnected()) {
      this.updateStatus("❌ Please connect to AI first");
      return;
    }

    this.isGenerating = true;
    this.setIsGenerating?.(true);
    this.updateStatus("🔄 Generating research with AI...");

    // Track research generation start with enhanced analytics
    const aiSession = this.aiAssistant.getSession();
    const pageAnalytics = (this as any).pageAnalytics;

    if (pageAnalytics) {
      pageAnalytics.trackFeatureUsage("research_generation_started", {
        research_type: researchType,
        research_depth: researchDepth,
        ai_provider: aiSession?.provider || "unknown",
        ai_model: aiSession?.model || "unknown",
        selected_topics: selectedTopics.length,
        topic_titles: selectedTopics.map((t) => t.title),
        has_vector_store: !!this.vectorStore,
        vector_store_ready: !this.isVectorStoreLoading,
      });
    }

    analytics.trackResearchGeneration(
      researchType,
      researchDepth,
      aiSession?.provider || "unknown",
      selectedTopics.length
    );

    try {
      // Use AgentCoordinator for Learning Research
      if (researchType === "learning" && this.agentCoordinator) {
        this.updateStatus("🤖 Initializing multi-agent learning research...");
        this.showAgentProgress = true;
        this.setShowAgentProgress?.(true);
        
        // Extract conversation content from topics
        const conversationContent = selectedTopics
          .map((t) => `${t.title}: ${t.description}`)
          .join("\n");
        
        // Generate comprehensive learning research using multiple agents
        const researchContent = await this.agentCoordinator.generateLearningResearch(
          conversationContent,
          this.attachedDocuments,
          researchDepth
        );
        
        // Create research metadata
        const researchId = `learning-research-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        const researchMetadata = {
          id: researchId,
          title: `Multi-Agent Learning Research: ${selectedTopics.map((t) => t.title).join(", ")}`,
          type: researchType,
          depth: researchDepth,
          topics: selectedTopics.map((t) => t.title),
          generatedAt: new Date().toISOString(),
          aiProvider: this.aiAssistant.getSession()?.provider || "unknown",
          model: this.aiAssistant.getSession()?.model || "unknown",
          documentIntegration: this.attachedDocuments.length > 0,
        };

        // Store research results
        this.researchResults[researchId] = {
          content: researchContent,
          metadata: researchMetadata,
          timestamp: new Date().toISOString(),
        } as ResearchItem;

        this.researchResults["current"] = researchContent;
        this.researchResults["currentMetadata"] = researchMetadata as ResearchMetadata;

        // Update React state and save to storage
        this.setResearchResults?.(researchContent);
        this.saveToStorage();

        // Save to vector store
        if (this.vectorStore) {
          await this.vectorStore.addGeneratedDocument(
            researchMetadata.title,
            researchContent,
            (progress) => {
              this.updateStatus(`💾 Saving research: ${progress.message}`);
            }
          );
          this.updateDocumentStatus();
        }

        this.updateStatus("✅ Multi-agent learning research completed successfully");
        this.showAgentProgress = false;
        this.setShowAgentProgress?.(false);
        
        // Track successful research generation
        if (pageAnalytics) {
          pageAnalytics.trackFeatureUsage("multi_agent_research_completed", {
            research_type: researchType,
            research_depth: researchDepth,
            ai_provider: aiSession?.provider || "unknown",
            ai_model: aiSession?.model || "unknown",
            content_length: researchContent.length,
            attached_documents: this.attachedDocuments.length,
            agent_session_id: this.currentAgentProgress?.sessionId,
            total_tokens: this.currentAgentProgress?.totalTokens,
            research_quality: this.currentAgentProgress?.researchQuality,
          });
        }
        
        return; // Exit early for multi-agent learning research
      }

      // Step 1: Perform RAG - Search for relevant documents (for non-learning research)
      let relevantDocuments: any[] = [];
      if (this.vectorStore && !this.isVectorStoreLoading) {
        // Enhanced fallback messaging for RAG search
        if (this.vectorStore.processingAvailable) {
          this.updateStatus(
            "🔍 Searching knowledge base for relevant documents..."
          );
          relevantDocuments = await this.searchRelevantDocuments(selectedTopics);
        } else {
          const status = this.vectorStore.processingStatus;
          if (this.vectorStore.downloadStatus === 'downloading') {
            this.updateStatus(
              `🧠 ${status} - Generating research without document context for now...`
            );
          } else {
            this.updateStatus(
              "🔍 Generating research (document search unavailable)..."
            );
          }
        }
      } else {
        console.log(
          "⚠️ VectorStore not ready, generating research without document context"
        );
        this.updateStatus(
          "🔍 Generating research (document search unavailable)..."
        );
      }

      // Step 2: Build research prompt with RAG context
      const researchPrompt = await this.buildResearchPrompt(
        selectedTopics,
        researchType,
        researchDepth,
        relevantDocuments
      );

      // Step 3: Generate research using AI with RAG context
      this.updateStatus("🤖 Generating comprehensive research report...");
      const rawContent = await this.aiAssistant.generateContent(
        researchPrompt,
        "research"
      );

      // Filter out <think> tags and any other unwanted content
      const researchContent = this.cleanResearchOutput(rawContent);

      // Step 4: Create research metadata
      const researchId = `research-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const researchMetadata = {
        id: researchId,
        title: `${
          researchType.charAt(0).toUpperCase() + researchType.slice(1)
        } Research: ${selectedTopics.map((t) => t.title).join(", ")}`,
        type: researchType,
        depth: researchDepth,
        topics: selectedTopics.map((t) => t.title),
        generatedAt: new Date().toISOString(),
        aiProvider: this.aiAssistant.getSession()?.provider || "unknown",
        model: this.aiAssistant.getSession()?.model || "unknown",
        documentIntegration: relevantDocuments.length > 0,
      };

      // Step 5: Save to vector store with research metadata
      if (this.vectorStore) {
        await this.vectorStore.addGeneratedDocument(
          researchMetadata.title,
          researchContent,
          // Progress callback for research document
          (progress) => {
            this.updateStatus(
              `💾 Saving research: ${progress.message} (${progress.progress}%)`
            );
          }
        );
        this.updateStatus("✅ Research saved to knowledge base");
        this.updateDocumentStatus();
      }

      // Step 6: Store research results with metadata for persistence
      this.researchResults[researchId] = {
        content: researchContent,
        metadata: researchMetadata,
        timestamp: new Date().toISOString(),
      } as ResearchItem;

      // Set current research as the most recent one
      this.researchResults["current"] = researchContent;
      this.researchResults["currentMetadata"] =
        researchMetadata as ResearchMetadata;

      // Update React state and save to storage
      this.setResearchResults?.(researchContent);
      this.saveToStorage();

      this.updateStatus("✅ Research generated and saved successfully");

      // Track successful research generation
      if (pageAnalytics) {
        pageAnalytics.trackFeatureUsage("research_generation_completed", {
          research_type: researchType,
          research_depth: researchDepth,
          ai_provider: aiSession?.provider || "unknown",
          ai_model: aiSession?.model || "unknown",
          content_length: researchContent.length,
          document_integration: relevantDocuments.length > 0,
          documents_found: relevantDocuments.length,
          topics_researched: selectedTopics.length,
        });
      }
    } catch (error) {
      console.error("❌ Research generation failed:", error);
      this.updateStatus(
        "❌ Research generation failed: " + (error as Error).message
      );

      // Fall back to demo content on error
      const demoContent = this.generateDemoResearch(
        selectedTopics,
        researchType,
        researchDepth
      );
      const demoId = `demo-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const demoMetadata = {
        id: demoId,
        title: `Demo ${
          researchType.charAt(0).toUpperCase() + researchType.slice(1)
        } Research: ${selectedTopics.map((t) => t.title).join(", ")}`,
        type: researchType,
        depth: researchDepth,
        topics: selectedTopics.map((t) => t.title),
        generatedAt: new Date().toISOString(),
        aiProvider: "demo",
        model: "demo",
        documentIntegration: false,
      };

      // Store demo content with metadata
      this.researchResults[demoId] = {
        content: demoContent,
        metadata: demoMetadata,
        timestamp: new Date().toISOString(),
      } as ResearchItem;

      this.researchResults["current"] = demoContent;
      this.researchResults["currentMetadata"] =
        demoMetadata as ResearchMetadata;

      this.setResearchResults?.(demoContent);
      this.saveToStorage();

      this.updateStatus("⚠️ Using demo content - AI generation failed");
    } finally {
      this.isGenerating = false;
      this.setIsGenerating?.(false);
    }
  }

  // RAG Search for relevant documents
  private async searchRelevantDocuments(
    selectedTopics: Topic[]
  ): Promise<any[]> {
    if (!this.vectorStore) {
      console.log("⚠️ No vector store available for RAG search");
      return [];
    }

    const allResults: any[] = [];

    try {
      // Search for documents related to each topic
      for (const topic of selectedTopics) {
        const searchQuery = `${topic.title} ${topic.description}`;
        console.log(`🔍 RAG Search: "${searchQuery}"`);

        const results = await this.vectorStore.searchSimilar(
          searchQuery,
          0.1,
          10
        );
        console.log(
          `📊 Found ${results.length} relevant documents for "${topic.title}"`
        );

        // Add topic context to results
        results.forEach((result) => {
          (result as any).relatedTopic = topic.title;
        });

        allResults.push(...results);
      }

      // Remove duplicates and sort by similarity
      const uniqueResults = allResults.filter(
        (result, index, self) =>
          index ===
          self.findIndex(
            (r) =>
              r.document.id === result.document.id &&
              r.chunk.index === result.chunk.index
          )
      );

      const sortedResults = uniqueResults.sort(
        (a, b) => b.similarity - a.similarity
      );

      console.log(
        `📊 RAG Search Summary: ${sortedResults.length} unique relevant documents found`
      );
      return sortedResults.slice(0, 20); // Limit to top 20 results
    } catch (error) {
      console.error("❌ RAG search failed:", error);
      return [];
    }
  }

  private async buildResearchPrompt(
    selectedTopics: Topic[],
    type: ResearchType,
    depth: ResearchDepth,
    relevantDocuments: any[]
  ): Promise<string> {
    const topics = selectedTopics
      .map((t) => `${t.title}: ${t.description}`)
      .join("\n");

    // Handle learning research type with specialized logic
    if (type === "learning") {
      return this.buildLearningResearchPrompt(selectedTopics, depth, relevantDocuments);
    }

    
    let prompt = `You are a professional researcher. Generate a comprehensive ${depth} ${type} research report based on the provided topics and supporting documents.\n\n`;

    prompt += `## Research Topics:\n${topics}\n\n`;

    // Add RAG context if documents are available
    if (relevantDocuments.length > 0) {
      prompt += `## Supporting Documents & Evidence:\n`;
      prompt += `The following documents from the knowledge base are relevant to your research:\n\n`;

      relevantDocuments.forEach((result, index) => {
        const matchPercentage = (result.similarity * 100).toFixed(1);
        prompt += `### Document ${index + 1}: "${
          result.document.title
        }" (${matchPercentage}% match)\n`;
        prompt += `**Related to:** ${(result as any).relatedTopic}\n`;
        prompt += `**Content:** ${result.chunk.content.substring(0, 500)}${
          result.chunk.content.length > 500 ? "..." : ""
        }\n`;
        prompt += `**Source:** Document ID ${result.document.id}, Chunk ${
          result.chunk.index + 1
        }\n\n`;
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

    if (depth === "overview") {
      prompt += `## Depth Guidelines:\n`;
      prompt += `- Keep sections concise with high-level insights\n`;
      prompt += `- Focus on 3-5 key points per topic\n`;
      prompt += `- Emphasize actionable takeaways\n`;
    } else if (depth === "detailed") {
      prompt += `## Depth Guidelines:\n`;
      prompt += `- Provide comprehensive analysis with supporting data\n`;
      prompt += `- Include market analysis, technology assessment, and competitive landscape\n`;
      prompt += `- Add specific metrics and quantitative insights\n`;
    } else {
      // comprehensive
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

  private async buildLearningResearchPrompt(
    selectedTopics: Topic[],
    depth: ResearchDepth,
    relevantDocuments: any[]
  ): Promise<string> {
    // Extract conversation content from topics for analysis
    const conversationContent = selectedTopics
      .map((t) => `${t.title}: ${t.description}`)
      .join("\n");

    let prompt = `You are an expert Learning Research Coordinator specialized in converting conversations, technical discussions, and Q&A sessions into structured, personalized learning curricula. Your role is to analyze conversational content and create comprehensive educational pathways.\n\n`;

    prompt += `## Conversation Analysis Task\n`;
    prompt += `Analyze the following conversational content and create a structured learning research report:\n\n`;
    prompt += `**Content to Analyze:**\n${conversationContent}\n\n`;

    // Add RAG context if documents are available
    if (relevantDocuments.length > 0) {
      prompt += `## Supporting Learning Materials:\n`;
      prompt += `The following documents from the knowledge base provide additional context:\n\n`;

      relevantDocuments.forEach((result, index) => {
        const matchPercentage = (result.similarity * 100).toFixed(1);
        prompt += `### Document ${index + 1}: "${result.document.title}" (${matchPercentage}% match)\n`;
        prompt += `**Content:** ${result.chunk.content.substring(0, 500)}${
          result.chunk.content.length > 500 ? "..." : ""
        }\n`;
        prompt += `**Source:** Document ID ${result.document.id}\n\n`;
      });
    }

    // Add attached documents if available
    if (this.attachedDocuments.length > 0) {
      prompt += `## Attached Reference Documents:\n`;
      prompt += `The following documents have been specifically attached for this learning research:\n\n`;

      this.attachedDocuments.forEach((doc, index) => {
        prompt += `### Attached Document ${index + 1}: "${doc.title}"\n`;
        prompt += `**Content:** ${doc.content.substring(0, 1000)}${
          doc.content.length > 1000 ? "..." : ""
        }\n`;
        prompt += `**Source:** ${doc.metadata.filename || doc.title}\n`;
        prompt += `**Type:** ${doc.metadata.filetype}\n\n`;
      });

      prompt += `**Important:** Use these attached documents as primary reference materials when creating the learning curriculum. Extract specific examples, code snippets, and concepts from these documents to enhance the learning experience.\n\n`;
    }

    prompt += `## Learning Analysis Framework\n\n`;
    prompt += `### Phase 1: Conversation Analysis\n`;
    prompt += `Analyze the content for:\n`;
    prompt += `- **Direct Learning Requests**: "I want to learn...", "How do I...", "Can you explain..."\n`;
    prompt += `- **Knowledge Gaps**: Questions indicating missing understanding\n`;
    prompt += `- **Technical Context**: Programming languages, frameworks, tools mentioned\n`;
    prompt += `- **Problem-Solving Patterns**: What user is trying to accomplish\n`;
    prompt += `- **Confusion Points**: Areas where user expresses uncertainty\n`;
    prompt += `- **Knowledge Base Connections**: Link conversation topics to available documents and references\n\n`;

    prompt += `### Phase 2: User Level Assessment\n`;
    prompt += `Determine user expertise level based on:\n`;
    prompt += `- **Technical Vocabulary**: Complexity and accuracy of terms used\n`;
    prompt += `- **Problem Complexity**: Sophistication of questions asked\n`;
    prompt += `- **Prior Knowledge**: Evidence of previous experience\n`;
    prompt += `- **Question Sophistication**: Level of inquiry demonstrated\n\n`;

    prompt += `### Phase 3: Learning Curriculum Design\n`;
    prompt += `Create structured learning path with:\n`;
    prompt += `- **Prerequisite Mapping**: Required background knowledge\n`;
    prompt += `- **Module Sequencing**: Logical progression of topics\n`;
    prompt += `- **Learning Objectives**: Specific skills and knowledge goals\n`;
    prompt += `- **Difficulty Progression**: Gradual complexity increase\n`;
    prompt += `- **Knowledge Base Integration**: Leverage attached documents and relevant KB content for examples and exercises\n`;
    prompt += `- **Document-Based Learning**: Create exercises and examples using the specific content from attached documents\n\n`;

    prompt += `## Required Learning Research Report Structure\n\n`;

    prompt += `Start with main title using single # header, then:\n\n`;

    prompt += `### 🎯 Learning Analysis Summary\n`;
    prompt += `**Primary Learning Goals:** List 3-5 key objectives\n`;
    prompt += `**User Level Assessment:** Beginner/Intermediate/Advanced (confidence: X/10)\n`;
    prompt += `**Knowledge Gaps:** Specific areas to address\n`;
    prompt += `**Learning Domain:** Programming/ML/DevOps/etc.\n`;
    prompt += `**Estimated Learning Time:** X hours\n\n`;

    prompt += `### 📚 Learning Curriculum\n`;
    prompt += `#### Prerequisites\n`;
    prompt += `- Required background knowledge\n`;
    prompt += `- Recommended experience level\n\n`;

    prompt += `#### Module 1: [Foundation Topic]\n`;
    prompt += `**Learning Objectives:** What you'll master\n`;
    prompt += `**Duration:** X minutes/hours\n`;
    prompt += `**Difficulty:** ⭐⭐☆☆☆\n\n`;

    prompt += `#### Module 2: [Advanced Topic]\n`;
    prompt += `**Learning Objectives:** Advanced skills\n`;
    prompt += `**Duration:** X hours\n`;
    prompt += `**Difficulty:** ⭐⭐⭐☆☆\n\n`;

    prompt += `### 📖 Step-by-Step Learning Guide\n`;
    prompt += `#### Module 1: [Topic Name]\n`;
    prompt += `##### 1.1 Conceptual Foundation\n`;
    prompt += `**What is [Concept]?** Clear, simple explanation.\n`;
    prompt += `**Why is this important?** Practical relevance.\n\n`;

    prompt += `##### 1.2 Technical Implementation\n`;
    prompt += `**Basic Setup:**\n`;
    prompt += `1. Step one\n`;
    prompt += `2. Step two\n\n`;

    prompt += `**Code Example:**\n`;
    prompt += `\\\`\\\`\\\`python\n`;
    prompt += `# Working code with detailed comments\n`;
    prompt += `import example\n`;
    prompt += `result = example.function()\n`;
    prompt += `\\\`\\\`\\\`\n\n`;

    prompt += `**Best Practices:**\n`;
    prompt += `- Key recommendation one\n`;
    prompt += `- Key recommendation two\n\n`;

    prompt += `##### 1.3 Hands-On Practice\n`;
    prompt += `**Exercise 1:** Clear objective\n`;
    prompt += `- Goal: What to accomplish\n`;
    prompt += `- Steps: Detailed instructions\n`;
    prompt += `- Expected Output: Success criteria\n\n`;

    prompt += `**Exercise 2:** Progressive challenge\n`;
    prompt += `- Goal: Advanced objective\n`;
    prompt += `- Steps: Complex instructions\n\n`;

    prompt += `### 📊 Progress Tracking\n`;
    prompt += `#### Completion Checklist\n`;
    prompt += `- [ ] Understand core concepts\n`;
    prompt += `- [ ] Complete all exercises\n`;
    prompt += `- [ ] Can implement basic functionality\n`;
    prompt += `- [ ] Ready for next module\n\n`;

    prompt += `#### Skill Milestones\n`;
    prompt += `- **Milestone 1:** Master the basics\n`;
    prompt += `- **Milestone 2:** Apply advanced techniques\n`;
    prompt += `- **Final Goal:** Complete practical implementation\n\n`;

    prompt += `#### Next Steps\n`;
    prompt += `- **If mastered:** Proceed to [next topic]\n`;
    prompt += `- **Need practice:** Try [additional exercises]\n`;
    prompt += `- **For deeper learning:** Explore [advanced resources]\n\n`;

    // Add depth-specific guidelines
    if (depth === "overview") {
      prompt += `**Depth Guidelines (Overview):** Focus on 2-3 core modules, basic exercises, practical application. Target 2-4 hours total learning time.\n\n`;
    } else if (depth === "detailed") {
      prompt += `**Depth Guidelines (Detailed):** Provide 4-6 comprehensive modules with multiple exercises, troubleshooting, and real-world projects. Target 6-12 hours total learning time.\n\n`;
    } else {
      // comprehensive
      prompt += `**Depth Guidelines (Comprehensive):** Create extensive 6+ module curriculum covering beginner to advanced levels with multiple learning paths, projects, and assessments. Target 15+ hours total learning time.\n\n`;
    }

    prompt += `## Critical Output Requirements:\n`;
    prompt += `- **IMPORTANT**: Generate ONLY the final learning research report - NO analysis tags\n`;
    prompt += `- **NO** <think>, <reasoning>, or <analysis> tags - clean markdown only\n`;
    prompt += `- **FORMATTING**: Use CLEAN, professional markdown with NO unnecessary gaps or excessive line breaks\n`;
    prompt += `- **STRUCTURE**: Follow the exact format shown in the example below\n`;
    prompt += `- **CODE BLOCKS**: Use proper \`\`\`language formatting for all code examples\n`;
    prompt += `- **SPACING**: Single line breaks between sections, no multiple empty lines\n`;
    prompt += `- **HEADERS**: Use consistent header hierarchy (# ## ### #### #####)\n`;
    prompt += `- Start directly with the main title using single # header\n`;
    prompt += `- Make it practical, actionable, and immediately useful\n`;
    prompt += `- Focus on the specific learning goals extracted from the conversation\n\n`;

    if (relevantDocuments.length > 0) {
      prompt += `- Reference specific information from the provided documents\n`;
      prompt += `- Integrate document knowledge into the learning path\n\n`;
    }

    prompt += `## Example Clean Format Template:\n`;
    prompt += `\`\`\`markdown\n`;
    prompt += `# [Learning Topic] - Complete Guide\n`;
    prompt += `\n`;
    prompt += `## 🎯 Learning Analysis Summary\n`;
    prompt += `**Primary Learning Goals:** Clear, concise bullet points\n`;
    prompt += `**User Level Assessment:** Beginner/Intermediate/Advanced (confidence: X/10)\n`;
    prompt += `**Knowledge Gaps:** Specific areas to address\n`;
    prompt += `**Learning Domain:** Programming/ML/DevOps/etc.\n`;
    prompt += `**Estimated Learning Time:** X hours\n`;
    prompt += `\n`;
    prompt += `## 📚 Learning Curriculum\n`;
    prompt += `### Prerequisites\n`;
    prompt += `- Required background knowledge\n`;
    prompt += `- Recommended experience level\n`;
    prompt += `\n`;
    prompt += `### Module 1: Foundation Topic\n`;
    prompt += `**Learning Objectives:** What you'll master\n`;
    prompt += `**Duration:** X minutes\n`;
    prompt += `**Difficulty:** ⭐⭐☆☆☆\n`;
    prompt += `\n`;
    prompt += `### Module 2: Progressive Topic\n`;
    prompt += `**Learning Objectives:** Advanced skills\n`;
    prompt += `**Duration:** X hours\n`;
    prompt += `**Difficulty:** ⭐⭐⭐☆☆\n`;
    prompt += `\n`;
    prompt += `## 📖 Step-by-Step Learning Guide\n`;
    prompt += `### Module 1: [Topic Name]\n`;
    prompt += `#### 1.1 Conceptual Foundation\n`;
    prompt += `**What is [Concept]?** Clear, simple explanation.\n`;
    prompt += `**Why is this important?** Practical relevance.\n`;
    prompt += `\n`;
    prompt += `#### 1.2 Technical Implementation\n`;
    prompt += `**Basic Setup:**\n`;
    prompt += `1. Step one\n`;
    prompt += `2. Step two\n`;
    prompt += `\n`;
    prompt += `**Code Example:**\n`;
    prompt += `\\\`\\\`\\\`python\n`;
    prompt += `import example\n`;
    prompt += `# Working code with comments\n`;
    prompt += `result = example.function()\n`;
    prompt += `\\\`\\\`\\\`\n`;
    prompt += `\n`;
    prompt += `#### 1.3 Hands-On Practice\n`;
    prompt += `**Exercise 1:** Clear objective\n`;
    prompt += `- Goal: What to accomplish\n`;
    prompt += `- Steps: Detailed instructions\n`;
    prompt += `- Expected Output: Success criteria\n`;
    prompt += `\n`;
    prompt += `## 📊 Progress Tracking\n`;
    prompt += `### Completion Checklist\n`;
    prompt += `- [ ] Understand core concepts\n`;
    prompt += `- [ ] Complete all exercises\n`;
    prompt += `- [ ] Ready for next module\n`;
    prompt += `\n`;
    prompt += `### Next Steps\n`;
    prompt += `- **If mastered:** Proceed to [next topic]\n`;
    prompt += `- **Need practice:** Try [additional exercises]\n`;
    prompt += `\\\`\\\`\\\`\n\n`;

    prompt += `**CRITICAL FORMATTING REQUIREMENTS:**\n`;
    prompt += `- Use EXACTLY the clean format shown in the template above\n`;
    prompt += `- NO excessive line breaks or gaps between sections\n`;
    prompt += `- Single blank line between major sections only\n`;
    prompt += `- Start with # title, then ## sections, then ### subsections\n`;
    prompt += `- Clean, professional formatting like the original scraped content\n`;
    prompt += `- NO markdown formatting errors or inconsistent spacing\n\n`;
    prompt += `Generate the complete learning research report now following this exact format.\n`;

    return prompt;
  }

  private cleanResearchOutput(rawContent: string): string {
    let cleanContent = rawContent;

    // Remove <think> tags and their content
    cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, "");

    // Remove any other unwanted XML-like tags that might appear
    cleanContent = cleanContent.replace(/<\/?reasoning>/gi, "");
    cleanContent = cleanContent.replace(/<\/?analysis>/gi, "");

    // Fix excessive whitespace and newlines - be more aggressive
    cleanContent = cleanContent.replace(/\n\s*\n\s*\n+/g, "\n\n"); // Max 2 newlines
    cleanContent = cleanContent.replace(/\n{4,}/g, "\n\n"); // No more than 2 consecutive newlines
    cleanContent = cleanContent.replace(/^\s+|\s+$/gm, ""); // Trim each line
    cleanContent = cleanContent.trim();

    // Remove unnecessary gaps around headers
    cleanContent = cleanContent.replace(/\n\n+(?=#)/g, "\n\n"); // Max one blank line before headers
    cleanContent = cleanContent.replace(/(#{1,6}[^\n]*)\n\n+/g, "$1\n"); // Remove gaps after headers

    // Clean up list formatting
    cleanContent = cleanContent.replace(/(\n- [^\n]*)\n\n+(?=- )/g, "$1\n"); // Remove gaps between list items
    cleanContent = cleanContent.replace(/(\n\d+\. [^\n]*)\n\n+(?=\d+\. )/g, "$1\n"); // Same for numbered lists

    // Fix code block spacing
    cleanContent = cleanContent.replace(/\n\n+```/g, "\n\n```"); // Max one line before code blocks
    cleanContent = cleanContent.replace(/```\n\n+/g, "```\n"); // No gaps after opening code blocks
    cleanContent = cleanContent.replace(/\n\n+```\n/g, "\n```\n"); // No gaps before closing code blocks

    // Ensure proper markdown formatting
    cleanContent = this.improveMarkdownFormatting(cleanContent);

    return cleanContent;
  }

  private improveMarkdownFormatting(content: string): string {
    let formatted = content;

    // Ensure proper heading hierarchy
    formatted = formatted.replace(/^#{7,}/gm, "######"); // Max 6 levels

    // Ensure space after hash symbols in headings
    formatted = formatted.replace(/^(#+)([^\s#])/gm, "$1 $2");

    // Improve list formatting - ensure single space after bullets/numbers
    formatted = formatted.replace(/^(\s*)-([^\s])/gm, "$1- $2");
    formatted = formatted.replace(/^(\s*)\*([^\s])/gm, "$1* $2");
    formatted = formatted.replace(/^(\s*)\d+\.([^\s])/gm, "$1$2 ");

    // Fix code block formatting - no extra newlines
    formatted = formatted.replace(/\n*```([a-zA-Z]*)\n*/g, "\n\n```$1\n");
    formatted = formatted.replace(/\n*```\n*/g, "\n```\n\n");

    // Ensure proper spacing around sections - single blank line
    formatted = formatted.replace(/^(#{1,6}[^\n]*)\n+/gm, "$1\n");
    formatted = formatted.replace(/\n+(#{1,6}[^\n]*)/gm, "\n\n$1");

    // Fix bold/italic formatting
    formatted = formatted.replace(/\*\*([^*\n]+)\*\*/g, "**$1**");
    formatted = formatted.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "*$1*");

    // Clean up excessive whitespace more aggressively
    formatted = formatted.replace(/[ \t]+$/gm, ""); // Remove trailing spaces
    formatted = formatted.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines
    formatted = formatted.replace(/^\n+/, ""); // Remove leading newlines
    formatted = formatted.replace(/\n+$/, ""); // Remove trailing newlines

    // Ensure consistent list spacing
    formatted = formatted.replace(/(\n- [^\n]*)\n+(?=- )/g, "$1\n");
    formatted = formatted.replace(/(\n\d+\. [^\n]*)\n+(?=\d+\. )/g, "$1\n");

    // Fix paragraph spacing
    formatted = formatted.replace(/([^\n])\n([A-Z])/g, "$1\n\n$2"); // Add space between paragraphs

    return formatted.trim();
  }

  private generateDemoResearch(
    selectedTopics: Topic[],
    type: ResearchType,
    depth: ResearchDepth
  ): string {
    const topics = selectedTopics.map((t) => t.title).join(", ");

    let content = `# ${
      type.charAt(0).toUpperCase() + type.slice(1)
    } Research Report\n\n`;
    content += `**Research Depth:** ${depth}\n`;
    content += `**Topics:** ${topics}\n`;
    content += `**Generated:** ${new Date().toLocaleDateString()}\n`;
    content += `**Note:** This is demo content - AI generation failed\n\n`;

    content += `## Executive Summary\n\n`;
    content += `This ${depth} ${type} research analysis covers ${topics}. `;

    if (depth === "overview") {
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
    } else if (depth === "detailed") {
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
    } else {
      // comprehensive
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
      this.updateStatus("❌ Vector Store not available");
      return;
    }

    // Enhanced fallback messaging for upload
    if (!this.vectorStore.processingAvailable) {
      const status = this.vectorStore.processingStatus;
      if (this.vectorStore.downloadStatus === 'downloading') {
        this.updateStatus(`⏳ ${status} - Upload will be available once download completes`);
      } else if (this.vectorStore.downloadStatus === 'error') {
        this.updateStatus("❌ AI model download failed - Document upload requires AI processing");
      } else {
        this.updateStatus("❌ Document processing not ready - Please wait or refresh the page");
      }
      return;
    }

    if (this.isUploading) {
      this.updateStatus("⚠️ Upload already in progress");
      return;
    }

    // Track document upload start
    const pageAnalytics = (this as any).pageAnalytics;
    if (pageAnalytics) {
      const fileTypes = Array.from(files).map((f) => f.type || "unknown");
      const fileSizes = Array.from(files).map((f) => f.size);
      const totalSize = fileSizes.reduce((sum, size) => sum + size, 0);

      pageAnalytics.trackFeatureUsage("document_upload_started", {
        file_count: files.length,
        file_types: fileTypes,
        total_size_bytes: totalSize,
        average_size_bytes: Math.round(totalSize / files.length),
        file_names: Array.from(files).map((f) => f.name),
      });
    }

    this.isUploading = true;
    this.setIsProcessingDocuments?.(true);
    console.log(`📊 Processing ${files.length} documents...`);

    let successCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(
          `📄 Processing file ${i + 1}/${files.length}: ${file.name}`
        );
        this.updateStatus(
          `📄 Processing ${file.name} (${i + 1}/${files.length})...`
        );

        // Update processing progress state for modal
        this.setProcessingProgress?.({
          currentFile: file.name,
          progress: 0,
          message: "Starting processing...",
          fileIndex: i + 1,
          totalFiles: files.length,
        });

        try {
          const content = await this.readFileContent(file);
          await this.vectorStore.addDocument(
            file,
            content,
            // Progress callback for each file
            (progress) => {
              this.updateStatus(
                `📄 ${file.name}: ${progress.message} (${progress.progress}%)`
              );

              // Update modal progress in real-time
              this.setProcessingProgress?.({
                currentFile: file.name,
                progress: progress.progress,
                message: progress.message,
                fileIndex: i + 1,
                totalFiles: files.length,
              });
            }
          );
          successCount++;
          console.log(`✅ Successfully processed: ${file.name}`);

          // Clear progress for this file
          this.setProcessingProgress?.({
            currentFile: file.name,
            progress: 100,
            message: "✅ Processing complete",
            fileIndex: i + 1,
            totalFiles: files.length,
          });

          // Brief pause to show completion
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (fileError) {
          console.error(`❌ Failed to process ${file.name}:`, fileError);
          failedCount++;
          this.updateStatus(
            `❌ Failed to process ${file.name}: ${(fileError as Error).message}`
          );

          // Show error in progress
          this.setProcessingProgress?.({
            currentFile: file.name,
            progress: 0,
            message: `❌ Error: ${(fileError as Error).message}`,
            fileIndex: i + 1,
            totalFiles: files.length,
          });

          // Continue processing other files instead of stopping
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause before next file
        }
      }

      if (successCount > 0) {
        this.updateStatus(
          `✅ Successfully uploaded ${successCount} file(s)${
            failedCount > 0 ? ` (${failedCount} failed)` : ""
          }`
        );
        this.updateDocumentStatus();

        // Track successful document uploads with enhanced analytics
        analytics.trackDocumentManagement("upload_documents", successCount);

        if (pageAnalytics) {
          pageAnalytics.trackFeatureUsage("document_upload_completed", {
            successful_files: successCount,
            failed_files: failedCount,
            total_files: files.length,
            success_rate: Math.round((successCount / files.length) * 100),
          });
        }
      } else {
        this.updateStatus(`❌ All uploads failed`);
        // Track failed uploads
        analytics.trackDocumentManagement("upload_failed", 0);
      }

      console.log(
        `📊 Upload process completed: ${successCount} successful, ${failedCount} failed`
      );
    } catch (error) {
      console.error("❌ Upload process failed:", error);
      this.updateStatus(
        "❌ Upload process failed: " + (error as Error).message
      );
    } finally {
      this.isUploading = false;
      this.setIsProcessingDocuments?.(false);
      this.setProcessingProgress?.(null);

      // Clear file input to allow re-uploading same files
      if (typeof document !== "undefined") {
        const fileInput = document.getElementById(
          "documentUpload"
        ) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = "";
          console.log(`📄 File input cleared successfully`);
        }
      }

      console.log(`📄 Upload process completed, state reset`);
    }
  }

  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check file size to prevent freezing (following reference implementation)
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        reject(
          new Error(
            `File too large: ${file.name} (${this.formatFileSize(
              file.size
            )}). Please use files under 10MB.`
          )
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  async showDocumentManager() {
    if (!this.vectorStore) {
      this.updateStatus("❌ Vector Store not initialized");
      return;
    }

    this.setShowDocumentManager?.(true);
    this.updateStatus("📚 Opening document manager...");

    // Track manage knowledge event
    try {
      const stats = await this.vectorStore.getStats();
      analytics.trackEvent("knowledge_management", {
        action: "manage_knowledge_opened",
        document_count: stats.documentCount,
        vector_count: stats.vectorCount,
        event_category: "knowledge",
        event_label: "manage_knowledge_opened",
      });
    } catch (error) {
      analytics.trackEvent("knowledge_management", {
        action: "manage_knowledge_opened",
        document_count: 0,
        vector_count: 0,
        event_category: "knowledge",
        event_label: "manage_knowledge_opened",
      });
    }
  }

  hideDocumentManager() {
    this.setShowDocumentManager?.(false);
  }

  async deleteDocument(docId: string) {
    if (!this.vectorStore) {
      this.updateStatus("❌ Vector Store not available");
      return;
    }

    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await this.vectorStore.deleteDocument(docId);
        this.updateStatus("✅ Document deleted successfully");
        this.updateDocumentStatus();
      } catch (error) {
        console.error("Failed to delete document:", error);
        this.updateStatus(
          "❌ Failed to delete document: " + (error as Error).message
        );
      }
    }
  }

  async previewDocument(docId: string) {
    if (!this.vectorStore) {
      this.updateStatus("❌ Vector Store not available");
      return null;
    }

    try {
      const document = await this.vectorStore.getDocument(docId);
      if (!document) {
        this.updateStatus("❌ Document not found");
        return null;
      }

      this.updateStatus("📄 Document preview loaded");
      return document;
    } catch (error) {
      console.error("Failed to preview document:", error);
      this.updateStatus(
        "❌ Failed to preview document: " + (error as Error).message
      );
      return null;
    }
  }

  async downloadDocument(docId: string) {
    if (!this.vectorStore) {
      this.updateStatus("❌ Vector Store not available");
      return;
    }

    try {
      const document = await this.vectorStore.getDocument(docId);
      if (!document) {
        this.updateStatus("❌ Document not found");
        return;
      }

      const blob = new Blob([document.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.title}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      this.updateStatus("✅ Document downloaded successfully");
    } catch (error) {
      console.error("Failed to download document:", error);
      this.updateStatus(
        "❌ Failed to download document: " + (error as Error).message
      );
    }
  }

  // Firecrawl Integration Methods
  openFirecrawlModal() {
    this.showFirecrawlModal = true;
    this.setShowFirecrawlModal?.(true);
  }

  closeFirecrawlModal() {
    this.showFirecrawlModal = false;
    this.setShowFirecrawlModal?.(false);
  }

  async scrapeUrl(url: string, apiKey: string) {
    if (!this.vectorStore) {
      this.updateStatus("❌ Vector Store not available");
      return;
    }

    if (!this.vectorStore.processingAvailable) {
      const status = this.vectorStore.processingStatus;
      if (this.vectorStore.downloadStatus === 'downloading') {
        this.updateStatus(`⏳ ${status} - Scraping will be available once download completes`);
      } else if (this.vectorStore.downloadStatus === 'error') {
        this.updateStatus("❌ AI model download failed - Document processing requires AI");
      } else {
        this.updateStatus("❌ Document processing not ready - Please wait or refresh the page");
      }
      return;
    }

    if (!url || !apiKey) {
      this.updateStatus("❌ Please provide both URL and API key");
      return;
    }

    if (this.isScrapingUrl) {
      this.updateStatus("⚠️ Scraping already in progress");
      return;
    }

    this.isScrapingUrl = true;
    this.setIsScrapingUrl?.(true);
    this.scrapingUrl = url;
    
    try {
      this.updateStatus("🔍 Starting Firecrawl scraping...");
      this.setScrapingProgress?.({ message: "Initializing Firecrawl...", progress: 10 });

      // Validate URL format
      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch (e) {
        throw new Error("Invalid URL format");
      }

      this.setScrapingProgress?.({ message: "Scraping content...", progress: 30 });

      // Call Firecrawl API
      const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: validUrl.toString(),
          pageOptions: {
            onlyMainContent: true,
            includeHtml: false,
            waitFor: 3000,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Firecrawl API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      this.setScrapingProgress?.({ message: "Processing scraped content...", progress: 60 });

      const data = await response.json();
      
      if (!data.data || !data.data.content) {
        throw new Error("No content extracted from the URL");
      }

      const content = data.data.content;
      const title = data.data.title || `Scraped from ${validUrl.hostname}`;
      const description = data.data.description || '';

      this.setScrapingProgress?.({ message: "Adding to Knowledge Base...", progress: 80 });

      // Create a virtual file-like object for the scraped content
      const scrapedFile = {
        name: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`,
        type: 'text/markdown',
        size: content.length,
        lastModified: Date.now(),
      };

      // Add to vector store
      await this.vectorStore.addDocument(
        scrapedFile as File,
        content,
        (progress) => {
          this.updateStatus(`📄 Processing scraped content: ${progress.message}`);
          this.setScrapingProgress?.({ 
            message: `Processing: ${progress.message}`, 
            progress: 80 + (progress.progress * 0.2) 
          });
        }
      );

      // Update document metadata to include Firecrawl source info
      const allDocs = await this.vectorStore.getAllDocuments();
      const newDoc = allDocs.find(doc => doc.title === title);
      if (newDoc) {
        // Use type assertion to add custom metadata properties
        (newDoc.metadata as any).originalUrl = validUrl.toString();
        (newDoc.metadata as any).scrapedAt = new Date().toISOString();
        (newDoc.metadata as any).firecrawlData = {
          url: validUrl.toString(),
          title: data.data.title,
          description: data.data.description,
          author: data.data.author,
          siteName: data.data.siteName,
          language: data.data.language,
        };
        newDoc.metadata.source = 'firecrawl';
        newDoc.metadata.description = description;
      }

      this.updateStatus(`✅ Successfully scraped and added "${title}" to Knowledge Base`);
      this.updateDocumentStatus();

      // Track successful scraping
      const pageAnalytics = (this as any).pageAnalytics;
      if (pageAnalytics) {
        pageAnalytics.trackFeatureUsage("firecrawl_scrape_success", {
          url: validUrl.toString(),
          domain: validUrl.hostname,
          content_length: content.length,
          title: title,
        });
      }

      // API key is managed by the UI component with remember option

      this.closeFirecrawlModal();

    } catch (error) {
      console.error("❌ Firecrawl scraping failed:", error);
      this.updateStatus(`❌ Scraping failed: ${(error as Error).message}`);
      
      // Track failed scraping
      const pageAnalytics = (this as any).pageAnalytics;
      if (pageAnalytics) {
        pageAnalytics.trackError("firecrawl_scrape_failed", (error as Error).message);
      }
    } finally {
      this.isScrapingUrl = false;
      this.setIsScrapingUrl?.(false);
      this.scrapingUrl = "";
      this.setScrapingProgress?.({ message: "", progress: 0 });
    }
  }

  // Simple encryption/decryption for API key storage
  private encryptApiKey(key: string): string {
    // Simple base64 encoding with a salt - not military grade but prevents casual access
    const salt = 'fc_key_2024_salt_protection';
    const combined = salt + key + salt;
    return btoa(combined);
  }

  private decryptApiKey(encryptedKey: string): string {
    try {
      const decoded = atob(encryptedKey);
      const salt = 'fc_key_2024_salt_protection';
      // Remove salt from both ends
      return decoded.slice(salt.length, -salt.length);
    } catch (error) {
      console.warn('Failed to decrypt API key, clearing saved key');
      this.clearFirecrawlApiKey();
      return '';
    }
  }

  // Load saved Firecrawl API key with decryption
  loadFirecrawlApiKey() {
    const savedKey = localStorage.getItem('firecrawl_api_key_encrypted');
    if (savedKey) {
      this.firecrawlApiKey = this.decryptApiKey(savedKey);
    }
  }

  // Save API key with encryption
  saveFirecrawlApiKey(key: string, remember: boolean = false) {
    if (remember && key.trim()) {
      const encrypted = this.encryptApiKey(key);
      localStorage.setItem('firecrawl_api_key_encrypted', encrypted);
      localStorage.setItem('firecrawl_api_key_remember', 'true');
      console.log('🔐 Firecrawl API key saved securely');
    } else {
      this.clearFirecrawlApiKey();
    }
    this.firecrawlApiKey = key;
  }

  // Clear saved API key
  clearFirecrawlApiKey() {
    localStorage.removeItem('firecrawl_api_key_encrypted');
    localStorage.removeItem('firecrawl_api_key_remember');
    this.firecrawlApiKey = '';
    console.log('🗑️ Firecrawl API key cleared');
  }

  // Check if API key is remembered
  isFirecrawlApiKeyRemembered(): boolean {
    return localStorage.getItem('firecrawl_api_key_remember') === 'true';
  }

  async searchDocuments(
    query: string,
    threshold: number = 0.3,
    limit: number = 20
  ) {
    if (!this.vectorStore) {
      this.updateStatus("❌ Vector Store not available");
      return [];
    }

    // Enhanced fallback messaging for search
    if (!this.vectorStore.processingAvailable) {
      const status = this.vectorStore.processingStatus;
      if (this.vectorStore.downloadStatus === 'downloading') {
        this.updateStatus(`⏳ ${status} - Search will be available once download completes`);
      } else if (this.vectorStore.downloadStatus === 'error') {
        this.updateStatus("❌ AI model download failed - Semantic search requires AI processing");
      } else {
        this.updateStatus("❌ Search not ready - Please wait or refresh the page");
      }
      return [];
    }

    if (!query.trim()) {
      this.updateStatus("❌ Please enter a search query");
      return [];
    }

    try {
      this.updateStatus("🔍 Searching documents...");
      const results = await this.vectorStore.searchSimilar(
        query,
        threshold,
        limit
      );

      console.log(
        "🔍 VectorStore search completed with",
        results.length,
        "results"
      );

      if (results.length === 0) {
        this.updateStatus("❌ No documents found matching your query");
        analytics.trackSearch(query, 0, "knowledge_base");
        return [];
      }

      this.updateStatus(`✅ Found ${results.length} relevant results`);
      // Track successful search
      analytics.trackSearch(query, results.length, "knowledge_base");
      return results;
    } catch (error) {
      console.error("Search failed:", error);
      this.updateStatus("❌ Search failed: " + (error as Error).message);
      // Track search error
      analytics.trackError(
        "search_error",
        (error as Error).message,
        "searchDocuments"
      );
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
      const totalSize = documents.reduce(
        (sum, doc) => sum + doc.metadata.filesize,
        0
      );

      this.setDocumentStatus?.({
        count: stats.documentCount,
        totalSize: totalSize,
        vectorCount: stats.vectorCount,
      });

      this.setDocuments?.(documents);
    } catch (error) {
      console.error("Failed to update document status:", error);
    }
  }

  exportResults() {
    const data = {
      topics: this.topics,
      researchResults: this.researchResults,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deepresearch_export_${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.updateStatus("✅ Research exported successfully");

    // Track export event
    analytics.trackExport("research_results", blob.size);
  }

  // TimeCapsule export - comprehensive data export including vector store
  async exportTimeCapsule() {
    try {
      this.updateStatus("📦 Preparing TimeCapsule export...");

      const timeCapsuleData = {
        metadata: {
          version: "4.0.0",
          exportedAt: new Date().toISOString(),
          platform: "Next.js",
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        },
        research: {
          topics: this.topics,
          researchResults: this.researchResults,
          currentTab: this.currentTab,
        },
        vectorStore: null as any,
        aiFramesData: null as any, // NEW: Include AI-Frames data if available
      };

      // Check for existing AI-Frames data and include it
      try {
        const existingAIFrames = localStorage.getItem("ai_frames_timecapsule");
        if (existingAIFrames) {
          const aiFramesData = JSON.parse(existingAIFrames);
          timeCapsuleData.aiFramesData = aiFramesData.data;
          this.updateStatus("🎥 Including AI-Frames data in export");
        }
      } catch (aiFramesError) {
        console.warn("⚠️ Could not include AI-Frames data:", aiFramesError);
      }

      // Export vector store data if available
      if (this.vectorStore) {
        try {
          const documents = await this.vectorStore.getAllDocuments();
          const stats = await this.vectorStore.getStats();

          timeCapsuleData.vectorStore = {
            documents: documents,
            stats: stats,
            exportedAt: new Date().toISOString(),
          };

          this.updateStatus("📊 Vector store data included in export");
        } catch (vectorError) {
          console.warn("⚠️ Could not export vector store data:", vectorError);
          this.updateStatus("⚠️ Research data exported without vector store");
        }
      }

      // Store large TimeCapsule data in IndexedDB to avoid localStorage quota issues
      if (this.vectorStore) {
        try {
          const timeCapsuleId = `timecapsule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Store TimeCapsule as a special document in VectorStore (IndexedDB)
          const timeCapsuleDoc = {
            id: timeCapsuleId,
            title: `TimeCapsule Export ${new Date().toLocaleDateString()}`,
            content: JSON.stringify(timeCapsuleData),
            metadata: {
              filename: `timecapsule_${new Date().toISOString().split("T")[0]}.json`,
              filesize: JSON.stringify(timeCapsuleData).length,
              filetype: 'application/json',
              uploadedAt: new Date().toISOString(),
              source: 'timecapsule_export',
              description: 'TimeCapsule export data stored in IndexedDB',
              isGenerated: true
            },
            chunks: [],
            vectors: []
          };

          await this.vectorStore.insertDocument(timeCapsuleDoc);
          
          // Save only minimal reference in localStorage
          const timeCapsuleRef = {
            id: timeCapsuleId,
            exportedAt: new Date().toISOString(),
            filename: timeCapsuleDoc.metadata.filename,
            fileSize: timeCapsuleDoc.metadata.filesize
          };
          
          localStorage.setItem("deepresearch_data", JSON.stringify({
            topics: this.topics,
            researchResults: this.researchResults,
            currentTab: this.currentTab
          }));
          localStorage.setItem("timecapsule_combined_ref", JSON.stringify(timeCapsuleRef));
          
          this.updateStatus("📊 TimeCapsule stored in IndexedDB");
        } catch (storageError) {
          console.warn("⚠️ Could not store in IndexedDB, using direct export:", storageError);
          // Fallback to direct export without storing in IndexedDB
        }
      }

      const blob = new Blob([JSON.stringify(timeCapsuleData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timecapsule_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const fileSize = blob.size;
      const hasAIFrames = !!timeCapsuleData.aiFramesData;
      
      this.updateStatus(
        `✅ TimeCapsule exported successfully (${Math.round(fileSize / 1024)}KB)${hasAIFrames ? ' - includes AI-Frames data' : ''}`
      );
    } catch (error) {
      console.error("❌ TimeCapsule export failed:", error);
      this.updateStatus(
        "❌ TimeCapsule export failed: " + (error as Error).message
      );
    }
  }

  // TimeCapsule import - restore from exported data
  async importTimeCapsule(file: File) {
    try {
      this.updateStatus("📦 Importing TimeCapsule...");

      const content = await this.readFileContent(file);
      const timeCapsuleData = JSON.parse(content);

      // Validate TimeCapsule format - support both DeepResearch and AI-Frames formats
      if (!timeCapsuleData.metadata && !timeCapsuleData.data) {
        throw new Error("Invalid TimeCapsule format");
      }

      // Handle AI-Frames TimeCapsule format
      if (timeCapsuleData.type === "ai-frames-timecapsule" && timeCapsuleData.data) {
        this.updateStatus("🎥 Detected AI-Frames TimeCapsule format...");
        
        // Extract AI-Frames data and convert to DeepResearch format
        const aiFramesData = timeCapsuleData.data;
        
        // Convert AI-Frames to research topics
        if (aiFramesData.frames && Array.isArray(aiFramesData.frames)) {
          const convertedTopics = aiFramesData.frames.map((frame: any, index: number) => ({
            id: frame.id || `frame-${index}`,
            title: frame.goal || `Frame ${index + 1}`,
            description: frame.description || frame.transcript || `Learning frame about ${frame.goal}`,
            selected: true,
            order: index,
            concepts: frame.aiConcepts || [],
            video: frame.video || null,
            timestamp: frame.timestamp || null,
          }));

          this.topics = convertedTopics;
          this.setTopics?.(this.topics);
          
          this.updateStatus(`📚 Converted ${convertedTopics.length} AI-Frames to research topics`);
        }

        // Import DeepResearch data if available
        if (aiFramesData.deepResearchData) {
          if (aiFramesData.deepResearchData.research) {
            if (aiFramesData.deepResearchData.research.topics) {
              this.topics = [...this.topics, ...aiFramesData.deepResearchData.research.topics];
              this.setTopics?.(this.topics);
            }
            
            if (aiFramesData.deepResearchData.research.researchResults) {
              this.researchResults = aiFramesData.deepResearchData.research.researchResults;
              this.setResearchResults?.(this.getCurrentResearchContent());
            }
          }
        }

        // Store AI-Frames data in IndexedDB instead of localStorage to avoid quota issues
        if (this.vectorStore) {
          try {
            const aiFramesId = `aiframes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const aiFramesDoc = {
              id: aiFramesId,
              title: `AI-Frames TimeCapsule ${new Date().toLocaleDateString()}`,
              content: JSON.stringify(timeCapsuleData),
              metadata: {
                filename: `ai_frames_timecapsule.json`,
                filesize: JSON.stringify(timeCapsuleData).length,
                filetype: 'application/json',
                uploadedAt: new Date().toISOString(),
                source: 'aiframes_import',
                description: 'AI-Frames TimeCapsule data stored in IndexedDB',
                isGenerated: true
              },
              chunks: [],
              vectors: []
            };

            await this.vectorStore.insertDocument(aiFramesDoc);
            
            // Store only minimal reference in localStorage
            localStorage.setItem("ai_frames_timecapsule_ref", JSON.stringify({
              id: aiFramesId,
              importedAt: new Date().toISOString()
            }));
            
            this.updateStatus("📊 AI-Frames data stored in IndexedDB");
          } catch (storageError) {
            console.warn("⚠️ Could not store AI-Frames in IndexedDB:", storageError);
            // Fallback to localStorage for small data only
            localStorage.setItem("ai_frames_timecapsule_ref", JSON.stringify({
              type: "legacy",
              importedAt: new Date().toISOString()
            }));
          }
        }

        this.saveToStorage();
        this.updateStatus("✅ AI-Frames TimeCapsule imported successfully - can now export as combined format");
        return;
      }

      // Handle traditional DeepResearch TimeCapsule format
      if (!timeCapsuleData.metadata || !timeCapsuleData.research) {
        throw new Error("Invalid DeepResearch TimeCapsule format");
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

      // Restore AI-Frames data if available in combined TimeCapsule
      if (timeCapsuleData.aiFramesData) {
        try {
          this.updateStatus("🎥 Restoring AI-Frames data...");
          
          if (this.vectorStore) {
            // Store in IndexedDB
            const aiFramesId = `aiframes_combined_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const aiFramesTimeCapsule = {
              version: "1.0",
              timestamp: new Date().toISOString(),
              type: "ai-frames-timecapsule",
              data: timeCapsuleData.aiFramesData,
            };
            
            const aiFramesDoc = {
              id: aiFramesId,
              title: `AI-Frames Combined Data ${new Date().toLocaleDateString()}`,
              content: JSON.stringify(aiFramesTimeCapsule),
              metadata: {
                filename: `ai_frames_combined.json`,
                filesize: JSON.stringify(aiFramesTimeCapsule).length,
                filetype: 'application/json',
                uploadedAt: new Date().toISOString(),
                source: 'aiframes_combined',
                description: 'AI-Frames combined data from TimeCapsule',
                isGenerated: true
              },
              chunks: [],
              vectors: []
            };

            await this.vectorStore.insertDocument(aiFramesDoc);
            
            // Store only reference in localStorage
            localStorage.setItem("ai_frames_timecapsule_ref", JSON.stringify({
              id: aiFramesId,
              importedAt: new Date().toISOString()
            }));
          }
          
          this.updateStatus("✅ AI-Frames data available for AI-Frames page");
        } catch (aiFramesError) {
          console.warn("⚠️ Could not restore AI-Frames data:", aiFramesError);
        }
      }

      // Restore vector store data
      if (timeCapsuleData.vectorStore && this.vectorStore) {
        try {
          this.updateStatus("📊 Restoring vector store data...");

          // Clear existing data
          await this.vectorStore.clear();

          // Import documents
          const documents = timeCapsuleData.vectorStore.documents || [];
          for (const doc of documents) {
            try {
              // Re-insert document into vector store
              await this.vectorStore.insertDocument(doc);
            } catch (docError) {
              console.warn(
                `⚠️ Could not restore document ${doc.id}:`,
                docError
              );
            }
          }

          this.updateDocumentStatus();
          this.updateStatus("✅ Vector store data restored");
        } catch (vectorError) {
          console.warn("⚠️ Could not restore vector store data:", vectorError);
          this.updateStatus("⚠️ Research data restored without vector store");
        }
      }

      // Store TimeCapsule data in IndexedDB instead of localStorage to avoid quota issues
      if (this.vectorStore) {
        try {
          const timeCapsuleId = `timecapsule_import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Store TimeCapsule as a special document in VectorStore (IndexedDB)
          const timeCapsuleDoc = {
            id: timeCapsuleId,
            title: `TimeCapsule Import ${new Date().toLocaleDateString()}`,
            content: JSON.stringify(timeCapsuleData),
            metadata: {
              filename: `imported_timecapsule.json`,
              filesize: JSON.stringify(timeCapsuleData).length,
              filetype: 'application/json',
              uploadedAt: new Date().toISOString(),
              source: 'timecapsule_import',
              description: 'TimeCapsule import data stored in IndexedDB',
              isGenerated: true
            },
            chunks: [],
            vectors: []
          };

          await this.vectorStore.insertDocument(timeCapsuleDoc);
          
          // Save only minimal reference in localStorage
          const timeCapsuleRef = {
            id: timeCapsuleId,
            importedAt: new Date().toISOString(),
            hasAIFrames: !!timeCapsuleData.aiFramesData
          };
          
          localStorage.setItem("timecapsule_combined_ref", JSON.stringify(timeCapsuleRef));
          
          this.updateStatus("📊 TimeCapsule stored in IndexedDB");
        } catch (storageError) {
          console.warn("⚠️ Could not store TimeCapsule in IndexedDB:", storageError);
          this.updateStatus("⚠️ TimeCapsule imported but not stored for cross-page compatibility");
        }
      }

      this.saveToStorage();
      
      const hasAIFrames = !!timeCapsuleData.aiFramesData;
      this.updateStatus(
        `✅ TimeCapsule imported successfully${hasAIFrames ? ' - AI-Frames data ready for AI-Frames page' : ''}`
      );
    } catch (error) {
      console.error("❌ TimeCapsule import failed:", error);
      this.updateStatus(
        "❌ TimeCapsule import failed: " + (error as Error).message
      );
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
      this.updateStatus("❌ Vector Store not available");
      return [];
    }

    try {
      const { query, threshold = 0.3, limit = 20 } = options;

      this.updateStatus("🔍 Performing advanced search...");
      console.log("🔍 Advanced search parameters:", options);

      const results = await this.vectorStore.searchSimilar(
        query,
        threshold,
        limit
      );

      // Apply additional filters if specified
      let filteredResults = results;

      if (options.documentTypes && options.documentTypes.length > 0) {
        filteredResults = filteredResults.filter((result) =>
          options.documentTypes!.includes(result.document.metadata.filetype)
        );
      }

      if (options.dateRange) {
        const { start, end } = options.dateRange;
        filteredResults = filteredResults.filter((result) => {
          const uploadDate = new Date(result.document.metadata.uploadedAt);
          return uploadDate >= start && uploadDate <= end;
        });
      }

      this.updateStatus(
        `✅ Advanced search completed: ${filteredResults.length} results`
      );
      return filteredResults;
    } catch (error) {
      console.error("❌ Advanced search failed:", error);
      this.updateStatus(
        "❌ Advanced search failed: " + (error as Error).message
      );
      return [];
    }
  }

  clearAll() {
    if (confirm("Are you sure you want to clear all research data?")) {
      this.topics = [];
      this.researchResults = {};
      this.setTopics?.([]);
      this.setResearchResults?.("");
      this.saveToStorage();
      this.updateStatus("🧹 All data cleared");
    }
  }

  saveToStorage() {
    try {
      const data = {
        topics: this.topics,
        researchResults: this.researchResults,
        aiConnection: {
          provider: this.aiAssistant?.getSession()?.provider || "ollama",
          connected: this.aiAssistant?.isConnected() || false,
          model: this.aiAssistant?.getSession()?.model || null,
          baseURL:
            this.aiAssistant?.getSession()?.baseURL || this.selectedOllamaURL,
          ollamaURL: this.selectedOllamaURL,
        },
      };
      
      const dataString = JSON.stringify(data);
      const dataSize = dataString.length;
      
      // Check if data is getting too large (> 2MB)
      if (dataSize > 2 * 1024 * 1024) {
        console.warn(`⚠️ Research data is large (${Math.round(dataSize / 1024)}KB), considering IndexedDB storage`);
        
        // Try to store in IndexedDB if VectorStore is available
        if (this.vectorStore) {
          this.saveToIndexedDB(data).then(() => {
            // Store only minimal data in localStorage
            const minimalData = {
              topics: this.topics,
              researchResults: { current: this.researchResults.current || "" }, // Only current research
              aiConnection: data.aiConnection,
              _storedInIndexedDB: true,
              _lastSaved: new Date().toISOString()
            };
            localStorage.setItem("deepresearch_data", JSON.stringify(minimalData));
            console.log("💾 Large data moved to IndexedDB, minimal data saved to localStorage");
          }).catch((indexedDBError) => {
            console.warn("⚠️ Failed to store in IndexedDB, trying localStorage with reduced data:", indexedDBError);
            this.saveReducedToLocalStorage(data);
          });
          return;
        } else {
          // Fallback: store reduced data in localStorage
          this.saveReducedToLocalStorage(data);
          return;
        }
      }
      
      // Try normal localStorage save
      localStorage.setItem("deepresearch_data", dataString);
      console.log("💾 Saved state to localStorage:", data.aiConnection);
      
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.error("❌ localStorage quota exceeded, trying IndexedDB storage");
        this.handleQuotaExceeded();
      } else {
        console.error("Failed to save to storage:", error);
      }
    }
  }

  private async saveToIndexedDB(data: any) {
    if (!this.vectorStore) {
      throw new Error("VectorStore not available");
    }
    
    const researchId = `research_state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const researchDoc = {
      id: researchId,
      title: `Research State ${new Date().toLocaleDateString()}`,
      content: JSON.stringify(data),
      metadata: {
        filename: `research_state.json`,
        filesize: JSON.stringify(data).length,
        filetype: 'application/json',
        uploadedAt: new Date().toISOString(),
        source: 'research_state',
        description: 'DeepResearch state data stored in IndexedDB',
        isGenerated: true
      },
      chunks: [],
      vectors: []
    };

    await this.vectorStore.insertDocument(researchDoc);
    
    // Store reference in localStorage
    localStorage.setItem("deepresearch_state_ref", JSON.stringify({
      id: researchId,
      savedAt: new Date().toISOString()
    }));
  }

  private saveReducedToLocalStorage(originalData: any) {
    try {
      // Save only essential data to localStorage
      const reducedData = {
        topics: this.topics,
        researchResults: { 
          current: this.researchResults.current || "",
          // Keep only the last 3 research items to reduce size
          ...Object.fromEntries(
            Object.entries(this.researchResults)
              .filter(([key, value]) => key !== 'current' && typeof value === 'object')
              .slice(-3)
          )
        },
        aiConnection: originalData.aiConnection,
        _reducedStorage: true,
        _lastSaved: new Date().toISOString()
      };
      
      localStorage.setItem("deepresearch_data", JSON.stringify(reducedData));
      console.log("💾 Saved reduced data to localStorage due to size constraints");
      
    } catch (reduceError) {
      console.error("❌ Failed to save even reduced data:", reduceError);
      // Last resort: save only connection state
      try {
        localStorage.setItem("deepresearch_data", JSON.stringify({
          topics: [],
          researchResults: {},
          aiConnection: originalData.aiConnection,
          _emergencyMode: true
        }));
        console.log("🚨 Emergency save: only connection state preserved");
      } catch (emergencyError) {
        console.error("❌ Complete localStorage failure:", emergencyError);
      }
    }
  }

  private handleQuotaExceeded() {
    console.log("🧹 Handling localStorage quota exceeded...");
    
    // Clear old TimeCapsule references that might be taking space
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('timecapsule') || key.includes('ai_frames')) {
          console.log(`🗑️ Removing old reference: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      // Try saving again with minimal data
      this.saveReducedToLocalStorage({
        topics: this.topics,
        researchResults: this.researchResults,
        aiConnection: {
          provider: this.aiAssistant?.getSession()?.provider || "ollama",
          connected: this.aiAssistant?.isConnected() || false,
          model: this.aiAssistant?.getSession()?.model || null,
          baseURL: this.aiAssistant?.getSession()?.baseURL || this.selectedOllamaURL,
          ollamaURL: this.selectedOllamaURL,
        }
      });
      
    } catch (cleanupError) {
      console.error("❌ Failed to clean up localStorage:", cleanupError);
    }
  }

  loadBasicDataFromStorage() {
    try {
      const data = localStorage.getItem("deepresearch_data");
      if (data) {
        const parsed = JSON.parse(data);
        this.topics = parsed.topics || [];
        this.researchResults = parsed.researchResults || {};

        // Update React state if setters are available
        this.setTopics?.(this.topics);
        this.setResearchResults?.(this.getCurrentResearchContent());

        console.log("📋 Loaded basic data from storage:", {
          topics: this.topics.length,
          hasResearchResults: Object.keys(this.researchResults).length > 0,
        });
      }
    } catch (error) {
      console.error("Failed to load basic data from storage:", error);
    }
  }

  loadAIConnectionFromStorage() {
    try {
      const data = localStorage.getItem("deepresearch_data");
      if (data) {
        const parsed = JSON.parse(data);

        // Restore AI connection state
        if (parsed.aiConnection) {
          console.log(
            "🔄 Loading AI connection state from storage:",
            parsed.aiConnection
          );
          this.restoreAIConnection(parsed.aiConnection);
        } else {
          console.log("📋 No saved AI connection state found");
        }
      }
    } catch (error) {
      console.error("Failed to load AI connection from storage:", error);
    }
  }

  // Legacy method for backward compatibility
  loadFromStorage() {
    this.loadBasicDataFromStorage();
    this.loadAIConnectionFromStorage();
  }

  private getCurrentResearchContent(): string {
    const current = this.researchResults["current"];
    if (typeof current === "string") {
      return current;
    }
    return "";
  }

  getResearchHistory(): ResearchItem[] {
    const history: ResearchItem[] = [];

    for (const [key, value] of Object.entries(this.researchResults)) {
      if (
        key !== "current" &&
        key !== "currentMetadata" &&
        typeof value === "object" &&
        "content" in value
      ) {
        history.push(value as ResearchItem);
      }
    }

    // Sort by timestamp (newest first)
    return history.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  loadResearchFromHistory(researchId: string) {
    const research = this.researchResults[researchId];
    if (research && typeof research === "object" && "content" in research) {
      const researchItem = research as ResearchItem;
      this.researchResults["current"] = researchItem.content;
      this.researchResults["currentMetadata"] = researchItem.metadata;
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
        provider: savedConnection.provider || "ollama",
        model: undefined,
        baseURL: undefined,
      };
      this.setAIStatus?.(initialStatus);

      // If it was previously connected, attempt to reconnect
      if (savedConnection.connected && savedConnection.model) {
        console.log(
          `🔄 Attempting to restore connection to ${savedConnection.provider} with model ${savedConnection.model}`
        );
        this.updateStatus(
          `🔄 Restoring AI connection to ${savedConnection.model}...`
        );

        if (savedConnection.provider === "ollama") {
          const baseURL =
            savedConnection.baseURL ||
            savedConnection.ollamaURL ||
            this.selectedOllamaURL;
          const success = await this.aiAssistant.connectToOllama(
            baseURL,
            savedConnection.model
          );

          if (success) {
            console.log("✅ AI connection restored successfully");
            this.updateStatus(
              `✅ AI connection restored: ${savedConnection.model}`
            );
          } else {
            console.log(
              "⚠️ Failed to restore AI connection - model may no longer be available"
            );
            this.updateStatus(
              `⚠️ Could not restore AI connection to ${savedConnection.model}`
            );
          }
        }
      } else {
        console.log(
          "📋 AI was not previously connected, showing disconnected state"
        );
        this.updateStatus(
          `🤖 AI ready to connect (${savedConnection.provider})`
        );
      }
    } catch (error) {
      console.error("❌ Failed to restore AI connection:", error);
      this.updateStatus(
        `❌ Failed to restore AI connection: ${(error as Error).message}`
      );
    }
  }

  // =============================================================================
  // METADATA MANAGEMENT HANDLERS
  // =============================================================================

  openBubblSpaceDialog(bubblSpace?: BubblSpace) {
    this.editingBubblSpace = bubblSpace || null;
    this.showBubblSpaceDialog = true;
    this.setEditingBubblSpace?.(this.editingBubblSpace);
    this.setShowBubblSpaceDialog?.(true);
  }

  closeBubblSpaceDialog() {
    this.showBubblSpaceDialog = false;
    this.editingBubblSpace = null;
    this.setShowBubblSpaceDialog?.(false);
    this.setEditingBubblSpace?.(null);
  }

  async saveBubblSpace(name: string, description: string, options: Partial<BubblSpace> = {}) {
    if (!this.metadataManager) return;

    try {
      console.log(`🔄 DeepResearch.saveBubblSpace called:`, { name, description, options, editingBubblSpace: this.editingBubblSpace?.id });
      
      let bubblSpace: BubblSpace;
      
      if (this.editingBubblSpace) {
        // Update existing
        console.log(`🔄 Updating existing BubblSpace: ${this.editingBubblSpace.id}`);
        bubblSpace = this.metadataManager.updateBubblSpace(this.editingBubblSpace.id, {
          name,
          description,
          ...options,
        });
        this.updateStatus(`✅ Updated BubblSpace: ${name}`);
      } else {
        // Create new
        console.log(`🔄 Creating new BubblSpace`);
        bubblSpace = this.metadataManager.createBubblSpace(name, description, options);
        this.updateStatus(`✅ Created BubblSpace: ${name}`);
      }

      console.log(`✅ BubblSpace operation completed, refreshing data...`);
      // Refresh data
      await this.loadMetadata();
      this.closeBubblSpaceDialog();
    } catch (error) {
      console.error('❌ Failed to save BubblSpace:', error);
      this.updateStatus(`❌ Failed to save BubblSpace: ${(error as Error).message}`);
    }
  }

  async deleteBubblSpace(id: string) {
    if (!this.metadataManager) return;

    try {
      const success = this.metadataManager.deleteBubblSpace(id);
      if (success) {
        await this.loadMetadata();
        this.updateStatus('✅ BubblSpace deleted');
      }
    } catch (error) {
      console.error('Failed to delete BubblSpace:', error);
      this.updateStatus(`❌ Failed to delete BubblSpace: ${(error as Error).message}`);
    }
  }

  selectBubblSpace(bubblSpace: BubblSpace) {
    this.currentBubblSpace = bubblSpace;
    this.setCurrentBubblSpace?.(bubblSpace);
    
    // Set as default
    if (this.metadataManager) {
      this.metadataManager.setDefaultBubblSpace(bubblSpace.id);
    }

    // Load most recent TimeCapsule for this BubblSpace
    if (this.metadataManager) {
      const timeCapsules = this.metadataManager
        .getTimeCapsulesByBubblSpace(bubblSpace.id)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      if (timeCapsules.length > 0) {
        this.currentTimeCapsule = timeCapsules[0];
        this.setCurrentTimeCapsule?.(this.currentTimeCapsule);
      } else {
        this.currentTimeCapsule = null;
        this.setCurrentTimeCapsule?.(null);
      }
    }

    this.updateStatus(`📦 Switched to BubblSpace: ${bubblSpace.name}`);
  }

  openTimeCapsuleDialog(timeCapsule?: TimeCapsuleMetadata) {
    this.editingTimeCapsule = timeCapsule || null;
    this.showTimeCapsuleDialog = true;
    this.setEditingTimeCapsule?.(this.editingTimeCapsule);
    this.setShowTimeCapsuleDialog?.(true);
  }

  closeTimeCapsuleDialog() {
    this.showTimeCapsuleDialog = false;
    this.editingTimeCapsule = null;
    this.setShowTimeCapsuleDialog?.(false);
    this.setEditingTimeCapsule?.(null);
  }

  async saveTimeCapsule(
    name: string,
    description: string,
    bubblSpaceId: string,
    options: Partial<TimeCapsuleMetadata> = {}
  ) {
    if (!this.metadataManager) return;

    try {
      console.log(`🔄 DeepResearch.saveTimeCapsule called:`, { 
        name, 
        description, 
        bubblSpaceId, 
        options, 
        editingTimeCapsule: this.editingTimeCapsule?.id 
      });
      
      let timeCapsule: TimeCapsuleMetadata;
      
      if (this.editingTimeCapsule) {
        // Update existing
        console.log(`🔄 Updating existing TimeCapsule: ${this.editingTimeCapsule.id}`);
        timeCapsule = this.metadataManager.updateTimeCapsule(this.editingTimeCapsule.id, {
          name,
          description,
          bubblSpaceId,
          ...options,
        });
        
        // Immediately update current TimeCapsule if it's the one being edited
        if (this.currentTimeCapsule?.id === this.editingTimeCapsule.id) {
          console.log(`🔄 Updating current TimeCapsule in DeepResearch UI`);
          this.currentTimeCapsule = timeCapsule;
          this.setCurrentTimeCapsule?.(timeCapsule);
        }
        
        this.updateStatus(`✅ Updated TimeCapsule: ${name}`);
      } else {
        // Create new
        console.log(`🔄 Creating new TimeCapsule`);
        timeCapsule = this.metadataManager.createTimeCapsule(name, description, bubblSpaceId, options);
        this.updateStatus(`✅ Created TimeCapsule: ${name}`);
      }

      // Set as current if newly created or if no current TimeCapsule
      if (!this.editingTimeCapsule || !this.currentTimeCapsule) {
        this.currentTimeCapsule = timeCapsule;
        this.setCurrentTimeCapsule?.(timeCapsule);
      }

      console.log(`✅ TimeCapsule operation completed, refreshing data...`);
      // Refresh data
      await this.loadMetadata();
      this.closeTimeCapsuleDialog();
    } catch (error) {
      console.error('❌ Failed to save TimeCapsule:', error);
      this.updateStatus(`❌ Failed to save TimeCapsule: ${(error as Error).message}`);
    }
  }

  async deleteTimeCapsule(id: string) {
    if (!this.metadataManager) return;

    try {
      const success = this.metadataManager.deleteTimeCapsule(id);
      if (success) {
        if (this.currentTimeCapsule?.id === id) {
          this.currentTimeCapsule = null;
          this.setCurrentTimeCapsule?.(null);
        }
        await this.loadMetadata();
        this.updateStatus('✅ TimeCapsule deleted');
      }
    } catch (error) {
      console.error('Failed to delete TimeCapsule:', error);
      this.updateStatus(`❌ Failed to delete TimeCapsule: ${(error as Error).message}`);
    }
  }

  selectTimeCapsule(timeCapsule: TimeCapsuleMetadata) {
    this.currentTimeCapsule = timeCapsule;
    this.setCurrentTimeCapsule?.(timeCapsule);
    this.updateStatus(`🕰️ Switched to TimeCapsule: ${timeCapsule.name}`);
  }

  openSafeImportDialog(file: File) {
    this.importFile = file;
    this.showSafeImportDialog = true;
    this.setShowSafeImportDialog?.(true);
  }

  closeSafeImportDialog() {
    this.showSafeImportDialog = false;
    this.importFile = null;
    this.setShowSafeImportDialog?.(false);
  }

  async performSafeImport(options: ImportOptions): Promise<ImportResult> {
    if (!this.metadataManager || !this.importFile) {
      throw new Error('No metadata manager or import file available');
    }

    try {
      const content = await this.readFileContent(this.importFile);
      const data: EnhancedTimeCapsule = JSON.parse(content);

      const result = await this.metadataManager.importTimeCapsule(data, options);
      
      if (result.success) {
        await this.loadMetadata();
        this.updateStatus(`✅ Import completed successfully`);
      } else {
        this.updateStatus(`⚠️ Import completed with warnings`);
      }

      this.closeSafeImportDialog();
      return result;
    } catch (error) {
      console.error('Safe import failed:', error);
      this.updateStatus(`❌ Import failed: ${(error as Error).message}`);
      throw error;
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
  html = html.replace(
    /^#{6}\s(.+)$/gm,
    '<h6 style="color: #4facfe; margin: 20px 0 10px 0; font-weight: 600; font-size: 14px;">$1</h6>'
  );
  html = html.replace(
    /^#{5}\s(.+)$/gm,
    '<h5 style="color: #4facfe; margin: 20px 0 10px 0; font-weight: 600; font-size: 16px;">$1</h5>'
  );
  html = html.replace(
    /^#{4}\s(.+)$/gm,
    '<h4 style="color: #4facfe; margin: 20px 0 10px 0; font-weight: 600; font-size: 18px;">$1</h4>'
  );
  html = html.replace(
    /^#{3}\s(.+)$/gm,
    '<h3 style="color: #4facfe; margin: 25px 0 15px 0; font-weight: 700; font-size: 20px;">$1</h3>'
  );
  html = html.replace(
    /^#{2}\s(.+)$/gm,
    '<h2 style="color: #00f2fe; margin: 30px 0 20px 0; font-weight: 700; font-size: 24px;">$1</h2>'
  );
  html = html.replace(
    /^#{1}\s(.+)$/gm,
    '<h1 style="color: #00f2fe; margin: 30px 0 20px 0; font-weight: 800; font-size: 28px; border-bottom: 2px solid rgba(79, 172, 254, 0.3); padding-bottom: 10px;">$1</h1>'
  );

  // Convert bold text
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<strong style="color: #4facfe; font-weight: 600;">$1</strong>'
  );

  // Convert italic text
  html = html.replace(
    /\*(.+?)\*/g,
    '<em style="color: rgba(255, 255, 255, 0.8); font-style: italic;">$1</em>'
  );

  // Convert unordered lists
  html = html.replace(
    /^[\s]*[-*+]\s(.+)$/gm,
    '<li style="margin: 5px 0; color: rgba(255, 255, 255, 0.9);">$1</li>'
  );

  // Convert ordered lists
  html = html.replace(
    /^[\s]*\d+\.\s(.+)$/gm,
    '<li style="margin: 5px 0; color: rgba(255, 255, 255, 0.9);">$1</li>'
  );

  // Wrap consecutive list items in ul/ol tags
  html = html.replace(/(<li[^>]*>.*?<\/li>[\s\S]*?)+/g, (match) => {
    if (match.includes("- ") || match.includes("* ") || match.includes("+ ")) {
      return `<ul style="margin: 15px 0; padding-left: 20px; list-style-type: disc;">${match}</ul>`;
    } else {
      return `<ol style="margin: 15px 0; padding-left: 20px; list-style-type: decimal;">${match}</ol>`;
    }
  });

  // Convert code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```/g, "").trim();
    return `<pre style="background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 15px; margin: 15px 0; overflow-x: auto; font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; color: #a8f7a8;"><code>${code}</code></pre>`;
  });

  // Convert inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 2px 6px; font-family: Monaco, Menlo, monospace; font-size: 12px; color: #a8f7a8;">$1</code>'
  );

  // Convert line breaks
  html = html.replace(
    /\n\n/g,
    '</p><p style="margin: 15px 0; color: rgba(255, 255, 255, 0.9); line-height: 1.8;">'
  );
  html = html.replace(/\n/g, "<br/>");

  // Wrap in paragraph tags
  html = `<p style="margin: 15px 0; color: rgba(255, 255, 255, 0.9); line-height: 1.8;">${html}</p>`;

  // Convert blockquotes
  html = html.replace(
    /^>\s(.+)$/gm,
    '<blockquote style="border-left: 4px solid #4facfe; margin: 20px 0; padding: 15px 20px; background: rgba(79, 172, 254, 0.1); color: rgba(255, 255, 255, 0.8); font-style: italic;">$1</blockquote>'
  );

  // Convert tables (basic support)
  html = html.replace(/\|(.+?)\|/g, (match) => {
    const cells = match.split("|").filter((cell) => cell.trim());
    const tableCells = cells
      .map(
        (cell) =>
          `<td style="padding: 8px 12px; border: 1px solid rgba(255, 255, 255, 0.2);">${cell.trim()}</td>`
      )
      .join("");
    return `<tr>${tableCells}</tr>`;
  });

  // Simple table wrapping
  if (html.includes("<tr>")) {
    html = html.replace(
      /(<tr>.*?<\/tr>)/g,
      '<table style="border-collapse: collapse; margin: 20px 0; width: 100%;">$1</table>'
    );
  }

  return html;
}

// Client-only time component to avoid hydration issues
function ClientOnlyTime() {
  const [currentTime, setCurrentTime] = useState<string>("");
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
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
        --:--:--
      </div>
    );
  }

  return (
    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
      {currentTime}
    </div>
  );
}

// React Component Hook
export function DeepResearchComponent() {
  // Initialize page analytics for fine-grained tracking
  const pageAnalytics = usePageAnalytics(
    "DeepResearch-TimeCapsule",
    "research"
  );

  // Get VectorStore from provider
  const {
    vectorStore,
    isInitialized: vectorStoreInitialized,
    isInitializing: vectorStoreInitializing,
    error: vectorStoreError,
    processingAvailable,
    processingStatus,
    downloadProgress,
    stats: vectorStoreStats
  } = useVectorStore();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [aiStatus, setAIStatus] = useState<AIConnectionStatus>({
    connected: false,
    provider: "ollama",
  });
  const [researchType, setResearchType] = useState<ResearchType>("learning");
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>("overview");
  const [researchResults, setResearchResults] = useState<string>("");
  const [currentTab, setCurrentTab] = useState<
    "research" | "sources" | "notes"
  >("research");
  const [statusMessage, setStatusMessage] = useState<string>(
    "🚀 DeepResearch TimeCapsule ready"
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [documentStatus, setDocumentStatus] = useState({
    count: 0,
    totalSize: 0,
    vectorCount: 0,
  });
  const [showDocumentManager, setShowDocumentManager] =
    useState<boolean>(false);
  const [isVectorStoreLoading, setIsVectorStoreLoading] =
    useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchThreshold, setSearchThreshold] = useState<number>(0.1);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>("");
  const [previewDocument, setPreviewDocument] = useState<DocumentData | null>(
    null
  );
  const [showDocumentPreview, setShowDocumentPreview] =
    useState<boolean>(false);
  const [showChunkView, setShowChunkView] = useState<boolean>(false);
  const [currentChunk, setCurrentChunk] = useState<any>(null);
  const [showAddTopicModal, setShowAddTopicModal] = useState<boolean>(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string>("");
  const [newTopicDescription, setNewTopicDescription] = useState<string>("");

  // Document processing progress states
  const [isProcessingDocuments, setIsProcessingDocuments] =
    useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<{
    currentFile: string;
    progress: number;
    message: string;
    fileIndex: number;
    totalFiles: number;
  } | null>(null);

  // AI Connection Modal States
  const [showOllamaConnectionModal, setShowOllamaConnectionModal] =
    useState<boolean>(false);
  const [showModelSelectionModal, setShowModelSelectionModal] =
    useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedOllamaURL, setSelectedOllamaURL] = useState<string>(
    "http://localhost:11434"
  );

  // Metadata Management States
  const [currentBubblSpace, setCurrentBubblSpace] = useState<BubblSpace | null>(null);
  const [currentTimeCapsule, setCurrentTimeCapsule] = useState<TimeCapsuleMetadata | null>(null);
  const [showBubblSpaceDialog, setShowBubblSpaceDialog] = useState<boolean>(false);
  const [showTimeCapsuleDialog, setShowTimeCapsuleDialog] = useState<boolean>(false);
  const [showSafeImportDialog, setShowSafeImportDialog] = useState<boolean>(false);
  const [bubblSpaces, setBubblSpaces] = useState<BubblSpace[]>([]);
  const [timeCapsules, setTimeCapsules] = useState<TimeCapsuleMetadata[]>([]);
  const [editingBubblSpace, setEditingBubblSpace] = useState<BubblSpace | null>(null);
  const [editingTimeCapsule, setEditingTimeCapsule] = useState<TimeCapsuleMetadata | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState<boolean>(false);

  // Firecrawl States
  const [showFirecrawlModal, setShowFirecrawlModal] = useState<boolean>(false);
  const [isScrapingUrl, setIsScrapingUrl] = useState<boolean>(false);
  const [scrapingProgress, setScrapingProgress] = useState<{ message: string; progress: number }>({ message: "", progress: 0 });

  // Agent Progress States
  const [currentAgentProgress, setCurrentAgentProgress] = useState<AgentProgress | null>(null);
  const [showAgentProgress, setShowAgentProgress] = useState<boolean>(false);

  // Document Manager States
  const [documentManagerTab, setDocumentManagerTab] = useState<string>("user");
  const [documentSearchQuery, setDocumentSearchQuery] = useState<string>("");

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

    // Set metadata management setters
    app.setCurrentBubblSpace = setCurrentBubblSpace;
    app.setCurrentTimeCapsule = setCurrentTimeCapsule;
    app.setShowBubblSpaceDialog = setShowBubblSpaceDialog;
    app.setShowTimeCapsuleDialog = setShowTimeCapsuleDialog;
    app.setShowSafeImportDialog = setShowSafeImportDialog;
    app.setBubblSpaces = setBubblSpaces;
    app.setTimeCapsules = setTimeCapsules;
    app.setEditingBubblSpace = setEditingBubblSpace;
    app.setEditingTimeCapsule = setEditingTimeCapsule;
    app.setIsMetadataLoading = setIsMetadataLoading;

    // Set Firecrawl setters
    app.setShowFirecrawlModal = setShowFirecrawlModal;
    app.setIsScrapingUrl = setIsScrapingUrl;
    app.setScrapingProgress = setScrapingProgress;

    // Set Agent Progress setters
    app.setCurrentAgentProgress = setCurrentAgentProgress;
    app.setShowAgentProgress = setShowAgentProgress;

    // Initialize the app asynchronously (non-blocking)
    app.init();

    // Set analytics for the app instance
    (app as any).pageAnalytics = pageAnalytics;
  }, []);

  // Update app when VectorStore from provider becomes available
  useEffect(() => {
    const app = appRef.current;
    if (app && vectorStore) {
      console.log('🔗 Connecting DeepResearch to VectorStoreProvider...');
      app.vectorStore = vectorStore;
      
      // Update loading state based on provider state
      app.isVectorStoreLoading = !vectorStoreInitialized;
      app.setIsVectorStoreLoading?.(!vectorStoreInitialized);
      
      // Update document status
      app.updateDocumentStatus();
      
      // Initialize AgentCoordinator with VectorStore if AI is connected
      if (app.agentCoordinator && app.aiAssistant && !app.agentCoordinator.isCurrentlyProcessing()) {
        console.log('🔄 Updating AgentCoordinator with VectorStore...');
        app.agentCoordinator = new AgentCoordinator(app.aiAssistant, vectorStore);
        app.agentCoordinator.setProgressCallback((progress) => {
          app.currentAgentProgress = progress;
          app.setCurrentAgentProgress?.(progress);
          
          // Update status message with current agent activity
          const activeTasks = progress.tasks.filter(t => t.status === 'in_progress');
          if (activeTasks.length > 0) {
            const activeTask = activeTasks[0];
            app.updateStatus(`🤖 ${activeTask.taskName}... (${activeTask.progress || 0}%)`);
          }
        });
      }
      
      console.log('✅ DeepResearch connected to VectorStoreProvider');
    }
  }, [vectorStore, vectorStoreInitialized]);

  // Update status message based on VectorStore provider state
  useEffect(() => {
    const app = appRef.current;
    if (app) {
      if (vectorStoreError) {
        app.updateStatus(`❌ VectorStore error: ${vectorStoreError}`);
      } else if (vectorStoreInitializing) {
        app.updateStatus('🚀 Initializing VectorStore...');
      } else if (!vectorStoreInitialized) {
        app.updateStatus('⏳ Waiting for VectorStore...');
      } else if (processingStatus) {
        app.updateStatus(processingStatus);
      }
    }
  }, [vectorStoreError, vectorStoreInitializing, vectorStoreInitialized, processingStatus]);

  // Listen for metadata changes from other pages (like AI-Frames) + Auto-sync
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const handleMetadataStorageChange = (event: StorageEvent) => {
      if (event.key === 'bubblspaces_metadata' || event.key === 'timecapsules_metadata') {
        console.log('🔄 Metadata changed in another page, refreshing DeepResearch...');
        // Reload metadata from localStorage
        setTimeout(() => {
          app.loadMetadata?.();
        }, 100); // Small delay to ensure storage write is complete
      }
    };

    const handleBubblSpaceChange = (event: CustomEvent) => {
      console.log('🔄 BubblSpace changed in same page, refreshing DeepResearch...', event.detail);
      setTimeout(() => {
        console.log('🔄 Calling app.loadMetadata from event handler...');
        app.loadMetadata?.();
      }, 50);
    };

    const handleTimeCapsuleChange = (event: CustomEvent) => {
      console.log('🔄 TimeCapsule changed in same page, refreshing DeepResearch...');
      setTimeout(() => {
        app.loadMetadata?.();
      }, 50);
    };

    // AUTO-SYNC: Sync metadata to Knowledge Base every 30 seconds
    const autoSyncInterval = setInterval(() => {
      if (app && app.metadataManager && app.vectorStore && app.vectorStore.initialized) {
        console.log('🔄 Auto-sync: Syncing DeepResearch metadata to Knowledge Base...');
        
        const bubblSpaces = app.metadataManager.getAllBubblSpaces();
        const timeCapsules = app.metadataManager.getAllTimeCapsules();
        
        app.metadataManager.saveMetadataToVectorStore(bubblSpaces, timeCapsules)
          .then(() => {
            console.log('✅ Auto-sync: DeepResearch metadata synced successfully');
          })
          .catch((error: any) => {
            console.warn('⚠️ Auto-sync: Failed to sync DeepResearch metadata:', error.message);
          });
      } else {
        console.log('⏳ Auto-sync: Waiting for DeepResearch metadata manager and vector store...');
      }
    }, 30000); // 30 seconds

    // Listen for storage events from other pages
    window.addEventListener('storage', handleMetadataStorageChange);
    
    // Listen for custom events from same page
    window.addEventListener('bubblspace-metadata-changed', handleBubblSpaceChange as EventListener);
    window.addEventListener('timecapsule-metadata-changed', handleTimeCapsuleChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleMetadataStorageChange);
      window.removeEventListener('bubblspace-metadata-changed', handleBubblSpaceChange as EventListener);
      window.removeEventListener('timecapsule-metadata-changed', handleTimeCapsuleChange as EventListener);
      
      // Clear auto-sync interval
      clearInterval(autoSyncInterval);
      console.log('🛑 Auto-sync: DeepResearch auto-sync stopped');
    };
  }, []);

  const app = appRef.current!; // Non-null assertion since we create it immediately in useEffect

  const handleSearch = async () => {
    if (!app || !searchQuery.trim()) {
      return;
    }

    // Track search start
    pageAnalytics.trackFeatureUsage("document_search_started", {
      search_query: searchQuery,
      search_threshold: searchThreshold,
      query_length: searchQuery.length,
      has_documents: documentStatus.count > 0,
      document_count: documentStatus.count,
    });

    setIsSearching(true);
    try {
      const results = await app.searchDocuments(
        searchQuery,
        searchThreshold,
        20
      );
      setSearchResults(results);
      console.log("Search completed, results:", results.length);

      // Track search completion
      pageAnalytics.trackFeatureUsage("document_search_completed", {
        search_query: searchQuery,
        search_threshold: searchThreshold,
        results_found: results.length,
        search_successful: results.length > 0,
        average_similarity:
          results.length > 0
            ? results.reduce((sum, r) => sum + (r.similarity || 0), 0) /
              results.length
            : 0,
      });

      if (results.length > 0) {
        setCurrentSearchQuery(searchQuery);
        setShowSearchResults(true);
        setShowDocumentManager(false); // Close document manager when showing search results
        console.log(
          "Opening search results modal with",
          results.length,
          "results"
        );
      }
    } catch (error) {
      console.error("Search failed:", error);
      app.updateStatus("❌ Search failed: " + (error as Error).message);
      setSearchResults([]);

      // Track search error
      pageAnalytics.trackError(
        "document_search_failed",
        error instanceof Error ? error.message : "Unknown search error"
      );
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
    setCurrentSearchQuery("");
  };

  const closeDocumentPreview = () => {
    setShowDocumentPreview(false);
    setPreviewDocument(null);
  };

  const handleViewChunk = (searchResult: any, document: DocumentData) => {
    console.log("🔍 handleViewChunk called with:", { searchResult, document });
    console.log("🔍 SearchResult structure:", Object.keys(searchResult || {}));
    console.log("🔍 SearchResult.chunk:", searchResult?.chunk);
    console.log("🔍 SearchResult.chunk.content:", searchResult?.chunk?.content);

    // Extract content from the correct structure (SearchResult.chunk.content)
    const chunkData = {
      content: searchResult?.chunk?.content || "No content available",
      similarity: searchResult?.similarity || 0,
      chunkIndex: searchResult?.chunk?.id || "unknown",
      documentId: searchResult?.document?.id || "unknown",
      document: searchResult?.document ||
        document || { title: "Unknown Document" },
    };

    console.log("🔍 Viewing chunk from:", chunkData.document?.title);
    setCurrentChunk(chunkData);
    setShowChunkView(true);
  };

  const closeChunkView = () => {
    setShowChunkView(false);
    setCurrentChunk(null);
  };

  // Document categorization functions
  const categorizeDocuments = (docs: DocumentData[]) => {
    const categories = {
      user: [] as DocumentData[],
      aiFrames: [] as DocumentData[],
      system: [] as DocumentData[],
      agentLogs: [] as DocumentData[]
    };

    docs.forEach(doc => {
      // Agent Logs
      if (doc.title.toLowerCase().includes('agent log') || 
          doc.metadata.source === 'research_state') {
        categories.agentLogs.push(doc);
      }
      // AI Frames
      else if (doc.metadata.source === 'ai-frames' || 
               doc.title.toLowerCase().includes('ai-frame')) {
        categories.aiFrames.push(doc);
      }
      // System & Metadata (TimeCapsules, BubblSpace, etc.)
      else if (doc.metadata.source === 'timecapsule_export' ||
               doc.metadata.source === 'timecapsule_import' ||
               doc.metadata.source === 'aiframes_import' ||
               doc.metadata.source === 'aiframes_combined' ||
               doc.title.toLowerCase().includes('timecapsule') ||
               doc.metadata.isGenerated === true) {
        categories.system.push(doc);
      }
      // User Documents (uploads, Firecrawl, etc.)
      else {
        categories.user.push(doc);
      }
    });

    return categories;
  };

  const getFilteredDocumentsByCategory = (category: string) => {
    const categorized = categorizeDocuments(documents);
    const categoryDocs = categorized[category as keyof typeof categorized] || [];
    
    if (!documentSearchQuery.trim()) {
      return categoryDocs;
    }
    
    return categoryDocs.filter(doc => 
      doc.title.toLowerCase().includes(documentSearchQuery.toLowerCase()) ||
      doc.metadata.description?.toLowerCase().includes(documentSearchQuery.toLowerCase())
    );
  };

  const getDocumentCategoryCounts = () => {
    const categorized = categorizeDocuments(documents);
    return {
      user: categorized.user.length,
      aiFrames: categorized.aiFrames.length,
      system: categorized.system.length,
      agentLogs: categorized.agentLogs.length
    };
  };

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
      {/* Metadata Management Header */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                DeepResearch Platform
              </h2>
              <Badge variant="outline" className="text-xs">
                {topics.length} Topic{topics.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            
            {/* BubblSpace & TimeCapsule Management - AI-Frames Style */} 
            <div className="flex items-center gap-4">
              {/* Current BubblSpace Display - Click to Edit */}
              {currentBubblSpace && (
                <div className="flex items-center gap-2">
                  <div 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => {
                      app.editingBubblSpace = currentBubblSpace;
                      app.setEditingBubblSpace?.(currentBubblSpace);
                      app.setShowBubblSpaceDialog?.(true);
                    }}
                    title={`Current BubblSpace: ${currentBubblSpace.name}. Click to edit.`}
                  >
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: currentBubblSpace.color || '#3B82F6' }}
                    />
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {currentBubblSpace.name}
                    </span>
                    {currentBubblSpace.isDefault && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      app.editingBubblSpace = currentBubblSpace;
                      app.setEditingBubblSpace?.(currentBubblSpace);
                      app.setShowBubblSpaceDialog?.(true);
                    }}
                    className="h-8 w-8 p-0"
                    title="Edit BubblSpace"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
                          {/* BubblSpace Management - Disabled for regular users */}
            {/* Advanced users only: BubblSpace creation disabled */}

              <Separator orientation="vertical" className="h-6" />

              {/* Current TimeCapsule Display - Click to Edit */}
              {currentTimeCapsule && (
                <div 
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => {
                    app.editingTimeCapsule = currentTimeCapsule;
                    app.setEditingTimeCapsule?.(currentTimeCapsule);
                    app.setShowTimeCapsuleDialog?.(true);
                  }}
                  title={`Current TimeCapsule: ${currentTimeCapsule.name}. Click to edit.`}
                >
                  <Package className="w-3 h-3" />
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {currentTimeCapsule.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {currentTimeCapsule.category}
                  </Badge>
                </div>
              )}
              
              {/* TimeCapsule Management */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  app.editingTimeCapsule = null;
                  app.setEditingTimeCapsule?.(null);
                  app.setShowTimeCapsuleDialog?.(true);
                }}
                title="Create or manage TimeCapsules"
                disabled={!currentBubblSpace}
              >
                <Plus className="h-4 w-4 mr-2" />
                TimeCapsule
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Enhanced TimeCapsule Export/Import */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) app.openSafeImportDialog(file);
                  };
                  input.click();
                }}
                title="Import Enhanced TimeCapsule with full metadata support"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => app.exportTimeCapsule()}
                title="Export Enhanced TimeCapsule with BubblSpace and metadata"
                disabled={!currentTimeCapsule}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-16">
        <ResizablePanelGroup direction="horizontal" className="h-screen">
        {/* Left Panel - Controls */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <ControlsPanel
            aiStatus={aiStatus}
            setAIStatus={setAIStatus}
            researchType={researchType}
            setResearchType={setResearchType}
            researchDepth={researchDepth}
            setResearchDepth={setResearchDepth}
            onAddTopic={(title, description) =>
              app.addTopic(title, description)
            }
            onConnectAI={() => app.connectAI()}
            onGenerateResearch={() => {
              const selectedTopics = topics.filter((t) => t.selected);
              if (selectedTopics.length === 0) {
                app.updateStatus("❌ Please select at least one topic first");
                return;
              }
              if (!aiStatus.connected) {
                app.updateStatus("❌ Please connect to AI first");
                return;
              }
              app.generateResearch(researchType, researchDepth);
            }}
            onClearAll={() => app.clearAll()}
            onManageKnowledge={() => app.showDocumentManager()}
            onUploadDocuments={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) app.handleFileUpload(files);
              };
              input.click();
            }}
            onScrapeUrl={() => app.openFirecrawlModal()}
            onUploadRepository={() => {
              /* Repository upload logic */
            }}
            onExportResults={() => app.exportResults()}
            onExportTimeCapsule={() => app.exportTimeCapsule()}
            onLoadTimeCapsule={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) app.importTimeCapsule(file);
              };
              input.click();
            }}
            isGenerating={isGenerating}
            documentStatus={documentStatus}
            documents={documents}
            onDocumentsChange={(attachedDocs) => {
              // Store attached documents for learning research
              app.attachedDocuments = attachedDocs;
            }}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Structure Builder */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <StructureBuilder
            topics={topics}
            onSelectTopic={(topicId) => app.selectTopic(topicId)}
            onDeleteTopic={(topicId) => app.deleteTopic(topicId)}
            onMoveTopic={(topicId, direction) =>
              app.moveTopic(topicId, direction)
            }
            documentStatus={documentStatus}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Research Output */}
        <ResizablePanel defaultSize={50} minSize={40}>
          <ResearchOutput
            researchResults={researchResults}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            onClearOutput={() => {
              setResearchResults("");
              app.updateStatus("🗑️ Research output cleared");
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Status Bar */}
      <StatusBar message={statusMessage} />

      {/* AI Connection Modal */}
      <Dialog
        open={showOllamaConnectionModal}
        onOpenChange={(open) => {
          if (!open) app.cancelConnection();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600" />
              Connect to Ollama
            </DialogTitle>
            <DialogDescription>
              Enter your Ollama server URL to connect to your local AI models.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ollama-url">Ollama Server URL</Label>
              <Input
                id="ollama-url"
                value={selectedOllamaURL}
                onChange={(e) => setSelectedOllamaURL(e.target.value)}
                placeholder="http://localhost:11434"
                className="font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => app.cancelConnection()}>
                Cancel
              </Button>
              <Button
                onClick={() => app.testOllamaConnection(selectedOllamaURL)}
              >
                <Wifi className="h-4 w-4 mr-2" />
                Test Connection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Model Selection Modal */}
      <Dialog
        open={showModelSelectionModal}
        onOpenChange={(open) => {
          if (!open) app.cancelConnection();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-600" />
              Select AI Model
            </DialogTitle>
            <DialogDescription>
              Choose from available models on your Ollama server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availableModels.length > 0 ? (
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {availableModels.map((model) => (
                    <Card
                      key={model.name}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => app.selectModel(model.name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{model.name}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Size: {model.size || "Unknown"}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {model.name.includes("chat") ? "Chat" : "Base"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  No models found. Make sure Ollama is running with models
                  installed.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => app.cancelConnection()}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Manager Modal */}
      <Dialog
        open={showDocumentManager}
        onOpenChange={(open) => {
          if (!open) app.hideDocumentManager();
        }}
      >
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Knowledge Base Manager
            </DialogTitle>
            <DialogDescription>
              Organized view of your documents by category. Search and manage your knowledge base content.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6">
            <Tabs value={documentManagerTab} onValueChange={setDocumentManagerTab} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="user" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  User Docs ({getDocumentCategoryCounts().user})
                </TabsTrigger>
                <TabsTrigger value="aiFrames" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Frames ({getDocumentCategoryCounts().aiFrames})
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  System ({getDocumentCategoryCounts().system})
                </TabsTrigger>
                <TabsTrigger value="agentLogs" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Logs ({getDocumentCategoryCounts().agentLogs})
                </TabsTrigger>
              </TabsList>

              {/* Search Section */}
              <div className="mb-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Search & Semantic Query</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Search ${documentManagerTab} documents...`}
                        value={documentSearchQuery}
                        onChange={(e) => setDocumentSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <Button onClick={handleSearch} disabled={isSearching}>
                        <Search className="h-4 w-4 mr-2" />
                        {isSearching ? "Searching..." : "Search"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Label htmlFor="search-threshold">
                        Similarity threshold:
                      </Label>
                      <Input
                        id="search-threshold"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={searchThreshold}
                        onChange={(e) =>
                          setSearchThreshold(parseFloat(e.target.value))
                        }
                        className="w-20"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Document Content Tabs */}
              <div className="flex-1 overflow-y-auto">
                <TabsContent value="user" className="h-full">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3 flex-shrink-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="h-4 w-4 text-green-600" />
                        User Documents ({getDocumentCategoryCounts().user})
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Your uploaded files, scraped content, and personal documents. These are available for learning research attachment.
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                      {getFilteredDocumentsByCategory("user").length > 0 ? (
                        <div className="space-y-2">
                          {getFilteredDocumentsByCategory("user").map((doc) => (
                            <Card key={doc.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium truncate">{doc.title}</h4>
                                    <Badge variant="outline" className="text-xs">
                                      {doc.metadata.source === 'firecrawl' ? '🔍 Scraped' : '📄 Upload'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                    <span>Size: {formatFileSize(doc.metadata.filesize)}</span>
                                    <span>Type: {doc.metadata.filetype}</span>
                                    <span>Added: {new Date(doc.metadata.uploadedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="outline" size="sm" onClick={() => handlePreviewDocument(doc.id)}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => app.downloadDocument(doc.id)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => app.deleteDocument(doc.id)} className="text-red-600 hover:text-red-700">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                          <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No user documents found.</p>
                          <p className="text-sm">Upload files or scrape URLs to add content to your knowledge base.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="aiFrames" className="h-full">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3 flex-shrink-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bot className="h-4 w-4 text-blue-600" />
                        AI Frames ({getDocumentCategoryCounts().aiFrames})
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        AI-generated learning frames and educational content from the AI-Frames system.
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                      {getFilteredDocumentsByCategory("aiFrames").length > 0 ? (
                        <div className="space-y-2">
                          {getFilteredDocumentsByCategory("aiFrames").map((doc) => (
                            <Card key={doc.id} className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium truncate">{doc.title}</h4>
                                    <Badge variant="outline" className="text-xs text-blue-600">
                                      🎓 AI Frame
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                    <span>Size: {formatFileSize(doc.metadata.filesize)}</span>
                                    <span>Added: {new Date(doc.metadata.uploadedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="outline" size="sm" onClick={() => handlePreviewDocument(doc.id)}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => app.downloadDocument(doc.id)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No AI frames found.</p>
                          <p className="text-sm">AI frames will appear here when synced from the AI-Frames system.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="system" className="h-full">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3 flex-shrink-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4 text-purple-600" />
                        System & Metadata ({getDocumentCategoryCounts().system})
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        TimeCapsules, BubblSpace exports, research outputs, and other system-generated content.
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                      {getFilteredDocumentsByCategory("system").length > 0 ? (
                        <div className="space-y-2">
                          {getFilteredDocumentsByCategory("system").map((doc) => (
                            <Card key={doc.id} className="p-3 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium truncate">{doc.title}</h4>
                                    <Badge variant="outline" className="text-xs text-purple-600">
                                      {doc.metadata.source === 'timecapsule_export' ? '📦 Export' : 
                                       doc.metadata.isGenerated ? '🤖 Generated' : '⚙️ System'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                    <span>Size: {formatFileSize(doc.metadata.filesize)}</span>
                                    <span>Added: {new Date(doc.metadata.uploadedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="outline" size="sm" onClick={() => handlePreviewDocument(doc.id)}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => app.downloadDocument(doc.id)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => app.deleteDocument(doc.id)} className="text-red-600 hover:text-red-700">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No system documents found.</p>
                          <p className="text-sm">TimeCapsule exports and system content will appear here.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="agentLogs" className="h-full">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3 flex-shrink-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4 text-orange-600" />
                        Agent Logs ({getDocumentCategoryCounts().agentLogs})
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Multi-agent research session logs, performance metrics, and processing details.
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                      {getFilteredDocumentsByCategory("agentLogs").length > 0 ? (
                        <div className="space-y-2">
                          {getFilteredDocumentsByCategory("agentLogs").map((doc) => (
                            <Card key={doc.id} className="p-3 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium truncate">{doc.title}</h4>
                                    <Badge variant="outline" className="text-xs text-orange-600">
                                      📋 Agent Log
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                    <span>Size: {formatFileSize(doc.metadata.filesize)}</span>
                                    <span>Added: {new Date(doc.metadata.uploadedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="outline" size="sm" onClick={() => handlePreviewDocument(doc.id)}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => app.downloadDocument(doc.id)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => app.deleteDocument(doc.id)} className="text-red-600 hover:text-red-700">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No agent logs found.</p>
                          <p className="text-sm">Agent processing logs will appear here after multi-agent research sessions.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          <div className="flex justify-between items-center p-6 pt-4 flex-shrink-0 border-t">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Total: {documents.length} documents • {formatFileSize(documents.reduce((sum, doc) => sum + doc.metadata.filesize, 0))}
            </div>
            <Button variant="outline" onClick={() => app.hideDocumentManager()}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search Results Modal */}
      {showSearchResults && (
        <Dialog
          open={showSearchResults}
          onOpenChange={(open) => {
            if (!open) closeSearchResults();
          }}
        >
          <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 p-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                Search Results for "{currentSearchQuery}"
              </DialogTitle>
              <DialogDescription>
                Found {searchResults.length} relevant chunks in your knowledge
                base.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-3 py-4">
                {searchResults.map((result, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">
                          Similarity: {(result.similarity * 100).toFixed(1)}%
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleViewChunk(result, result.document)
                          }
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                      <h4 className="font-medium">
                        {result.document?.title || "Unknown Document"}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                        {result.chunk?.content || "No content available"}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
            <div className="flex justify-end p-6 pt-4 flex-shrink-0 border-t">
              <Button variant="outline" onClick={closeSearchResults}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Document Preview Modal */}
      {showDocumentPreview && previewDocument && (
        <Dialog
          open={showDocumentPreview}
          onOpenChange={(open) => {
            if (!open) closeDocumentPreview();
          }}
        >
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 p-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                {previewDocument.title}
              </DialogTitle>
              <DialogDescription>
                Document preview -{" "}
                {formatFileSize(previewDocument.metadata.filesize)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="whitespace-pre-wrap text-sm font-mono bg-slate-50 dark:bg-slate-800 p-4 rounded-lg leading-relaxed my-4">
                {previewDocument.content}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 pt-4 flex-shrink-0 border-t">
              <Button
                variant="outline"
                onClick={() => app.downloadDocument(previewDocument.id)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={closeDocumentPreview}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Chunk View Modal */}
      {showChunkView && currentChunk && (
        <Dialog
          open={showChunkView}
          onOpenChange={(open) => {
            if (!open) closeChunkView();
          }}
        >
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 p-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                Document Chunk
              </DialogTitle>
              <DialogDescription>
                From:{" "}
                {currentChunk.document?.title ||
                  currentChunk.document?.name ||
                  "Unknown Document"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6">
              {/* Chunk metadata */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                <div className="flex justify-between items-center">
                  <span>
                    <strong>Similarity Match:</strong>{" "}
                    {currentChunk.similarity
                      ? (currentChunk.similarity * 100).toFixed(1) + "%"
                      : "N/A"}
                  </span>
                  <span>
                    <strong>Content Length:</strong>{" "}
                    {currentChunk.content?.length || 0} characters
                  </span>
                </div>
              </div>

              {/* Chunk content */}
              <div className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-4 rounded-lg leading-relaxed my-4">
                {currentChunk.content || "No content available"}
              </div>
            </div>
            <div className="flex justify-end p-6 pt-4 flex-shrink-0 border-t">
              <Button variant="outline" onClick={closeChunkView}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Metadata Management Dialogs */}
      <BubblSpaceDialog
        isOpen={showBubblSpaceDialog}
        onClose={() => app.closeBubblSpaceDialog()}
        onSave={(bubblSpace: Partial<BubblSpace>) => {
          if (bubblSpace.name && bubblSpace.description) {
            app.saveBubblSpace(bubblSpace.name, bubblSpace.description, bubblSpace);
          }
        }}
        onDelete={(id: string) => {
          app.deleteBubblSpace(id);
        }}
        bubblSpace={editingBubblSpace}
        existingBubblSpaces={bubblSpaces}
      />

      <TimeCapsuleDialog
        isOpen={showTimeCapsuleDialog}
        onClose={() => app.closeTimeCapsuleDialog()}
        onSave={(timeCapsule: Partial<TimeCapsuleMetadata>) => {
          if (timeCapsule.name && timeCapsule.description && timeCapsule.bubblSpaceId) {
            app.saveTimeCapsule(timeCapsule.name, timeCapsule.description, timeCapsule.bubblSpaceId, timeCapsule);
          }
        }}
        onDelete={(id: string) => {
          app.deleteTimeCapsule(id);
        }}
        timeCapsule={editingTimeCapsule}
        bubblSpaces={bubblSpaces}
      />

      {/* TODO: Fix SafeImportDialog props interface 
      <SafeImportDialog
        isOpen={showSafeImportDialog && !!app.importFile}
        onClose={() => app.closeSafeImportDialog()}
        onImport={(options: ImportOptions) => {
          app.performSafeImport(options);
          return Promise.resolve({ success: true, details: {} } as ImportResult);
        }}
        file={app.importFile}
      />
      */}

      {/* Firecrawl Modal */}
      <Dialog open={showFirecrawlModal} onOpenChange={setShowFirecrawlModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>🔍</span>
              Scrape URL with Firecrawl
            </DialogTitle>
            <DialogDescription>
              Enter a URL and your Firecrawl API key to scrape web content and add it to your Knowledge Base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firecrawl-url">Website URL</Label>
              <Input
                id="firecrawl-url"
                placeholder="https://example.com/article"
                type="url"
                defaultValue=""
                key="firecrawl-url-input"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="firecrawl-api-key">Firecrawl API Key</Label>
                {app?.isFirecrawlApiKeyRemembered() && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-green-600">
                      🔐 Saved
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        app.clearFirecrawlApiKey();
                        // Clear the input field
                        const apiKeyInput = document.getElementById('firecrawl-api-key') as HTMLInputElement;
                        if (apiKeyInput) apiKeyInput.value = '';
                      }}
                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                      title="Forget saved API key"
                    >
                      Forget
                    </Button>
                  </div>
                )}
              </div>
              <Input
                id="firecrawl-api-key"
                placeholder="fc-xxxxxxxxxx"
                type="password"
                defaultValue={app?.firecrawlApiKey || ""}
                key="firecrawl-api-key-input"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get your API key from{" "}
                  <a 
                    href="https://firecrawl.dev" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    firecrawl.dev
                  </a>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember-api-key"
                    className="w-4 h-4"
                    defaultChecked={app?.isFirecrawlApiKeyRemembered()}
                  />
                  <Label htmlFor="remember-api-key" className="text-xs cursor-pointer">
                    Remember API key
                  </Label>
                </div>
              </div>
            </div>
            {isScrapingUrl && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {scrapingProgress.message}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {scrapingProgress.progress}%
                  </span>
                </div>
                <Progress value={scrapingProgress.progress} className="w-full" />
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => app.closeFirecrawlModal()}
              disabled={isScrapingUrl}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const urlInput = document.getElementById('firecrawl-url') as HTMLInputElement;
                const apiKeyInput = document.getElementById('firecrawl-api-key') as HTMLInputElement;
                const rememberCheckbox = document.getElementById('remember-api-key') as HTMLInputElement;
                if (urlInput && apiKeyInput) {
                  // Save API key with encryption if remember is checked
                  app.saveFirecrawlApiKey(apiKeyInput.value, rememberCheckbox?.checked || false);
                  app.scrapeUrl(urlInput.value, apiKeyInput.value);
                }
              }}
              disabled={isScrapingUrl}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isScrapingUrl ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <span className="mr-2">🔍</span>
                  Scrape URL
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Agent Progress Modal with RAG Visualization */}
      <Dialog open={showAgentProgress} onOpenChange={setShowAgentProgress}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <span>🤖</span>
              Multi-Agent Research with RAG Analytics
            </DialogTitle>
            <DialogDescription>
              Multiple specialized agents are working together with RAG-enhanced context to create comprehensive learning research.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden px-6">
            <Tabs defaultValue="progress" className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="progress" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Agent Progress
                </TabsTrigger>
                <TabsTrigger value="rag" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  RAG Queries ({currentAgentProgress?.ragQueries?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="progress" className="h-full overflow-y-auto">
                  <div className="space-y-4">
                    {currentAgentProgress && (
                      <>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">Session: {currentAgentProgress.sessionId}</span>
                            <span className="text-gray-500">
                              {currentAgentProgress.estimatedTimeRemaining && 
                                `Est. ${currentAgentProgress.estimatedTimeRemaining} remaining`
                              }
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Agent Progress:</h4>
                            {currentAgentProgress.tasks.map((task, index) => (
                              <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex-shrink-0">
                                  {task.status === 'completed' && (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  )}
                                  {task.status === 'in_progress' && (
                                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                  )}
                                  {task.status === 'pending' && (
                                    <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                                  )}
                                  {task.status === 'failed' && (
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium truncate">
                                      {task.taskName}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      {task.status === 'completed' && task.duration && (
                                        <span>{task.duration}</span>
                                      )}
                                      {task.status === 'in_progress' && task.progress && (
                                        <span>{task.progress}%</span>
                                      )}
                                      {task.tokensUsed && (
                                        <span>{task.tokensUsed} tokens</span>
                                      )}
                                      {task.ragStats && (
                                        <Badge variant="outline" className="text-xs">
                                          {task.ragStats.totalQueries} RAG queries
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {task.status === 'in_progress' && task.progress && (
                                    <div className="mt-2">
                                      <Progress value={task.progress} className="h-2" />
                                    </div>
                                  )}
                                  {task.ragStats && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                                      <div className="flex justify-between">
                                        <span>RAG Performance:</span>
                                        <span>{task.ragStats.averageResponseTime.toFixed(0)}ms avg</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Retrieved:</span>
                                        <span>{task.ragStats.documentsRetrieved} documents</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Relevance:</span>
                                        <span>{(task.ragStats.averageSimilarity * 100).toFixed(1)}%</span>
                                      </div>
                                    </div>
                                  )}
                                  {task.status === 'failed' && task.error && (
                                    <p className="text-xs text-red-600 mt-1">{task.error}</p>
                                  )}
                                  {task.status === 'completed' && task.result && (
                                    <p className="text-xs text-green-600 mt-1">{task.result}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {currentAgentProgress.totalTokens && (
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex justify-between">
                                  <span>Total Tokens:</span>
                                  <span className="font-medium">{currentAgentProgress.totalTokens}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Research Quality:</span>
                                  <Badge variant={
                                    currentAgentProgress.researchQuality === 'excellent' ? 'default' :
                                    currentAgentProgress.researchQuality === 'good' ? 'secondary' : 'outline'
                                  }>
                                    {currentAgentProgress.researchQuality}
                                  </Badge>
                                </div>
                                {currentAgentProgress.ragStats && (
                                  <>
                                    <div className="flex justify-between">
                                      <span>RAG Queries:</span>
                                      <span className="font-medium">{currentAgentProgress.ragStats.totalQueries}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>RAG Success Rate:</span>
                                      <span className="font-medium">
                                        {((currentAgentProgress.ragStats.successfulQueries / Math.max(1, currentAgentProgress.ragStats.totalQueries)) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="rag" className="h-full overflow-y-auto">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Search className="h-4 w-4 text-blue-600" />
                          Real-Time RAG Query Monitoring
                        </CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Live view of knowledge base queries performed by each agent during research generation.
                        </p>
                      </CardHeader>
                      <CardContent>
                        {currentAgentProgress?.ragQueries && currentAgentProgress.ragQueries.length > 0 ? (
                          <div className="space-y-3">
                            {currentAgentProgress.ragQueries
                              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                              .map((query, index) => (
                              <Card key={query.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs text-blue-600">
                                        {query.agentId || 'unknown'}
                                      </Badge>
                                      <Badge variant={query.success ? 'default' : 'destructive'} className="text-xs">
                                        {query.success ? '✅' : '❌'} {query.resultsCount} results
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        {query.responseTime}ms
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {query.timestamp.toLocaleTimeString()}
                                    </span>
                                  </div>
                                  
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    "{query.queryText}"
                                  </p>
                                  
                                  {query.success && query.averageSimilarity > 0 && (
                                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                                      <span>Avg Similarity: {(query.averageSimilarity * 100).toFixed(1)}%</span>
                                      <span>Max: {(query.maxSimilarity * 100).toFixed(1)}%</span>
                                      <span>Threshold: {(query.searchParameters.threshold * 100).toFixed(1)}%</span>
                                    </div>
                                  )}
                                  
                                  {query.documents.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Retrieved Documents:
                                      </p>
                                      <div className="space-y-1">
                                        {query.documents.slice(0, 3).map((doc, docIndex) => (
                                          <div key={docIndex} className="flex items-center justify-between text-xs p-2 bg-white dark:bg-gray-800 rounded border">
                                            <span className="truncate flex-1 mr-2">
                                              {doc.title}
                                            </span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                              <Badge variant="outline" className="text-xs">
                                                {(doc.similarity * 100).toFixed(1)}%
                                              </Badge>
                                              <Badge variant="secondary" className="text-xs">
                                                {doc.source}
                                              </Badge>
                                            </div>
                                          </div>
                                        ))}
                                        {query.documents.length > 3 && (
                                          <p className="text-xs text-gray-500 text-center">
                                            +{query.documents.length - 3} more documents
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {!query.success && query.errorMessage && (
                                    <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                      Error: {query.errorMessage}
                                    </p>
                                  )}
                                </div>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No RAG queries yet.</p>
                            <p className="text-sm">Queries will appear here as agents search the knowledge base.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="analytics" className="h-full overflow-y-auto">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="h-4 w-4 text-purple-600" />
                          Session Analytics & Performance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {currentAgentProgress?.ragStats ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm">RAG Performance</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Total Queries:</span>
                                  <span className="font-medium">{currentAgentProgress.ragStats.totalQueries}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Successful:</span>
                                  <span className="font-medium text-green-600">{currentAgentProgress.ragStats.successfulQueries}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Avg Response Time:</span>
                                  <span className="font-medium">{currentAgentProgress.ragStats.averageResponseTime.toFixed(0)}ms</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Avg Similarity:</span>
                                  <span className="font-medium">{(currentAgentProgress.ragStats.averageSimilarity * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Document Hit Rate:</span>
                                  <span className="font-medium">{currentAgentProgress.ragStats.documentHitRate.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm">Query Performance</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Fast (&lt;100ms):</span>
                                  <span className="font-medium text-green-600">{currentAgentProgress.ragStats.performanceMetrics.fastQueries}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Medium (100-500ms):</span>
                                  <span className="font-medium text-yellow-600">{currentAgentProgress.ragStats.performanceMetrics.mediumQueries}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Slow (&gt;500ms):</span>
                                  <span className="font-medium text-red-600">{currentAgentProgress.ragStats.performanceMetrics.slowQueries}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Timeouts:</span>
                                  <span className="font-medium text-red-600">{currentAgentProgress.ragStats.performanceMetrics.timeoutQueries}</span>
                                </div>
                              </div>
                            </div>

                            {currentAgentProgress.ragStats.topDocuments.length > 0 && (
                              <div className="col-span-2 space-y-3">
                                <h4 className="font-medium text-sm">Most Retrieved Documents</h4>
                                <div className="space-y-2">
                                  {currentAgentProgress.ragStats.topDocuments.slice(0, 5).map((doc, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                                      <span className="truncate flex-1 mr-2">{doc.title}</span>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <Badge variant="outline" className="text-xs">
                                          {doc.hitCount} hits
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          {(doc.averageSimilarity * 100).toFixed(1)}% avg
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Analytics will appear here during research generation.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t">
            <div className="flex justify-between items-center w-full">
              <span className="text-xs text-gray-500">
                Enhanced agent logs with RAG analytics will be automatically saved to Knowledge Base
              </span>
              <Button
                variant="outline"
                onClick={() => setShowAgentProgress(false)}
                disabled={isGenerating}
              >
                {isGenerating ? 'Processing...' : 'Close'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
