import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema, insertQuestionSchema, insertConversationSchema, insertClipSchema, insertContentPieceSchema } from "@shared/schema";
import { z } from "zod";

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

  // AI Mock Responses
  app.post("/api/ai/question", async (req, res) => {
    try {
      const { sessionId, questionId } = req.body;
      
      // Mock AI question selection and follow-up logic
      const question = questionId ? await storage.getQuestion(questionId) : null;
      
      if (!question) {
        // Select a random question if none specified
        const questions = await storage.getQuestions();
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        
        if (!randomQuestion) {
          return res.status(404).json({ message: "No questions available" });
        }

        res.json({
          question: randomQuestion.primary,
          questionId: randomQuestion.id,
          followUps: [randomQuestion.followUp1, randomQuestion.followUp2].filter(Boolean)
        });
      } else {
        res.json({
          question: question.primary,
          questionId: question.id,
          followUps: [question.followUp1, question.followUp2].filter(Boolean)
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get AI question" });
    }
  });

  app.post("/api/ai/feedback", async (req, res) => {
    try {
      const { response } = req.body;
      
      // Mock AI feedback based on response length and content
      const feedbacks = [];
      
      if (response.length > 100) {
        feedbacks.push({ type: "positive", message: "Clear articulation", level: "good" });
      } else {
        feedbacks.push({ type: "warning", message: "Add more specifics", level: "improve" });
      }
      
      if (response.toLowerCase().includes("example") || response.toLowerCase().includes("specific")) {
        feedbacks.push({ type: "positive", message: "Good use of examples", level: "excellent" });
      }
      
      feedbacks.push({ type: "positive", message: "Good eye contact", level: "excellent" });
      
      const suggestion = "Try expanding on your examples with concrete numbers or outcomes.";
      
      res.json({ feedbacks, suggestion });
    } catch (error) {
      res.status(500).json({ message: "Failed to get AI feedback" });
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

  // Mock clip generation
  app.post("/api/sessions/:sessionId/generate-clips", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Mock generated clips
      const mockClips = [
        {
          sessionId,
          title: "The Moment I Knew I Had to Start My Own Business",
          description: "Perfect hook for TikTok/Instagram Reels",
          startTime: 15,
          endTime: 62,
          socialScore: 85,
          platform: "tiktok",
          videoUrl: null,
        },
        {
          sessionId,
          title: "My Biggest Business Failure (And What It Taught Me)",
          description: "Engaging story format for YouTube Shorts",
          startTime: 374,
          endTime: 451,
          socialScore: 92,
          platform: "youtube",
          videoUrl: null,
        },
        {
          sessionId,
          title: "The Key to Entrepreneurial Success",
          description: "Motivational content for Instagram",
          startTime: 627,
          endTime: 708,
          socialScore: 78,
          platform: "instagram",
          videoUrl: null,
        }
      ];
      
      const clips = [];
      for (const clipData of mockClips) {
        const clip = await storage.createClip(clipData);
        clips.push(clip);
      }
      
      res.json(clips);
    } catch (error) {
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

  // Mock content generation
  app.post("/api/sessions/:sessionId/generate-content", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { type } = req.body;
      
      let mockContent;
      
      if (type === "carousel") {
        mockContent = {
          sessionId,
          type: "carousel",
          title: "5 Lessons From My Entrepreneurial Journey",
          content: {
            slides: [
              { title: "The importance of solving real problems", content: "Every successful business starts with a problem that needs solving." },
              { title: "How failure taught me resilience", content: "My first startup failed, but it taught me invaluable lessons." },
              { title: "Building the right team", content: "Surround yourself with people who complement your skills." },
              { title: "Customer feedback is everything", content: "Listen to your customers and iterate based on their needs." },
              { title: "Persistence pays off", content: "Success rarely happens overnight - keep pushing forward." }
            ]
          },
          platform: "linkedin",
        };
      } else if (type === "image") {
        mockContent = {
          sessionId,
          type: "image",
          title: "Inspirational Quote",
          content: {
            quote: "The biggest risk is not taking any risk at all",
            author: "Entrepreneur",
            design: "quote_card"
          },
          platform: "linkedin",
        };
      } else if (type === "text") {
        mockContent = {
          sessionId,
          type: "text",
          title: "Story Format Post",
          content: {
            hook: "🧵 Thread: The day I almost gave up on my business...",
            body: "It was 2 AM, and I was staring at my laptop screen, questioning every decision I'd made. Our startup was running out of money, and I felt like a failure.\n\nBut then something clicked...",
            cta: "What's the biggest challenge you've faced as an entrepreneur? Share in the comments 👇"
          },
          platform: "linkedin",
        };
      }
      
      if (mockContent) {
        const content = await storage.createContentPiece(mockContent);
        res.status(201).json(content);
      } else {
        res.status(400).json({ message: "Invalid content type" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to generate content" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
