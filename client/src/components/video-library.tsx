import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Play, Download, Share, Video, Slice, Clock, Folder } from "lucide-react";
import type { Session } from "@shared/schema";

export default function VideoLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const completedSessions = sessions.filter(session => session.status === "completed");
  
  const filteredSessions = completedSessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || session.topic.toLowerCase().includes(categoryFilter.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Mock stats - in production, these would come from actual data
  const stats = {
    totalSessions: completedSessions.length,
    totalClips: completedSessions.length * 8, // Rough estimate
    totalDuration: completedSessions.reduce((acc, session) => acc + (session.duration || 0), 0),
    totalContent: completedSessions.length * 5, // Rough estimate
  };

  return (
    <div className="space-y-6">
      {/* Library Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Video Library</h2>
          <p className="text-neutral-600">Manage your recorded sessions and generated content</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search videos..."
              className="pl-10 pr-4 py-2"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={16} />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="tech">Tech</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Library Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSessions.map((session) => (
          <Card key={session.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-video bg-neutral-900 relative">
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {formatDuration(session.duration || 0)}
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30">
                  <Play className="text-white ml-1" size={16} />
                </Button>
              </div>
              {/* Placeholder for video thumbnail */}
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Video className="text-neutral-600" size={32} />
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-neutral-800 mb-2">{session.title}</h3>
              <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{session.topic}</p>
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
                <span>{formatDate(session.createdAt)}</span>
                <span>8 clips generated</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" className="flex-1 bg-primary text-white hover:bg-primary/90">
                  View Content
                </Button>
                <Button size="sm" variant="outline" className="w-8 h-8 p-0">
                  <Download className="text-neutral-600" size={14} />
                </Button>
                <Button size="sm" variant="outline" className="w-8 h-8 p-0">
                  <Share className="text-neutral-600" size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredSessions.length === 0 && (
        <div className="text-center py-12">
          <Video className="mx-auto text-neutral-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-neutral-800 mb-2">No videos found</h3>
          <p className="text-neutral-600 mb-4">
            {searchTerm || categoryFilter !== "all" 
              ? "Try adjusting your search or filter criteria"
              : "Start recording your first session to see it here"
            }
          </p>
          <Button className="bg-primary text-white hover:bg-primary/90">
            Create New Session
          </Button>
        </div>
      )}

      {/* Library Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Video className="text-primary" size={24} />
            </div>
            <div className="text-2xl font-bold text-neutral-800">{stats.totalSessions}</div>
            <div className="text-sm text-neutral-600">Total Sessions</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Slice className="text-secondary" size={24} />
            </div>
            <div className="text-2xl font-bold text-neutral-800">{stats.totalClips}</div>
            <div className="text-sm text-neutral-600">Generated Clips</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="text-accent" size={24} />
            </div>
            <div className="text-2xl font-bold text-neutral-800">
              {Math.floor(stats.totalDuration / 3600)}h {Math.floor((stats.totalDuration % 3600) / 60)}m
            </div>
            <div className="text-sm text-neutral-600">Total Duration</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Folder className="text-purple-600" size={24} />
            </div>
            <div className="text-2xl font-bold text-neutral-800">{stats.totalContent}</div>
            <div className="text-sm text-neutral-600">Content Pieces</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
