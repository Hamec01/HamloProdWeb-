export type BeatStatus = "available" | "reserved" | "sold" | "private";

export type Beat = {
  id: string;
  title: string;
  slug: string;
  caseNumber: string;
  coverPalette: string;
  coverImageUrl: string | null;
  coverImagePath: string | null;
  previewUrl: string;
  previewStoragePath: string | null;
  wavFilePath: string | null;
  zipFilePath: string | null;
  bpm: number;
  mood: string;
  description: string;
  priceUsd: number;
  status: BeatStatus;
  featured: boolean;
  createdAt: string;
  duration: string;
};