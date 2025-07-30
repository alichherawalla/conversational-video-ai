import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { OctagonMinus, Pause, RotateCcw, CheckCircle, AlertTriangle, Download, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import CameraPreview from "./camera-preview";
import ConversationFlow from "./conversation-flow";
import type { InsertSession } from "@shared/schema";

export default function RecordingStudio() {
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [sessionTranscript, setSessionTranscript] = useState<string>("");
  const [sessionSettings, setSessionSettings] = useState({
    title: "Entrepreneurial Journey",
    topic: "Entrepreneurial Journey",
    targetDuration: "15-20 minutes",
    aiPersonality: "friendly",
  });

  const queryClient = useQueryClient();

  const createSessionMutation = useMutation({
    mutationFn: async (data: InsertSession) => {
      const res = await apiRequest("POST", "/api/sessions", data);
      return res.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSession> }) => {
      const res = await apiRequest("PATCH", `/api/sessions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const handleStartSession = () => {
    if (!currentSession) {
      createSessionMutation.mutate({
        ...sessionSettings,
        status: "recording",
      });
    }
  };

  const handleEndSession = () => {
    if (currentSession) {
      updateSessionMutation.mutate({
        id: currentSession,
        data: { status: "completed" },
      });
      setCurrentSession(null);
      // Note: Keep videoBlob for download even after session ends
    }
  };

  const handleRecordingComplete = (blob: Blob) => {
    console.log("Recording completed:", blob, "Size:", blob.size, "Type:", blob.type);
    
    // Store video blob for download
    setVideoBlob(blob);
    const videoUrl = URL.createObjectURL(blob);
    console.log("Video blob stored, download should now be available");
    
    if (currentSession) {
      updateSessionMutation.mutate({
        id: currentSession,
        data: { 
          status: "completed",
          videoUrl: videoUrl,
          duration: Math.floor(blob.size / 100000) // Rough duration estimate
        },
      });
    }
  };

  // Fetch transcript when session changes
  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: ["/api/sessions", currentSession, "conversations"],
    enabled: !!currentSession,
  });

  // Update transcript when conversations change
  useEffect(() => {
    if (conversations.length > 0) {
      const transcript = conversations
        .filter(conv => conv.type === "user_response" || conv.type === "ai_question")
        .map(conv => {
          const timestamp = new Date(conv.timestamp * 1000).toLocaleTimeString();
          const speaker = conv.type === "ai_question" ? "AI" : "User";
          return `[${timestamp}] ${speaker}: ${conv.content}`;
        })
        .join('\n\n');
      setSessionTranscript(transcript);
    }
  }, [conversations]);

  const handleDownloadVideo = () => {
    console.log("Download clicked, videoBlob:", videoBlob);
    if (videoBlob) {
      console.log("Starting video download...");
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionSettings.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Video download triggered");
      
      // Also download transcript if available
      if (sessionTranscript) {
        console.log("Starting transcript download...");
        const transcriptBlob = new Blob([sessionTranscript], { type: 'text/plain' });
        const transcriptUrl = URL.createObjectURL(transcriptBlob);
        const transcriptLink = document.createElement('a');
        transcriptLink.href = transcriptUrl;
        transcriptLink.download = `${sessionSettings.title.replace(/\s+/g, '_')}_transcript_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(transcriptLink);
        transcriptLink.click();
        document.body.removeChild(transcriptLink);
        URL.revokeObjectURL(transcriptUrl);
        console.log("Transcript download triggered");
      }
    } else {
      console.log("No video blob available for download");
    }
  };

  const handleClearVideo = () => {
    setVideoBlob(null);
    console.log("Video blob cleared");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Video Recording Panel */}
      <div className="lg:col-span-2 space-y-6">
        <CameraPreview 
          onRecordingComplete={handleRecordingComplete} 
          sessionId={currentSession}
        />
        
        {currentSession && (
          <ConversationFlow sessionId={currentSession} />
        )}
      </div>

      {/* Control Panel */}
      <div className="space-y-6">
        {/* Session Settings */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Session Settings</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="topic">Session Topic</Label>
                <Input
                  id="topic"
                  value={sessionSettings.topic}
                  onChange={(e) => setSessionSettings({ ...sessionSettings, topic: e.target.value })}
                  placeholder="Entrepreneurial Journey"
                />
              </div>
              
              <div>
                <Label htmlFor="duration">Target Duration</Label>
                <Select
                  value={sessionSettings.targetDuration}
                  onValueChange={(value) => setSessionSettings({ ...sessionSettings, targetDuration: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5-10 minutes">5-10 minutes</SelectItem>
                    <SelectItem value="10-15 minutes">10-15 minutes</SelectItem>
                    <SelectItem value="15-20 minutes">15-20 minutes</SelectItem>
                    <SelectItem value="20+ minutes">20+ minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="personality">AI Personality</Label>
                <Select
                  value={sessionSettings.aiPersonality}
                  onValueChange={(value) => setSessionSettings({ ...sessionSettings, aiPersonality: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional Interviewer</SelectItem>
                    <SelectItem value="friendly">Friendly Conversationalist</SelectItem>
                    <SelectItem value="investigative">Investigative Journalist</SelectItem>
                    <SelectItem value="casual">Casual Chat Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Feedback Panel */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">AI Feedback</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="text-green-600" size={16} />
                  <span className="text-sm text-green-800">Clear articulation</span>
                </div>
                <span className="text-xs text-green-600">Good</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="text-amber-600" size={16} />
                  <span className="text-sm text-amber-800">Add more specifics</span>
                </div>
                <span className="text-xs text-amber-600">Improve</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="text-green-600" size={16} />
                  <span className="text-sm text-green-800">Good eye contact</span>
                </div>
                <span className="text-xs text-green-600">Excellent</span>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 Try expanding on your examples with concrete numbers or outcomes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Quick Actions</h3>
            
            <div className="space-y-3">
              {!currentSession ? (
                <Button
                  onClick={handleStartSession}
                  className="w-full bg-primary text-white hover:bg-primary/90"
                  disabled={createSessionMutation.isPending}
                >
                  Start Session
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={handleEndSession}
                    className="w-full bg-primary text-white hover:bg-primary/90"
                    disabled={updateSessionMutation.isPending}
                  >
                    <OctagonMinus className="mr-2" size={16} />
                    End Session
                  </Button>
                </div>
              )}
              
              {/* Video Management - always show if video is available */}
              {videoBlob && (
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">Video Ready</p>
                        <p className="text-xs text-green-600">
                          Size: {Math.round(videoBlob.size / 1024 / 1024 * 100) / 100} MB • Type: {videoBlob.type}
                        </p>
                      </div>
                      <CheckCircle className="text-green-600" size={20} />
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleDownloadVideo}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="mr-2" size={16} />
                      Download Video
                    </Button>
                    <Button
                      onClick={handleClearVideo}
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              )}
              
              <Button className="w-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                <Pause className="mr-2" size={16} />
                Pause Recording
              </Button>
              
              <Button className="w-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
                <RotateCcw className="mr-2" size={16} />
                Restart Question
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
