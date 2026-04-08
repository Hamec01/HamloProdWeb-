export type BeatStatus = "available" | "reserved" | "sold" | "private";

export type Beat = {
  id: string;
  title: string;
  slug: string;
  caseNumber: string;
  coverPalette: string;
  previewUrl: string;
  bpm: number;
  mood: string;
  description: string;
  priceUsd: number;
  status: BeatStatus;
  featured: boolean;
  createdAt: string;
  duration: string;
};