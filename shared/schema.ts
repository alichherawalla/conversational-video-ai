import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  duration: integer("duration").default(0), // in seconds
  status: varchar("status").notNull().default("draft"), // draft, recording, completed
  aiPersonality: varchar("ai_personality").notNull().default("friendly"),
  targetDuration: varchar("target_duration").notNull().default("15-20 minutes"),
  videoUrl: text("video_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primary: text("primary").notNull(),
  followUp1: text("follow_up_1"),
  followUp2: text("follow_up_2"),
  category: varchar("category").notNull(),
  difficulty: varchar("difficulty").notNull().default("medium"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").references(() => questions.id), // track which question this relates to
  type: varchar("type").notNull(), // ai_question, user_response, ai_feedback
  content: text("content").notNull(),
  timestamp: integer("timestamp").notNull(), // seconds from start
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clips = pgTable("clips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: integer("start_time").notNull(), // seconds
  endTime: integer("end_time").notNull(), // seconds
  socialScore: integer("social_score").default(0),
  platform: varchar("platform").notNull(), // tiktok, instagram, youtube
  videoUrl: text("video_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentPieces = pgTable("content_pieces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // carousel, image, text
  title: text("title").notNull(),
  content: jsonb("content").notNull(), // flexible content structure
  platform: varchar("platform").notNull().default("linkedin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertClipSchema = createInsertSchema(clips).omit({
  id: true,
  createdAt: true,
});

export const insertContentPieceSchema = createInsertSchema(contentPieces).omit({
  id: true,
  createdAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertClip = z.infer<typeof insertClipSchema>;
export type Clip = typeof clips.$inferSelect;

export type InsertContentPiece = z.infer<typeof insertContentPieceSchema>;
export type ContentPiece = typeof contentPieces.$inferSelect;
