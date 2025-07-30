import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Square, Mic, Settings } from "lucide-react";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useEnhancedTranscription } from "@/hooks/use-enhanced-transcription";

interface CameraPreviewProps {
  onRecordingComplete?: (blob: Blob) => void;
  sessionId?: string | null;
  onStartSession?: () => Promise<void>;
  onTranscriptionComplete?: (text: string) => void;
}

export default function CameraPreview({ onRecordingComplete, sessionId, onStartSession, onTranscriptionComplete }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Enhanced transcription system with word-level timing
  const {
    startEnhancedTranscription,
    stopEnhancedTranscription,
    forceSubmitCurrent,
    clearTranscription,
    isTranscribing,
    currentText,
    allWords,
    lastActivityTime,
    isAutoSubmitPending
  } = useEnhancedTranscription({
    onTranscriptionUpdate: (text, words, isPartial) => {
      console.log("Transcription update:", text, "Words:", words.length, "Partial:", isPartial);
      if (!isPartial && text.trim()) {
        onTranscriptionComplete?.(text);
      }
    },
    onAutoSubmit: (text, words) => {
      console.log("Auto-submitting transcription:", text, "Words:", words.length);
      if (text.trim()) {
        onTranscriptionComplete?.(text);
      }
    },
    chunkDuration: 5, // 5-second chunks
    autoSubmitDelay: 5 // Auto-submit after 5 seconds of silence
  });
  
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
    audio: true, // Video with audio
    onAudioLevel: (level) => {
      setAudioLevel(level);
    },
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
      
      console.log("Starting video recording and enhanced transcription...");
      setIsRecordingAudio(true);
      clearTranscription();
      
      // Start video recording
      await startVideoRecording();
      
      // Start enhanced transcription with the audio stream
      if (stream) {
        await startEnhancedTranscription(stream);
      }
      
      console.log("Video recording and enhanced transcription started");
    } catch (error) {
      console.error("Recording failed:", error);
      setIsRecordingAudio(false);
    }
  };

  const handleStopRecording = async () => {
    console.log("Stopping recordings...");
    
    // Stop enhanced transcription
    await stopEnhancedTranscription();
    
    // Stop video recording
    stopVideoRecording();
    
    setIsRecordingAudio(false);
  };

  const handleManualTranscript = async () => {
    console.log("Manual transcript requested");
    const result = forceSubmitCurrent();
    if (result) {
      console.log("Manually submitted transcript:", result.text);
    } else {
      console.log("No transcript available to submit");
    }
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

        {/* Manual transcript button - always show when video recording */}
        {isRecordingVideo && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
            <Button
              onClick={handleManualTranscript}
              className={`px-4 py-2 text-sm rounded-lg ${
                isTranscribing 
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
              disabled={!isTranscribing}
            >
              {isTranscribing ? "Get Transcript" : "Processing..."}
            </Button>
          </div>
        )}
        
        {/* Enhanced transcription status */}
        {isRecordingVideo && (
          <div className="absolute top-16 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  isTranscribing ? "bg-green-500" : "bg-yellow-500"
                }`}></div>
                <span className="text-xs font-medium text-green-300">
                  {isTranscribing ? "Smart Transcription Active" : "Initializing..."}
                </span>
              </div>
              {isAutoSubmitPending && (
                <span className="text-xs text-yellow-300">Auto-submit in 5s</span>
              )}
            </div>
            <p className="text-xs text-green-200">
              Word-level timing • Auto-submit after 5 seconds of silence
            </p>
            {currentText && (
              <div className="mt-2 text-xs text-gray-300 max-h-20 overflow-y-auto">
                <strong>Live:</strong> {currentText.slice(-100)}...
              </div>
            )}
          </div>
        )}

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
