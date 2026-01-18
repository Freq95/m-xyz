import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Numele trebuie să aibă cel puțin 2 caractere')
      .max(100, 'Numele nu poate depăși 100 de caractere'),
    email: z.string().email('Adresa de email nu este validă'),
    password: z
      .string()
      .min(8, 'Parola trebuie să aibă cel puțin 8 caractere')
      .regex(/[A-Z]/, 'Parola trebuie să conțină cel puțin o literă mare')
      .regex(/[0-9]/, 'Parola trebuie să conțină cel puțin o cifră'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Parolele nu coincid',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('Adresa de email nu este validă'),
  password: z.string().min(1, 'Parola este obligatorie'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Adresa de email nu este validă'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, 'Parola trebuie să aibă cel puțin 8 caractere')
      .regex(/[A-Z]/, 'Parola trebuie să conțină cel puțin o literă mare')
      .regex(/[0-9]/, 'Parola trebuie să conțină cel puțin o cifră'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Parolele nu coincid',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
