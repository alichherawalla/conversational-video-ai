import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Square, Mic, Settings } from "lucide-react";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useAudioTranscription } from "@/hooks/use-audio-transcription";

interface CameraPreviewProps {
  onRecordingComplete?: (blob: Blob) => void;
  sessionId?: string | null;
  onStartSession?: () => Promise<void>;
}

export default function CameraPreview({ onRecordingComplete, sessionId, onStartSession }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const { transcribeAudio } = useAudioTranscription();
  
  // Video recording with audio
  const {
    isRecording: isRecordingVideo,
    duration,
    stream,
    startRecording: startVideoRecording,
    stopRecording: stopVideoRecording,
    formatDuration,
  } = useMediaRecorder({
    onStop: (blob) => {
      console.log("Video recording stopped, blob:", blob, "Size:", blob.size, "Type:", blob.type);
      onRecordingComplete?.(blob);
      setIsRecordingAudio(false);
      setAudioLevel(0);
    },
    audio: false, // This is for video with audio recording (not audio-only)
  });

  // Audio-only recording for transcription
  const {
    isRecording: isRecordingTranscript,
    startRecording: startTranscriptRecording,
    stopRecording: stopTranscriptRecording,
  } = useMediaRecorder({
    onStop: async (blob) => {
      try {
        console.log("Audio transcription recording stopped, blob size:", blob.size, "type:", blob.type);
        if (sessionId && blob.size > 0) {
          console.log("Starting transcription...");
          const result = await transcribeAudio(blob);
          console.log("Transcription result:", result.text);
          // You could emit this to parent component or store it
        } else if (blob.size === 0) {
          console.warn("Audio blob is empty, skipping transcription");
        }
      } catch (error) {
        console.error('Audio transcription failed:', error);
      }
    },
    onAudioLevel: (level) => {
      setAudioLevel(level);
    },
    audio: true, // Audio-only for transcription
  });

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStartRecording = async () => {
    try {
      // If no session exists, start one first
      if (!sessionId && onStartSession) {
        console.log("No session found, starting new session...");
        await onStartSession();
        // Wait a moment for session to be created
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Start both video and audio recording simultaneously
      console.log("Starting video and audio recording...");
      setIsRecordingAudio(true);
      await Promise.all([
        startVideoRecording(),
        startTranscriptRecording()
      ]);
      console.log("Both video and audio transcription recording started");
    } catch (error) {
      console.error("Recording failed:", error);
      setIsRecordingAudio(false);
    }
  };

  const handleStopRecording = () => {
    console.log("Stopping recordings...");
    stopVideoRecording();
    if (isRecordingTranscript) {
      stopTranscriptRecording();
    }
    setIsRecordingAudio(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-neutral-800">Camera Preview</h2>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-sm rounded-full ${
            isRecordingVideo 
              ? "bg-red-100 text-red-800" 
              : "bg-green-100 text-green-800"
          }`}>
            {isRecordingVideo ? "Recording" : "Ready"}
          </span>
        </div>
      </div>
      
      <div className="relative bg-neutral-900 rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Recording overlay */}
        {isRecordingVideo && (
          <div className="absolute top-4 left-4 flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">
              {formatDuration(duration)}
            </span>
          </div>
        )}
        
        {/* Camera controls overlay */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
          <Button
            onClick={isRecordingVideo ? handleStopRecording : handleStartRecording}
            className={`w-12 h-12 rounded-full ${
              isRecordingVideo
                ? "bg-red-600 hover:bg-red-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isRecordingVideo ? (
              <Square className="text-white" size={16} />
            ) : (
              <div className="w-4 h-4 bg-white rounded-full" />
            )}
          </Button>
          <Button className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full">
            <Mic className="text-white" size={16} />
          </Button>
          <Button className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full">
            <Settings className="text-white" size={16} />
          </Button>
        </div>
        
        {/* Audio transcription indicator */}
        {isRecordingAudio && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
            Recording audio for transcription
            <div className="ml-2 w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-100"
                style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      
      {/* Recording Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="bg-neutral-50 rounded-lg p-3">
          <div className="text-lg font-semibold text-neutral-800">
            {formatDuration(duration)}
          </div>
          <div className="text-sm text-neutral-600">Duration</div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3">
          <div className="text-lg font-semibold text-neutral-800">1080p</div>
          <div className="text-sm text-neutral-600">Quality</div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3">
          <div className="text-lg font-semibold text-neutral-800">
            {Math.round(duration * 0.5)}MB
          </div>
          <div className="text-sm text-neutral-600">File Size</div>
        </div>
      </div>
    </div>
  );
}
