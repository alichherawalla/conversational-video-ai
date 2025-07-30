import { useState, useRef, useCallback } from "react";

interface UseMediaRecorderOptions {
  onDataAvailable?: (data: Blob) => void;
  onStop?: (blob: Blob) => void;
  audio?: boolean; // Add audio-only option
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const constraints = options.audio 
        ? { audio: true } 
        : { video: { width: 1280, height: 720 }, audio: true };
        
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);
      
      const mimeType = options.audio ? "audio/webm" : "video/webm;codecs=vp9";
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: mimeType,
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          options.onDataAvailable?.(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blobType = options.audio ? "audio/webm" : "video/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        options.onStop?.(blob);
        
        // Clean up
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsRecording(false);
        setDuration(0);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      throw new Error("Failed to start recording. Please check camera permissions.");
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isRecording]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.resume();
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    isRecording,
    duration,
    stream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    formatDuration,
  };
}
