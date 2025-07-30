import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TranscriptionResult {
  text: string;
  duration?: number;
}

export function useAudioTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);

  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob): Promise<TranscriptionResult> => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      return response.json();
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