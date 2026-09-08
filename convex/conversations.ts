import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

function titleFromText(text: string) {
  const firstLine = text.split("\n")[0]?.trim() || "New chat";
  return firstLine.length <= 48 ? firstLine : `${firstLine.slice(0, 45).trimEnd()}…`;
}

function canAccess(
  conversation: Doc<"conversations"> | null,
  userId: Id<"users"> | null
) {
  if (!conversation) {
    return false;
  }

  if (conversation.userId) {
    return conversation.userId === userId;
  }

  return userId === null;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    const conversations = await ctx.db.query("conversations").order("desc").collect();
    return conversations.filter((conversation) => !conversation.userId);
  },
});

export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!canAccess(conversation, userId)) {
      return null;
    }

    return conversation;
  },
});

export const send = mutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    content: v.string(),
    source: v.optional(v.union(v.literal("voice"), v.literal("text"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const content = args.content.trim();
    if (!content) {
      throw new Error("Message cannot be empty");
    }

    let conversationId = args.conversationId;
    if (!conversationId) {
      conversationId = await ctx.db.insert("conversations", {
        ...(userId ? { userId } : {}),
        title: titleFromText(content),
      });
    } else {
      const conversation = await ctx.db.get(conversationId);
      if (!canAccess(conversation, userId)) {
        throw new Error("Conversation not found");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      ...(userId ? { userId } : {}),
      role: "user",
      content,
      source: args.source ?? "text",
    });

    return { conversationId, messageId };
  },
});

export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!canAccess(conversation, userId)) {
      throw new Error("Conversation not found");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!canAccess(conversation, userId)) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
  },
});
