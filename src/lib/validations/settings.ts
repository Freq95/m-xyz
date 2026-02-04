import { z } from 'zod';

export const notificationPreferencesSchema = z.object({
  email_comments: z.boolean(),
  email_alerts: z.boolean(),
  email_digest: z.enum(['daily', 'weekly', 'never']),
  push_enabled: z.boolean(),
});

export const usernameSchema = z
  .string()
  .min(3, 'Username-ul trebuie să aibă minim 3 caractere')
  .max(30, 'Username-ul nu poate depăși 30 de caractere')
  .regex(/^[a-z0-9_]+$/, 'Username-ul poate conține doar litere mici, cifre și underscore')
  .transform((val) => val.toLowerCase());

export const updateSettingsSchema = z.object({
  displayName: z.string().max(50, 'Numele nu poate depăși 50 de caractere').optional(),
  username: usernameSchema.optional(),
  bio: z.string().max(500, 'Bio-ul nu poate depăși 500 de caractere').optional(),
  avatarUrl: z.string().url('URL avatar invalid').optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  language: z.enum(['ro']).optional(),
  neighborhoodId: z.string().uuid('ID cartier invalid').optional(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;