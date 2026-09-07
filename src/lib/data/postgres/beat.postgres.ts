/**
 * PostgreSQL implementation of {@link BeatRepository} (Prisma). Server-only.
 *
 * No Supabase, no mock fallback. A unique-constraint violation propagates as a
 * Prisma `P2002` for the service to translate to 409; a missing row on
 * update/delete propagates as `P2025` and is mapped to `null` / `false`.
 */

import { Prisma } from "@prisma/client";
import { prisma as sharedPrisma } from "@/lib/db/client";
import type {
  BeatCreateInput,
  BeatListQuery,
  BeatRepository,
  BeatUpdateInput,
} from "@/lib/data/repositories/beat.repository";
import type { Page } from "@/lib/data/repositories/common";
import type { BeatRecord } from "@/types/beat";
import { toBeatRecord } from "@/lib/data/beat-mappers";

type PrismaLike = Pick<typeof sharedPrisma, "beat">;

const MAX_LIMIT = 100;

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return MAX_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function clampOffset(offset: number): number {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return Math.trunc(offset);
}

export class PrismaBeatRepository implements BeatRepository {
  constructor(private readonly db: PrismaLike = sharedPrisma) {}

  async list(query: BeatListQuery): Promise<Page<BeatRecord>> {
    const where: Prisma.BeatWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.statusIn && query.statusIn.length > 0) where.status = { in: query.statusIn };
    if (typeof query.featured === "boolean") where.featured = query.featured;
    if (query.publishedOnly) where.publishedAt = { not: null };

    const [rows, total] = await Promise.all([
      this.db.beat.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: clampLimit(query.limit),
        skip: clampOffset(query.offset),
      }),
      this.db.beat.count({ where }),
    ]);

    return { items: rows.map(toBeatRecord), total };
  }

  async findById(id: string): Promise<BeatRecord | null> {
    const row = await this.db.beat.findUnique({ where: { id } });
    return row ? toBeatRecord(row) : null;
  }

  async findBySlug(slug: string): Promise<BeatRecord | null> {
    const row = await this.db.beat.findUnique({ where: { slug } });
    return row ? toBeatRecord(row) : null;
  }

  async findByCaseNumber(caseNumber: string): Promise<BeatRecord | null> {
    const row = await this.db.beat.findUnique({ where: { caseNumber } });
    return row ? toBeatRecord(row) : null;
  }

  async create(input: BeatCreateInput): Promise<BeatRecord> {
    const row = await this.db.beat.create({ data: input });
    return toBeatRecord(row);
  }

  async update(id: string, input: BeatUpdateInput): Promise<BeatRecord | null> {
    try {
      const row = await this.db.beat.update({ where: { id }, data: input });
      return toBeatRecord(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db.beat.delete({ where: { id } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return false;
      }
      throw error;
    }
  }
}

export function isUniqueViolation(error: unknown): { target: "slug" | "caseNumber" | "unknown" } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const targetRaw = error.meta?.target;
    const target = Array.isArray(targetRaw) ? targetRaw.join(",") : String(targetRaw ?? "");
    if (target.includes("case_number")) return { target: "caseNumber" };
    if (target.includes("slug")) return { target: "slug" };
    return { target: "unknown" };
  }
  return null;
}
