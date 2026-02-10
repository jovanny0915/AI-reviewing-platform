"use client";

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AuthResult = { ok: true; user: User | null } | { ok: false; error: string };

/**
 * Sign up with email and password. Supabase sends a confirmation email with OTP.
 * Ensure the "Confirm signup" email template uses {{ .Token }} for a 6-digit code.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user ?? null };
}

/**
 * Resend the signup verification OTP to the given email.
 */
export async function resendSignupOtp(email: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, user: null };
}

/**
 * Verify the signup OTP and create session. Used only after signUp().
 */
export async function verifyOtp(email: string, token: string): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "signup",
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Verification failed." };
  return { ok: true, user: data.user };
}

/**
 * Sign in with email and password only (no OTP).
 */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Sign in failed." };
  return { ok: true, user: data.user };
}

/**
 * Sign out and clear session.
 */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
