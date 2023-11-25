import * as z from "zod";

// For Community bio
export const CommunityValidation = z.object({
  accountId: z.string(),
  bio: z
    .string()
    .min(1)
    .max(350)
    .refine((value) => value.trim().length > 0),
});
