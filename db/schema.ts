import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  code: text("code").primaryKey(),
  adminKey: text("admin_key").notNull(),
  status: text("status").notNull().default("open"),
  stage: integer("stage").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const answers = sqliteTable("answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomCode: text("room_code").notNull().references(() => sessions.code, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  phrase: text("phrase").notNull(),
  choice: text("choice").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("answers_room_participant_idx").on(table.roomCode, table.participantId)]);
