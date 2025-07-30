import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { OctagonMinus, Pause, RotateCcw, CheckCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import CameraPreview from "./camera-preview";
import ConversationFlow from "./conversation-flow";
import type { InsertSession } from "@shared/schema";

export default function RecordingStudio() {
  const [currentSession, setCurrentSession] = useState<string | null>(null);
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
    }
  };

  const handleRecordingComplete = (blob: Blob) => {
    // Here you would upload the video blob to your storage
    console.log("Recording completed:", blob);
    
    if (currentSession) {
      updateSessionMutation.mutate({
        id: currentSession,
        data: { 
          status: "completed",
          videoUrl: URL.createObjectURL(blob) // In production, this would be a real URL
        },
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Video Recording Panel */}
      <div className="lg:col-span-2 space-y-6">
        <CameraPreview onRecordingComplete={handleRecordingComplete} />
        
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
                <Button
                  onClick={handleEndSession}
                  className="w-full bg-primary text-white hover:bg-primary/90"
                  disabled={updateSessionMutation.isPending}
                >
                  <OctagonMinus className="mr-2" size={16} />
                  End Session
                </Button>
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
