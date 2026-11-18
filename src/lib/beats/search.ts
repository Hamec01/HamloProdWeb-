import type { Prisma } from "@prisma/client";

export function normalizeBeatSearch(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, 120) : "";
}

export function beatSearchWhere(value: unknown): Prisma.BeatWhereInput {
  const query = normalizeBeatSearch(value);
  if (!query) return {};
  return { AND: query.split(" ").map((word) => {
    const contains = word.replace(/[\\%_]/gu, "\\$&");
    return { OR: ["title", "caseNumber", "slug"].map((field) => ({ [field]: { contains, mode: "insensitive" } })) };
  }) };
}
