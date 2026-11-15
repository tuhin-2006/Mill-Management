import { z } from "zod";

/**
 * Schema for environment variables.
 * Uses safeParse to ensure missing variables never crash the application during build or setup.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Anon key is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

const rawEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const parsed = envSchema.safeParse(rawEnv);

export const env = {
  isConfigured: parsed.success,
  url: parsed.success ? parsed.data.NEXT_PUBLIC_SUPABASE_URL : undefined,
  anonKey: parsed.success ? parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined,
  serviceRoleKey: parsed.success ? parsed.data.SUPABASE_SERVICE_ROLE_KEY : undefined,
  status: {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  },
  errors: parsed.success ? null : parsed.error.format(),
};
