import { z } from "zod";
export const leaderboardQuerySchema = z.object({
  query: z
    .object({
      period: z.enum(["weekly", "monthly"]).default("weekly"),
      role: z.string().optional(),
      level: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
});
export const leaderboardPrivacySchema = z.object({
  body: z.object({ leaderboardOptIn: z.boolean() }).strict(),
  query: z.object({}).strict(),
  params: z.object({}).strict(),
});
