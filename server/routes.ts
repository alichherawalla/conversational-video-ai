import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertSessionSchema,
  insertQuestionSchema,
  insertConversationSchema,
  insertClipSchema,
  insertContentPieceSchema,
} from "@shared/schema";
import {
  generateAIQuestion,
  analyzeResponse,
  generateLinkedInContent,
  generateAllLinkedInContent,
  generateVideoClips,
} from "./anthropic";
import { transcribeAudioBuffer } from "./openai";
import { z } from "zod";
import multer from "multer";
import busboy from "busboy";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

// Configure multer for file uploads with larger limits for video files
const upload = multer({
  dest: "/tmp/",
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for video files
    fieldSize: 25 * 1024 * 1024, // 25MB field size limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Sessions
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(validatedData);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid session data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, validatedData);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid session data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // Questions
  app.get("/api/questions", async (req, res) => {
    try {
      const { category } = req.query;
      const questions = category
        ? await storage.getQuestionsByCategory(category as string)
        : await storage.getQuestions();
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.post("/api/questions", async (req, res) => {
    try {
      const validatedData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(validatedData);
      res.status(201).json(question);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid question data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create question" });
    }
  });

  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteQuestion(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  // Conversations
  app.get("/api/sessions/:sessionId/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversationsBySession(
        req.params.sessionId,
      );
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Enhanced AI Question System with Contextual Follow-ups
  app.post("/api/ai/question", async (req, res) => {
    try {
      const {
        sessionId,
        questionId,
        followUpIndex,
        baseQuestion,
        userResponse,
      } = req.body;

      if (followUpIndex !== undefined && baseQuestion && userResponse) {
        // Generate contextual AI follow-up based on user's response
        const aiQuestion = await generateAIQuestion(
          sessionId,
          questionId,
          followUpIndex,
          baseQuestion,
          userResponse,
        );
        res.json({
          question: aiQuestion.question,
          questionId: aiQuestion.questionId,
          isFollowUp: true,
          followUpIndex,
        });
      } else if (followUpIndex !== undefined) {
        // Fallback to pre-written follow-up questions
        const question = questionId
          ? await storage.getQuestion(questionId)
          : null;
        if (!question) {
          return res.status(404).json({ message: "Question not found" });
        }

        const followUps = [question.followUp1, question.followUp2].filter(
          Boolean,
        );
        if (followUpIndex < followUps.length) {
          res.json({
            question: followUps[followUpIndex],
            questionId: question.id,
            isFollowUp: true,
            followUpIndex,
          });
        } else {
          res.status(404).json({ message: "Follow-up question not found" });
        }
      } else {
        // Select primary question - either specific or next unasked question
        if (questionId) {
          // Return specific requested question
          const question = await storage.getQuestion(questionId);
          if (!question) {
            return res.status(404).json({ message: "Question not found" });
          }

          res.json({
            question: question.primary,
            questionId: question.id,
            followUps: [question.followUp1, question.followUp2].filter(Boolean),
            isFollowUp: false,
          });
        } else {
          // Get next unasked question from the session
          const conversations =
            await storage.getConversationsBySession(sessionId);
          const askedQuestionIds = conversations
            .filter((c) => c.type === "ai_question")
            .map((c) => c.questionId)
            .filter(Boolean);

          const allQuestions = await storage.getQuestions();
          const unaskedQuestions = allQuestions.filter(
            (q) => !askedQuestionIds.includes(q.id),
          );

          if (unaskedQuestions.length === 0) {
            // All questions have been asked, generate AI question as fallback
            const aiQuestion = await generateAIQuestion(sessionId);
            return res.json({
              question: aiQuestion.question,
              questionId: aiQuestion.questionId,
              followUps: [],
              isFollowUp: false,
            });
          }

          // Select the first unasked question (sequential progression)
          const nextQuestion = unaskedQuestions[0];

          res.json({
            question: nextQuestion.primary,
            questionId: nextQuestion.id,
            followUps: [nextQuestion.followUp1, nextQuestion.followUp2].filter(
              Boolean,
            ),
            isFollowUp: false,
          });
        }
      }
    } catch (error) {
      console.error("AI question generation error:", error);
      res.status(500).json({ message: "Failed to get AI question" });
    }
  });

  // AI Response Analysis with Claude
  app.post("/api/ai/feedback", async (req, res) => {
    try {
      const { response, sessionId, questionId } = req.body;

      const feedback = await analyzeResponse(response, sessionId, questionId);

      res.json(feedback);
    } catch (error) {
      console.error("AI feedback error:", error);
      res.status(500).json({ message: "Failed to analyze response" });
    }
  });

  // Audio Transcription with OpenAI Whisper
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const fs = await import("fs");
      const audioBuffer = fs.readFileSync(req.file.path);
      const transcription = await transcribeAudioBuffer(
        audioBuffer,
        req.file.originalname || "audio.wav",
      );

      // Clean up temp file
      fs.unlinkSync(req.file.path);

      res.json({
        text: transcription.text,
        duration: transcription.duration,
        words: transcription.words || [],
      });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });

  // Video Transcription with OpenAI Whisper (extracts audio first)
  app.post(
    "/api/transcribe-video",
    upload.single("video"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No video file provided" });
        }

        const fs = await import("fs");
        const path = await import("path");
        const { execSync } = await import("child_process");

        // Extract audio from video using ffmpeg
        const audioPath = path.join("/tmp", `audio_${Date.now()}.wav`);

        try {
          console.log(
            "Extracting audio from video file:",
            req.file.originalname,
          );
          execSync(
            `ffmpeg -i "${req.file.path}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${audioPath}"`,
          );

          // Transcribe the extracted audio
          const audioBuffer = fs.readFileSync(audioPath);
          const transcription = await transcribeAudioBuffer(
            audioBuffer,
            "extracted_audio.wav",
          );

          // Clean up temp files
          fs.unlinkSync(req.file.path);
          fs.unlinkSync(audioPath);

          res.json({
            text: transcription.text,
            duration: transcription.duration,
            words: transcription.words || [],
          });
        } catch (ffmpegError) {
          console.error("FFmpeg error:", ffmpegError);
          // Clean up files on error
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

          res
            .status(500)
            .json({ message: "Failed to extract audio from video" });
        }
      } catch (error) {
        console.error("Video transcription error:", error);
        res.status(500).json({ message: "Failed to transcribe video" });
      }
    },
  );

  // Extract transcript from video only (no content generation)
  app.post("/api/upload-video-transcribe", async (req, res) => {
    // Set longer timeout for large video processing
    req.setTimeout(15 * 60 * 1000); // 15 minutes
    res.setTimeout(15 * 60 * 1000); // 15 minutes

    try {
      const fs = await import("fs");
      const path = await import("path");
      const { spawn } = await import("child_process");

      // Debug headers and content type
      console.log("Request headers:", req.headers);
      console.log("Content-Type:", req.headers["content-type"]);

      // Use busboy for streaming multipart uploads
      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: 500 * 1024 * 1024, // 500MB limit
          files: 1,
        },
      });

      let videoPath: string | null = null;
      let originalName: string | null = null;
      let fileSize = 0;
      let uploadError: Error | null = null;

      bb.on("file", (name, file, info) => {
        const { filename, mimeType } = info;

        if (!filename || !mimeType.startsWith("video/")) {
          uploadError = new Error(
            "Invalid file type. Please upload a video file.",
          );
          file.resume(); // Drain the file stream
          return;
        }

        originalName = filename;
        videoPath = path.join("/tmp", `video_${Date.now()}_${filename}`);

        console.log(`Streaming upload started: ${filename} (${mimeType})`);

        const writeStream = createWriteStream(videoPath);

        file.on("data", (data) => {
          fileSize += data.length;
          // Log progress every 10MB
          if (fileSize % (10 * 1024 * 1024) < data.length) {
            console.log(
              `Upload progress: ${Math.round(fileSize / 1024 / 1024)}MB`,
            );
          }
        });

        file.on("limit", () => {
          uploadError = new Error("File too large. Maximum size is 500MB.");
        });

        file.on("error", (err) => {
          uploadError = err;
        });

        file.pipe(writeStream);

        writeStream.on("error", (err) => {
          uploadError = err;
        });
      });

      bb.on("finish", async () => {
        if (uploadError) {
          console.error("Upload error:", uploadError);
          return res.status(400).json({
            message: uploadError.message,
            suggestion: uploadError.message.includes("size")
              ? "Try compressing your video or use the transcript-only option"
              : "Please try uploading a valid video file",
          });
        }

        if (!videoPath || !originalName) {
          return res.status(400).json({ message: "No video file provided" });
        }

        console.log(
          `Streaming upload completed: ${originalName} (${Math.round(fileSize / 1024 / 1024)}MB)`,
        );

        // Extract audio from video using ffmpeg with optimized settings for large files
        const audioPath = path.join("/tmp", `audio_${Date.now()}.wav`);

        try {
          console.log("Extracting audio from streamed video file...");

          // Use spawn for better memory handling and progress tracking
          await new Promise((resolve, reject) => {
            const ffmpeg = spawn("ffmpeg", [
              "-i",
              videoPath!,
              "-vn", // No video
              "-acodec",
              "pcm_s16le",
              "-ar",
              "16000", // Lower sample rate for transcription efficiency
              "-ac",
              "1", // Mono audio for transcription
              "-y", // Overwrite output
              audioPath,
            ]);

            let errorOutput = "";

            ffmpeg.stderr.on("data", (data) => {
              errorOutput += data.toString();
              // Log progress for large files
              if (data.toString().includes("time=")) {
                const timeMatch = data
                  .toString()
                  .match(/time=(\d{2}:\d{2}:\d{2})/);
                if (timeMatch) {
                  console.log(`Audio extraction progress: ${timeMatch[1]}`);
                }
              }
            });

            ffmpeg.on("close", (code) => {
              if (code === 0) {
                console.log("Audio extraction completed successfully");
                resolve(void 0);
              } else {
                console.error("FFmpeg error output:", errorOutput);
                reject(
                  new Error(`FFmpeg failed with code ${code}: ${errorOutput}`),
                );
              }
            });

            ffmpeg.on("error", (err) => {
              console.error("FFmpeg spawn error:", err);
              reject(err);
            });
          });

          // Check if audio file was created successfully
          if (!fs.existsSync(audioPath)) {
            throw new Error("Audio extraction failed - no output file created");
          }

          const audioBuffer = fs.readFileSync(audioPath);
          const audioSizeMB = Math.round(audioBuffer.length / 1024 / 1024);
          console.log(
            `Transcribing extracted audio (${audioSizeMB}MB) with word-level timing...`,
          );

          // Transcribe the extracted audio with word-level timing
          const transcription = await transcribeAudioBuffer(
            audioBuffer,
            originalName,
          );

          console.log(
            `Transcription completed (${transcription.text.length} chars).`,
          );

          // Clean up temp files
          try {
            fs.unlinkSync(videoPath!);
            fs.unlinkSync(audioPath);
          } catch (cleanupError) {
            console.warn("File cleanup warning:", cleanupError);
          }

          console.log(
            `Successfully transcribed ${originalName}: ${transcription.text.length} characters`,
          );

          // Create upload record for this transcription
          const uploadRecord = await storage.createUpload({
            originalName: originalName,
            objectPath: fieldname || 'video-upload', // Use field name or default
            fileSize: contentLength || 0,
            mimeType: mimetype || 'video/mp4',
            status: 'transcribed',
            transcript: transcription.text,
            linkedinContentMarkdown: null, // Generated later when content is created
            contentItems: null,
            videoClips: null,
          });

          console.log(`Created upload record with ID: ${uploadRecord.id}`);

          res.json({
            uploadId: uploadRecord.id, // Return unique upload ID
            transcript: {
              text: transcription.text,
              duration: transcription.duration,
              words: transcription.words || [],
            },
          });
        } catch (ffmpegError) {
          console.error("Video processing error:", ffmpegError);

          // Clean up files on error
          try {
            if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          } catch (cleanupError) {
            console.warn("Error during cleanup:", cleanupError);
          }

          res.status(500).json({
            message: "Failed to transcribe video file",
            error:
              ffmpegError instanceof Error
                ? ffmpegError.message
                : String(ffmpegError),
            suggestion:
              "Try uploading a smaller video file or paste transcript text instead",
          });
        }
      });

      bb.on("error", (err: any) => {
        console.error("Busboy error:", err);
        res.status(400).json({
          message: "Upload processing error",
          error: err instanceof Error ? err.message : String(err),
        });
      });

      req.pipe(bb);
    } catch (error) {
      console.error("Video upload transcription error:", error);
      res.status(500).json({
        message: "Failed to transcribe video",
        error: error instanceof Error ? error.message : String(error),
        suggestion:
          "Try uploading a smaller video file or paste transcript text instead",
      });
    }
  });

  // Generate video clips from uploaded video + transcript
  app.post("/api/upload-video-generate-clips", async (req, res) => {
    // Set longer timeout for large video processing
    req.setTimeout(15 * 60 * 1000); // 15 minutes
    res.setTimeout(15 * 60 * 1000); // 15 minutes

    try {
      const fs = await import("fs");
      const path = await import("path");
      const { spawn } = await import("child_process");

      // Use busboy for streaming multipart uploads
      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: 500 * 1024 * 1024, // 500MB limit
          files: 1,
        },
      });

      let videoPath: string | null = null;
      let originalName: string | null = null;
      let fileSize = 0;
      let uploadError: Error | null = null;
      let transcript: string = "";

      bb.on("field", (name, val) => {
        if (name === "transcript") {
          transcript = val;
        }
      });

      bb.on("file", (name, file, info) => {
        const { filename, mimeType } = info;

        if (!filename || !mimeType.startsWith("video/")) {
          uploadError = new Error(
            "Invalid file type. Please upload a video file.",
          );
          file.resume(); // Drain the file stream
          return;
        }

        originalName = filename;
        videoPath = path.join("/tmp", `video_${Date.now()}_${filename}`);

        console.log(`Streaming video upload for clipping: ${filename}`);

        const writeStream = createWriteStream(videoPath);

        file.on("data", (data) => {
          fileSize += data.length;
          if (fileSize % (10 * 1024 * 1024) < data.length) {
            console.log(
              `Upload progress: ${Math.round(fileSize / 1024 / 1024)}MB`,
            );
          }
        });

        file.on("limit", () => {
          uploadError = new Error("File too large. Maximum size is 500MB.");
        });

        file.on("error", (err) => {
          uploadError = err;
        });

        file.pipe(writeStream);

        writeStream.on("error", (err) => {
          uploadError = err;
        });
      });

      bb.on("finish", async () => {
        if (uploadError) {
          console.error("Upload error:", uploadError);
          return res.status(400).json({
            message: uploadError.message,
            suggestion: uploadError.message.includes("size")
              ? "Try compressing your video"
              : "Please try uploading a valid video file",
          });
        }

        if (!videoPath || !originalName || !transcript.trim()) {
          return res.status(400).json({
            message:
              "Video file and transcript are both required for video clipping",
          });
        }

        console.log(
          `Processing video clips for: ${originalName} (${Math.round(fileSize / 1024 / 1024)}MB)`,
        );

        try {
          // Extract audio from video for word-level timing
          const audioPath = videoPath.replace(/\.[^/.]+$/, "") + "_audio.wav";

          console.log("Extracting audio for word-level timing...");
          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn("ffmpeg", [
              "-i",
              videoPath!,
              "-ac",
              "1", // Convert to mono
              "-ar",
              "16000", // 16kHz sample rate for Whisper
              "-acodec",
              "pcm_s16le", // PCM format
              "-y", // Overwrite output file
              audioPath,
            ]);

            let errorOutput = "";
            ffmpeg.stderr.on("data", (data) => {
              errorOutput += data.toString();
            });

            ffmpeg.on("close", (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(
                  new Error(`FFmpeg failed with code ${code}: ${errorOutput}`),
                );
              }
            });

            ffmpeg.on("error", (err) => {
              reject(err);
            });
          });

          // Get word-level timing from audio
          const audioBuffer = fs.readFileSync(audioPath);
          console.log("Transcribing for word-level timing...");
          const transcription = await transcribeAudioBuffer(
            audioBuffer,
            originalName,
          );

          // Clean up audio file
          fs.unlinkSync(audioPath);

          console.log(
            `Got ${transcription.words?.length || 0} word-level timestamps`,
          );

          // Generate video clips using word-level timing data
          const videoClips = await generateVideoClips(
            transcript,
            transcription.duration || 120,
            transcription.words || [],
          );

          console.log(
            `Successfully generated ${videoClips.length} clips for ${originalName}`,
          );

          // Create actual video clip files using FFmpeg
          console.log("Creating actual video clip files...");
          const { createVideoClips } = await import("./video-clipper");

          const clipRequests = videoClips.map((clip: any) => ({
            title: clip.title,
            description: clip.description,
            startTime: clip.startTime,
            endTime: clip.endTime,
            socialScore: clip.socialScore || 0,
          }));

          // Create video clips from the original video file
          const videoClipResults = await createVideoClips(
            videoPath,
            clipRequests,
          );

          // Now clean up the original video file
          try {
            fs.unlinkSync(videoPath!);
          } catch (cleanupError) {
            console.warn("File cleanup warning:", cleanupError);
          }

          console.log(
            `Successfully created ${videoClipResults.length} video clip files for ${originalName}`,
          );

          res.json({
            clips: videoClipResults.map((clipResult: any, index: number) => ({
              id: `video-clip-${Date.now()}-${index}`,
              title: clipResult.title,
              description: clipResult.description,
              startTime: clipResult.startTime,
              endTime: clipResult.endTime,
              socialScore: clipResult.socialScore,
              duration: clipResult.endTime - clipResult.startTime,
              videoPath: clipResult.videoPath,
              createdAt: new Date().toISOString(),
            })),
          });
        } catch (processingError) {
          console.error("Video clipping error:", processingError);

          // Clean up files on error
          try {
            if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
          } catch (cleanupError) {
            console.warn("Error during cleanup:", cleanupError);
          }

          res.status(500).json({
            message: "Failed to generate video clips",
            error:
              processingError instanceof Error
                ? processingError.message
                : String(processingError),
            suggestion: "Check that transcript matches the video content",
          });
        }
      });

      bb.on("error", (err: any) => {
        console.error("Busboy error:", err);
        res.status(400).json({
          message: "Upload processing error",
          error: err instanceof Error ? err.message : String(err),
        });
      });

      req.pipe(bb);
    } catch (error) {
      console.error("Video clipping error:", error);
      res.status(500).json({
        message: "Failed to generate video clips",
        error: error instanceof Error ? error.message : String(error),
        suggestion: "Try uploading a smaller video file",
      });
    }
  });

  // Content Generation from Uploaded Transcript
  app.post("/api/generate-content-from-upload", async (req, res) => {
    // Set longer timeout for comprehensive content generation
    req.setTimeout(10 * 60 * 1000); // 10 minutes
    res.setTimeout(10 * 60 * 1000); // 10 minutes

    try {
      const {
        transcript,
        uploadId, // Optional: if provided, update existing upload record
        generateComprehensive = true,
        contentType = "text",
        generateAll = false,
      } = req.body;

      if (!transcript || transcript.trim().length === 0) {
        return res.status(400).json({
          message: "Transcript is required for content generation",
        });
      }

      console.log("Generating content from upload");
      console.log("Generate comprehensive:", generateComprehensive);
      console.log("Transcript length:", transcript.length);
      console.log("Sample content:", transcript.substring(0, 200) + "...");

      // Truncate very long transcripts to prevent API timeouts
      const maxTranscriptLength = 500000; // ~50k characters max
      const processedTranscript =
        transcript.length > maxTranscriptLength
          ? transcript.substring(0, maxTranscriptLength) +
            "... [truncated for processing]"
          : transcript;

      if (transcript.length > maxTranscriptLength) {
        console.log(
          `Truncated transcript from ${transcript.length} to ${processedTranscript.length} characters`,
        );
      }

      if (generateComprehensive) {
        // Use new comprehensive content generation (7-8 posts across all types)
        console.log("Starting comprehensive content generation...");
        const allContent =
          await generateAllLinkedInContent(processedTranscript);
        console.log("Comprehensive content generation completed successfully");

        // Transform the comprehensive response into individual posts
        const allPosts: any[] = [];
        const timestamp = Date.now();

        // Add carousel posts
        if (allContent.carousel_posts) {
          allContent.carousel_posts.forEach((post: any, index: number) => {
            allPosts.push({
              id: `upload-carousel-${timestamp}-${index}`,
              title: post.title,
              content: post,
              type: "carousel",
              platform: "linkedin",
              createdAt: new Date().toISOString(),
            });
          });
        }

        // Add image posts
        if (allContent.image_posts) {
          allContent.image_posts.forEach((post: any, index: number) => {
            allPosts.push({
              id: `upload-image-${timestamp}-${index}`,
              title: post.title,
              content: post,
              type: "image",
              platform: "linkedin",
              createdAt: new Date().toISOString(),
            });
          });
        }

        // Add text posts
        if (allContent.text_posts) {
          allContent.text_posts.forEach((post: any, index: number) => {
            allPosts.push({
              id: `upload-text-${timestamp}-${index}`,
              title: post.title,
              content: post,
              type: "text",
              platform: "linkedin",
              createdAt: new Date().toISOString(),
            });
          });
        }

        // Auto-create LinkedIn.md file
        const linkedinMarkdown = generateUploadContentMarkdown(
          processedTranscript,
          allPosts,
          [] // No clips in content generation - they're generated separately
        );

        // Create or update upload record in database
        let uploadRecord;
        if (uploadId) {
          // Update existing upload record
          uploadRecord = await storage.updateUpload(uploadId, {
            linkedinContentMarkdown: linkedinMarkdown,
            contentItems: allPosts,
          });
          console.log(`Updated upload record with ID: ${uploadId}`);
        } else {
          // Create new upload record
          uploadRecord = await storage.createUpload({
            originalName: 'text-content-generated', // Content generated from text, not file
            objectPath: 'text-generated',
            fileSize: 0,
            mimeType: 'text/plain',
            status: 'content-generated',
            transcript: processedTranscript,
            linkedinContentMarkdown: linkedinMarkdown,
            contentItems: allPosts,
            videoClips: null, // Clips generated separately
          });
          console.log(`Created upload record with ID: ${uploadRecord.id}`);
        }

        res.json({
          comprehensive: true,
          uploadId: uploadRecord.id, // Return unique upload ID
          posts: allPosts,
          linkedinMarkdown, // Include markdown in response for immediate download
          summary: {
            total: allPosts.length,
            carousels: allContent.carousel_posts?.length || 0,
            images: allContent.image_posts?.length || 0,
            texts: allContent.text_posts?.length || 0,
          },
        });
      } else {
        // Use original single-type generation for backward compatibility
        const content = await generateLinkedInContent(
          transcript,
          contentType,
          generateAll,
        );

        if (generateAll && content.posts) {
          // Return multiple posts
          res.json({
            posts: content.posts.map((post: any, index: number) => ({
              id: `upload-${Date.now()}-${index}`,
              title: post.title,
              content: post,
              type: contentType,
              platform: "linkedin",
              createdAt: new Date().toISOString(),
            })),
          });
        } else {
          // Return single post (legacy support)
          res.json({
            id: `upload-${Date.now()}`,
            title: content.title,
            content: content,
            type: contentType,
            platform: "linkedin",
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Content generation from upload error:", error);
      res
        .status(500)
        .json({ message: "Failed to generate content from upload" });
    }
  });

  // Generate clips from uploaded content
  app.post("/api/generate-clips-from-upload", async (req, res) => {
    try {
      const { transcript, uploadId } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      console.log("Generating clips from upload");
      console.log("Transcript length:", transcript.length);

      // Generate video clips using the same function as sessions
      // Estimate duration based on transcript length (roughly 150 words per minute)
      const estimatedDuration = Math.max(
        60,
        Math.floor(transcript.split(" ").length / 2.5),
      );
      const clips = await generateVideoClips(transcript, estimatedDuration);

      // If uploadId provided, update the upload record with video clips
      if (uploadId) {
        await storage.updateUpload(uploadId, {
          videoClips: clips,
        });
        console.log(`Updated upload record ${uploadId} with ${clips.length} video clips`);
      }

      res.json(clips);
    } catch (error) {
      console.error("Error generating clips from upload:", error);
      res.status(500).json({ error: "Failed to generate clips" });
    }
  });

  // AI-Powered Content Generation with Claude
  app.post("/api/sessions/:sessionId/generate-content", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { contentType = "text" } = req.body; // carousel, image, text

      // Get conversation data including both questions and responses for context
      const conversations = await storage.getConversationsBySession(sessionId);
      const userResponses = conversations.filter(
        (c) => c.type === "user_response",
      );

      if (userResponses.length === 0) {
        return res.status(400).json({
          message:
            "No user responses found for content generation. Please complete at least one response in your interview session first.",
          debug: {
            totalConversations: conversations.length,
            conversationTypes: conversations.map((c) => c.type),
          },
        });
      }

      // Build comprehensive transcript from conversation data
      const conversationPairs: Array<{
        question: string;
        response: string;
        timestamp: number;
      }> = [];
      const questionsMap = new Map<number, string>();

      // First, map questions by timestamp
      conversations
        .filter((c) => c.type === "ai_question")
        .forEach((q) => {
          questionsMap.set(q.timestamp, q.content);
        });

      // Then build Q&A pairs
      conversations
        .filter((c) => c.type === "user_response")
        .forEach((response) => {
          // Find the most recent question before this response
          const questionTimestamps = Array.from(questionsMap.keys()).filter(
            (t) => t <= response.timestamp,
          );
          if (questionTimestamps.length > 0) {
            const questionTimestamp = Math.max(...questionTimestamps);
            const question = questionsMap.get(questionTimestamp);

            if (question) {
              conversationPairs.push({
                question,
                response: response.content,
                timestamp: response.timestamp,
              });
            }
          }
        });

      // Create full transcript with timing
      const fullTranscript = conversationPairs
        .map((pair) => `Q: ${pair.question}\nA: ${pair.response}`)
        .join("\n\n");

      const conversationText = `Interview Transcript:
${fullTranscript}

Total Duration: ${Math.max(...conversations.map((c) => c.timestamp))} seconds`;

      if (!fullTranscript) {
        return res
          .status(400)
          .json({ message: "No meaningful conversation content found" });
      }

      console.log("Generating content for session:", sessionId);
      console.log("Content type:", contentType);
      console.log("Conversation text length:", conversationText.length);
      console.log(
        "Sample content:",
        conversationText.substring(0, 200) + "...",
      );

      const content = await generateLinkedInContent(
        conversationText,
        contentType,
        true,
      );

      // Check if we got multiple posts (new batch generation)
      if (content.posts && Array.isArray(content.posts)) {
        // Save all posts to database
        const savedPosts = [];
        for (const post of content.posts) {
          const contentPiece = await storage.createContentPiece({
            sessionId,
            type: contentType,
            title: post.title || "Generated Content",
            content: post,
            platform: "linkedin",
          });
          savedPosts.push(contentPiece);
        }

        res.json({ posts: savedPosts });
      } else {
        // Single post (legacy support)
        const contentPiece = await storage.createContentPiece({
          sessionId,
          type: contentType,
          title: content.title || "Generated Content",
          content: content,
          platform: "linkedin",
        });

        res.json(contentPiece);
      }
    } catch (error) {
      console.error("Content generation error:", error);
      res.status(500).json({ message: "Failed to generate content" });
    }
  });

  // Clips
  app.get("/api/sessions/:sessionId/clips", async (req, res) => {
    try {
      const clips = await storage.getClipsBySession(req.params.sessionId);
      res.json(clips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clips" });
    }
  });

  app.post("/api/clips", async (req, res) => {
    try {
      const validatedData = insertClipSchema.parse(req.body);
      const clip = await storage.createClip(validatedData);
      res.status(201).json(clip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid clip data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create clip" });
    }
  });

  // AI-Powered Clip Generation with Claude
  app.post("/api/sessions/:sessionId/generate-clips", async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Get session data and conversation history for context
      const session = await storage.getSession(sessionId);
      const conversations = await storage.getConversationsBySession(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Use fullTranscript if available, otherwise build from conversations
      let conversationText = session.fullTranscript || "";

      if (!conversationText.trim()) {
        // Fallback to building from conversations
        const conversationPairs: Array<{ question: string; response: string }> =
          [];
        const questionsMap = new Map<number, string>();

        // First, map questions by timestamp
        conversations
          .filter((c) => c.type === "ai_question")
          .forEach((q) => {
            questionsMap.set(q.timestamp, q.content);
          });

        // Then build Q&A pairs
        conversations
          .filter((c) => c.type === "user_response")
          .forEach((response) => {
            // Find the most recent question before this response
            const questionTimestamps = Array.from(questionsMap.keys()).filter(
              (t) => t <= response.timestamp,
            );
            if (questionTimestamps.length > 0) {
              const questionTimestamp = Math.max(...questionTimestamps);
              const question = questionsMap.get(questionTimestamp);

              if (question) {
                conversationPairs.push({
                  question,
                  response: response.content,
                });
              }
            }
          });

        conversationText = conversationPairs
          .map((pair) => `Q: ${pair.question}\nA: ${pair.response}`)
          .join("\n\n");
      }

      if (!conversationText.trim()) {
        return res
          .status(400)
          .json({ message: "No conversation content found" });
      }

      // Use Claude to generate optimized clips
      const clipSuggestions = await generateVideoClips(
        conversationText,
        session.duration || 180,
      );

      // Save clips to database
      const savedClips = [];
      for (const clipData of clipSuggestions) {
        const clip = await storage.createClip({
          sessionId,
          title: clipData.title,
          platform: "social_media",
          description: clipData.description,
          startTime: clipData.startTime,
          endTime: clipData.endTime,
          socialScore: clipData.socialScore,
        });
        savedClips.push(clip);
      }

      res.json(savedClips);
    } catch (error) {
      console.error("Clip generation error:", error);
      res.status(500).json({ message: "Failed to generate clips" });
    }
  });

  // Content Pieces
  app.get("/api/sessions/:sessionId/content", async (req, res) => {
    try {
      const content = await storage.getContentPiecesBySession(
        req.params.sessionId,
      );
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.post("/api/content", async (req, res) => {
    try {
      const validatedData = insertContentPieceSchema.parse(req.body);
      const content = await storage.createContentPiece(validatedData);
      res.status(201).json(content);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid content data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create content" });
    }
  });

  // Download session package (video, transcript, content)
  app.get("/api/download-session-package/:sessionId", async (req, res) => {
    // Set longer timeout for large package downloads
    req.setTimeout(15 * 60 * 1000); // 15 minutes
    res.setTimeout(15 * 60 * 1000); // 15 minutes

    try {
      const { sessionId } = req.params;
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const archiver = await import("archiver");
      const archive = archiver.default("zip", { zlib: { level: 9 } });

      res.attachment(
        `${session.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_package.zip`,
      );
      archive.pipe(res);

      // Add video file if exists
      if (session.videoUrl) {
        const videoPath = session.videoUrl.replace("/uploads/", "uploads/");
        try {
          const fs = await import("fs");
          if (fs.existsSync(videoPath)) {
            archive.file(videoPath, { name: "video.mp4" });
          }
        } catch (e) {
          console.log("Video file not found:", videoPath);
        }
      }

      // Add transcript
      if (session.fullTranscript) {
        archive.append(session.fullTranscript, { name: "transcript.txt" });
      }

      // Generate and add LinkedIn content markdown
      const [contentPieces, clips] = await Promise.all([
        storage.getContentPiecesBySession(sessionId),
        storage.getClipsBySession(sessionId),
      ]);

      const markdownContent = generateContentMarkdown(
        session,
        contentPieces,
        clips,
      );
      archive.append(markdownContent, { name: "linkedin_content.md" });

      archive.finalize();
    } catch (error) {
      console.error("Download session package error:", error);
      res.status(500).json({ error: "Failed to create download package" });
    }
  });

  // Download upload package (transcript, content, video clips)
  app.post("/api/download-upload-package", async (req, res) => {
    // Set longer timeout for large package downloads
    req.setTimeout(15 * 60 * 1000); // 15 minutes
    res.setTimeout(15 * 60 * 1000); // 15 minutes

    try {
      const { uploadId, transcript, content, clips } = req.body;

      // Try to get data from upload record if uploadId provided
      let transcriptData = transcript;
      let contentData = content;
      let clipsData = clips;
      let storedMarkdown = null;

      if (uploadId) {
        const uploadRecord = await storage.getUpload(uploadId);
        if (uploadRecord) {
          transcriptData = uploadRecord.transcript || transcript;
          contentData = uploadRecord.contentItems || content;
          clipsData = uploadRecord.videoClips || clips;
          storedMarkdown = uploadRecord.linkedinContentMarkdown;
          console.log(`Using stored upload record ${uploadId}`);
        }
      }

      // Debug logging to understand data structure
      console.log("Download package data:");
      console.log("- Upload ID:", uploadId || "none");
      console.log("- Transcript length:", transcriptData?.length || 0);
      console.log("- Content items:", contentData?.length || 0);
      console.log("- Clips items:", clipsData?.length || 0);
      console.log("- Stored markdown:", storedMarkdown ? "yes" : "no");
      if (contentData && contentData.length > 0) {
        console.log("- First content item keys:", Object.keys(contentData[0]));
        if (contentData[0].content) {
          console.log(
            "- First content.content keys:",
            Object.keys(contentData[0].content),
          );
        }
      }
      if (clipsData && clipsData.length > 0) {
        console.log("- First clip keys:", Object.keys(clipsData[0]));
      }

      const archiver = await import("archiver");
      const archive = archiver.default("zip", { zlib: { level: 9 } });

      res.attachment(`upload_content_package_${Date.now()}.zip`);
      archive.pipe(res);

      // Add transcript
      if (transcriptData) {
        archive.append(transcriptData, { name: "transcript.txt" });
      }

      // Use stored markdown if available, otherwise generate it
      const markdownContent = storedMarkdown || generateUploadContentMarkdown(
        transcriptData,
        contentData,
        clipsData,
      );
      archive.append(markdownContent, { name: "linkedin_content.md" });

      // Add actual video clip files if they exist
      if (clipsData && clipsData.length > 0) {
        const fs = await import("fs");
        for (const clip of clipsData) {
          if (clip.videoPath && fs.existsSync(clip.videoPath)) {
            const clipFileName = `${clip.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp4`;
            archive.file(clip.videoPath, {
              name: `video_clips/${clipFileName}`,
            });
          }
        }

        // Add clips metadata
        const clipsMetadata = clipsData.map((clip: any) => ({
          filename: `${clip.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp4`,
          title: clip.title,
          description: clip.description,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          socialScore: clip.socialScore,
        }));

        archive.append(JSON.stringify(clipsMetadata, null, 2), {
          name: "video_clips/clips_metadata.json",
        });
      }

      archive.finalize();
    } catch (error) {
      console.error("Download upload package error:", error);
      res.status(500).json({ error: "Failed to create download package" });
    }
  });

  // Download all upload clips as ZIP
  app.get("/api/upload-clips/download-all", async (req, res) => {
    try {
      const archiver = require("archiver");

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="upload_clips.zip"',
      );

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(res);

      // For upload clips, we don't have actual video files, so create a text file with clip information
      const clipInfo = `Upload Video Clips Information

Note: These clips were generated from uploaded transcript content.
To create actual video clips, you would need to upload the original video file.

Generated Clip Timestamps:
- Sample clips would be created based on transcript analysis
- Each clip includes start/end times and social media scores
- Download individual session clips from the Video Library for actual video files

For more information, visit the Video Library section.`;

      archive.append(clipInfo, { name: "clip_info.txt" });
      archive.finalize();
    } catch (error) {
      console.error("Upload clips download error:", error);
      res.status(500).json({ error: "Failed to download upload clips" });
    }
  });

  // Create video clips from session video using generated timestamps
  app.post("/api/sessions/:sessionId/create-clips", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const clips = await storage.getClips(sessionId);
      if (!clips || clips.length === 0) {
        return res.status(400).json({
          error: "No clips found for this session. Generate clips first.",
        });
      }

      // Check if video file exists
      const videoPath = `uploads/${sessionId}.mp4`;
      const fs = await import("fs");
      if (!fs.existsSync(videoPath)) {
        return res
          .status(400)
          .json({ error: "Video file not found for this session" });
      }

      const { createVideoClips } = await import("./video-clipper");

      const clipRequests = clips.map((clip) => ({
        title: clip.title,
        description: clip.description || "",
        startTime: clip.startTime,
        endTime: clip.endTime,
        socialScore: clip.socialScore || 0,
      }));

      const clipResults = await createVideoClips(videoPath, clipRequests);

      // Update clips in storage with video file paths
      for (let i = 0; i < clipResults.length; i++) {
        const clipResult = clipResults[i];
        const originalClip = clips[i];

        await storage.updateClip(originalClip.id, {
          ...originalClip,
          videoPath: clipResult.videoPath,
        });
      }

      res.json({
        message: `Successfully created ${clipResults.length} video clips`,
        clips: clipResults,
      });
    } catch (error) {
      console.error("Video clipping error:", error);
      res.status(500).json({ error: "Failed to create video clips" });
    }
  });

  // Create video clips from uploaded video and timestamps
  app.post(
    "/api/create-video-clips",
    upload.single("video"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "Video file is required" });
        }

        const { clips: clipsData } = req.body;
        if (!clipsData) {
          return res.status(400).json({ error: "Clips data is required" });
        }

        const clips = JSON.parse(clipsData);
        const { createVideoClips } = await import("./video-clipper");

        const clipResults = await createVideoClips(req.file.path, clips);

        // Clean up uploaded file
        const fs = await import("fs");
        fs.unlinkSync(req.file.path);

        res.json({
          message: `Successfully created ${clipResults.length} video clips`,
          clips: clipResults,
        });
      } catch (error) {
        console.error("Video clipping error:", error);
        res.status(500).json({ error: "Failed to create video clips" });
      }
    },
  );

  // Serve video clip file for viewing (streaming)
  app.get("/api/clips/:clipId/video", async (req, res) => {
    try {
      const { clipId } = req.params;
      console.log("Attempting to serve video for clip:", clipId);

      // For upload clips, we need to find the clip file in the uploads/clips directory
      const fs = await import("fs");
      const path = await import("path");

      // Look for the clip file by ID
      const clipsDir = "uploads/clips";
      if (!fs.existsSync(clipsDir)) {
        return res.status(404).json({ error: "Clips directory not found" });
      }

      // Find files that match the clip ID pattern
      const files = fs.readdirSync(clipsDir);
      const clipFile = files.find((file) =>
        file.includes(clipId.split("-").slice(-1)[0]),
      );

      if (!clipFile) {
        console.log("Available clip files:", files);
        return res.status(404).json({ error: "Clip video file not found" });
      }

      const clipPath = path.join(clipsDir, clipFile);

      if (!fs.existsSync(clipPath)) {
        return res.status(404).json({ error: "Video file not found on disk" });
      }

      const stat = fs.statSync(clipPath);

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Accept-Ranges", "bytes");

      const readStream = fs.createReadStream(clipPath);
      readStream.pipe(res);
    } catch (error) {
      console.error("Video serving error:", error);
      res.status(500).json({ error: "Failed to serve video" });
    }
  });

  // Download individual video clip
  app.get("/api/clips/:clipId/download", async (req, res) => {
    try {
      const { clipId } = req.params;
      console.log("Attempting to download clip:", clipId);

      // For upload clips, we need to find the clip file in the uploads/clips directory
      const fs = await import("fs");
      const path = await import("path");

      // Look for the clip file by ID
      const clipsDir = "uploads/clips";
      if (!fs.existsSync(clipsDir)) {
        return res.status(404).json({ error: "Clips directory not found" });
      }

      // Find files that match the clip ID pattern
      const files = fs.readdirSync(clipsDir);
      const clipFile = files.find((file) =>
        file.includes(clipId.split("-").slice(-1)[0]),
      );

      if (!clipFile) {
        console.log("Available clip files:", files);
        return res.status(404).json({ error: "Clip video file not found" });
      }

      const clipPath = path.join(clipsDir, clipFile);

      if (!fs.existsSync(clipPath)) {
        return res.status(404).json({ error: "Video file not found on disk" });
      }

      const fileName = clipFile;
      const stat = fs.statSync(clipPath);

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", stat.size);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );

      const readStream = fs.createReadStream(clipPath);
      readStream.pipe(res);
    } catch (error) {
      console.error("Clip download error:", error);
      res.status(500).json({ error: "Failed to download clip" });
    }
  });

  // Download all clips from a session as ZIP
  app.get("/api/sessions/:sessionId/download-clips", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const clips = await storage.getClips(sessionId);
      const clipsWithVideos = clips.filter((clip) => clip.videoPath);

      if (clipsWithVideos.length === 0) {
        return res
          .status(404)
          .json({ error: "No video clips found for this session" });
      }

      const archiver = await import("archiver");
      const fs = await import("fs");
      const path = await import("path");

      const archive = archiver.default("zip", { zlib: { level: 9 } });

      const session = await storage.getSession(sessionId);
      const sessionTitle =
        session?.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "session";

      res.attachment(`${sessionTitle}_video_clips.zip`);
      archive.pipe(res);

      // Add each video clip to the archive
      for (const clip of clipsWithVideos) {
        if (fs.existsSync(clip.videoPath!)) {
          const fileName = `${clip.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp4`;
          archive.file(clip.videoPath!, { name: fileName });
        }
      }

      // Add a metadata file with clip information
      const metadata = clipsWithVideos.map((clip) => ({
        filename: `${clip.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.mp4`,
        title: clip.title,
        description: clip.description,
        startTime: clip.startTime,
        endTime: clip.endTime,
        duration: clip.endTime - clip.startTime,
        socialScore: clip.socialScore,
      }));

      archive.append(JSON.stringify(metadata, null, 2), {
        name: "clips_metadata.json",
      });

      archive.finalize();
    } catch (error) {
      console.error("Clips download error:", error);
      res.status(500).json({ error: "Failed to download clips" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate markdown content for sessions
function generateContentMarkdown(
  session: any,
  contentPieces: any[],
  clips: any[],
): string {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  let markdown = `# ${session.title}\n\n`;
  markdown += `**Topic:** ${session.topic}\n`;
  markdown += `**Duration:** ${formatTime(session.duration || 0)}\n`;
  markdown += `**Created:** ${new Date(session.createdAt).toLocaleDateString()}\n\n`;

  markdown += `## LinkedIn Content\n\n`;

  // Group content by type
  const carouselPosts = contentPieces.filter((c) => c.type === "carousel");
  const imagePosts = contentPieces.filter((c) => c.type === "image");
  const textPosts = contentPieces.filter((c) => c.type === "text");

  if (carouselPosts.length > 0) {
    markdown += `### Carousel Posts\n\n`;
    carouselPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;

      // Add detailed caption if available
      if (post.content.detailed_caption) {
        markdown += `**Caption:**\n${post.content.detailed_caption}\n\n`;
      }

      if (post.content.slides) {
        markdown += `**Slides:**\n`;
        post.content.slides.forEach((slide: any, slideIndex: number) => {
          markdown += `**Slide ${slideIndex + 1}:** ${slide.title}\n`;
          markdown += `${slide.content}\n\n`;
        });
      }

      // Add visual direction if available
      if (post.content.visual_direction) {
        markdown += `**Visual Direction:**\n${post.content.visual_direction}\n\n`;
      }

      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(" ")}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (imagePosts.length > 0) {
    markdown += `### Image Posts\n\n`;
    imagePosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;

      // Add detailed caption if available
      if (post.content.detailed_caption) {
        markdown += `**Caption:**\n${post.content.detailed_caption}\n\n`;
      }

      if (post.content.quote) {
        markdown += `**Quote:** "${post.content.quote}"\n\n`;
      }
      if (post.content.insight) {
        markdown += `**Insight:** ${post.content.insight}\n\n`;
      }
      if (post.content.statistic) {
        markdown += `**Statistic:** ${post.content.statistic}\n\n`;
      }

      // Add visual direction if available
      if (post.content.visual_direction) {
        markdown += `**Visual Direction:**\n${post.content.visual_direction}\n\n`;
      }

      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(" ")}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (textPosts.length > 0) {
    markdown += `### Text Posts\n\n`;
    textPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;

      // Add detailed content if available (this is the full post content)
      if (post.content.detailed_content) {
        markdown += `**Full Post Content:**\n${post.content.detailed_content}\n\n`;
      } else {
        // Fallback to individual components
        if (post.content.hook) {
          markdown += `**Hook:** ${post.content.hook}\n\n`;
        }
        if (post.content.body) {
          markdown += `**Body:**\n${post.content.body}\n\n`;
        }
        if (post.content.callToAction) {
          markdown += `**Call to Action:** ${post.content.callToAction}\n\n`;
        }
      }

      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(" ")}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (clips.length > 0) {
    markdown += `## Video Clips\n\n`;
    clips.forEach((clip, index) => {
      markdown += `### ${index + 1}. ${clip.title}\n\n`;
      markdown += `**Time:** ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)} (${formatTime(clip.endTime - clip.startTime)} duration)\n`;
      markdown += `**Description:** ${clip.description}\n`;
      markdown += `**Social Score:** ${clip.socialScore}/100\n\n`;
      markdown += `---\n\n`;
    });
  }

  return markdown;
}

// Helper function to generate comprehensive markdown content for uploads
function generateUploadContentMarkdown(
  transcript: string,
  content: any[],
  clips: any[],
): string {
  console.log("mac12345::", JSON.stringify({ content }));
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  let markdown = `# Upload Content Package\n\n`;
  markdown += `**Generated:** ${new Date().toLocaleDateString()}\n`;
  markdown += `**Transcript Length:** ${transcript?.length || 0} characters\n`;
  markdown += `**Content Items:** ${content?.length || 0}\n`;
  markdown += `**Video Clips:** ${clips?.length || 0}\n\n`;

  if (!content || content.length === 0) {
    markdown += `## LinkedIn Content\n\n*No content generated yet. Please generate content first.*\n\n`;
  } else {
    markdown += `## LinkedIn Content\n\n`;
  }

  // Group content by type and ensure safety
  const carouselPosts = content
    ? content.filter((c) => c && c.type === "carousel")
    : [];
  const imagePosts = content
    ? content.filter((c) => c && c.type === "image")
    : [];
  const textPosts = content
    ? content.filter((c) => c && c.type === "text")
    : [];

  if (carouselPosts.length > 0) {
    markdown += `### Carousel Posts\n\n`;
    carouselPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;

      // Add detailed caption if available
      if (post.content.detailed_caption) {
        markdown += `**Caption:**\n${post.content.detailed_caption}\n\n`;
      }

      if (post.content.slides) {
        markdown += `**Slides:**\n`;
        post.content.slides.forEach((slide: any, slideIndex: number) => {
          markdown += `**Slide ${slideIndex + 1}:** ${slide.title}\n`;
          markdown += `${slide.content}\n\n`;
        });
      }

      // Add visual direction if available
      if (post.content.visual_direction) {
        markdown += `**Visual Direction:**\n${post.content.visual_direction}\n\n`;
      }

      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(" ")}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (imagePosts.length > 0) {
    markdown += `### Image Posts\n\n`;
    imagePosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;

      // Add detailed caption if available
      if (post.content.detailed_caption) {
        markdown += `**Caption:**\n${post.content.detailed_caption}\n\n`;
      }

      if (post.content.quote) {
        markdown += `**Quote:** "${post.content.quote}"\n\n`;
      }
      if (post.content.insight) {
        markdown += `**Insight:** ${post.content.insight}\n\n`;
      }
      if (post.content.statistic) {
        markdown += `**Statistic:** ${post.content.statistic}\n\n`;
      }

      // Add visual direction if available
      if (post.content.visual_direction) {
        markdown += `**Visual Direction:**\n${post.content.visual_direction}\n\n`;
      }

      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(" ")}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (textPosts.length > 0) {
    markdown += `### Text Posts\n\n`;
    textPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;

      // Add detailed content if available (this is the full post content)
      if (post.content.detailed_content) {
        markdown += `**Full Post Content:**\n${post.content.detailed_content}\n\n`;
      } else {
        // Fallback to individual components
        if (post.content.hook) {
          markdown += `**Hook:** ${post.content.hook}\n\n`;
        }
        if (post.content.body) {
          markdown += `**Body:**\n${post.content.body}\n\n`;
        }
        if (post.content.callToAction) {
          markdown += `**Call to Action:** ${post.content.callToAction}\n\n`;
        }
      }

      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(" ")}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (clips && clips.length > 0) {
    markdown += `## Video Clips\n\n`;
    clips.forEach((clip: any, index: number) => {
      markdown += `### ${index + 1}. ${clip.title}\n\n`;
      markdown += `**Time:** ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)} (${formatTime(clip.endTime - clip.startTime)} duration)\n`;
      markdown += `**Description:** ${clip.description}\n`;
      markdown += `**Social Score:** ${clip.socialScore}/100\n\n`;

      if (clip.detailed_caption) {
        markdown += `**Detailed Caption (300-500 words):**\n${clip.detailed_caption}\n\n`;
      }

      if (clip.key_moments && clip.key_moments.length > 0) {
        markdown += `**Key Moments:**\n`;
        clip.key_moments.forEach((moment: string) => {
          markdown += `- ${moment}\n`;
        });
        markdown += `\n`;
      }

      if (clip.tags && clip.tags.length > 0) {
        markdown += `**Tags:** ${clip.tags.join(" ")}\n\n`;
      }

      markdown += `---\n\n`;
    });
  }

  return markdown;
}
