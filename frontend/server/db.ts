import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }
  return _supabase;
}

// Convenience export — lazy-initialized to avoid build-time errors
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const value = (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as Function).bind(getSupabase());
    }
    return value;
  },
});
