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
      const { transcript, contentType = 'text' } = req.body;
      
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
      const content = await generateLinkedInContent(transcript, contentType);
      
      // Return the generated content directly (not stored in database)
      res.json({
        id: `upload-${Date.now()}`,
        title: content.title,
        content: content,
        type: contentType,
        platform: "linkedin",
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Content generation from upload error:', error);
      res.status(500).json({ message: "Failed to generate content from upload" });
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
      
      const content = await generateLinkedInContent(conversationText, contentType);
      
      // Save to database
      const contentPiece = await storage.createContentPiece({
        sessionId,
        type: contentType,
        title: content.title || 'Generated Content',
        content: content,
        platform: 'linkedin'
      });
      
      res.json(contentPiece);
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
      
      const conversationText = conversations
        .filter(c => c.type === 'user_response')
        .map(c => c.content)
        .join(' ');
      
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

  const httpServer = createServer(app);
  return httpServer;
}
