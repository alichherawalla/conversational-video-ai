import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema, insertQuestionSchema, insertConversationSchema, insertClipSchema, insertContentPieceSchema } from "@shared/schema";
import { generateAIQuestion, analyzeResponse, generateLinkedInContent, generateVideoClips } from "./anthropic";
import { transcribeAudioBuffer } from "./openai";
import { z } from "zod";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ dest: '/tmp/' });

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
        return res.status(400).json({ message: "Invalid session data", errors: error.errors });
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
        return res.status(400).json({ message: "Invalid session data", errors: error.errors });
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
        return res.status(400).json({ message: "Invalid question data", errors: error.errors });
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
      const conversations = await storage.getConversationsBySession(req.params.sessionId);
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
        return res.status(400).json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Enhanced AI Question System with Contextual Follow-ups
  app.post("/api/ai/question", async (req, res) => {
    try {
      const { sessionId, questionId, followUpIndex, baseQuestion, userResponse } = req.body;
      
      if (followUpIndex !== undefined && baseQuestion && userResponse) {
        // Generate contextual AI follow-up based on user's response
        const aiQuestion = await generateAIQuestion(
          sessionId, 
          questionId, 
          followUpIndex, 
          baseQuestion, 
          userResponse
        );
        res.json({
          question: aiQuestion.question,
          questionId: aiQuestion.questionId,
          isFollowUp: true,
          followUpIndex
        });
      } else if (followUpIndex !== undefined) {
        // Fallback to pre-written follow-up questions
        const question = questionId ? await storage.getQuestion(questionId) : null;
        if (!question) {
          return res.status(404).json({ message: "Question not found" });
        }
        
        const followUps = [question.followUp1, question.followUp2].filter(Boolean);
        if (followUpIndex < followUps.length) {
          res.json({
            question: followUps[followUpIndex],
            questionId: question.id,
            isFollowUp: true,
            followUpIndex
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
            isFollowUp: false
          });
        } else {
          // Get next unasked question from the session
          const conversations = await storage.getConversationsBySession(sessionId);
          const askedQuestionIds = conversations
            .filter(c => c.type === 'ai_question')
            .map(c => c.questionId)
            .filter(Boolean);
          
          const allQuestions = await storage.getQuestions();
          const unaskedQuestions = allQuestions.filter(q => !askedQuestionIds.includes(q.id));
          
          if (unaskedQuestions.length === 0) {
            // All questions have been asked, generate AI question as fallback
            const aiQuestion = await generateAIQuestion(sessionId);
            return res.json({
              question: aiQuestion.question,
              questionId: aiQuestion.questionId,
              followUps: [],
              isFollowUp: false
            });
          }

          // Select the first unasked question (sequential progression)
          const nextQuestion = unaskedQuestions[0];
          
          res.json({
            question: nextQuestion.primary,
            questionId: nextQuestion.id,
            followUps: [nextQuestion.followUp1, nextQuestion.followUp2].filter(Boolean),
            isFollowUp: false
          });
        }
      }
    } catch (error) {
      console.error('AI question generation error:', error);
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
      console.error('AI feedback error:', error);
      res.status(500).json({ message: "Failed to analyze response" });
    }
  });

  // Audio Transcription with OpenAI Whisper
  app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const fs = await import('fs');
      const audioBuffer = fs.readFileSync(req.file.path);
      const transcription = await transcribeAudioBuffer(audioBuffer, req.file.originalname || 'audio.wav');
      
      // Clean up temp file
      fs.unlinkSync(req.file.path);
      
      res.json({
        text: transcription.text,
        duration: transcription.duration
      });
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });

  // Content Generation from Uploaded Transcript
  app.post("/api/generate-content-from-upload", async (req, res) => {
    try {
      const { transcript, contentType = 'text', generateAll = false } = req.body;
      
      if (!transcript || transcript.trim().length === 0) {
        return res.status(400).json({ 
          message: "Transcript is required for content generation" 
        });
      }
      
      console.log('Generating content from upload');
      console.log('Content type:', contentType);
      console.log('Transcript length:', transcript.length);
      console.log('Sample content:', transcript.substring(0, 200) + '...');
      
      // Generate content using Claude with the uploaded transcript
      const content = await generateLinkedInContent(transcript, contentType, generateAll);
      
      if (generateAll && content.posts) {
        // Return multiple posts
        res.json({
          posts: content.posts.map((post: any, index: number) => ({
            id: `upload-${Date.now()}-${index}`,
            title: post.title,
            content: post,
            type: contentType,
            platform: "linkedin",
            createdAt: new Date().toISOString()
          }))
        });
      } else {
        // Return single post (legacy support)
        res.json({
          id: `upload-${Date.now()}`,
          title: content.title,
          content: content,
          type: contentType,
          platform: "linkedin",
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Content generation from upload error:', error);
      res.status(500).json({ message: "Failed to generate content from upload" });
    }
  });

  // Generate clips from uploaded content
  app.post("/api/generate-clips-from-upload", async (req, res) => {
    try {
      const { transcript } = req.body;
      
      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      console.log('Generating clips from upload');
      console.log('Transcript length:', transcript.length);
      
      // Generate video clips using the same function as sessions
      // Estimate duration based on transcript length (roughly 150 words per minute)
      const estimatedDuration = Math.max(60, Math.floor(transcript.split(' ').length / 2.5));
      const clips = await generateVideoClips(transcript, estimatedDuration);
      
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
      const { contentType = 'text' } = req.body; // carousel, image, text
      
      // Get conversation data including both questions and responses for context
      const conversations = await storage.getConversationsBySession(sessionId);
      const userResponses = conversations.filter(c => c.type === 'user_response');
      
      if (userResponses.length === 0) {
        return res.status(400).json({ 
          message: "No user responses found for content generation. Please complete at least one response in your interview session first.",
          debug: {
            totalConversations: conversations.length,
            conversationTypes: conversations.map(c => c.type)
          }
        });
      }
      
      // Build comprehensive transcript from conversation data
      const conversationPairs: Array<{question: string; response: string; timestamp: number}> = [];
      const questionsMap = new Map<number, string>();
      
      // First, map questions by timestamp
      conversations
        .filter(c => c.type === 'ai_question')
        .forEach(q => {
          questionsMap.set(q.timestamp, q.content);
        });
      
      // Then build Q&A pairs
      conversations
        .filter(c => c.type === 'user_response')
        .forEach(response => {
          // Find the most recent question before this response
          const questionTimestamps = Array.from(questionsMap.keys()).filter(t => t <= response.timestamp);
          if (questionTimestamps.length > 0) {
            const questionTimestamp = Math.max(...questionTimestamps);
            const question = questionsMap.get(questionTimestamp);
            
            if (question) {
              conversationPairs.push({
                question,
                response: response.content,
                timestamp: response.timestamp
              });
            }
          }
        });
      
      // Create full transcript with timing
      const fullTranscript = conversationPairs
        .map(pair => `Q: ${pair.question}\nA: ${pair.response}`)
        .join('\n\n');
      
      const conversationText = `Interview Transcript:
${fullTranscript}

Total Duration: ${Math.max(...conversations.map(c => c.timestamp))} seconds`;
      
      if (!fullTranscript) {
        return res.status(400).json({ message: "No meaningful conversation content found" });
      }
      
      console.log('Generating content for session:', sessionId);
      console.log('Content type:', contentType);
      console.log('Conversation text length:', conversationText.length);
      console.log('Sample content:', conversationText.substring(0, 200) + '...');
      
      const content = await generateLinkedInContent(conversationText, contentType, true);
      
      // Check if we got multiple posts (new batch generation)
      if (content.posts && Array.isArray(content.posts)) {
        // Save all posts to database
        const savedPosts = [];
        for (const post of content.posts) {
          const contentPiece = await storage.createContentPiece({
            sessionId,
            type: contentType,
            title: post.title || 'Generated Content',
            content: post,
            platform: 'linkedin'
          });
          savedPosts.push(contentPiece);
        }
        
        res.json({ posts: savedPosts });
      } else {
        // Single post (legacy support)
        const contentPiece = await storage.createContentPiece({
          sessionId,
          type: contentType,
          title: content.title || 'Generated Content',
          content: content,
          platform: 'linkedin'
        });
        
        res.json(contentPiece);
      }
    } catch (error) {
      console.error('Content generation error:', error);
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
        return res.status(400).json({ message: "Invalid clip data", errors: error.errors });
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
      let conversationText = session.fullTranscript || '';
      
      if (!conversationText.trim()) {
        // Fallback to building from conversations
        const conversationPairs: Array<{question: string; response: string}> = [];
        const questionsMap = new Map<number, string>();
        
        // First, map questions by timestamp
        conversations
          .filter(c => c.type === 'ai_question')
          .forEach(q => {
            questionsMap.set(q.timestamp, q.content);
          });
        
        // Then build Q&A pairs
        conversations
          .filter(c => c.type === 'user_response')
          .forEach(response => {
            // Find the most recent question before this response
            const questionTimestamps = Array.from(questionsMap.keys()).filter(t => t <= response.timestamp);
            if (questionTimestamps.length > 0) {
              const questionTimestamp = Math.max(...questionTimestamps);
              const question = questionsMap.get(questionTimestamp);
              
              if (question) {
                conversationPairs.push({
                  question,
                  response: response.content
                });
              }
            }
          });
        
        conversationText = conversationPairs
          .map(pair => `Q: ${pair.question}\nA: ${pair.response}`)
          .join('\n\n');
      }
      
      if (!conversationText.trim()) {
        return res.status(400).json({ message: "No conversation content found" });
      }
      
      // Use Claude to generate optimized clips
      const clipSuggestions = await generateVideoClips(conversationText, session.duration || 180);
      
      // Save clips to database
      const savedClips = [];
      for (const clipData of clipSuggestions) {
        const clip = await storage.createClip({
          sessionId,
          title: clipData.title,
          platform: 'social_media',
          description: clipData.description,
          startTime: clipData.startTime,
          endTime: clipData.endTime,
          socialScore: clipData.socialScore
        });
        savedClips.push(clip);
      }
      
      res.json(savedClips);
    } catch (error) {
      console.error('Clip generation error:', error);
      res.status(500).json({ message: "Failed to generate clips" });
    }
  });

  // Content Pieces
  app.get("/api/sessions/:sessionId/content", async (req, res) => {
    try {
      const content = await storage.getContentPiecesBySession(req.params.sessionId);
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
        return res.status(400).json({ message: "Invalid content data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create content" });
    }
  });

  // Download session package (video, transcript, content)
  app.get("/api/download-session-package/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      
      res.attachment(`${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_package.zip`);
      archive.pipe(res);

      // Add video file if exists
      if (session.videoUrl) {
        const videoPath = session.videoUrl.replace('/uploads/', 'uploads/');
        try {
          const fs = await import('fs');
          if (fs.existsSync(videoPath)) {
            archive.file(videoPath, { name: 'video.mp4' });
          }
        } catch (e) {
          console.log('Video file not found:', videoPath);
        }
      }

      // Add transcript
      if (session.fullTranscript) {
        archive.append(session.fullTranscript, { name: 'transcript.txt' });
      }

      // Generate and add LinkedIn content markdown
      const [contentPieces, clips] = await Promise.all([
        storage.getContentPiecesBySession(sessionId),
        storage.getClipsBySession(sessionId)
      ]);

      const markdownContent = generateContentMarkdown(session, contentPieces, clips);
      archive.append(markdownContent, { name: 'linkedin_content.md' });

      archive.finalize();
    } catch (error) {
      console.error('Download session package error:', error);
      res.status(500).json({ error: "Failed to create download package" });
    }
  });

  // Download upload package (transcript, content)
  app.post("/api/download-upload-package", async (req, res) => {
    try {
      const { transcript, content, clips } = req.body;
      
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      
      res.attachment(`upload_content_package_${Date.now()}.zip`);
      archive.pipe(res);

      // Add transcript
      if (transcript) {
        archive.append(transcript, { name: 'transcript.txt' });
      }

      // Generate and add LinkedIn content markdown
      const markdownContent = generateUploadContentMarkdown(transcript, content, clips);
      archive.append(markdownContent, { name: 'linkedin_content.md' });

      archive.finalize();
    } catch (error) {
      console.error('Download upload package error:', error);
      res.status(500).json({ error: "Failed to create download package" });
    }
  });

  // Download all upload clips as ZIP
  app.get("/api/upload-clips/download-all", async (req, res) => {
    try {
      const archiver = require('archiver');
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="upload_clips.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
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

      archive.append(clipInfo, { name: 'clip_info.txt' });
      archive.finalize();
    } catch (error) {
      console.error('Upload clips download error:', error);
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
        return res.status(400).json({ error: "No clips found for this session. Generate clips first." });
      }

      // Check if video file exists
      const videoPath = `uploads/${sessionId}.mp4`;
      const fs = await import('fs');
      if (!fs.existsSync(videoPath)) {
        return res.status(400).json({ error: "Video file not found for this session" });
      }

      const { createVideoClips } = await import('./video-clipper');
      
      const clipRequests = clips.map(clip => ({
        title: clip.title,
        description: clip.description || "",
        startTime: clip.startTime,
        endTime: clip.endTime,
        socialScore: clip.socialScore || 0
      }));

      const clipResults = await createVideoClips(videoPath, clipRequests);
      
      // Update clips in storage with video file paths
      for (let i = 0; i < clipResults.length; i++) {
        const clipResult = clipResults[i];
        const originalClip = clips[i];
        
        await storage.updateClip(originalClip.id, {
          ...originalClip,
          videoPath: clipResult.videoPath
        });
      }
      
      res.json({ 
        message: `Successfully created ${clipResults.length} video clips`,
        clips: clipResults 
      });
    } catch (error) {
      console.error('Video clipping error:', error);
      res.status(500).json({ error: "Failed to create video clips" });
    }
  });

  // Create video clips from uploaded video and timestamps
  app.post("/api/create-video-clips", upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Video file is required" });
      }

      const { clips: clipsData } = req.body;
      if (!clipsData) {
        return res.status(400).json({ error: "Clips data is required" });
      }

      const clips = JSON.parse(clipsData);
      const { createVideoClips } = await import('./video-clipper');
      
      const clipResults = await createVideoClips(req.file.path, clips);
      
      // Clean up uploaded file
      const fs = await import('fs');
      fs.unlinkSync(req.file.path);
      
      res.json({ 
        message: `Successfully created ${clipResults.length} video clips`,
        clips: clipResults 
      });
    } catch (error) {
      console.error('Video clipping error:', error);
      res.status(500).json({ error: "Failed to create video clips" });
    }
  });

  // Download individual video clip
  app.get("/api/clips/:clipId/download", async (req, res) => {
    try {
      const { clipId } = req.params;
      
      const clip = await storage.getClip(clipId);
      if (!clip || !clip.videoPath) {
        return res.status(404).json({ error: "Clip or video file not found" });
      }

      const fs = await import('fs');
      const path = await import('path');
      
      if (!fs.existsSync(clip.videoPath)) {
        return res.status(404).json({ error: "Video file not found on disk" });
      }

      const fileName = `${clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
      const stat = fs.statSync(clip.videoPath);
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      const readStream = fs.createReadStream(clip.videoPath);
      readStream.pipe(res);
    } catch (error) {
      console.error('Clip download error:', error);
      res.status(500).json({ error: "Failed to download clip" });
    }
  });

  // Download all clips from a session as ZIP
  app.get("/api/sessions/:sessionId/download-clips", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const clips = await storage.getClips(sessionId);
      const clipsWithVideos = clips.filter(clip => clip.videoPath);
      
      if (clipsWithVideos.length === 0) {
        return res.status(404).json({ error: "No video clips found for this session" });
      }

      const archiver = await import('archiver');
      const fs = await import('fs');
      const path = await import('path');
      
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      
      const session = await storage.getSession(sessionId);
      const sessionTitle = session?.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'session';
      
      res.attachment(`${sessionTitle}_video_clips.zip`);
      archive.pipe(res);

      // Add each video clip to the archive
      for (const clip of clipsWithVideos) {
        if (fs.existsSync(clip.videoPath!)) {
          const fileName = `${clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
          archive.file(clip.videoPath!, { name: fileName });
        }
      }

      // Add a metadata file with clip information
      const metadata = clipsWithVideos.map(clip => ({
        filename: `${clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`,
        title: clip.title,
        description: clip.description,
        startTime: clip.startTime,
        endTime: clip.endTime,
        duration: clip.endTime - clip.startTime,
        socialScore: clip.socialScore
      }));
      
      archive.append(JSON.stringify(metadata, null, 2), { name: 'clips_metadata.json' });
      
      archive.finalize();
    } catch (error) {
      console.error('Clips download error:', error);
      res.status(500).json({ error: "Failed to download clips" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate markdown content for sessions
function generateContentMarkdown(session: any, contentPieces: any[], clips: any[]): string {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  let markdown = `# ${session.title}\n\n`;
  markdown += `**Topic:** ${session.topic}\n`;
  markdown += `**Duration:** ${formatTime(session.duration || 0)}\n`;
  markdown += `**Created:** ${new Date(session.createdAt).toLocaleDateString()}\n\n`;

  markdown += `## LinkedIn Content\n\n`;

  // Group content by type
  const carouselPosts = contentPieces.filter(c => c.type === 'carousel');
  const imagePosts = contentPieces.filter(c => c.type === 'image');
  const textPosts = contentPieces.filter(c => c.type === 'text');

  if (carouselPosts.length > 0) {
    markdown += `### Carousel Posts\n\n`;
    carouselPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;
      if (post.content.slides) {
        post.content.slides.forEach((slide: any, slideIndex: number) => {
          markdown += `**Slide ${slideIndex + 1}:** ${slide.icon} ${slide.title}\n`;
          markdown += `${slide.content}\n\n`;
        });
      }
      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(' ')}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (imagePosts.length > 0) {
    markdown += `### Image Posts\n\n`;
    imagePosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;
      if (post.content.quote) {
        markdown += `**Quote:** "${post.content.quote}"\n\n`;
      }
      if (post.content.insight) {
        markdown += `**Insight:** ${post.content.insight}\n\n`;
      }
      if (post.content.statistic) {
        markdown += `**Statistic:** ${post.content.statistic}\n\n`;
      }
      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(' ')}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (textPosts.length > 0) {
    markdown += `### Text Posts\n\n`;
    textPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;
      if (post.content.hook) {
        markdown += `**Hook:** ${post.content.hook}\n\n`;
      }
      if (post.content.body) {
        markdown += `**Body:**\n${post.content.body}\n\n`;
      }
      if (post.content.callToAction) {
        markdown += `**Call to Action:** ${post.content.callToAction}\n\n`;
      }
      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(' ')}\n\n`;
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

// Helper function to generate markdown content for uploads
function generateUploadContentMarkdown(transcript: string, content: any[], clips: any[]): string {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  let markdown = `# Upload Content Package\n\n`;
  markdown += `**Generated:** ${new Date().toLocaleDateString()}\n`;
  markdown += `**Transcript Length:** ${transcript.length} characters\n\n`;

  markdown += `## LinkedIn Content\n\n`;

  // Group content by type
  const carouselPosts = content.filter(c => c.type === 'carousel');
  const imagePosts = content.filter(c => c.type === 'image');
  const textPosts = content.filter(c => c.type === 'text');

  if (carouselPosts.length > 0) {
    markdown += `### Carousel Posts\n\n`;
    carouselPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;
      if (post.content.slides) {
        post.content.slides.forEach((slide: any, slideIndex: number) => {
          markdown += `**Slide ${slideIndex + 1}:** ${slide.icon} ${slide.title}\n`;
          markdown += `${slide.content}\n\n`;
        });
      }
      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(' ')}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (imagePosts.length > 0) {
    markdown += `### Image Posts\n\n`;
    imagePosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;
      if (post.content.quote) {
        markdown += `**Quote:** "${post.content.quote}"\n\n`;
      }
      if (post.content.insight) {
        markdown += `**Insight:** ${post.content.insight}\n\n`;
      }
      if (post.content.statistic) {
        markdown += `**Statistic:** ${post.content.statistic}\n\n`;
      }
      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(' ')}\n\n`;
      }
      markdown += `---\n\n`;
    });
  }

  if (textPosts.length > 0) {
    markdown += `### Text Posts\n\n`;
    textPosts.forEach((post, index) => {
      markdown += `#### ${index + 1}. ${post.title}\n\n`;
      if (post.content.hook) {
        markdown += `**Hook:** ${post.content.hook}\n\n`;
      }
      if (post.content.body) {
        markdown += `**Body:**\n${post.content.body}\n\n`;
      }
      if (post.content.callToAction) {
        markdown += `**Call to Action:** ${post.content.callToAction}\n\n`;
      }
      if (post.content.tags) {
        markdown += `**Tags:** ${post.content.tags.join(' ')}\n\n`;
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
      markdown += `---\n\n`;
    });
  }

  return markdown;
}
