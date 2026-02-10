import { createServerClientForAuth } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/types";

export async function getAuthUser() {
  const supabase = await createServerClientForAuth();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createServerClientForAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error?.code === "PGRST116" && !profile) {
    const { data: inserted } = await supabase
      .from("profiles")
      .insert({ id: user.id, role: "client" })
      .select("id, role, created_at, updated_at")
      .single();
    profile = inserted;
  }
  if (!profile) return null;
  return profile as Profile;
}
