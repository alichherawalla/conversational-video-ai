import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Download,
  Slice,
  Images,
  Image,
  AlignLeft,
  Clock,
  Eye,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Session, Clip, ContentPiece } from "@shared/schema";

interface ContentGenerationProps {
  selectedSessionId?: string;
}

export default function ContentGeneration({
  selectedSessionId,
}: ContentGenerationProps) {
  const [selectedSession, setSelectedSession] = useState<string>(
    selectedSessionId || "",
  );

  // Update selected session when prop changes
  useEffect(() => {
    if (selectedSessionId) {
      setSelectedSession(selectedSessionId);
    }
  }, [selectedSessionId]);
  const [viewingContent, setViewingContent] = useState<ContentPiece | null>(
    null,
  );
  const [viewingClip, setViewingClip] = useState<Clip | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>("");
  const [uploadGeneratedContent, setUploadGeneratedContent] = useState<
    ContentPiece[]
  >([]);
  const [uploadGeneratedClips, setUploadGeneratedClips] = useState<Clip[]>([]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: clips = [] } = useQuery<Clip[]>({
    queryKey: ["/api/sessions", selectedSession, "clips"],
    enabled: !!selectedSession,
  });

  const { data: contentPieces = [] } = useQuery<ContentPiece[]>({
    queryKey: ["/api/sessions", selectedSession, "content"],
    enabled: !!selectedSession,
  });

  const generateClipsMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/sessions/${sessionId}/generate-clips`,
      );
      return res.json();
    },
    onSuccess: () => {
      // Invalidate clips query to refresh the display
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", selectedSession, "clips"],
      });
    },
  });

  const generateContentMutation = useMutation({
    mutationFn: async ({
      sessionId,
      type,
    }: {
      sessionId: string;
      type: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/sessions/${sessionId}/generate-content`,
        { contentType: type },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", selectedSession, "content"],
      });
    },
  });

  const createVideoClipsMutation = useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/sessions/${data.sessionId}/create-clips`,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", selectedSession, "clips"],
      });
      toast({
        title: "Video Clips Created",
        description:
          "Actual video files have been cut and created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Video Clipping Failed",
        description: error.message || "Failed to create video clips",
        variant: "destructive",
      });
    },
  });

  // Session content generation mutation (like upload version)
  const sessionContentMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const allContent = [];

      // Generate 3 posts for each content type (9 total) with separate API calls
      const contentTypes = ["carousel", "image", "text"];

      for (const contentType of contentTypes) {
        // Make 3 separate API calls for each content type
        for (let i = 0; i < 3; i++) {
          const res = await apiRequest(
            "POST",
            `/api/sessions/${sessionId}/generate-content`,
            {
              contentType,
            },
          );
          const result = await res.json();
          allContent.push(result);
        }
      }

      // Generate video clips
      const clipsRes = await apiRequest(
        "POST",
        `/api/sessions/${sessionId}/generate-clips`,
      );
      const clips = await clipsRes.json();

      return { content: allContent, clips };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", selectedSession, "clips"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", selectedSession, "content"],
      });
      toast({
        title: "Content Generated",
        description:
          "Generated 9 LinkedIn posts and video clips from your session!",
      });
    },
    onError: (error) => {
      console.error("Session content generation error:", error);
      toast({
        title: "Generation Failed",
        description:
          "Failed to generate content from session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadContentMutation = useMutation({
    mutationFn: async ({ transcript }: { transcript: string }) => {
      setUploadGeneratedContent([]); // Clear previous results
      setUploadGeneratedClips([]);

      // Generate comprehensive content (7-8 posts across all types) in one API call
      const contentRes = await apiRequest(
        "POST",
        "/api/generate-content-from-upload",
        {
          transcript,
          generateComprehensive: true, // Use new comprehensive generation
        },
      );
      const contentResult = await contentRes.json();

      // Generate video clips
      const clipsRes = await apiRequest(
        "POST",
        "/api/generate-clips-from-upload",
        { transcript },
      );
      const clips = await clipsRes.json();

      return { 
        content: contentResult.posts || [], 
        clips,
        summary: contentResult.summary
      };
    },
    onSuccess: (data) => {
      setUploadGeneratedContent(data.content);
      setUploadGeneratedClips(data.clips);
      toast({
        title: "Content Generated Successfully",
        description: data.summary 
          ? `Generated ${data.summary.total} LinkedIn posts: ${data.summary.carousels} carousels, ${data.summary.images} images, ${data.summary.texts} text posts, and ${data.clips.length} video clips!`
          : `Generated ${data.content.length} LinkedIn posts and ${data.clips.length} video clips!`,
      });
    },
    onError: (error) => {
      console.error("Upload content generation error:", error);
      toast({
        title: "Generation Failed",
        description:
          "Failed to generate content from upload. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Transcribe video only (extract transcript from video)
  const videoTranscribeMutation = useMutation({
    mutationFn: async ({ videoFile }: { videoFile: File }) => {
      if (!videoFile) {
        throw new Error("No video file provided");
      }

      console.log(
        "Starting video transcription:",
        videoFile.name,
        "Size:",
        videoFile.size,
      );

      const formData = new FormData();
      formData.append("video", videoFile, videoFile.name);

      const response = await fetch("/api/upload-video-transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Video transcription error:", errorText);
        throw new Error(
          `Video transcription failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log("Video transcription success:", result);
      return result;
    },
    onSuccess: (data) => {
      const text = data.transcript.words
        ? data.transcript.words.map((w) => JSON.stringify(w)).join(" ")
        : data.transcript?.text;
      setUploadedTranscript(text || "");
      toast({
        title: "Video Transcribed Successfully",
        description: `Extracted ${data.transcript?.text?.length || 0} characters of transcript. You can now generate content or video clips.`,
      });
    },
    onError: (error) => {
      console.error("Video transcription error:", error);
      toast({
        title: "Video Transcription Failed",
        description:
          "Failed to transcribe video file. Please try a smaller file or paste transcript text instead.",
        variant: "destructive",
      });
    },
  });

  // Generate video clips from video + transcript
  const videoClipMutation = useMutation({
    mutationFn: async ({
      videoFile,
      transcript,
    }: {
      videoFile: File;
      transcript: string;
    }) => {
      if (!videoFile || !transcript.trim()) {
        throw new Error(
          "Both video file and transcript are required for video clipping",
        );
      }

      console.log("Starting video clip generation:", videoFile.name);

      const formData = new FormData();
      formData.append("video", videoFile, videoFile.name);
      formData.append("transcript", transcript);

      const response = await fetch("/api/upload-video-generate-clips", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Video clip generation error:", errorText);
        throw new Error(
          `Video clip generation failed: ${response.status} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log("Video clip generation success:", result);
      return result;
    },
    onSuccess: (data) => {
      setUploadGeneratedClips(data.clips || []);
      toast({
        title: "Video Clips Generated Successfully",
        description: `Generated ${data.clips?.length || 0} video clips with precise timing!`,
      });
    },
    onError: (error) => {
      console.error("Video clip generation error:", error);
      toast({
        title: "Video Clip Generation Failed",
        description:
          "Failed to generate video clips. Check that transcript matches the video content.",
        variant: "destructive",
      });
    },
  });

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileSizeMB = Math.round(file.size / 1024 / 1024);
      if (fileSizeMB > 500) {
        toast({
          title: "File Too Large",
          description:
            "Video files must be under 500MB. Please compress your video or use the transcript-only option.",
          variant: "destructive",
        });
        event.target.value = ""; // Clear the input
        return;
      }

      if (fileSizeMB > 100) {
        toast({
          title: "Large File Detected",
          description: `Your ${fileSizeMB}MB video will take 5-15 minutes to process. Please be patient.`,
        });
      }

      setUploadedVideo(file);
    }
  };

  const handleTranscriptUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedTranscript(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const transcribeVideo = async () => {
    if (!uploadedVideo) {
      alert("Please select a video file first");
      return;
    }

    try {
      await videoTranscribeMutation.mutateAsync({
        videoFile: uploadedVideo,
      });
    } catch (error) {
      console.error("Failed to transcribe video:", error);
    }
  };

  const generateContentFromTranscript = async () => {
    if (!uploadedTranscript.trim()) {
      alert(
        "Please provide a transcript (transcribe a video or paste/upload text)",
      );
      return;
    }

    try {
      await uploadContentMutation.mutateAsync({
        transcript: uploadedTranscript,
      });
    } catch (error) {
      console.error("Failed to generate content:", error);
    }
  };

  const generateVideoClips = async () => {
    if (!uploadedVideo || !uploadedTranscript.trim()) {
      alert(
        "Both video file and transcript are required for video clip generation",
      );
      return;
    }

    try {
      await videoClipMutation.mutateAsync({
        videoFile: uploadedVideo,
        transcript: uploadedTranscript,
      });
    } catch (error) {
      console.error("Failed to generate video clips:", error);
    }
  };

  const selectedSessionData = sessions.find((s) => s.id === selectedSession);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const downloadContentPackage = async (
    sessionData?: any,
    uploadData?: { transcript: string; content: any[]; clips: any[] },
  ) => {
    try {
      if (sessionData) {
        // Download session-based content
        const response = await apiRequest(
          "GET",
          `/api/download-session-package/${sessionData.id}`,
        );
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sessionData.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_package.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (uploadData) {
        // Download upload-based content package
        const response = await apiRequest(
          "POST",
          "/api/download-upload-package",
          uploadData,
        );
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `upload_content_package_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  if (!selectedSession && !uploadMode) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-neutral-800 mb-4">
            Content Generation
          </h2>
          <p className="text-neutral-600 mb-6">
            Generate LinkedIn content by uploading your own content
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Upload Mode */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Upload Content</h3>
                <Button
                  onClick={() => setUploadMode(true)}
                  className="w-full"
                  variant="outline"
                >
                  Upload Video & Transcript
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (uploadMode) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-neutral-800">
            Upload Content
          </h2>
          <div className="flex items-center gap-3">
            <Button
              onClick={() =>
                downloadContentPackage(undefined, {
                  transcript: uploadedTranscript,
                  content: uploadGeneratedContent,
                  clips: uploadGeneratedClips,
                })
              }
              disabled={
                uploadGeneratedContent.length === 0 &&
                uploadGeneratedClips.length === 0
              }
              className="bg-primary text-white hover:bg-primary/90"
            >
              <Download className="mr-2" size={16} />
              Download Package
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setUploadMode(false);
                setUploadedVideo(null);
                setUploadedTranscript("");
                setUploadGeneratedContent([]);
                setUploadGeneratedClips([]);
              }}
            >
              Back to Sessions
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Upload Options */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Choose Upload Method</h3>

              {/* Video Upload Option */}
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center">
                    <Play className="mr-2" size={16} />
                    Video Upload (Recommended)
                  </h4>
                  <p className="text-sm text-neutral-600 mb-3">
                    Upload a video file - we'll automatically extract audio and
                    generate precise word-level timestamps for accurate video
                    clips
                  </p>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {uploadedVideo && (
                    <p className="text-sm text-green-600 mt-2 flex items-center">
                      ✓ Video ready: {uploadedVideo.name}
                    </p>
                  )}
                </div>

                <div className="text-center text-neutral-500 text-sm py-2">
                  or
                </div>

                {/* Transcript Upload Option */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center">
                    <AlignLeft className="mr-2" size={16} />
                    Transcript Only
                  </h4>
                  <p className="text-sm text-neutral-600 mb-3">
                    Upload or paste transcript text (video clips will use
                    estimated timing)
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Upload Transcript File
                      </label>
                      <input
                        type="file"
                        accept=".txt,.md,.doc,.docx"
                        onChange={handleTranscriptUpload}
                        className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
                      />
                    </div>

                    <div className="text-center text-neutral-400 text-xs">
                      or
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Paste Transcript Text
                      </label>
                      <textarea
                        value={uploadedTranscript}
                        onChange={(e) => setUploadedTranscript(e.target.value)}
                        placeholder="Paste your interview transcript here..."
                        className="w-full h-32 p-3 border border-neutral-300 rounded-lg resize-none text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processing Workflow */}
          {(uploadedVideo || uploadedTranscript.trim()) && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Processing Workflow</h3>

                {/* Step 1: Transcribe Video (if video uploaded) */}
                {uploadedVideo && (
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-neutral-700">
                      Step 1: Extract Transcript from Video
                    </h4>
                    <Button
                      onClick={transcribeVideo}
                      disabled={videoTranscribeMutation.isPending}
                      className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {videoTranscribeMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2" size={16} />
                          Transcribing Video (5-15 min for large files)...
                        </>
                      ) : (
                        <>
                          <AlignLeft className="mr-2" size={16} />
                          Extract Transcript from Video
                        </>
                      )}
                    </Button>
                    {videoTranscribeMutation.isPending && (
                      <div className="text-sm text-neutral-600 mt-2 space-y-1">
                        <p>
                          🎬 Processing video file (this may take several
                          minutes)...
                        </p>
                        <p>
                          🎤 Extracting audio and transcribing with word-level
                          timing...
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Generate Content (if transcript available) */}
                {uploadedTranscript.trim() && (
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-neutral-700">
                      {uploadedVideo
                        ? "Step 2a: Generate LinkedIn Content"
                        : "Generate LinkedIn Content"}
                    </h4>
                    <Button
                      onClick={generateContentFromTranscript}
                      disabled={uploadContentMutation.isPending}
                      className="w-full bg-primary text-white hover:bg-primary/90"
                    >
                      {uploadContentMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2" size={16} />
                          Generating Content...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2" size={16} />
                          Generate All Content (7-8 Posts)
                        </>
                      )}
                    </Button>
                    {uploadContentMutation.isPending && (
                      <div className="text-sm text-neutral-600 mt-2">
                        <p>Creating comprehensive LinkedIn content...</p>
                        <p className="text-xs mt-1">
                          Generating 7-8 unique posts with different angles and variations...
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Generate Video Clips (if video + transcript available) */}
                {uploadedVideo && uploadedTranscript.trim() && (
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-neutral-700">
                      Step 2b: Generate Video Clips
                    </h4>
                    <Button
                      onClick={generateVideoClips}
                      disabled={videoClipMutation.isPending}
                      className="w-full bg-green-600 text-white hover:bg-green-700"
                    >
                      {videoClipMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2" size={16} />
                          Generating Video Clips...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2" size={16} />
                          Generate Video Clips
                        </>
                      )}
                    </Button>
                    {videoClipMutation.isPending && (
                      <div className="text-sm text-neutral-600 mt-2">
                        <p>Creating video clips...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Success Messages */}
                {uploadContentMutation.isSuccess && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ Generated {uploadGeneratedContent.length} LinkedIn posts!
                  </p>
                )}
                {videoClipMutation.isSuccess && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ Generated {uploadGeneratedClips.length} video clips with
                    precise timing!
                  </p>
                )}

                {/* Help Text */}
                <div className="text-xs text-neutral-500 mt-4 p-3 bg-neutral-50 rounded-lg">
                  <strong>Workflow Options:</strong>
                  <br />• <strong>Content only:</strong> Upload/paste transcript
                  → Generate content
                  <br />• <strong>Video clips:</strong> Upload video → Extract
                  transcript → Generate clips
                  <br />• <strong>Both:</strong> Upload video → Extract
                  transcript → Generate content + clips
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Content Display */}
          {uploadGeneratedContent.length > 0 && (
            <div className="space-y-6">
              {["carousel", "image", "text"].map((contentType) => {
                const filteredContent = uploadGeneratedContent.filter(
                  (c) => c.type === contentType,
                );
                if (filteredContent.length === 0) return null;

                return (
                  <Card key={contentType}>
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-4 flex items-center">
                        {contentType === "carousel" && (
                          <Images className="mr-2" size={16} />
                        )}
                        {contentType === "image" && (
                          <Image className="mr-2" size={16} />
                        )}
                        {contentType === "text" && (
                          <AlignLeft className="mr-2" size={16} />
                        )}
                        LinkedIn{" "}
                        {contentType.charAt(0).toUpperCase() +
                          contentType.slice(1)}{" "}
                        Posts ({filteredContent.length})
                      </h3>
                      <div className="grid gap-4">
                        {filteredContent.map((content, index) => (
                          <div
                            key={`${contentType}-${index}`}
                            className="border rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium">
                                {content.title}
                              </span>
                              <Button
                                size="sm"
                                onClick={() => {
                                  console.log("Viewing content:", content);
                                  setViewingContent(content);
                                }}
                                className="bg-primary text-white hover:bg-primary/90"
                              >
                                <Eye className="mr-1" size={12} />
                                View Full
                              </Button>
                            </div>
                            {contentType === "carousel" && (
                              <div className="bg-gradient-to-br from-primary to-secondary text-white p-3 rounded text-center">
                                <div className="text-xs">📊 Carousel Post</div>
                                <div className="text-sm font-medium">
                                  {(content.content as any)?.slides?.length ||
                                    0}{" "}
                                  slides
                                </div>
                              </div>
                            )}
                            {contentType === "image" && (
                              <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white p-3 rounded text-center">
                                <div className="text-lg mb-1">💡</div>
                                <div className="text-xs font-medium">
                                  {content.title.substring(0, 40)}...
                                </div>
                              </div>
                            )}
                            {contentType === "text" && (
                              <div className="bg-gradient-to-br from-green-500 to-teal-600 text-white p-3 rounded">
                                <div className="text-xs mb-1">✍️ Text Post</div>
                                <div className="text-xs">
                                  {(content.content as any)?.detailed_content
                                    ? `"${(content.content as any).detailed_content.substring(0, 60)}..."`
                                    : (content.content as any)?.hook
                                      ? `Hook: "${(content.content as any).hook.substring(0, 40)}..."`
                                      : "LinkedIn Text Post"}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Generated Video Clips Display */}
          {uploadGeneratedClips.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Generated Video Clips</h3>
                </div>
                <div className="grid gap-4">
                  {uploadGeneratedClips.map((clip, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Play className="mr-2" size={16} />
                          <span className="font-medium">{clip.title}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setViewingClip(clip)}
                            className="bg-primary text-white hover:bg-primary/90"
                          >
                            <Eye className="mr-1" size={12} />
                            View Details
                          </Button>
                          {clip.videoPath && (
                            <Button
                              size="sm"
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = `/api/clips/${clip.id}/download`;
                                link.download = `${clip.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp4`;
                                link.click();
                              }}
                              className="bg-green-600 text-white hover:bg-green-700"
                            >
                              <Download className="mr-1" size={12} />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-neutral-600 mb-2">
                        <Clock className="mr-1" size={12} />
                        {formatTime(clip.startTime)} -{" "}
                        {formatTime(clip.endTime)}(
                        {formatTime(clip.endTime - clip.startTime)} duration)
                      </div>
                      <p className="text-sm text-neutral-600">
                        {clip.description}
                      </p>
                      <div className="text-xs text-neutral-500 mt-2">
                        Social Score: {clip.socialScore}/100
                      </div>
                      {clip.detailed_caption && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <h6 className="text-xs font-medium text-blue-800 mb-1">Detailed Caption:</h6>
                          <p className="text-xs text-blue-700">{clip.detailed_caption}</p>
                        </div>
                      )}
                      {clip.key_moments && (
                        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <h6 className="text-xs font-medium text-green-800 mb-1">Key Moments:</h6>
                          <ul className="text-xs text-green-700 list-disc pl-4">
                            {clip.key_moments.map((moment: string, idx: number) => (
                              <li key={idx}>{moment}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Content Viewing Modal */}
          {viewingContent && (
            <Dialog
              open={!!viewingContent}
              onOpenChange={() => setViewingContent(null)}
            >
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>{viewingContent.title}</span>
                    <Badge variant="secondary">
                      {viewingContent.type.toUpperCase()}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {viewingContent.type === "carousel" && (
                    <div>
                      <h4 className="font-semibold mb-3">
                        LinkedIn Carousel Post
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                        {Array.isArray(
                          (viewingContent.content as any)?.slides,
                        ) &&
                          (viewingContent.content as any).slides.map(
                            (slide: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-gradient-to-br from-primary to-secondary text-white p-3 rounded-lg text-center min-h-[120px] flex flex-col justify-center"
                              >
                                <div className="text-sm font-semibold mb-2">
                                  {slide.title}
                                </div>
                                <div className="text-xs opacity-90">
                                  {slide.content}
                                </div>
                              </div>
                            ),
                          )}
                      </div>
                      <div className="bg-neutral-50 p-4 rounded-lg mb-4">
                        <h5 className="font-medium mb-2">Detailed Post Caption:</h5>
                        <div className="text-sm text-neutral-700 whitespace-pre-wrap mb-3">
                          {(viewingContent.content as any)?.detailed_caption ||
                            (viewingContent.content as any)?.title ||
                            "Professional carousel content"}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(viewingContent.content as any)?.tags?.map(
                            (tag: string, idx: number) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>

                      {/* Creative Direction for Carousels */}
                      {(viewingContent.content as any)?.creative_direction && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-green-800">
                            Creative Direction for Designers:
                          </h5>
                          <p className="text-sm text-green-700">
                            {(viewingContent.content as any).creative_direction}
                          </p>
                        </div>
                      )}

                      {/* Design Specifications */}
                      {(viewingContent.content as any)?.design_specifications && (
                        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-purple-800">
                            Design Specifications:
                          </h5>
                          <div className="space-y-2 text-sm text-purple-700">
                            {(viewingContent.content as any).design_specifications.layout && (
                              <div><strong>Layout:</strong> {(viewingContent.content as any).design_specifications.layout}</div>
                            )}
                            {(viewingContent.content as any).design_specifications.colors && (
                              <div><strong>Colors:</strong> {(viewingContent.content as any).design_specifications.colors}</div>
                            )}
                            {(viewingContent.content as any).design_specifications.typography && (
                              <div><strong>Typography:</strong> {(viewingContent.content as any).design_specifications.typography}</div>
                            )}
                            {(viewingContent.content as any).design_specifications.brand_integration && (
                              <div><strong>Brand Integration:</strong> {(viewingContent.content as any).design_specifications.brand_integration}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {viewingContent.type === "image" && (
                    <div>
                      <h4 className="font-semibold mb-3">
                        LinkedIn Image Post
                      </h4>

                      {/* Image Mock-up */}
                      <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white p-6 rounded-lg mb-4 min-h-[250px] flex flex-col justify-center items-center text-center relative">
                        <div className="text-4xl mb-3">💡</div>
                        <div className="text-xl font-bold mb-3 max-w-md">
                          {(viewingContent.content as any)?.quote_overlay ||
                            (viewingContent.content as any)?.quote ||
                            "Key Insight"}
                        </div>
                        <div className="text-sm opacity-75 absolute bottom-4 right-4">
                          LinkedIn Image Post
                        </div>
                      </div>

                      {/* Detailed Caption */}
                      <div className="bg-neutral-50 p-4 rounded-lg mb-4">
                        <h5 className="font-medium mb-2">Post Caption:</h5>
                        <div className="text-sm text-neutral-700 whitespace-pre-wrap mb-3">
                          {(viewingContent.content as any)?.detailed_caption ||
                            (viewingContent.content as any)?.insight ||
                            "Professional insight from the interview"}
                        </div>
                      </div>

                      {/* Visual Direction for Designers */}
                      {(viewingContent.content as any)
                        ?.illustration_direction && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-yellow-800">
                            Visual Direction for Designers:
                          </h5>
                          <p className="text-sm text-yellow-700">
                            {
                              (viewingContent.content as any)
                                .illustration_direction
                            }
                          </p>
                        </div>
                      )}

                      {/* Visual Elements */}
                      {(viewingContent.content as any)?.visual_elements && (
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-blue-800">
                            Visual Elements Needed:
                          </h5>
                          <ul className="text-sm text-blue-700 list-disc pl-4">
                            {(
                              viewingContent.content as any
                            ).visual_elements.map(
                              (element: string, idx: number) => (
                                <li key={idx}>{element}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Typography & Design Details */}
                      {(viewingContent.content as any)?.typography && (
                        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-indigo-800">
                            Typography Guidelines:
                          </h5>
                          <p className="text-sm text-indigo-700">
                            {(viewingContent.content as any).typography}
                          </p>
                        </div>
                      )}

                      {/* Composition Details */}
                      {(viewingContent.content as any)?.composition && (
                        <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-teal-800">
                            Composition Layout:
                          </h5>
                          <p className="text-sm text-teal-700">
                            {(viewingContent.content as any).composition}
                          </p>
                        </div>
                      )}

                      {/* Design Mood */}
                      {(viewingContent.content as any)?.design_mood && (
                        <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-rose-800">
                            Design Mood & Personality:
                          </h5>
                          <p className="text-sm text-rose-700">
                            {(viewingContent.content as any).design_mood}
                          </p>
                        </div>
                      )}

                      {/* Color Scheme */}
                      {(viewingContent.content as any)?.color_scheme && (
                        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg mb-4">
                          <h5 className="font-medium mb-2 text-purple-800">
                            Color Scheme:
                          </h5>
                          <p className="text-sm text-purple-700">
                            {(viewingContent.content as any).color_scheme}
                          </p>
                        </div>
                      )}

                      {/* Hashtags */}
                      <div className="bg-neutral-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">Hashtags:</h5>
                        <div className="flex flex-wrap gap-1">
                          {(viewingContent.content as any)?.tags?.map(
                            (tag: string, idx: number) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {viewingContent.type === "text" && (
                    <div>
                      <h4 className="font-semibold mb-3">LinkedIn Text Post</h4>
                      <div className="bg-neutral-50 p-6 rounded-lg space-y-4">
                        {/* Handle new detailed_content format */}
                        {(viewingContent.content as any)?.detailed_content ? (
                          <div>
                            <h5 className="font-medium mb-2 text-primary">
                              Complete Post:
                            </h5>
                            <div className="text-neutral-700 whitespace-pre-line p-4 bg-white rounded border">
                              {(viewingContent.content as any).detailed_content}
                            </div>
                          </div>
                        ) : (
                          /* Fallback for old format */
                          <>
                            <div>
                              <h5 className="font-medium mb-2 text-primary">
                                Hook:
                              </h5>
                              <p className="text-neutral-700">
                                {(viewingContent.content as any)?.hook}
                              </p>
                            </div>
                            <div>
                              <h5 className="font-medium mb-2 text-primary">
                                Body:
                              </h5>
                              <div className="text-neutral-700 whitespace-pre-line">
                                {(viewingContent.content as any)?.body}
                              </div>
                            </div>
                            <div>
                              <h5 className="font-medium mb-2 text-primary">
                                Call to Action:
                              </h5>
                              <p className="text-neutral-700">
                                {(viewingContent.content as any)?.callToAction}
                              </p>
                            </div>
                          </>
                        )}

                        {/* Key Quotes */}
                        {(viewingContent.content as any)?.key_quotes && (
                          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <h5 className="font-medium mb-2 text-blue-800">
                              Key Quotes for Social Sharing:
                            </h5>
                            <ul className="text-sm text-blue-700 list-disc pl-4">
                              {(viewingContent.content as any).key_quotes.map(
                                (quote: string, idx: number) => (
                                  <li key={idx} className="mb-1">"{quote}"</li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Engagement Hooks */}
                        {(viewingContent.content as any)?.engagement_hooks && (
                          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                            <h5 className="font-medium mb-2 text-green-800">
                              Engagement Hooks:
                            </h5>
                            <ul className="text-sm text-green-700 list-disc pl-4">
                              {(viewingContent.content as any).engagement_hooks.map(
                                (hook: string, idx: number) => (
                                  <li key={idx} className="mb-1">{hook}</li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}

                        <div>
                          <h5 className="font-medium mb-2 text-primary">
                            Hashtags:
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            {(viewingContent.content as any)?.tags?.map(
                              (tag: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Upload Clip Viewing Modal */}
          {viewingClip && (
            <Dialog
              open={!!viewingClip}
              onOpenChange={() => setViewingClip(null)}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>{viewingClip.title}</span>
                    <Badge variant="secondary">CLIP</Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="bg-neutral-900 aspect-video rounded-lg overflow-hidden relative">
                    {viewingClip.videoPath ? (
                      <video
                        controls
                        className="w-full h-full object-cover"
                        src={`/api/clips/${viewingClip.id}/video`}
                        onError={(e) => {
                          console.error('Video loading error:', e);
                          // Fallback to placeholder if video fails to load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'flex';
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : null}
                    <div className="bg-neutral-900 aspect-video rounded-lg flex items-center justify-center relative" style={{ display: viewingClip.videoPath ? 'none' : 'flex' }}>
                      <div className="text-center text-white">
                        <Play className="mx-auto mb-2" size={48} />
                        <p className="text-sm">Video clip available</p>
                        <p className="text-xs text-neutral-400">Download to play locally</p>
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/50 text-white text-sm px-3 py-1 rounded">
                      {formatTime(viewingClip.startTime)} -{" "}
                      {formatTime(viewingClip.endTime)}
                    </div>
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-sm px-3 py-1 rounded">
                      {formatTime(viewingClip.endTime - viewingClip.startTime)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h5 className="font-medium mb-1">Description:</h5>
                      <p className="text-sm text-neutral-700">
                        {viewingClip.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium mb-1">
                          Social Media Score:
                        </h5>
                        <div className="flex items-center">
                          <div className="w-24 bg-neutral-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${viewingClip.socialScore}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {viewingClip.socialScore}/100
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">
            {selectedSessionData?.title}
          </h2>
          <p className="text-neutral-600">
            Duration: {formatTime(selectedSessionData?.duration || 0)} • Topic:{" "}
            {selectedSessionData?.topic}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() =>
              sessionContentMutation.mutate({ sessionId: selectedSession })
            }
            disabled={!selectedSession || sessionContentMutation.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {sessionContentMutation.isPending
              ? "Generating..."
              : "Generate All Content"}
          </Button>
          <Button
            onClick={() => downloadContentPackage(selectedSessionData)}
            disabled={!selectedSession}
            className="bg-primary text-white hover:bg-primary/90"
          >
            <Download className="mr-2" size={16} />
            Download Package
          </Button>
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {sessions
                .filter((session) => session.status === "completed")
                .map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.title} - {formatTime(session.duration || 0)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Video Clips Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-neutral-800">
              <Slice className="text-primary mr-2 inline" size={20} />
              Video Clips with Timestamps
            </h3>
            <div className="flex gap-2">
              <Button
                onClick={() => generateClipsMutation.mutate(selectedSession)}
                disabled={generateClipsMutation.isPending}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {generateClipsMutation.isPending
                  ? "Analyzing..."
                  : "Generate Clips"}
              </Button>
              {clips.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      createVideoClipsMutation.mutate({
                        sessionId: selectedSession,
                      })
                    }
                    disabled={createVideoClipsMutation.isPending}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    {createVideoClipsMutation.isPending
                      ? "Cutting..."
                      : "Create Video Files"}
                  </Button>
                  {clips.some((clip) => clip.videoPath) && (
                    <Button
                      onClick={() =>
                        window.open(
                          `/api/sessions/${selectedSession}/download-clips`,
                          "_blank",
                        )
                      }
                      variant="outline"
                      className="border-secondary text-secondary hover:bg-secondary/10"
                    >
                      <Download className="mr-1" size={16} />
                      Download All Clips
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {clips.length === 0 && !generateClipsMutation.isPending && (
            <div className="text-center py-8 text-neutral-500">
              <p className="mb-2">No video clips generated yet</p>
              <p className="text-sm">
                Generate clips to create short, shareable video segments with
                timestamps
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="border border-neutral-200 rounded-lg overflow-hidden"
              >
                <div className="aspect-video bg-neutral-900 relative">
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {formatTime(clip.endTime - clip.startTime)}
                  </div>
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center">
                    <Clock size={12} className="mr-1" />
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30">
                      <Play className="text-white ml-1" size={16} />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-medium text-neutral-800 mb-1">
                    {clip.title}
                  </h4>
                  <p className="text-sm text-neutral-600 mb-2">
                    {clip.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Score: {clip.socialScore}/100
                    </span>
                    <div className="flex gap-1">
                      {clip.videoPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/api/clips/${clip.id}/download`,
                              "_blank",
                            )
                          }
                          title="Download video clip"
                        >
                          <Download className="mr-1" size={12} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingClip(clip)}
                      >
                        <Eye className="mr-1" size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Content Generation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Carousel Content */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              <Images className="text-primary mr-2 inline" size={20} />
              LinkedIn Carousels
            </h3>

            <div className="space-y-4">
              {contentPieces.filter((cp) => cp.type === "carousel").length ===
                0 &&
                !generateContentMutation.isPending && (
                  <div className="text-center py-4 text-neutral-500 text-sm">
                    No carousel posts yet. Generate to create professional slide
                    content.
                  </div>
                )}

              {contentPieces
                .filter((cp) => cp.type === "carousel")
                .slice(0, 2)
                .map((content) => (
                  <div
                    key={content.id}
                    className="border border-neutral-200 rounded-lg p-3"
                  >
                    <h4 className="font-medium text-neutral-800 mb-2">
                      {content.title}
                    </h4>
                    <div className="grid grid-cols-5 gap-1 mb-3">
                      {Array.from(
                        {
                          length: Math.min(
                            5,
                            (content.content as any)?.slides?.length || 5,
                          ),
                        },
                        (_, i) => (
                          <div
                            key={i}
                            className="aspect-square bg-primary/10 rounded flex items-center justify-center text-xs"
                          >
                            {i + 1}
                          </div>
                        ),
                      )}
                    </div>
                    <div className="text-sm text-neutral-600 mb-2">
                      {Array.isArray((content.content as any)?.slides) &&
                        (content.content as any).slides
                          .slice(0, 2)
                          .map((slide: any, idx: number) => (
                            <p key={idx} className="mb-1">
                              <span className="text-primary font-medium">
                                {slide.title}
                              </span>
                            </p>
                          ))}
                      {Array.isArray((content.content as any)?.slides) &&
                        (content.content as any).slides.length > 2 && (
                          <p className="text-xs text-neutral-500">
                            +{(content.content as any).slides.length - 2} more
                            slides
                          </p>
                        )}
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-primary text-white hover:bg-primary/90"
                      onClick={() => setViewingContent(content)}
                    >
                      <Eye className="mr-1" size={12} />
                      View Full Carousel
                    </Button>
                  </div>
                ))}

              <Button
                onClick={() =>
                  generateContentMutation.mutate({
                    sessionId: selectedSession,
                    type: "carousel",
                  })
                }
                disabled={generateContentMutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {generateContentMutation.isPending
                  ? "Generating..."
                  : "Generate New Carousel"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Image Content */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              <Image className="text-secondary mr-2 inline" size={20} />
              LinkedIn Image Posts
            </h3>

            <div className="space-y-4">
              {contentPieces.filter((cp) => cp.type === "image").length === 0 &&
                !generateContentMutation.isPending && (
                  <div className="text-center py-4 text-neutral-500 text-sm">
                    No image posts yet. Generate to create quote cards and
                    visual content.
                  </div>
                )}

              {contentPieces
                .filter((cp) => cp.type === "image")
                .slice(0, 2)
                .map((content) => (
                  <div
                    key={content.id}
                    className="border border-neutral-200 rounded-lg p-3"
                  >
                    <div className="aspect-square bg-gradient-to-br from-primary to-secondary rounded-lg mb-3 flex items-center justify-center text-white text-sm font-medium">
                      Quote Card
                    </div>
                    <h4 className="font-medium text-neutral-800 mb-2">
                      {content.title}
                    </h4>
                    <p className="text-sm text-neutral-600 mb-2">
                      "
                      {(content.content as any)?.quote ||
                        "Key insight from interview"}
                      "
                    </p>
                    <Button
                      size="sm"
                      className="w-full bg-primary text-white hover:bg-primary/90"
                      onClick={() => setViewingContent(content)}
                    >
                      <Eye className="mr-1" size={12} />
                      View Image Post
                    </Button>
                  </div>
                ))}

              <Button
                onClick={() =>
                  generateContentMutation.mutate({
                    sessionId: selectedSession,
                    type: "image",
                  })
                }
                disabled={generateContentMutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {generateContentMutation.isPending
                  ? "Generating..."
                  : "Generate New Image"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Text Content */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              <AlignLeft className="text-accent mr-2 inline" size={20} />
              LinkedIn Text Posts
            </h3>

            <div className="space-y-4">
              {contentPieces.filter((cp) => cp.type === "text").length === 0 &&
                !generateContentMutation.isPending && (
                  <div className="text-center py-4 text-neutral-500 text-sm">
                    No text posts yet. Generate to create engaging LinkedIn
                    stories.
                  </div>
                )}

              {contentPieces
                .filter((cp) => cp.type === "text")
                .slice(0, 2)
                .map((content) => (
                  <div
                    key={content.id}
                    className="border border-neutral-200 rounded-lg p-3"
                  >
                    <h4 className="font-medium text-neutral-800 mb-2">
                      {content.title}
                    </h4>
                    <div className="bg-neutral-50 rounded p-2 mb-2 text-sm text-neutral-700">
                      <p className="font-medium text-neutral-800">
                        {(content.content as any)?.hook || "Opening hook..."}
                      </p>
                      <p className="mt-1 line-clamp-2">
                        {(content.content as any)?.body?.substring(0, 80) ||
                          "Content preview..."}
                        ...
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(content.content as any)?.tags
                          ?.slice(0, 2)
                          .map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-primary text-white hover:bg-primary/90"
                      onClick={() => setViewingContent(content)}
                    >
                      <Eye className="mr-1" size={12} />
                      View Full Post
                    </Button>
                  </div>
                ))}

              <Button
                onClick={() =>
                  generateContentMutation.mutate({
                    sessionId: selectedSession,
                    type: "text",
                  })
                }
                disabled={generateContentMutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {generateContentMutation.isPending
                  ? "Generating..."
                  : "Generate New Post"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Viewing Modals */}
      {viewingContent && (
        <Dialog
          open={!!viewingContent}
          onOpenChange={() => setViewingContent(null)}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{viewingContent.title}</span>
                <Badge variant="secondary">
                  {viewingContent.type.toUpperCase()}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {viewingContent.type === "carousel" && (
                <div>
                  <h4 className="font-semibold mb-3">LinkedIn Carousel Post</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    {Array.isArray((viewingContent.content as any)?.slides) &&
                      (viewingContent.content as any).slides.map(
                        (slide: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-gradient-to-br from-primary to-secondary text-white p-3 rounded-lg text-center min-h-[120px] flex flex-col justify-center"
                          >
                            <div className="text-sm font-semibold mb-2">
                              {slide.title}
                            </div>
                            <div className="text-xs opacity-90">
                              {slide.content}
                            </div>
                          </div>
                        ),
                      )}
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <h5 className="font-medium mb-2">Post Caption:</h5>
                    <p className="text-sm text-neutral-700 mb-3">
                      {(viewingContent.content as any)?.title}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(viewingContent.content as any)?.tags?.map(
                        (tag: string, idx: number) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {viewingContent.type === "image" && (
                <div>
                  <h4 className="font-semibold mb-3">LinkedIn Image Post</h4>
                  <div className="bg-gradient-to-br from-primary to-secondary text-white p-8 rounded-lg text-center mb-4 min-h-[200px] flex flex-col justify-center">
                    <blockquote className="text-xl font-medium mb-2">
                      "{(viewingContent.content as any)?.quote}"
                    </blockquote>
                    <div className="text-sm opacity-90">
                      {(viewingContent.content as any)?.insight}
                    </div>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <h5 className="font-medium mb-2">Post Caption:</h5>
                    <p className="text-sm text-neutral-700 mb-3">
                      {(viewingContent.content as any)?.title}
                    </p>
                    {(viewingContent.content as any)?.statistic && (
                      <p className="text-sm text-neutral-600 mb-3">
                        <strong>Key Stat:</strong>{" "}
                        {(viewingContent.content as any)?.statistic}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(viewingContent.content as any)?.tags?.map(
                        (tag: string, idx: number) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {viewingContent.type === "text" && (
                <div>
                  <h4 className="font-semibold mb-3">LinkedIn Text Post</h4>
                  <div className="bg-neutral-50 p-4 rounded-lg space-y-3">
                    <div>
                      <h5 className="font-medium text-primary">Hook:</h5>
                      <p className="text-sm text-neutral-700">
                        {(viewingContent.content as any)?.hook}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-primary">Content:</h5>
                      <div className="text-sm text-neutral-700 whitespace-pre-line">
                        {(viewingContent.content as any)?.body}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-medium text-primary">
                        Call to Action:
                      </h5>
                      <p className="text-sm text-neutral-700">
                        {(viewingContent.content as any)?.callToAction}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-primary">Hashtags:</h5>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(viewingContent.content as any)?.tags?.map(
                          (tag: string, idx: number) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={() => setViewingContent(null)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Clip Viewing Modal */}
      {viewingClip && (
        <Dialog open={!!viewingClip} onOpenChange={() => setViewingClip(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{viewingClip.title}</span>
                <Badge variant="secondary">
                  Score: {viewingClip.socialScore}/100
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="aspect-video bg-neutral-900 rounded-lg relative">
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {formatTime(viewingClip.endTime - viewingClip.startTime)}
                </div>
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center">
                  <Clock size={12} className="mr-1" />
                  {formatTime(viewingClip.startTime)} -{" "}
                  {formatTime(viewingClip.endTime)}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30">
                    <Play className="text-white ml-1" size={24} />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h5 className="font-medium text-primary mb-1">
                    Description:
                  </h5>
                  <p className="text-sm text-neutral-700">
                    {viewingClip.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-neutral-500">Start Time</p>
                    <p className="font-medium">
                      {formatTime(viewingClip.startTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">End Time</p>
                    <p className="font-medium">
                      {formatTime(viewingClip.endTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Duration</p>
                    <p className="font-medium">
                      {formatTime(viewingClip.endTime - viewingClip.startTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Badge variant="outline">
                    Platform: {viewingClip.platform}
                  </Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Download className="mr-1" size={12} />
                      Export Clip
                    </Button>
                    <Button size="sm" onClick={() => setViewingClip(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
