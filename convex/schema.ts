import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
  notes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    content: v.string(),
    source: v.optional(v.union(v.literal("voice"), v.literal("text"))),
  }).index("by_user", ["userId"]),
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
  }).index("by_user", ["userId"]),
  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    source: v.optional(v.union(v.literal("voice"), v.literal("text"))),
  }).index("by_conversation", ["conversationId"]),
  ...authTables,
});