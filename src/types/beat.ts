export type BeatStatus = "available" | "reserved" | "sold" | "private";
export type BeatGenre = "boombap" | "rap" | "trap" | "drill" | "another";

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
  genre: BeatGenre;
  substyle: string;
  bpm: number;
  mood: string;
  description: string;
  priceUsd: number;
  priceRub: number;
  status: BeatStatus;
  featured: boolean;
  createdAt: string;
  duration: string;
  availableForDownload: boolean;
};