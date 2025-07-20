import React, { useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AIFrameNodeData, FrameAttachment } from "./types";
import { 
  Video, 
  FileText,
  File,
  Clock, 
  Target, 
  BookOpen, 
  Edit3, 
  Save, 
  X, 
  Plus,
  Link,
  Unlink,
  Brain,
  Hash
} from "lucide-react";

interface EnhancedAIFrameNodeProps extends NodeProps {
  data: AIFrameNodeData & {
    onFrameUpdate?: (frameId: string, updatedData: Partial<AIFrameNodeData>) => void;
    onAttachContent?: (frameId: string, attachment: FrameAttachment) => void;
    onDetachContent?: (frameId: string) => void;
  };
}

export default function EnhancedAIFrameNode({ data, selected }: EnhancedAIFrameNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<AIFrameNodeData>(data);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    console.log('🎯 SAVE ATTEMPT:', {
      frameId: data.frameId,
      hasOnFrameUpdate: !!data.onFrameUpdate,
      editData: editData,
      willEmitEvent: !!(data.onFrameUpdate && data.frameId)
    });
    
    setIsSaving(true);
    
    try {
      // Update the node data
      Object.assign(data, editData);
      
      // Sync changes back to parent frames array
      if (data.onFrameUpdate && data.frameId) {
        const updatedFrameData = {
          id: data.frameId,
          title: editData.title,
          goal: editData.goal,
          informationText: editData.informationText,
          afterVideoText: editData.afterVideoText,
          aiConcepts: editData.aiConcepts,
          isGenerated: editData.isGenerated,
          sourceGoal: editData.sourceGoal,
          sourceUrl: editData.sourceUrl,
          attachment: editData.attachment,
          updatedAt: new Date().toISOString(),
        };
        
        await data.onFrameUpdate(data.frameId, updatedFrameData);
        
        // REAL-TIME SYNC: Emit graph frame edited event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('graph-frame-edited', {
            detail: {
              frameId: data.frameId,
              updatedFrame: updatedFrameData,
              timestamp: new Date().toISOString()
            }
          }));
        }
        
        console.log('✏️ Enhanced AI Frame Node: Frame edit event emitted:', {
          frameId: data.frameId,
          title: editData.title
        });
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save frame:', error);
    } finally {
      setIsSaving(false);
    }
  }, [data, editData]);

  const handleCancel = useCallback(() => {
    setEditData(data);
    setIsEditing(false);
  }, [data]);

  const handleDetachContent = useCallback(() => {
    if (data.onDetachContent && data.frameId) {
      data.onDetachContent(data.frameId);
      setEditData(prev => ({ ...prev, attachment: undefined }));
    }
  }, [data]);

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-3 w-3" />;
      case 'pdf': return <File className="h-3 w-3" />;
      case 'text': return <FileText className="h-3 w-3" />;
      default: return <Plus className="h-3 w-3" />;
    }
  };

  const getAttachmentLabel = (attachment: FrameAttachment) => {
    switch (attachment.type) {
      case 'video': 
        return `Video: ${attachment.data.title || 'Untitled'}`;
      case 'pdf': 
        return `PDF: ${attachment.data.title || 'Untitled'}`;
      case 'text': 
        return `Text: ${attachment.data.title || 'Untitled'}`;
      default: 
        return 'Unknown attachment';
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="enhanced-ai-frame-node">
      {/* Sequential connection handle (top) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{
          width: '24px',
          height: '24px',
          backgroundColor: '#9468e6',
          border: '2px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(148, 104, 230, 0.3)',
          zIndex: 5
        }}
      />
      
      {/* Attachment handle (right side) - Large and Orange */}
      <Handle 
        type="target" 
        position={Position.Right} 
        id="attachment-slot"
        style={{
          top: '50%',
          width: '32px',
          height: '32px',
          backgroundColor: '#f97316',
          border: '4px solid white',
          borderRadius: '50%',
          boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
          zIndex: 10
        }}
      />
      
      <Card className={`w-96 ${selected ? 'ring-2 ring-purple-500' : ''} transition-all duration-200`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-purple-100 rounded">
                <Hash className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">
                  {isEditing ? (
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData({...editData, title: e.target.value})}
                      className="h-6 text-sm"
                      placeholder="Enter frame name..."
                    />
                  ) : (
                    data.title || "AI Frame"
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    Frame
                  </Badge>
                  {data.isGenerated && (
                    <Badge variant="outline" className="text-xs">
                      AI Generated
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-6 w-6 p-0"
                    title="Save changes"
                  >
                    <Save className={`h-3 w-3 ${isSaving ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="h-6 w-6 p-0"
                    title="Cancel changes"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-6 w-6 p-0"
                  title="Edit frame"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-3">
          {/* Learning Goal */}
          <div>
            <Label className="text-xs font-medium flex items-center gap-1">
              <Target className="h-3 w-3" />
              Learning Goal
            </Label>
            {isEditing ? (
              <Textarea
                value={editData.goal}
                onChange={(e) => setEditData({...editData, goal: e.target.value})}
                className="mt-1 text-xs h-16"
                placeholder="What should learners understand after this frame?"
              />
            ) : (
              <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                {data.goal || "No learning goal specified"}
              </p>
            )}
          </div>

          {/* Information Text */}
          <div>
            <Label className="text-xs font-medium flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              Context & Background
            </Label>
            {isEditing ? (
              <Textarea
                value={editData.informationText}
                onChange={(e) => setEditData({...editData, informationText: e.target.value})}
                className="mt-1 text-xs h-20"
                placeholder="Provide background context and explanation..."
              />
            ) : (
              <p className="text-xs text-gray-600 mt-1 line-clamp-4">
                {data.informationText || "No background information provided"}
              </p>
            )}
          </div>

          {/* Attachment Slot */}
          <div className="border-2 border-dashed border-orange-300 rounded-lg p-3">
            <Label className="text-xs font-medium flex items-center gap-1 mb-2">
              <Link className="h-3 w-3" />
              Content Attachment {data.attachment ? '(1/1)' : '(0/1)'}
            </Label>
            
            {data.attachment ? (
              <div className="flex items-center justify-between bg-orange-50 p-2 rounded">
                <div className="flex items-center gap-2">
                  {getAttachmentIcon(data.attachment.type)}
                  <span className="text-xs font-medium">
                    {getAttachmentLabel(data.attachment)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDetachContent}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  title="Detach content"
                >
                  <Unlink className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-2">
                <Plus className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                <p className="text-xs text-gray-500">
                  No attachment connected
                </p>
                <p className="text-xs text-gray-400">
                  Video, PDF, or Text (one per frame)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  💡 Connect attachment node to orange handle →
                </p>
              </div>
            )}
            
            {/* ENHANCED: Video attachment validation */}
            {data.attachment?.type === 'video' && !data.attachment.data?.videoUrl && (
              <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                <p className="text-xs text-red-600 font-medium">⚠️ Video attachment has no URL!</p>
                <p className="text-xs text-red-500 mt-1">
                  Edit the VideoAttachmentNode and add a YouTube URL
                </p>
              </div>
            )}
          </div>

          {/* AI Concepts (if any) */}
          {data.aiConcepts.length > 0 && (
            <div>
              <Label className="text-xs font-medium flex items-center gap-1">
                <Brain className="h-3 w-3" />
                Related Concepts ({data.aiConcepts.length})
              </Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.aiConcepts.slice(0, 3).map((concept, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {concept}
                  </Badge>
                ))}
                {data.aiConcepts.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{data.aiConcepts.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Save Status */}
          {isSaving && (
            <div className="text-xs text-purple-600 flex items-center gap-1">
              <Save className="h-3 w-3 animate-spin" />
              Saving frame...
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Sequential connection handle (bottom) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{
          width: '24px',
          height: '24px',
          backgroundColor: '#9468e6',
          border: '2px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(148, 104, 230, 0.3)',
          zIndex: 5
        }}
      />
    </div>
  );
} 