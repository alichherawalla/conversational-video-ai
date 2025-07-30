import { useState, useRef, useCallback } from "react";
import { useAudioTranscription } from "./use-audio-transcription";

interface UseRealtimeTranscriptionOptions {
  onTranscriptionUpdate?: (text: string, isPartial: boolean) => void;
  chunkDuration?: number; // Duration in seconds for each chunk
}

export function useRealtimeTranscription(options: UseRealtimeTranscriptionOptions = {}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState("");
  const [partialTranscription, setPartialTranscription] = useState("");
  
  const { transcribeAudio } = useAudioTranscription();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkDuration = options.chunkDuration || 3; // 3 seconds default

  const startRealtimeTranscription = useCallback(async (stream: MediaStream) => {
    try {
      setIsTranscribing(true);
      setCurrentTranscription("");
      setPartialTranscription("");
      
      // Create audio-only MediaRecorder for transcription chunks
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          
          // Create blob from current chunks and transcribe
          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size > 1000) { // Only transcribe if we have enough audio data
            try {
              console.log("Transcribing chunk of size:", blob.size);
              const result = await transcribeAudio(blob);
              if (result.text && result.text.trim()) {
                console.log("Chunk transcription:", result.text);
                setPartialTranscription(result.text);
                options.onTranscriptionUpdate?.(result.text, true);
              }
            } catch (error) {
              console.error("Chunk transcription failed:", error);
            }
          }
        }
      };

      // Start recording and request data every chunkDuration seconds
      mediaRecorder.start();
      intervalRef.current = setInterval(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.requestData();
        }
      }, chunkDuration * 1000);

    } catch (error) {
      console.error("Failed to start realtime transcription:", error);
      setIsTranscribing(false);
    }
  }, [transcribeAudio, chunkDuration, options]);

  const stopRealtimeTranscription = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Final transcription of all chunks
    if (chunksRef.current.length > 0) {
      try {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        
        if (finalBlob.size > 1000) {
          console.log("Final transcription of complete recording, size:", finalBlob.size);
          const result = await transcribeAudio(finalBlob);
          if (result.text && result.text.trim()) {
            console.log("Final transcription:", result.text);
            setCurrentTranscription(result.text);
            setPartialTranscription("");
            options.onTranscriptionUpdate?.(result.text, false);
          }
        }
      } catch (error) {
        console.error("Final transcription failed:", error);
      }
    }

    setIsTranscribing(false);
    chunksRef.current = [];
  }, [transcribeAudio, options]);

  return {
    startRealtimeTranscription,
    stopRealtimeTranscription,
    isTranscribing,
    currentTranscription,
    partialTranscription,
    clearTranscription: () => {
      setCurrentTranscription("");
      setPartialTranscription("");
    }
  };
}