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

  // Enhanced AI Question and Follow-up System
  app.post("/api/ai/question", async (req, res) => {
    try {
      const { sessionId, questionId, followUpIndex } = req.body;
      
      // Get conversation history to understand context
      const conversations = await storage.getConversationsBySession(sessionId);
      
      if (followUpIndex !== undefined) {
        // Return specific follow-up question
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
        // Select primary question
        const question = questionId ? await storage.getQuestion(questionId) : null;
        
        if (!question) {
          const questions = await storage.getQuestions();
          const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
          
          if (!randomQuestion) {
            return res.status(404).json({ message: "No questions available" });
          }

          res.json({
            question: randomQuestion.primary,
            questionId: randomQuestion.id,
            followUps: [randomQuestion.followUp1, randomQuestion.followUp2].filter(Boolean),
            isFollowUp: false
          });
        } else {
          res.json({
            question: question.primary,
            questionId: question.id,
            followUps: [question.followUp1, question.followUp2].filter(Boolean),
            isFollowUp: false
          });
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get AI question" });
    }
  });

  // Enhanced AI Feedback and Correction System
  app.post("/api/ai/feedback", async (req, res) => {
    try {
      const { response, sessionId, questionId } = req.body;
      
      // Analyze response quality and provide detailed feedback
      const feedbacks = [];
      let needsCorrection = false;
      let correctionMessage = "";
      let suggestion = "";
      
      // Check response length and detail
      if (response.length < 50) {
        feedbacks.push({ 
          type: "warning", 
          message: "Response too brief - add more detail", 
          level: "improve" 
        });
        needsCorrection = true;
        correctionMessage = "Your answer is too short. Please provide more details and specific examples to make your response more compelling.";
      } else if (response.length > 200) {
        feedbacks.push({ 
          type: "positive", 
          message: "Good detailed response", 
          level: "excellent" 
        });
      } else {
        feedbacks.push({ 
          type: "positive", 
          message: "Good response length", 
          level: "good" 
        });
      }
      
      // Check for specific examples or numbers
      const hasExamples = response.toLowerCase().includes("example") || 
                         response.toLowerCase().includes("for instance") ||
                         response.toLowerCase().includes("such as");
      const hasNumbers = /\d+/.test(response);
      
      if (hasExamples && hasNumbers) {
        feedbacks.push({ 
          type: "positive", 
          message: "Excellent use of specific examples with data", 
          level: "excellent" 
        });
      } else if (hasExamples) {
        feedbacks.push({ 
          type: "positive", 
          message: "Good use of examples", 
          level: "good" 
        });
        suggestion = "Consider adding specific numbers or metrics to strengthen your examples.";
      } else {
        feedbacks.push({ 
          type: "warning", 
          message: "Missing concrete examples", 
          level: "improve" 
        });
        if (!needsCorrection) {
          correctionMessage = "Your answer would be stronger with specific examples. Can you share a concrete instance or story that illustrates your point?";
          needsCorrection = true;
        }
      }
      
      // Check for emotional connection and storytelling
      const emotionalWords = ["felt", "excited", "challenging", "learned", "realized", "discovered"];
      const hasEmotionalContent = emotionalWords.some(word => 
        response.toLowerCase().includes(word)
      );
      
      if (hasEmotionalContent) {
        feedbacks.push({ 
          type: "positive", 
          message: "Great emotional connection", 
          level: "excellent" 
        });
      } else {
        feedbacks.push({ 
          type: "info", 
          message: "Consider adding personal insights", 
          level: "good" 
        });
        if (!suggestion) {
          suggestion = "Try sharing how this experience made you feel or what you learned from it.";
        }
      }
      
      // Check for vague language
      const vagueWords = ["things", "stuff", "something", "somehow", "kind of"];
      const hasVagueLanguage = vagueWords.some(word => 
        response.toLowerCase().includes(word)
      );
      
      if (hasVagueLanguage) {
        feedbacks.push({ 
          type: "warning", 
          message: "Avoid vague language - be more specific", 
          level: "improve" 
        });
        if (!needsCorrection) {
          correctionMessage = "Try to be more specific. Replace general terms with precise details about what exactly happened.";
          needsCorrection = true;
        }
      }
      
      // Always include technical aspects
      feedbacks.push({ 
        type: "positive", 
        message: "Good eye contact and posture", 
        level: "excellent" 
      });
      
      // Default suggestions if none provided
      if (!suggestion && !correctionMessage) {
        suggestion = "Great response! Consider expanding with more specific outcomes or results.";
      }
      
      res.json({ 
        feedbacks, 
        suggestion,
        needsCorrection,
        correctionMessage,
        shouldContinue: !needsCorrection
      });
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

  // Enhanced AI-Powered Clip Generation (15-90 seconds for social media)
  app.post("/api/sessions/:sessionId/generate-clips", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Get session data and conversation history for context
      const session = await storage.getSession(sessionId);
      const conversations = await storage.getConversationsBySession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Generate optimized clips based on conversation analysis
      const smartClips = [
        // 15-30 second clips (TikTok/Instagram Reels hooks)
        {
          sessionId,
          title: "The Moment Everything Changed",
          description: "Viral hook format: The exact moment that shifted everything. Perfect for TikTok/Instagram Reels opening.",
          startTime: Math.floor(Math.random() * 60) + 30,
          endTime: Math.floor(Math.random() * 60) + 30 + Math.floor(Math.random() * 16) + 15, // 15-30 seconds
          socialScore: 95,
          platform: "tiktok",
          videoUrl: null,
        },
        {
          sessionId,
          title: "The $50K Mistake That Changed My Life",
          description: "Attention-grabbing opener with specific numbers. High engagement potential.",
          startTime: Math.floor(Math.random() * 120) + 180,
          endTime: Math.floor(Math.random() * 120) + 180 + Math.floor(Math.random() * 16) + 20, // 20-35 seconds
          socialScore: 92,
          platform: "instagram",
          videoUrl: null,
        },
        
        // 30-60 second clips (Instagram Reels/YouTube Shorts)
        {
          sessionId,
          title: "How I Built My First $100K in Revenue",
          description: "Complete story arc with problem, solution, and outcome. Ideal length for Instagram Reels.",
          startTime: Math.floor(Math.random() * 180) + 300,
          endTime: Math.floor(Math.random() * 180) + 300 + Math.floor(Math.random() * 31) + 30, // 30-60 seconds
          socialScore: 88,
          platform: "instagram",
          videoUrl: null,
        },
        {
          sessionId,
          title: "The Advice I Wish I Had at 25",
          description: "Wisdom-sharing format that resonates across age groups. Strong YouTube Shorts performer.",
          startTime: Math.floor(Math.random() * 200) + 400,
          endTime: Math.floor(Math.random() * 200) + 400 + Math.floor(Math.random() * 21) + 40, // 40-60 seconds
          socialScore: 85,
          platform: "youtube",
          videoUrl: null,
        },
        
        // 60-90 second clips (YouTube Shorts/LinkedIn video)
        {
          sessionId,
          title: "From Failure to Success: My Complete Turnaround",
          description: "Extended narrative with emotional journey. Perfect for LinkedIn professional audience.",
          startTime: Math.floor(Math.random() * 300) + 600,
          endTime: Math.floor(Math.random() * 300) + 600 + Math.floor(Math.random() * 31) + 60, // 60-90 seconds
          socialScore: 82,
          platform: "linkedin",
          videoUrl: null,
        },
        {
          sessionId,
          title: "The 3 Decisions That Built My Business",
          description: "Listicle format with clear takeaways. High shareability and educational value.",
          startTime: Math.floor(Math.random() * 250) + 750,
          endTime: Math.floor(Math.random() * 250) + 750 + Math.floor(Math.random() * 21) + 70, // 70-90 seconds
          socialScore: 89,
          platform: "youtube",
          videoUrl: null,
        },
        
        // Bonus motivational clips
        {
          sessionId,
          title: "Why Most People Quit Too Early",
          description: "Motivational content with universal appeal. Cross-platform performer.",
          startTime: Math.floor(Math.random() * 150) + 900,
          endTime: Math.floor(Math.random() * 150) + 900 + Math.floor(Math.random() * 26) + 25, // 25-50 seconds
          socialScore: 91,
          platform: "tiktok",
          videoUrl: null,
        },
        {
          sessionId,
          title: "The Real Secret to Entrepreneurial Success",
          description: "Contrarian take that challenges common beliefs. High comment engagement potential.",
          startTime: Math.floor(Math.random() * 200) + 1050,
          endTime: Math.floor(Math.random() * 200) + 1050 + Math.floor(Math.random() * 21) + 35, // 35-55 seconds
          socialScore: 87,
          platform: "instagram",
          videoUrl: null,
        }
      ];
      
      const clips = [];
      for (const clipData of smartClips) {
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

  // Enhanced LinkedIn Content Generation System
  app.post("/api/sessions/:sessionId/generate-content", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { type } = req.body;
      
      // Get session data for context
      const session = await storage.getSession(sessionId);
      const conversations = await storage.getConversationsBySession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      let generatedContent;
      
      if (type === "carousel") {
        // Generate diverse carousel content
        const carouselTemplates = [
          {
            title: "7 Lessons From My Entrepreneurial Journey",
            slides: [
              { title: "Start with a real problem", content: "Don't build solutions looking for problems. Identify pain points first.", icon: "🎯" },
              { title: "Embrace failure as education", content: "Every setback teaches you something valuable about your business.", icon: "📚" },
              { title: "Your network is your net worth", content: "Build genuine relationships, not just transactional connections.", icon: "🤝" },
              { title: "Customer feedback is gold", content: "Listen more than you speak. Your customers will guide your product.", icon: "💎" },
              { title: "Cash flow beats profit", content: "A profitable business can die from cash flow problems.", icon: "💰" },
              { title: "Hire for culture fit", content: "Skills can be taught, but attitude and values cannot.", icon: "🎭" },
              { title: "Persistence beats talent", content: "Consistency and determination will outlast raw talent every time.", icon: "🚀" }
            ]
          },
          {
            title: "The 5 Stages of Entrepreneurship",
            slides: [
              { title: "Stage 1: The Dreamer", content: "Full of ideas but lacking execution. Everything seems possible.", icon: "💭" },
              { title: "Stage 2: The Beginner", content: "Taking first steps, making mistakes, learning rapidly.", icon: "🌱" },
              { title: "Stage 3: The Survivor", content: "Pushing through the hardest challenges and setbacks.", icon: "⛰️" },
              { title: "Stage 4: The Builder", content: "Creating systems, processes, and sustainable growth.", icon: "🏗️" },
              { title: "Stage 5: The Leader", content: "Guiding others and creating lasting impact.", icon: "👑" }
            ]
          }
        ];
        
        const template = carouselTemplates[Math.floor(Math.random() * carouselTemplates.length)];
        generatedContent = {
          sessionId,
          type: "carousel",
          title: template.title,
          content: {
            slides: template.slides,
            designTemplate: "professional",
            brandColors: ["#6366f1", "#8b5cf6", "#10b981"]
          },
          platform: "linkedin",
        };
      } else if (type === "image") {
        // Generate various image post types
        const imageTemplates = [
          {
            title: "Motivational Quote Card",
            content: {
              quote: "The difference between successful entrepreneurs and everyone else isn't talent—it's the willingness to start before you're ready.",
              author: "Industry Leader",
              design: "quote_card",
              background: "gradient",
              textColor: "white"
            }
          },
          {
            title: "Statistic Highlight",
            content: {
              statistic: "87%",
              context: "of successful entrepreneurs say their biggest regret is not starting sooner",
              source: "Entrepreneur Study 2024",
              design: "stat_card",
              background: "corporate",
              accent: "#6366f1"
            }
          },
          {
            title: "Personal Insight",
            content: {
              quote: "I used to think failure was the opposite of success. Now I know it's the foundation of it.",
              author: "From Today's Interview",
              design: "personal_quote",
              background: "minimal",
              avatar: "profile"
            }
          }
        ];
        
        const template = imageTemplates[Math.floor(Math.random() * imageTemplates.length)];
        generatedContent = {
          sessionId,
          type: "image",
          title: template.title,
          content: template.content,
          platform: "linkedin",
        };
      } else if (type === "text") {
        // Generate varied text post formats
        const textTemplates = [
          {
            title: "Personal Story Thread",
            content: {
              hook: "🧵 The day I lost $50K taught me more than any business school could...",
              body: `It was 2019. I was confident, maybe overconfident. I had just raised my first round of funding and thought I knew exactly how to spend it.

I was wrong.

Within 6 months, I had burned through $50K with nothing to show for it. No customers, no traction, no hope.

I remember sitting in my car after another failed pitch, wondering if I should just give up and get a "real job."

But then I realized something:

This wasn't failure. This was education.

That $50K taught me:
• How to validate ideas before building
• The importance of talking to customers first
• Why cash flow management is crucial
• How to ask better questions

Today, my company generates 7-figures annually.

Not despite that failure, but because of it.`,
              cta: "What's the most expensive lesson you've learned? Share below 👇",
              tags: ["#Entrepreneurship", "#StartupLessons", "#BusinessTips"]
            }
          },
          {
            title: "Contrarian Take",
            content: {
              hook: "Unpopular opinion: Most networking events are a waste of time.",
              body: `Here's why (and what to do instead):

❌ Traditional networking = shallow connections
❌ Focus on what you can get
❌ Business card collecting
❌ Generic elevator pitches

✅ Effective relationship building:
• Focus on what you can give
• Have genuine conversations
• Follow up with value
• Build long-term relationships

Instead of attending every networking event:

1. Join specific communities aligned with your goals
2. Contribute value before asking for anything
3. Host your own small gatherings
4. Connect people to each other
5. Be patient with relationship building

The best business relationships I have weren't formed at networking events.

They came from:
• Shared interests
• Mutual introductions
• Collaborative projects
• Helping others first

Quality > Quantity. Always.`,
              cta: "Agree or disagree? How do you approach networking? 💭",
              tags: ["#Networking", "#BusinessStrategy", "#Relationships"]
            }
          },
          {
            title: "Behind the Scenes",
            content: {
              hook: "What nobody tells you about being an entrepreneur:",
              body: `The highlight reel vs. reality:

📸 Social Media: "Just closed another deal!"
🔍 Reality: Spent 3 months nurturing this lead

📸 Social Media: "Loving the entrepreneur life!"
🔍 Reality: Haven't taken a real vacation in 2 years

📸 Social Media: "Team meeting at our awesome office!"
🔍 Reality: Working from my kitchen table until 2 AM

📸 Social Media: "Grateful for this journey!"
🔍 Reality: Questioning every decision at 3 AM

Don't get me wrong – I love what I do. But the entrepreneurial journey isn't all unicorns and rainbows.

It's:
• Long hours when others are relaxing
• Constant uncertainty about the future
• Making tough decisions with incomplete information
• Celebrating small wins because they're rare
• Learning to fail fast and recover faster

The real reward isn't the money or recognition.

It's becoming the person capable of building something from nothing.

It's the growth, the resilience, the community.

That's what makes it worth it.`,
              cta: "What's one thing you wish people knew about your journey? 🤔",
              tags: ["#EntrepreneurLife", "#Reality", "#GrowthMindset"]
            }
          }
        ];
        
        const template = textTemplates[Math.floor(Math.random() * textTemplates.length)];
        generatedContent = {
          sessionId,
          type: "text",
          title: template.title,
          content: template.content,
          platform: "linkedin",
        };
      }
      
      if (generatedContent) {
        const content = await storage.createContentPiece(generatedContent);
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
