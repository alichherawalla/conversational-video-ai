import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Play, Download, Slice, Images, Image, AlignLeft, Clock, Eye, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Session, Clip, ContentPiece } from "@shared/schema";

export default function ContentGeneration() {
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [viewingContent, setViewingContent] = useState<ContentPiece | null>(null);
  const [viewingClip, setViewingClip] = useState<Clip | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>("");
  const [uploadGeneratedContent, setUploadGeneratedContent] = useState<ContentPiece[]>([]);
  const [uploadGeneratedClips, setUploadGeneratedClips] = useState<Clip[]>([]);
  
  const queryClient = useQueryClient();

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
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/generate-clips`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", selectedSession, "clips"] });
    },
  });

  const generateContentMutation = useMutation({
    mutationFn: async ({ sessionId, type }: { sessionId: string; type: string }) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/generate-content`, { contentType: type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", selectedSession, "content"] });
    },
  });

  const uploadContentMutation = useMutation({
    mutationFn: async ({ transcript }: { transcript: string }) => {
      const results = [];
      setUploadGeneratedContent([]); // Clear previous results
      
      // Generate content types one by one
      const contentTypes = ['carousel', 'image', 'text'];
      
      for (const contentType of contentTypes) {
        const res = await apiRequest("POST", "/api/generate-content-from-upload", { transcript, contentType });
        const result = await res.json();
        results.push(result);
        
        // Update state after each generation to show progress
        setUploadGeneratedContent([...results]);
      }
      
      // Also generate video clips
      const clipsRes = await apiRequest("POST", "/api/generate-clips-from-upload", { transcript });
      const clips = await clipsRes.json();
      setUploadGeneratedClips(clips);
      
      return { content: results, clips };
    },
    onSuccess: (data) => {
      // Content is already set incrementally in the mutation function
      // Clips are set after generation
    }
  });

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedVideo(file);
    }
  };

  const handleTranscriptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedTranscript(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const generateFromUpload = async () => {
    if (!uploadedTranscript.trim()) {
      alert("Please provide a transcript (either upload a file or paste text)");
      return;
    }
    
    try {
      await uploadContentMutation.mutateAsync({ 
        transcript: uploadedTranscript
      });
    } catch (error) {
      console.error("Failed to generate content from upload:", error);
      alert("Failed to generate content. Please try again.");
    }
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedSession && !uploadMode) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-neutral-800 mb-4">Content Generation</h2>
          <p className="text-neutral-600 mb-6">
            Generate LinkedIn content from existing sessions or upload your own content
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Existing Sessions */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">From Existing Session</h3>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions
                      .filter(session => session.status === "completed")
                      .map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.title} - {formatTime(session.duration || 0)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

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
          <h2 className="text-2xl font-semibold text-neutral-800">Upload Content</h2>
          <Button variant="outline" onClick={() => {
            setUploadMode(false);
            setUploadedVideo(null);
            setUploadedTranscript("");
            setUploadGeneratedContent([]);
            setUploadGeneratedClips([]);
          }}>
            Back to Sessions
          </Button>
        </div>

        <div className="space-y-6">
          {/* Video Upload */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Video Upload (Optional)</h3>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
              />
              {uploadedVideo && (
                <p className="text-sm text-green-600 mt-2">
                  Video uploaded: {uploadedVideo.name}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Transcript Upload */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Transcript (Required)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Upload Transcript File</label>
                  <input
                    type="file"
                    accept=".txt,.md,.doc,.docx"
                    onChange={handleTranscriptUpload}
                    className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
                  />
                </div>
                
                <div className="text-center text-neutral-500 text-sm">or</div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Paste Transcript Text</label>
                  <textarea
                    value={uploadedTranscript}
                    onChange={(e) => setUploadedTranscript(e.target.value)}
                    placeholder="Paste your interview transcript here..."
                    className="w-full h-48 p-3 border border-neutral-300 rounded-lg resize-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Generation */}
          {uploadedTranscript && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Generate Content</h3>
                <Button 
                  onClick={generateFromUpload}
                  disabled={uploadContentMutation.isPending}
                  className="w-full bg-primary text-white hover:bg-primary/90"
                >
                  {uploadContentMutation.isPending ? "Generating All Content Types..." : "Generate LinkedIn Content (All Types)"}
                </Button>
                {uploadContentMutation.isPending && (
                  <div className="text-sm text-neutral-600 mt-2">
                    <p>Creating LinkedIn content and video clips...</p>
                    <p className="text-xs mt-1">
                      Generated {uploadGeneratedContent.length}/3 content pieces
                      {uploadGeneratedClips.length > 0 && ` + ${uploadGeneratedClips.length} video clips`}
                    </p>
                  </div>
                )}
                {uploadContentMutation.isSuccess && (
                  <p className="text-sm text-green-600 mt-2">
                    Generated {uploadGeneratedContent.length} LinkedIn posts and {uploadGeneratedClips.length} video clips! View them below.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Generated Content Display */}
          {uploadGeneratedContent.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Generated LinkedIn Content</h3>
                <div className="grid gap-4">
                  {uploadGeneratedContent.map((content, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          {content.type === 'carousel' && <Images className="mr-2" size={16} />}
                          {content.type === 'image' && <Image className="mr-2" size={16} />}
                          {content.type === 'text' && <AlignLeft className="mr-2" size={16} />}
                          <span className="font-medium capitalize">{content.type} Post</span>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => setViewingContent(content)}
                          className="bg-primary text-white hover:bg-primary/90"
                        >
                          <Eye className="mr-1" size={12} />
                          View Full
                        </Button>
                      </div>
                      <p className="text-sm text-neutral-600">{content.title}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Video Clips Display */}
          {uploadGeneratedClips.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Generated Video Clips</h3>
                <div className="grid gap-4">
                  {uploadGeneratedClips.map((clip, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Play className="mr-2" size={16} />
                          <span className="font-medium">{clip.title}</span>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => setViewingClip(clip)}
                          className="bg-primary text-white hover:bg-primary/90"
                        >
                          <Eye className="mr-1" size={12} />
                          View Details
                        </Button>
                      </div>
                      <div className="flex items-center text-sm text-neutral-600 mb-2">
                        <Clock className="mr-1" size={12} />
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)} 
                        ({formatTime(clip.endTime - clip.startTime)} duration)
                      </div>
                      <p className="text-sm text-neutral-600">{clip.description}</p>
                      <div className="text-xs text-neutral-500 mt-2">
                        Social Score: {clip.socialScore}/100
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
          <h2 className="text-2xl font-semibold text-neutral-800">{selectedSessionData?.title}</h2>
          <p className="text-neutral-600">
            Duration: {formatTime(selectedSessionData?.duration || 0)} • 
            Topic: {selectedSessionData?.topic}
          </p>
        </div>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a session" />
          </SelectTrigger>
          <SelectContent>
            {sessions
              .filter(session => session.status === "completed")
              .map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.title} - {formatTime(session.duration || 0)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Video Clips Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-neutral-800">
              <Slice className="text-primary mr-2 inline" size={20} />
              Video Clips with Timestamps
            </h3>
            <Button
              onClick={() => generateClipsMutation.mutate(selectedSession)}
              disabled={generateClipsMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {generateClipsMutation.isPending ? "Analyzing..." : "Generate Clips"}
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clips.map((clip) => (
              <div key={clip.id} className="border border-neutral-200 rounded-lg overflow-hidden">
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
                  <h4 className="font-medium text-neutral-800 mb-1">{clip.title}</h4>
                  <p className="text-sm text-neutral-600 mb-2">{clip.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Score: {clip.socialScore}/100
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setViewingClip(clip)}
                    >
                      <Eye className="mr-1" size={12} />
                      View Details
                    </Button>
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
              {contentPieces
                .filter(cp => cp.type === "carousel")
                .slice(0, 2)
                .map((content) => (
                  <div key={content.id} className="border border-neutral-200 rounded-lg p-3">
                    <h4 className="font-medium text-neutral-800 mb-2">{content.title}</h4>
                    <div className="grid grid-cols-5 gap-1 mb-3">
                      {Array.from({ length: Math.min(5, (content.content as any)?.slides?.length || 5) }, (_, i) => (
                        <div key={i} className="aspect-square bg-primary/10 rounded flex items-center justify-center text-xs">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <div className="text-sm text-neutral-600 mb-2">
                      {Array.isArray((content.content as any)?.slides) && 
                        (content.content as any).slides.slice(0, 2).map((slide: any, idx: number) => (
                          <p key={idx} className="mb-1">
                            <span className="text-primary font-medium">{slide.icon}</span> {slide.title}
                          </p>
                        ))
                      }
                      {Array.isArray((content.content as any)?.slides) && (content.content as any).slides.length > 2 && (
                        <p className="text-xs text-neutral-500">+{(content.content as any).slides.length - 2} more slides</p>
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
                onClick={() => generateContentMutation.mutate({ sessionId: selectedSession, type: "carousel" })}
                disabled={generateContentMutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {generateContentMutation.isPending ? "Generating..." : "Generate New Carousel"}
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
              {contentPieces
                .filter(cp => cp.type === "image")
                .slice(0, 2)
                .map((content) => (
                  <div key={content.id} className="border border-neutral-200 rounded-lg p-3">
                    <div className="aspect-square bg-gradient-to-br from-primary to-secondary rounded-lg mb-3 flex items-center justify-center text-white text-sm font-medium">
                      Quote Card
                    </div>
                    <h4 className="font-medium text-neutral-800 mb-2">{content.title}</h4>
                    <p className="text-sm text-neutral-600 mb-2">
                      "{(content.content as any)?.quote || 'Key insight from interview'}"
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
                onClick={() => generateContentMutation.mutate({ sessionId: selectedSession, type: "image" })}
                disabled={generateContentMutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {generateContentMutation.isPending ? "Generating..." : "Generate New Image"}
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
              {contentPieces
                .filter(cp => cp.type === "text")
                .slice(0, 2)
                .map((content) => (
                  <div key={content.id} className="border border-neutral-200 rounded-lg p-3">
                    <h4 className="font-medium text-neutral-800 mb-2">{content.title}</h4>
                    <div className="bg-neutral-50 rounded p-2 mb-2 text-sm text-neutral-700">
                      <p className="font-medium text-neutral-800">{(content.content as any)?.hook || 'Opening hook...'}</p>
                      <p className="mt-1 line-clamp-2">{(content.content as any)?.body?.substring(0, 80) || 'Content preview...'}...</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(content.content as any)?.tags?.slice(0, 2).map((tag: string, idx: number) => (
                          <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
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
                onClick={() => generateContentMutation.mutate({ sessionId: selectedSession, type: "text" })}
                disabled={generateContentMutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {generateContentMutation.isPending ? "Generating..." : "Generate New Post"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Viewing Modals */}
      {viewingContent && (
        <Dialog open={!!viewingContent} onOpenChange={() => setViewingContent(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{viewingContent.title}</span>
                <Badge variant="secondary">{viewingContent.type.toUpperCase()}</Badge>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {viewingContent.type === "carousel" && (
                <div>
                  <h4 className="font-semibold mb-3">LinkedIn Carousel Post</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    {Array.isArray((viewingContent.content as any)?.slides) && 
                      (viewingContent.content as any).slides.map((slide: any, idx: number) => (
                        <div key={idx} className="bg-gradient-to-br from-primary to-secondary text-white p-3 rounded-lg text-center min-h-[120px] flex flex-col justify-center">
                          <div className="text-2xl mb-1">{slide.icon}</div>
                          <div className="text-sm font-semibold mb-1">{slide.title}</div>
                          <div className="text-xs opacity-90">{slide.content}</div>
                        </div>
                      ))
                    }
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <h5 className="font-medium mb-2">Post Caption:</h5>
                    <p className="text-sm text-neutral-700 mb-3">{(viewingContent.content as any)?.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {(viewingContent.content as any)?.tags?.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
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
                    <p className="text-sm text-neutral-700 mb-3">{(viewingContent.content as any)?.title}</p>
                    {(viewingContent.content as any)?.statistic && (
                      <p className="text-sm text-neutral-600 mb-3">
                        <strong>Key Stat:</strong> {(viewingContent.content as any)?.statistic}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(viewingContent.content as any)?.tags?.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
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
                      <p className="text-sm text-neutral-700">{(viewingContent.content as any)?.hook}</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-primary">Content:</h5>
                      <div className="text-sm text-neutral-700 whitespace-pre-line">
                        {(viewingContent.content as any)?.body}
                      </div>
                    </div>
                    <div>
                      <h5 className="font-medium text-primary">Call to Action:</h5>
                      <p className="text-sm text-neutral-700">{(viewingContent.content as any)?.callToAction}</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-primary">Hashtags:</h5>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(viewingContent.content as any)?.tags?.map((tag: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end pt-4">
                <Button onClick={() => setViewingContent(null)}>
                  Close
                </Button>
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
                <Badge variant="secondary">Score: {viewingClip.socialScore}/100</Badge>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="aspect-video bg-neutral-900 rounded-lg relative">
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {formatTime(viewingClip.endTime - viewingClip.startTime)}
                </div>
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center">
                  <Clock size={12} className="mr-1" />
                  {formatTime(viewingClip.startTime)} - {formatTime(viewingClip.endTime)}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30">
                    <Play className="text-white ml-1" size={24} />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <h5 className="font-medium text-primary mb-1">Description:</h5>
                  <p className="text-sm text-neutral-700">{viewingClip.description}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-neutral-500">Start Time</p>
                    <p className="font-medium">{formatTime(viewingClip.startTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">End Time</p>
                    <p className="font-medium">{formatTime(viewingClip.endTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Duration</p>
                    <p className="font-medium">{formatTime(viewingClip.endTime - viewingClip.startTime)}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4">
                  <Badge variant="outline">Platform: {viewingClip.platform}</Badge>
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