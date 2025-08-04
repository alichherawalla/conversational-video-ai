import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  OctagonMinus,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Download,
  Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import CameraPreview from "./camera-preview";
import ConversationFlow from "./conversation-flow";
import type { InsertSession } from "@shared/schema";

interface RecordingStudioProps {
  onNavigateToContent?: (sessionId: string) => void;
}

export default function RecordingStudio({
  onNavigateToContent,
}: RecordingStudioProps) {
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [sessionTranscript, setSessionTranscript] = useState<string>("");
  const [transcriptionText, setTranscriptionText] = useState<string>("");

  const [allTranscriptions, setAllTranscriptions] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
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
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertSession>;
    }) => {
      const res = await apiRequest("PATCH", `/api/sessions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const handleStartSession = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!currentSession) {
        createSessionMutation.mutate(
          {
            ...sessionSettings,
            status: "recording",
          },
          {
            onSuccess: (data) => {
              setCurrentSession(data.id);
              console.log("Session started:", data.id);
              resolve();
            },
            onError: (error) => {
              console.error("Failed to start session:", error);
              reject(error);
            },
          },
        );
      } else {
        resolve();
      }
    });
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
    console.log(
      "Recording completed:",
      blob,
      "Size:",
      blob.size,
      "Type:",
      blob.type,
    );

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
          duration: Math.floor(blob.size / 100000), // Rough duration estimate
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
        .filter(
          (conv) =>
            conv.type === "user_response" || conv.type === "ai_question",
        )
        .map((conv) => {
          const timestamp = new Date(
            conv.timestamp * 1000,
          ).toLocaleTimeString();
          const speaker = conv.type === "ai_question" ? "AI" : "User";
          return `[${timestamp}] ${speaker}: ${conv.content}`;
        })
        .join("\n\n");
      setSessionTranscript(transcript);
    }
  }, [conversations]);

  const handleDownloadVideo = () => {
    console.log("Download clicked, videoBlob:", videoBlob);
    if (videoBlob) {
      console.log("Starting video download...");
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = url;
      // Determine file extension based on blob type
      const fileExtension = videoBlob.type.includes("mp4") ? "mp4" : "webm";
      a.download = `${sessionSettings.title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Video download triggered");

      // Also download transcript if available
      const allTranscriptText = allTranscriptions.join("\n\n");
      console.log("Building transcript from:", {
        sessionTranscript: sessionTranscript.length,
        allTranscriptText: allTranscriptText.length,
        transcriptionText: transcriptionText.length,
        allTranscriptions: allTranscriptions,
      });

      const combinedTranscript =
        [
          sessionTranscript
            ? `--- Conversation History ---\n${sessionTranscript}`
            : "",
          allTranscriptText
            ? `\n\n--- Voice Transcriptions ---\n${allTranscriptText}`
            : "",
          transcriptionText
            ? `\n\n--- Latest Transcription ---\n${transcriptionText}`
            : "",
        ]
          .filter(Boolean)
          .join("") ||
        "No transcript available. Please complete a conversation session first.";

      console.log("Final combined transcript:", combinedTranscript);
      if (combinedTranscript) {
        console.log("Starting transcript download...");
        const transcriptBlob = new Blob([combinedTranscript], {
          type: "text/plain",
        });
        const transcriptUrl = URL.createObjectURL(transcriptBlob);
        const transcriptLink = document.createElement("a");
        transcriptLink.href = transcriptUrl;
        transcriptLink.download = `${sessionSettings.title.replace(/\s+/g, "_")}_transcript_${new Date().toISOString().split("T")[0]}.txt`;
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
    setTranscriptionText("");
    setGeneratedContent(null);
    console.log("Video blob cleared");
  };

  const handleGenerateContent = async () => {
    if (!currentSession) return;

    setIsGeneratingContent(true);
    try {
      // Generate social media clips
      const clipsResponse = await apiRequest(
        "POST",
        `/api/sessions/${currentSession}/generate-clips`,
      );
      const clips = await clipsResponse.json();

      // Generate LinkedIn content
      const linkedinResponse = await apiRequest(
        "POST",
        `/api/sessions/${currentSession}/generate-content`,
        {
          contentType: "text",
        },
      );
      const linkedinContent = await linkedinResponse.json();

      setGeneratedContent({
        clips,
        linkedin: linkedinContent,
      });
    } catch (error) {
      console.error("Content generation failed:", error);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Video Recording Panel - Center (Bigger) */}
      <div className="lg:col-span-2 space-y-6">
        <CameraPreview
          onRecordingComplete={handleRecordingComplete}
          sessionId={currentSession}
          onStartSession={handleStartSession}
          onTranscriptionComplete={(text) => {
            console.log("Transcription completed in recording studio:", text);

            // Handle special auto-submit signal - pass it through but don't display it
            if (text === "__AUTO_SUBMIT_SILENCE__") {
              setTranscriptionText(text);
              return;
            }

            console.log("Setting transcriptionText to:", text);

            // For continuous transcription, append to existing text
            setTranscriptionText((prev) => {
              if (prev && !prev.includes(text)) {
                // Add space if there's existing text and the new text doesn't start with punctuation
                const separator =
                  prev.trim() && !text.match(/^[.!?]/) ? " " : "";
                return prev + separator + text;
              }
              return text;
            });

            setAllTranscriptions((prev) => [...prev, text]);
          }}
        />
      </div>
      {/* Conversation Flow Panel - Left */}
      <div className="lg:col-span-2 max-h-screen overflow-y-auto space-y-6">
        {currentSession && (
          <ConversationFlow
            sessionId={currentSession}
            transcribedText={transcriptionText}
            onTranscriptionProcessed={() => setTranscriptionText("")}
          />
        )}

        {/* Voice Transcription Display */}
        {transcriptionText &&
          transcriptionText !== "__AUTO_SUBMIT_SILENCE__" && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                  Voice Transcription
                </h3>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">{transcriptionText}</p>
                </div>
              </CardContent>
            </Card>
          )}
        <Card>
          <CardContent>
            <textarea
              placeholder="NOTES"
              style={{ padding: "4px", width: "100%" }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Session Settings Panel - Right */}
      <div className="lg:col-span-1 space-y-6">
        {/* Quick Actions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              Quick Actions
            </h3>

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
                        <p className="text-sm font-medium text-green-800">
                          Video Ready
                        </p>
                        <p className="text-xs text-green-600">
                          Size:{" "}
                          {Math.round((videoBlob.size / 1024 / 1024) * 100) /
                            100}{" "}
                          MB • Type: {videoBlob.type}
                        </p>
                      </div>
                      <CheckCircle className="text-green-600" size={20} />
                    </div>
                  </div>

                  <div className="space-y-2">
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
