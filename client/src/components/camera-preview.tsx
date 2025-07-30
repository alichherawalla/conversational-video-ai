import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Square, Mic, Settings } from "lucide-react";
import { useMediaRecorder } from "@/hooks/use-media-recorder";

interface CameraPreviewProps {
  onRecordingComplete?: (blob: Blob) => void;
}

export default function CameraPreview({ onRecordingComplete }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    isRecording,
    duration,
    stream,
    startRecording,
    stopRecording,
    formatDuration,
  } = useMediaRecorder({
    onStop: (blob) => {
      onRecordingComplete?.(blob);
    },
  });

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error("Recording failed:", error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-neutral-800">Camera Preview</h2>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-sm rounded-full ${
            isRecording 
              ? "bg-red-100 text-red-800" 
              : "bg-green-100 text-green-800"
          }`}>
            {isRecording ? "Recording" : "Ready"}
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
        {isRecording && (
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
            onClick={isRecording ? stopRecording : handleStartRecording}
            className={`w-12 h-12 rounded-full ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isRecording ? (
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
