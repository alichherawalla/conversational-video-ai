import { sessions, questions, conversations, clips, contentPieces, type Session, type InsertSession, type Question, type InsertQuestion, type Conversation, type InsertConversation, type Clip, type InsertClip, type ContentPiece, type InsertContentPiece } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Sessions
  getSession(id: string): Promise<Session | undefined>;
  getSessions(): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;

  // Questions
  getQuestion(id: string): Promise<Question | undefined>;
  getQuestions(): Promise<Question[]>;
  getQuestionsByCategory(category: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: string, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: string): Promise<boolean>;

  // Conversations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsBySession(sessionId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;

  // Clips
  getClip(id: string): Promise<Clip | undefined>;
  getClipsBySession(sessionId: string): Promise<Clip[]>;
  createClip(clip: InsertClip): Promise<Clip>;
  deleteClip(id: string): Promise<boolean>;

  // Content Pieces
  getContentPiece(id: string): Promise<ContentPiece | undefined>;
  getContentPiecesBySession(sessionId: string): Promise<ContentPiece[]>;
  createContentPiece(contentPiece: InsertContentPiece): Promise<ContentPiece>;
  deleteContentPiece(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    
    try {
      // Check if tables exist by attempting to query
      await db.select().from(questions).limit(1);
      this.initialized = true;
      
      // Initialize sample data if tables are empty
      await this.initializeSampleData();
    } catch (error) {
      // Tables might not exist yet - this is expected during initial setup
      console.log("Database tables not yet available - they will be created by db:push");
      this.initialized = true;
    }
  }

  private async initializeSampleData() {
    try {
      const existingQuestions = await db.select().from(questions);
      
      if (existingQuestions.length === 0) {
        const sampleQuestions: Omit<Question, 'id'>[] = [
          {
            primary: "What inspired you to start your entrepreneurial journey?",
            followUp1: "Can you share a specific problem you identified that led to your first business idea?",
            followUp2: "How did that experience shape your current approach to business?",
            category: "Business & Entrepreneurship",
            difficulty: "medium",
            createdAt: new Date(),
          },
          {
            primary: "How do you handle failure and setbacks in your business?",
            followUp1: "Can you describe a specific failure that taught you something valuable?",
            followUp2: "What advice would you give to someone facing their first major setback?",
            category: "Personal Development",
            difficulty: "medium",
            createdAt: new Date(),
          },
          {
            primary: "What role does technology play in your business strategy?",
            followUp1: "Which emerging technologies excite you the most?",
            followUp2: "How do you stay updated with rapid technological changes?",
            category: "Innovation & Technology",
            difficulty: "hard",
            createdAt: new Date(),
          },
        ];

        for (const question of sampleQuestions) {
          await db.insert(questions).values({ id: randomUUID(), ...question });
        }
      }
    } catch (error) {
      // Ignore initialization errors - tables may not be ready yet
      console.log("Sample data initialization deferred");
    }
  }

  // Sessions
  async getSession(id: string): Promise<Session | undefined> {
    await this.ensureInitialized();
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
  }

  async getSessions(): Promise<Session[]> {
    await this.ensureInitialized();
    return await db.select().from(sessions);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    await this.ensureInitialized();
    const [newSession] = await db
      .insert(sessions)
      .values({ 
        id: randomUUID(), 
        ...insertSession,
        duration: insertSession.duration ?? 0,
        createdAt: new Date()
      })
      .returning();
    return newSession;
  }

  async updateSession(id: string, session: Partial<InsertSession>): Promise<Session | undefined> {
    const [updatedSession] = await db
      .update(sessions)
      .set(session)
      .where(eq(sessions.id, id))
      .returning();
    return updatedSession || undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return result.rowCount > 0;
  }

  // Questions
  async getQuestion(id: string): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question || undefined;
  }

  async getQuestions(): Promise<Question[]> {
    await this.ensureInitialized();
    return await db.select().from(questions);
  }

  async getQuestionsByCategory(category: string): Promise<Question[]> {
    return await db.select().from(questions).where(eq(questions.category, category));
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db
      .insert(questions)
      .values({ 
        id: randomUUID(), 
        ...insertQuestion,
        followUp1: insertQuestion.followUp1 ?? null,
        followUp2: insertQuestion.followUp2 ?? null,
        createdAt: new Date()
      })
      .returning();
    return newQuestion;
  }

  async updateQuestion(id: string, question: Partial<InsertQuestion>): Promise<Question | undefined> {
    const [updatedQuestion] = await db
      .update(questions)
      .set(question)
      .where(eq(questions.id, id))
      .returning();
    return updatedQuestion || undefined;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const result = await db.delete(questions).where(eq(questions.id, id));
    return result.rowCount > 0;
  }

  // Conversations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationsBySession(sessionId: string): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.sessionId, sessionId));
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values({ 
        id: randomUUID(), 
        ...insertConversation,
        createdAt: new Date()
      })
      .returning();
    return newConversation;
  }

  // Clips
  async getClip(id: string): Promise<Clip | undefined> {
    const [clip] = await db.select().from(clips).where(eq(clips.id, id));
    return clip || undefined;
  }

  async getClipsBySession(sessionId: string): Promise<Clip[]> {
    return await db.select().from(clips).where(eq(clips.sessionId, sessionId));
  }

  async createClip(insertClip: InsertClip): Promise<Clip> {
    const [newClip] = await db
      .insert(clips)
      .values({ 
        id: randomUUID(), 
        ...insertClip,
        description: insertClip.description ?? null,
        videoUrl: insertClip.videoUrl ?? null,
        socialScore: insertClip.socialScore ?? null,
        createdAt: new Date()
      })
      .returning();
    return newClip;
  }

  async deleteClip(id: string): Promise<boolean> {
    const result = await db.delete(clips).where(eq(clips.id, id));
    return result.rowCount > 0;
  }

  // Content Pieces
  async getContentPiece(id: string): Promise<ContentPiece | undefined> {
    const [contentPiece] = await db.select().from(contentPieces).where(eq(contentPieces.id, id));
    return contentPiece || undefined;
  }

  async getContentPiecesBySession(sessionId: string): Promise<ContentPiece[]> {
    return await db.select().from(contentPieces).where(eq(contentPieces.sessionId, sessionId));
  }

  async createContentPiece(insertContentPiece: InsertContentPiece): Promise<ContentPiece> {
    const [newContentPiece] = await db
      .insert(contentPieces)
      .values({ 
        id: randomUUID(), 
        ...insertContentPiece,
        platform: insertContentPiece.platform ?? "linkedin",
        createdAt: new Date()
      })
      .returning();
    return newContentPiece;
  }

  async deleteContentPiece(id: string): Promise<boolean> {
    const result = await db.delete(contentPieces).where(eq(contentPieces.id, id));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
