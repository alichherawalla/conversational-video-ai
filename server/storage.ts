import { type Session, type InsertSession, type Question, type InsertQuestion, type Conversation, type InsertConversation, type Clip, type InsertClip, type ContentPiece, type InsertContentPiece } from "@shared/schema";
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

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private questions: Map<string, Question>;
  private conversations: Map<string, Conversation>;
  private clips: Map<string, Clip>;
  private contentPieces: Map<string, ContentPiece>;

  constructor() {
    this.sessions = new Map();
    this.questions = new Map();
    this.conversations = new Map();
    this.clips = new Map();
    this.contentPieces = new Map();

    // Initialize with sample questions
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleQuestions: Question[] = [
      {
        id: randomUUID(),
        primary: "What inspired you to start your entrepreneurial journey?",
        followUp1: "Can you share a specific problem you identified that led to your first business idea?",
        followUp2: "How did that experience shape your current approach to business?",
        category: "Business & Entrepreneurship",
        difficulty: "medium",
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        primary: "How do you handle failure and setbacks in your business?",
        followUp1: "Can you describe a specific failure that taught you something valuable?",
        followUp2: "What advice would you give to someone facing their first major setback?",
        category: "Personal Development",
        difficulty: "medium",
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        primary: "What role does technology play in your business strategy?",
        followUp1: "Which emerging technologies excite you the most?",
        followUp2: "How do you stay updated with rapid technological changes?",
        category: "Innovation & Technology",
        difficulty: "hard",
        createdAt: new Date(),
      },
    ];

    sampleQuestions.forEach(question => {
      this.questions.set(question.id, question);
    });
  }

  // Sessions
  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const session: Session = { 
      ...insertSession, 
      id, 
      createdAt: new Date() 
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: string, session: Partial<InsertSession>): Promise<Session | undefined> {
    const existing = this.sessions.get(id);
    if (!existing) return undefined;
    
    const updated: Session = { ...existing, ...session };
    this.sessions.set(id, updated);
    return updated;
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  // Questions
  async getQuestion(id: string): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async getQuestions(): Promise<Question[]> {
    return Array.from(this.questions.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getQuestionsByCategory(category: string): Promise<Question[]> {
    return Array.from(this.questions.values())
      .filter(q => q.category === category)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = randomUUID();
    const question: Question = { 
      ...insertQuestion, 
      id, 
      createdAt: new Date() 
    };
    this.questions.set(id, question);
    return question;
  }

  async updateQuestion(id: string, question: Partial<InsertQuestion>): Promise<Question | undefined> {
    const existing = this.questions.get(id);
    if (!existing) return undefined;
    
    const updated: Question = { ...existing, ...question };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    return this.questions.delete(id);
  }

  // Conversations
  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationsBySession(sessionId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(c => c.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = { 
      ...insertConversation, 
      id, 
      createdAt: new Date() 
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  // Clips
  async getClip(id: string): Promise<Clip | undefined> {
    return this.clips.get(id);
  }

  async getClipsBySession(sessionId: string): Promise<Clip[]> {
    return Array.from(this.clips.values())
      .filter(c => c.sessionId === sessionId)
      .sort((a, b) => a.startTime - b.startTime);
  }

  async createClip(insertClip: InsertClip): Promise<Clip> {
    const id = randomUUID();
    const clip: Clip = { 
      ...insertClip, 
      id, 
      createdAt: new Date() 
    };
    this.clips.set(id, clip);
    return clip;
  }

  async deleteClip(id: string): Promise<boolean> {
    return this.clips.delete(id);
  }

  // Content Pieces
  async getContentPiece(id: string): Promise<ContentPiece | undefined> {
    return this.contentPieces.get(id);
  }

  async getContentPiecesBySession(sessionId: string): Promise<ContentPiece[]> {
    return Array.from(this.contentPieces.values())
      .filter(c => c.sessionId === sessionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createContentPiece(insertContentPiece: InsertContentPiece): Promise<ContentPiece> {
    const id = randomUUID();
    const contentPiece: ContentPiece = { 
      ...insertContentPiece, 
      id, 
      createdAt: new Date() 
    };
    this.contentPieces.set(id, contentPiece);
    return contentPiece;
  }

  async deleteContentPiece(id: string): Promise<boolean> {
    return this.contentPieces.delete(id);
  }
}

export const storage = new MemStorage();
