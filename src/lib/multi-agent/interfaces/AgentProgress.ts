/**
 * Agent Progress Tracking Interface
 * 
 * Defines callbacks and data structures for tracking detailed agent progress
 * Used by Orchestrator to create sub-steps for UI visibility
 */

import { AgentSubStep, AgentThinking } from '@/components/DeepResearch/components/ResearchSteps';

export interface AgentProgressCallback {
  onAgentStart: (agentName: string, agentType: string, input: any) => void;
  onAgentProgress: (agentName: string, progress: number, stage?: string, itemsProcessed?: number, totalItems?: number) => void;
  onAgentThinking: (agentName: string, thinking: AgentThinking) => void;
  onAgentComplete: (agentName: string, output: any, metrics?: AgentMetrics) => void;
  onAgentError: (agentName: string, error: string, retryCount?: number) => void;
}

export interface AgentMetrics {
  llmCalls: number;
  tokensUsed: number;
  responseTime: number;
  confidence: number;
  startTime?: number;
  endTime?: number;
}

export interface AgentTracker {
  agentName: string;
  agentType: string;
  startTime: number;
  endTime?: number;
  metrics: AgentMetrics;
  thinking?: AgentThinking;
  error?: string;
  retryCount: number;
  progress: number;
  stage?: string;
  itemsProcessed?: number;
  totalItems?: number;
}

export class AgentProgressTracker {
  private trackers: Map<string, AgentTracker> = new Map();
  private callback?: AgentProgressCallback;

  constructor(callback?: AgentProgressCallback) {
    this.callback = callback;
  }

  setCallback(callback: AgentProgressCallback) {
    this.callback = callback;
  }

  startAgent(agentName: string, agentType: string, input: any): void {
    const tracker: AgentTracker = {
      agentName,
      agentType,
      startTime: Date.now(),
      metrics: {
        llmCalls: 0,
        tokensUsed: 0,
        responseTime: 0,
        confidence: 0,
        startTime: Date.now(),
      },
      retryCount: 0,
      progress: 0,
    };

    this.trackers.set(agentName, tracker);
    this.callback?.onAgentStart(agentName, agentType, input);
  }

  updateProgress(
    agentName: string, 
    progress: number, 
    stage?: string, 
    itemsProcessed?: number, 
    totalItems?: number
  ): void {
    const tracker = this.trackers.get(agentName);
    if (tracker) {
      tracker.progress = progress;
      tracker.stage = stage;
      tracker.itemsProcessed = itemsProcessed;
      tracker.totalItems = totalItems;
      
      this.callback?.onAgentProgress(agentName, progress, stage, itemsProcessed, totalItems);
    }
  }

  setThinking(agentName: string, thinking: AgentThinking): void {
    const tracker = this.trackers.get(agentName);
    if (tracker) {
      tracker.thinking = thinking;
      this.callback?.onAgentThinking(agentName, thinking);
    }
  }

  completeAgent(agentName: string, output: any, additionalMetrics?: Partial<AgentMetrics>): void {
    const tracker = this.trackers.get(agentName);
    if (tracker) {
      tracker.endTime = Date.now();
      tracker.metrics.endTime = tracker.endTime;
      tracker.metrics.responseTime = tracker.endTime - tracker.startTime;
      tracker.progress = 100;

      // Merge additional metrics
      if (additionalMetrics) {
        Object.assign(tracker.metrics, additionalMetrics);
      }

      this.callback?.onAgentComplete(agentName, output, tracker.metrics);
    }
  }

  errorAgent(agentName: string, error: string): void {
    const tracker = this.trackers.get(agentName);
    if (tracker) {
      tracker.error = error;
      tracker.retryCount += 1;
      this.callback?.onAgentError(agentName, error, tracker.retryCount);
    }
  }

  getTracker(agentName: string): AgentTracker | undefined {
    return this.trackers.get(agentName);
  }

  getAllTrackers(): AgentTracker[] {
    return Array.from(this.trackers.values());
  }

  createSubStep(agentName: string): AgentSubStep | null {
    const tracker = this.trackers.get(agentName);
    if (!tracker) return null;

    return {
      id: `agent_${agentName}_${tracker.startTime}`,
      agentName: tracker.agentName,
      agentType: tracker.agentType as any,
      status: tracker.error ? 'failed' : 
               tracker.endTime ? 'completed' : 
               tracker.progress > 0 ? 'in_progress' : 'pending',
      startTime: tracker.startTime,
      endTime: tracker.endTime,
      duration: tracker.endTime ? (tracker.endTime - tracker.startTime) : undefined,
      input: {},  // Will be populated by agents
      output: {}, // Will be populated by agents
      thinking: tracker.thinking,
      progress: tracker.progress,
      stage: tracker.stage,
      itemsProcessed: tracker.itemsProcessed,
      totalItems: tracker.totalItems,
      error: tracker.error,
      retryCount: tracker.retryCount,
      metrics: tracker.metrics,
    };
  }

  clear(): void {
    this.trackers.clear();
  }
}

export default AgentProgressTracker;