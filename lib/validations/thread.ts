import * as z from "zod";

// For Thread (Post)
export const ThreadValidation = z.object({
  thread: z.string().min(1).max(550),
  accountId: z.string(),
});

// For Comments

export const CommentValidation = z.object({
  thread: z.string().min(1).max(350),
});
