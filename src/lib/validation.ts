import { z } from "zod";
import { isValidDateKey, isValidTimeZone } from "./dates";

export const NOTE_MAX_LENGTH = 20_000;
export const SUMMARY_MAX_LENGTH = 20_000;

export const dateKeySchema = z
  .string()
  .refine(isValidDateKey, { message: "Expected a valid date in YYYY-MM-DD format" });

export const monthSchema = z.object({
  year: z.coerce.number().int().min(1970).max(9999),
  month: z.coerce.number().int().min(1).max(12),
});

export const noteContentSchema = z
  .string()
  .trim()
  .min(1, "Note cannot be empty")
  .max(NOTE_MAX_LENGTH, `Note cannot exceed ${NOTE_MAX_LENGTH} characters`);

export const createNoteSchema = z.object({
  content: noteContentSchema,
});

export const updateNoteSchema = z.object({
  content: noteContentSchema,
});

export const updateDaySchema = z
  .object({
    isWorkDay: z.boolean().optional(),
    summary: z
      .string()
      .trim()
      .max(SUMMARY_MAX_LENGTH)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((v) => v.isWorkDay !== undefined || v.summary !== undefined, {
    message: "Provide at least one of: isWorkDay, summary",
  });

export const commitsQuerySchema = z.object({
  repository: z.string().trim().min(1).max(200).optional(),
});

export const searchTypeSchema = z.enum(["note", "commit", "summary"]);

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Query must be at least 2 characters").max(200),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined))
    .pipe(z.array(searchTypeSchema).optional()),
  from: z
    .string()
    .optional()
    .refine((v) => !v || isValidDateKey(v), "from must be YYYY-MM-DD"),
  to: z
    .string()
    .optional()
    .refine((v) => !v || isValidDateKey(v), "to must be YYYY-MM-DD"),
  repository: z.string().trim().min(1).max(200).optional(),
});

export const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: "Unknown timezone" });

export const updateSettingsSchema = z.object({
  timezone: timeZoneSchema,
});

export type UpdateDayInput = z.infer<typeof updateDaySchema>;

export const authorEmailsSchema = z
  .array(z.email({ message: "Enter valid email addresses" }))
  .max(10, "Up to 10 emails");

export const exportQuerySchema = z.object({
  format: z.enum(["md", "json", "csv"]).default("md"),
  from: z
    .string()
    .optional()
    .refine((v) => !v || isValidDateKey(v), "from must be YYYY-MM-DD"),
  to: z
    .string()
    .optional()
    .refine((v) => !v || isValidDateKey(v), "to must be YYYY-MM-DD"),
});
