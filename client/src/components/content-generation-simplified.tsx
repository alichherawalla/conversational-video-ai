import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Download, Slice, Images, Image, AlignLeft, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Session, Clip, ContentPiece } from "@shared/schema";

export default function ContentGeneration() {
  const [selectedSession, setSelectedSession] = useState<string>("");
  
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

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedSession) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-neutral-800 mb-4">Content Generation</h2>
          <p className="text-neutral-600 mb-6">
            Select a completed interview session to generate LinkedIn content and video clips
          </p>
          
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6">
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
                    <Button size="sm" variant="outline">
                      <Download className="mr-1" size={12} />
                      Export
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
                    <Button size="sm" className="w-full bg-primary text-white hover:bg-primary/90">
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
                    <Button size="sm" className="w-full bg-primary text-white hover:bg-primary/90">
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
                    <Button size="sm" className="w-full bg-primary text-white hover:bg-primary/90">
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
    </div>
  );
}