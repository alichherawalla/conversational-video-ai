import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Square, Mic, Settings } from "lucide-react";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useAudioTranscription } from "@/hooks/use-audio-transcription";

interface CameraPreviewProps {
  onRecordingComplete?: (blob: Blob) => void;
  sessionId?: string | null;
  onStartSession?: () => Promise<void>;
  onTranscriptionComplete?: (text: string) => void;
}

export default function CameraPreview({
  onRecordingComplete,
  sessionId,
  onStartSession,
  onTranscriptionComplete,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const { transcribeAudio } = useAudioTranscription();

  // Real-time transcription state
  const [accumulatedTranscript, setAccumulatedTranscript] = useState("");
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);

  // Transcription tracking
  const transcriptionChunksRef = useRef<string[]>([]);
  const lastSubmissionTimeRef = useRef<number>(0);
  const lastTranscriptTimeRef = useRef<number>(Date.now());
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      console.log(
        "Video recording stopped, blob:",
        blob,
        "Size:",
        blob.size,
        "Type:",
        blob.type,
      );
      onRecordingComplete?.(blob);
      setIsRecordingAudio(false);
      setAudioLevel(0);
    },
    audio: false, // This is for video recording (video + audio), not audio-only
  });

  // Audio-only recording for transcription
  const {
    isRecording: isRecordingTranscript,
    startRecording: startTranscriptRecording,
    stopRecording: stopTranscriptRecording,
  } = useMediaRecorder({
    onStop: async (blob) => {
      try {
        console.log(
          "Audio transcription recording stopped, blob size:",
          blob.size,
          "type:",
          blob.type,
        );

        if (blob.size > 0) {
          try {
            const result = await transcribeAudio(blob);
            console.log("Transcription result:", result);
            console.log("Word count:", result.words?.length || 0);

            if (result.text && result.text.trim()) {
              // Add to accumulated transcript for real-time display
              const newChunk = result.text.trim();
              transcriptionChunksRef.current.push(newChunk);

              const currentTime = Date.now();
              const timeSinceLastSubmission =
                currentTime - lastSubmissionTimeRef.current;

              // Update last transcript time when we get new words
              lastTranscriptTimeRef.current = currentTime;

              // Clear any existing silence timeout since we got new words
              if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
              }

              // Update accumulated transcript immediately for real-time display
              setAccumulatedTranscript((prev) => {
                const updated = prev ? `${prev} ${newChunk}` : newChunk;
                console.log("Real-time transcript update:", updated);
                return updated;
              });

              // Start silence detection timer - auto-submit after 10 seconds of no new words
              silenceTimeoutRef.current = setTimeout(() => {
                if (transcriptionChunksRef.current.length > 0) {
                  const fullTranscript =
                    transcriptionChunksRef.current.join(" ");
                  console.log(
                    "Auto-submitting transcript after 10 seconds of silence:",
                    fullTranscript,
                  );
                  onTranscriptionComplete?.(fullTranscript);
                  lastSubmissionTimeRef.current = Date.now();

                  // Reset accumulation after successful submission
                  transcriptionChunksRef.current = [];
                  setAccumulatedTranscript("");
                }
              }, 10000); // 10 seconds
            } else {
              // No new words detected - check if we should auto-submit due to silence
              const timeSinceLast = Date.now() - lastTranscriptTimeRef.current;
              if (
                timeSinceLast >= 10000 &&
                transcriptionChunksRef.current.length > 0
              ) {
                const fullTranscript = transcriptionChunksRef.current.join(" ");
                console.log(
                  "Auto-submitting transcript due to extended silence:",
                  fullTranscript,
                );
                onTranscriptionComplete?.(fullTranscript);
                lastSubmissionTimeRef.current = Date.now();

                // Reset accumulation after successful submission
                transcriptionChunksRef.current = [];
                setAccumulatedTranscript("");
              }
            }
          } catch (error) {
            console.error("Transcription failed:", error);
          }
        }
      } catch (error) {
        console.error("Audio transcription failed:", error);
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
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log("Starting video and audio recording...");
      setIsRecordingAudio(true);

      // Reset transcription tracking
      setAccumulatedTranscript("");
      transcriptionChunksRef.current = [];
      lastSubmissionTimeRef.current = Date.now();
      lastTranscriptTimeRef.current = Date.now();

      // Clear any existing timers
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        setSilenceTimer(null);
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      await Promise.all([startVideoRecording(), startTranscriptRecording()]);

      console.log("Video and audio transcription recording started - manual transcript only");
    } catch (error) {
      console.error("Recording failed:", error);
      setIsRecordingAudio(false);
    }
  };

  const handleStopRecording = async () => {
    console.log("Stopping recordings...");

    // Clear all timers
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Submit any remaining transcription before stopping
    if (transcriptionChunksRef.current.length > 0) {
      const fullTranscript = transcriptionChunksRef.current.join(" ");
      console.log("Submitting final transcript on stop:", fullTranscript);
      onTranscriptionComplete?.(fullTranscript);
    }

    stopVideoRecording();
    if (isRecordingTranscript) {
      stopTranscriptRecording();
    }

    setIsRecordingAudio(false);
    setAccumulatedTranscript("");
    transcriptionChunksRef.current = [];
    lastSubmissionTimeRef.current = 0;
    lastTranscriptTimeRef.current = Date.now();
  };

  const handleManualTranscript = async () => {
    console.log("Manual transcript requested");
    if (isRecordingTranscript) {
      console.log("Forcing transcription by stopping audio recording");
      stopTranscriptRecording();

      setTimeout(() => {
        if (isRecordingVideo) {
          console.log("Restarting audio recording after manual transcription");
          startTranscriptRecording();
        }
      }, 3000);
    } else {
      console.log("Manual transcript skipped - not currently recording audio");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-neutral-800">
          Camera Preview
        </h2>
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-1 text-sm rounded-full ${
              isRecordingVideo
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
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
            onClick={
              isRecordingVideo ? handleStopRecording : handleStartRecording
            }
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
                isRecordingTranscript
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
              disabled={!isRecordingTranscript}
            >
              {isRecordingTranscript ? "Get Transcript" : "Processing..."}
            </Button>
          </div>
        )}

        {/* Real-time transcript display */}
        {isRecordingVideo && accumulatedTranscript && (
          <div className="absolute top-16 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white max-h-32 overflow-y-auto">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-green-300">
                Real-time Transcript
              </span>
            </div>
            <p className="text-sm text-white leading-relaxed">
              {accumulatedTranscript}
            </p>
            <p className="text-xs text-green-200 mt-2">
              Manual transcription • Click "Get Transcript" when ready
            </p>
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
