import type { BeatGenre, BeatRecord, BeatStatus } from "@/types/beat";
import type { Page } from "./common";

/** Fields a service may set. Object keys are NOT here — assets are attached
 *  through a verified UploadIntent flow (M7.2), never from request input. */
export type BeatCreateInput = {
  slug: string;
  caseNumber: string;
  title: string;
  status: BeatStatus;
  genre: BeatGenre;
  substyle: string | null;
  mood: string | null;
  bpm: number | null;
  description: string | null;
  durationSeconds: number | null;
  coverPalette: string;
  priceUsd: number;
  priceRub: number;
  featured: boolean;
  availableForDownload: boolean;
  publishedAt: Date | null;
};

export type BeatUpdateInput = Partial<BeatCreateInput>;

export type BeatListQuery = {
  limit: number;
  offset: number;
  status?: BeatStatus;
  /** Restrict to any of these statuses (used by the public catalogue). */
  statusIn?: BeatStatus[];
  featured?: boolean;
  /** Only rows with a non-null `publishedAt` (used by the public catalogue). */
  publishedOnly?: boolean;
};

/**
 * Internal persistence contract. Services authenticate/authorise and redact
 * private keys before any public response. Missing single rows return null;
 * infrastructure failures reject (never a silent mock fallback).
 */
export interface BeatRepository {
  list(query: BeatListQuery): Promise<Page<BeatRecord>>;
  findById(id: string): Promise<BeatRecord | null>;
  findBySlug(slug: string): Promise<BeatRecord | null>;
  findByCaseNumber(caseNumber: string): Promise<BeatRecord | null>;
  create(input: BeatCreateInput): Promise<BeatRecord>;
  update(id: string, input: BeatUpdateInput): Promise<BeatRecord | null>;
  delete(id: string): Promise<boolean>;
}
