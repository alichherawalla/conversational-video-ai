import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export interface ClipRequest {
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  socialScore: number;
}

export interface ClipResult extends ClipRequest {
  videoPath: string;
  duration: number;
}

export async function createVideoClips(
  inputVideoPath: string, 
  clips: ClipRequest[], 
  outputDir: string = 'uploads/clips'
): Promise<ClipResult[]> {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results: ClipResult[] = [];
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const duration = clip.endTime - clip.startTime;
    
    // Skip clips that are too short or invalid
    if (duration <= 0 || duration > 300) {
      console.warn(`Skipping invalid clip ${i}: duration ${duration}s`);
      continue;
    }

    const timestamp = Date.now();
    const fileName = `clip_${timestamp}_${i}.mp4`;
    const outputPath = path.join(outputDir, fileName);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputVideoPath)
          .setStartTime(clip.startTime)
          .setDuration(duration)
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .outputOptions([
            '-movflags', 'faststart', // Optimize for web playback
            '-preset', 'fast',        // Balance quality/speed
            '-crf', '23'              // Good quality/size ratio
          ])
          .on('start', (commandLine) => {
            console.log(`Creating clip ${i+1}/${clips.length}: ${fileName}`);
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Clip ${i+1} progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            console.log(`Clip ${i+1} completed: ${fileName}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`Error creating clip ${i+1}:`, err);
            reject(err);
          })
          .run();
      });

      results.push({
        ...clip,
        videoPath: outputPath,
        duration: duration
      });

    } catch (error) {
      console.error(`Failed to create clip ${i+1}:`, error);
      // Continue with other clips even if one fails
    }
  }

  return results;
}

export async function getVideoInfo(videoPath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  format: string;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      
      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        format: metadata.format.format_name || 'unknown'
      });
    });
  });
}

export function cleanupClips(clipPaths: string[]) {
  clipPaths.forEach(clipPath => {
    try {
      if (fs.existsSync(clipPath)) {
        fs.unlinkSync(clipPath);
        console.log(`Cleaned up clip: ${clipPath}`);
      }
    } catch (error) {
      console.warn(`Failed to cleanup clip ${clipPath}:`, error);
    }
  });
}