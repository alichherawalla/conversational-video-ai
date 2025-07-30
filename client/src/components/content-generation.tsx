import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Download, Edit, Slice, Images, Image, AlignLeft } from "lucide-react";
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
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/generate-content`, { type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", selectedSession, "content"] });
    },
  });

  const completedSessions = sessions.filter(s => s.status === "completed");
  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  return (
    <div className="space-y-8">
      {/* Session Selection */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Select Session</label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a completed session..." />
                </SelectTrigger>
                <SelectContent>
                  {completedSessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title} - {new Date(session.createdAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSession && (
              <Button
                onClick={() => generateClipsMutation.mutate(selectedSession)}
                disabled={generateClipsMutation.isPending}
                className="bg-primary text-white hover:bg-primary/90"
              >
                Generate Clips
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedSession && (
        <>
          {/* Video Processing */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-neutral-800 mb-6">Video Processing & Clip Generation</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Video Timeline */}
                <div>
                  <h3 className="text-lg font-medium text-neutral-800 mb-4">Session Timeline</h3>
                  
                  <div className="bg-neutral-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-neutral-600">
                        Total Duration: {Math.floor((selectedSessionData?.duration || 0) / 60)}:{String((selectedSessionData?.duration || 0) % 60).padStart(2, '0')}
                      </span>
                      <span className="text-sm text-neutral-600">AI Highlights: {clips.length} segments</span>
                    </div>
                    
                    {/* Timeline visualization */}
                    <div className="relative h-8 bg-neutral-200 rounded-full overflow-hidden">
                      <div className="absolute left-0 top-0 h-full bg-primary w-1/3 rounded-full"></div>
                      <div className="absolute left-1/2 top-0 h-full bg-secondary w-1/4 rounded-full"></div>
                      <div className="absolute right-8 top-0 h-full bg-accent w-1/6 rounded-full"></div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>0:00</span>
                      <span>6:14</span>
                      <span>9:21</span>
                      <span>15:47</span>
                      <span>{Math.floor((selectedSessionData?.duration || 0) / 60)}:{String((selectedSessionData?.duration || 0) % 60).padStart(2, '0')}</span>
                    </div>
                  </div>
                  
                  {/* Highlight segments */}
                  <div className="space-y-3">
                    {clips.map((clip) => (
                      <div key={clip.id} className="border border-neutral-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-neutral-800">{clip.title}</h4>
                          <span className="text-xs bg-primary text-white px-2 py-1 rounded">
                            {Math.floor(clip.startTime / 60)}:{String(clip.startTime % 60).padStart(2, '0')} - {Math.floor(clip.endTime / 60)}:{String(clip.endTime % 60).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 mb-2">{clip.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-neutral-500">Social Score: {clip.socialScore || 0}/100</span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {clip.endTime - clip.startTime}s clip
                            </span>
                          </div>
                          <Button size="sm" variant="outline">
                            <Slice className="mr-1" size={12} />
                            Create Clip
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generated Clips */}
                <div>
                  <h3 className="text-lg font-medium text-neutral-800 mb-4">Generated Clips</h3>
                  
                  <div className="space-y-4">
                    {clips.map((clip) => (
                      <div key={clip.id} className="border border-neutral-200 rounded-lg overflow-hidden">
                        <div className="aspect-video bg-neutral-900 relative">
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            {Math.floor((clip.endTime - clip.startTime) / 60)}:{String((clip.endTime - clip.startTime) % 60).padStart(2, '0')}
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
                          <div className="flex items-center space-x-2">
                            <Button size="sm" className="bg-primary text-white hover:bg-primary/90">
                              <Download className="mr-1" size={12} />
                              Download
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="mr-1" size={12} />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                  LinkedIn Carousel
                </h3>
                
                <div className="space-y-4">
                  {contentPieces
                    .filter(cp => cp.type === "carousel")
                    .slice(0, 2)
                    .map((content) => (
                      <div key={content.id} className="border border-neutral-200 rounded-lg p-3">
                        <h4 className="font-medium text-neutral-800 mb-2">{content.title}</h4>
                        <div className="grid grid-cols-5 gap-1 mb-3">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div key={i} className="aspect-square bg-primary/10 rounded flex items-center justify-center text-xs">
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        <div className="text-sm text-neutral-600 mb-2">
                          {Array.isArray((content.content as any)?.slides) && 
                            (content.content as any).slides.slice(0, 3).map((slide: any, idx: number) => (
                              <p key={idx} className="mb-1">
                                <span className="text-primary font-medium">{slide.icon}</span> {slide.title}
                              </p>
                            ))
                          }
                          {Array.isArray((content.content as any)?.slides) && (content.content as any).slides.length > 3 && (
                            <p className="text-xs text-neutral-500">+{(content.content as any).slides.length - 3} more slides</p>
                          )}
                        </div>
                        <Button size="sm" className="w-full bg-primary text-white hover:bg-primary/90">
                          View Carousel
                        </Button>
                      </div>
                    ))}
                  
                  <Button
                    onClick={() => generateContentMutation.mutate({ sessionId: selectedSession, type: "carousel" })}
                    disabled={generateContentMutation.isPending}
                    className="w-full bg-primary text-white hover:bg-primary/90"
                  >
                    Generate New Carousel
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
                    .slice(0, 3)
                    .map((content) => (
                      <div key={content.id} className="border border-neutral-200 rounded-lg p-3">
                        <div className="aspect-square bg-gradient-to-br from-primary to-secondary rounded-lg mb-3 flex items-center justify-center text-white text-sm font-medium">
                          Quote Card
                        </div>
                        <h4 className="font-medium text-neutral-800 mb-2">{content.title}</h4>
                        <p className="text-sm text-neutral-600 mb-2">
                          "{(content.content as any)?.quote || 'Inspirational quote'}"
                        </p>
                        <Button size="sm" className="w-full bg-primary text-white hover:bg-primary/90">
                          View Image
                        </Button>
                      </div>
                    ))}
                  
                  <Button
                    onClick={() => generateContentMutation.mutate({ sessionId: selectedSession, type: "image" })}
                    disabled={generateContentMutation.isPending}
                    className="w-full bg-primary text-white hover:bg-primary/90"
                  >
                    Generate New Image
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
                    .slice(0, 3)
                    .map((content) => (
                      <div key={content.id} className="border border-neutral-200 rounded-lg p-3">
                        <h4 className="font-medium text-neutral-800 mb-2">{content.title}</h4>
                        <div className="bg-neutral-50 rounded p-2 mb-2 text-sm text-neutral-700">
                          <p className="font-medium text-neutral-800">{(content.content as any)?.hook || 'Story hook...'}</p>
                          <p className="mt-1 line-clamp-2">{(content.content as any)?.body?.substring(0, 100) || 'Body content...'}...</p>
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
                    Generate New Post
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
