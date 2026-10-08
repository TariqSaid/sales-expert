import { createClient } from "@supabase/supabase-js";

// Server-side only: uses the secret key, never shown in the browser
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);