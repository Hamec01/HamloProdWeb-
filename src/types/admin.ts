import type { UserRole } from "@/types/user-role";

export type AdminBeatFormData = {
  title: string;
  bpm: number;
  mood: string;
  status: "available" | "reserved" | "sold" | "private";
  priceUsd: number;
};

export type AdminUserProfile = {
  email: string;
  role: UserRole;
};