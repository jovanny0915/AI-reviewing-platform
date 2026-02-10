import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser Supabase client (use in client components).
 * Uses cookies so middleware can read the session and protect routes.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
