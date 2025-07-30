import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TranscriptionResult {
  text: string;
  duration?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export function useAudioTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);

  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob): Promise<TranscriptionResult> => {
      const formData = new FormData();
      // Use appropriate file extension based on blob type
      const fileExtension = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('audio', audioBlob, `recording.${fileExtension}`);
      
      console.log("Sending audio for transcription:", audioBlob.type, audioBlob.size);
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription API error:', response.status, errorText);
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Transcription API response:", result);
      return result;
    },
    onMutate: () => {
      setIsTranscribing(true);
    },
    onSettled: () => {
      setIsTranscribing(false);
    },
  });

  const transcribeAudio = async (audioBlob: Blob) => {
    return transcribeMutation.mutateAsync(audioBlob);
  };

  return {
    transcribeAudio,
    isTranscribing,
    error: transcribeMutation.error,
  };
}