import { z } from 'zod';

export const checkoutSchema = z.object({
  body: z
    .object({
      planCode: z
        .string()
        .trim()
        .min(2)
        .max(50)
        .regex(/^[A-Za-z0-9_-]+$/)
        .transform((v) => v.toUpperCase()),
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({}).strict(),
});