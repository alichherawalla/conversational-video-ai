import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioTranscription } from "./use-audio-transcription";

interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  chunkIndex: number;
  absoluteStart: number;
  absoluteEnd: number;
}

interface EnhancedTranscriptionOptions {
  onTranscriptionUpdate?: (text: string, words: TranscriptionWord[], isPartial: boolean) => void;
  onAutoSubmit?: (text: string, words: TranscriptionWord[]) => void;
  chunkDuration?: number; // Duration in seconds for each chunk
  autoSubmitDelay?: number; // Delay in seconds before auto-submit
}

export function useEnhancedTranscription(options: EnhancedTranscriptionOptions = {}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [allWords, setAllWords] = useState<TranscriptionWord[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [lastActivityTime, setLastActivityTime] = useState<number | null>(null);
  
  const { transcribeAudio } = useAudioTranscription();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const chunkDuration = options.chunkDuration || 5; // 5 seconds default
  const autoSubmitDelay = options.autoSubmitDelay || 5; // 5 seconds auto-submit delay
  const startTimeRef = useRef<number>(0);
  const chunkIndexRef = useRef<number>(0);

  // Clear auto-submit timer
  const clearAutoSubmitTimer = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  }, []);

  // Set auto-submit timer
  const setAutoSubmitTimer = useCallback(() => {
    clearAutoSubmitTimer();
    autoSubmitTimerRef.current = setTimeout(() => {
      if (allWords.length > 0 || currentText.trim()) {
        console.log("Auto-submitting due to 5 seconds of silence");
        options.onAutoSubmit?.(currentText, allWords);
      }
    }, autoSubmitDelay * 1000);
  }, [allWords, currentText, autoSubmitDelay, options, clearAutoSubmitTimer]);

  const startEnhancedTranscription = useCallback(async (stream: MediaStream) => {
    try {
      setIsTranscribing(true);
      setAllWords([]);
      setCurrentText("");
      setLastActivityTime(null);
      clearAutoSubmitTimer();
      
      startTimeRef.current = Date.now();
      chunkIndexRef.current = 0;
      
      // Create audio-only MediaRecorder for transcription chunks
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const chunkStartTime = (Date.now() - startTimeRef.current) / 1000;
          const currentChunkIndex = chunkIndexRef.current++;
          
          console.log(`Processing chunk ${currentChunkIndex} at ${chunkStartTime}s, size: ${event.data.size}`);
          
          try {
            const result = await transcribeAudio(event.data);
            console.log("Chunk transcription result:", result);
            
            if (result.text && result.text.trim()) {
              const chunkWords: TranscriptionWord[] = [];
              
              if (result.words && result.words.length > 0) {
                // Use word-level timestamps from Whisper
                result.words.forEach(word => {
                  chunkWords.push({
                    word: word.word,
                    start: word.start,
                    end: word.end,
                    chunkIndex: currentChunkIndex,
                    absoluteStart: chunkStartTime + word.start,
                    absoluteEnd: chunkStartTime + word.end
                  });
                });
              } else {
                // Fallback: estimate timing if no word-level data
                const words = result.text.trim().split(/\s+/);
                const estimatedDuration = result.duration || chunkDuration;
                const timePerWord = estimatedDuration / words.length;
                
                words.forEach((word, index) => {
                  const wordStart = index * timePerWord;
                  const wordEnd = (index + 1) * timePerWord;
                  chunkWords.push({
                    word: word,
                    start: wordStart,
                    end: wordEnd,
                    chunkIndex: currentChunkIndex,
                    absoluteStart: chunkStartTime + wordStart,
                    absoluteEnd: chunkStartTime + wordEnd
                  });
                });
              }
              
              if (chunkWords.length > 0) {
                setAllWords(prevWords => {
                  const newWords = [...prevWords, ...chunkWords];
                  const newText = newWords.map(w => w.word).join(' ');
                  setCurrentText(newText);
                  
                  // Update activity time and reset auto-submit timer
                  setLastActivityTime(Date.now());
                  
                  options.onTranscriptionUpdate?.(newText, newWords, true);
                  
                  return newWords;
                });
                
                // Reset auto-submit timer since we got new content
                setAutoSubmitTimer();
              }
            } else {
              // No meaningful content, but check if we should auto-submit
              if (allWords.length > 0 && !autoSubmitTimerRef.current) {
                console.log("Empty chunk received, starting auto-submit timer");
                setAutoSubmitTimer();
              }
            }
          } catch (error) {
            console.error("Chunk transcription failed:", error);
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

      console.log(`Enhanced transcription started with ${chunkDuration}s chunks and ${autoSubmitDelay}s auto-submit`);

    } catch (error) {
      console.error("Failed to start enhanced transcription:", error);
      setIsTranscribing(false);
    }
  }, [transcribeAudio, chunkDuration, autoSubmitDelay, options, allWords, setAutoSubmitTimer]);

  const stopEnhancedTranscription = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    clearAutoSubmitTimer();
    setIsTranscribing(false);
    
    console.log("Enhanced transcription stopped");
  }, [clearAutoSubmitTimer]);

  const forceSubmitCurrent = useCallback(() => {
    if (allWords.length > 0 || currentText.trim()) {
      clearAutoSubmitTimer();
      options.onTranscriptionUpdate?.(currentText, allWords, false);
      console.log("Force submitted current transcription:", currentText);
      return { text: currentText, words: allWords };
    }
    return null;
  }, [allWords, currentText, options, clearAutoSubmitTimer]);

  const clearTranscription = useCallback(() => {
    setAllWords([]);
    setCurrentText("");
    setLastActivityTime(null);
    clearAutoSubmitTimer();
  }, [clearAutoSubmitTimer]);

  // Effect to handle component unmount
  useEffect(() => {
    return () => {
      clearAutoSubmitTimer();
    };
  }, [clearAutoSubmitTimer]);

  return {
    startEnhancedTranscription,
    stopEnhancedTranscription,
    forceSubmitCurrent,
    clearTranscription,
    isTranscribing,
    currentText,
    allWords,
    lastActivityTime,
    isAutoSubmitPending: !!autoSubmitTimerRef.current
  };
}