import { useState, useRef, useCallback } from "react";

interface UseMediaRecorderOptions {
  onDataAvailable?: (data: Blob) => void;
  onStop?: (blob: Blob) => void;
  onAudioLevel?: (level: number) => void;
  audio?: boolean; // Add audio-only option
  deviceId?: string; // Add device selection
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const audioConstraints = options.deviceId 
        ? { deviceId: { exact: options.deviceId } }
        : true;
        
      const constraints = options.audio 
        ? { audio: audioConstraints } 
        : { 
            video: { width: 1280, height: 720 }, 
            audio: audioConstraints // Always include audio for video recording
          };
        
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);
      
      // Setup audio level monitoring for audio recording
      if (options.audio && options.onAudioLevel) {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        analyser.fftSize = 256;
        source.connect(analyser);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateAudioLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
            options.onAudioLevel?.(average);
            animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
          }
        };
        
        updateAudioLevel();
      }
      
      // Try MP4 first, fall back to WebM if not supported
      let mimeType: string;
      let mediaRecorder: MediaRecorder;
      
      if (options.audio) {
        // For audio-only recording
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else {
          mimeType = "audio/webm"; // fallback
        }
      } else {
        // For video with audio recording - try MP4 first
        if (MediaRecorder.isTypeSupported("video/mp4")) {
          mimeType = "video/mp4";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
          mimeType = "video/webm;codecs=vp9,opus";
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          mimeType = "video/webm";
        } else {
          mimeType = "video/webm"; // fallback
        }
      }
      
      console.log("Using media recorder with MIME type:", mimeType);
      console.log("MediaStream has audio tracks:", mediaStream.getAudioTracks().length);
      console.log("MediaStream has video tracks:", mediaStream.getVideoTracks().length);
      
      // Configure MediaRecorder with audio options
      const recorderOptions: MediaRecorderOptions = {
        mimeType: mimeType,
      };
      
      // Add audio bitrate for better audio quality (only for video recording)
      if (!options.audio) {
        recorderOptions.audioBitsPerSecond = 128000; // 128 kbps for good audio quality
      }
      
      mediaRecorder = new MediaRecorder(mediaStream, recorderOptions);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          options.onDataAvailable?.(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log("MediaRecorder stopped, created blob:", blob.type, blob.size);
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
        
        // Clean up audio monitoring
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
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
