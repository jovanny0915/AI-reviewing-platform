export type UserRole = "admin" | "client";

export interface Profile {
  id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}
