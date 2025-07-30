import OpenAI from "openai";
import fs from "fs";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranscriptionResult {
  text: string;
  duration?: number;
}

export async function transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
  try {
    const audioReadStream = fs.createReadStream(audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: "whisper-1",
    });

    return {
      text: transcription.text,
      duration: 0, // Duration not provided by Whisper API
    };
  } catch (error) {
    console.error('OpenAI transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
}

export async function transcribeAudioBuffer(audioBuffer: Buffer, filename: string): Promise<TranscriptionResult> {
  try {
    // Create a temporary file for the audio buffer
    const tempFilePath = `/tmp/${filename}`;
    fs.writeFileSync(tempFilePath, audioBuffer);

    const result = await transcribeAudio(tempFilePath);

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    return result;
  } catch (error) {
    console.error('OpenAI transcription error:', error);
    throw new Error('Failed to transcribe audio buffer');
  }
}