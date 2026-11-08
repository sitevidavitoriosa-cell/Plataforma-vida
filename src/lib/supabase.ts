import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(SUPABASE_URL, CHAVE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
export const CHAVE_PUBLICA = CHAVE;
