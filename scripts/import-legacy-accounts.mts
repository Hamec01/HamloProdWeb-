/**
 * Import the remaining legacy Supabase rows — accounts, orders, contracts, and
 * the social tables — into Prisma, preserving every UUID, timestamp and relation.
 *
 *   npx tsx scripts/import-legacy-accounts.mts <dir> (--dry-run|--apply)
 *
 * <dir> holds the JSON exports produced from the isolated legacy database:
 *   legacy-auth-users.json legacy-profiles.json legacy-orders.json
 *   legacy-contracts.json legacy-beat-purchases.json legacy-beat-reactions.json
 *   legacy-content-comments.json legacy-content-ratings.json legacy-loyalty-points.json
 *
 * stdout carries counts and validation results only — never an email, a password
 * hash, a buyer passport/phone, a download token or a contract body.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma, type UserRole } from "@prisma/client";

const [dirArg, mode] = process.argv.slice(2);
if (!dirArg || !["--dry-run", "--apply"].includes(mode ?? "")) {
  throw new Error("Usage: import-legacy-accounts.mts <export-dir> (--dry-run|--apply)");
}

async function load<T>(name: string): Promise<T[]> {
  const raw = await readFile(path.join(dirArg, name), "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${name} is not a JSON array`);
  return parsed as T[];
}

function ts(value: string | null | undefined, field: string): Date | null {
  if (value === null || value === undefined) return null;
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) throw new Error(`Invalid timestamp in ${field}: ${value}`);
  return d;
}

function reqTs(value: string | null | undefined, field: string): Date {
  const d = ts(value, field);
  if (!d) throw new Error(`Missing required timestamp ${field}`);
  return d;
}

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ── source shapes ───────────────────────────────────────────────────────────
type LegacyAuthUser = {
  id: string;
  email: string;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string | null;
  last_sign_in_at: string | null;
  provider: string | null;
  display_name: string | null;
  is_sso_user: boolean;
  is_anonymous: boolean;
  deleted_at: string | null;
};
type LegacyProfile = { id: string; email: string; role: string; created_at: string; updated_at: string };
type LegacyOrder = Record<string, unknown> & { id: string; beat_id: string; buyer_user_id: string | null };
type LegacyContract = Record<string, unknown> & { id: string; order_id: string; beat_id: string };
type LegacyPurchase = Record<string, unknown> & { id: string; beat_id: string; user_id: string };
type LegacyReaction = Record<string, unknown> & { id: string; beat_id: string; user_id: string };
type LegacyComment = Record<string, unknown> & { id: string; content_id: string; user_id: string };
type LegacyRating = Record<string, unknown> & { id: string; content_id: string; user_id: string };
type LegacyLoyalty = Record<string, unknown> & { user_id: string };

const [authUsers, profiles, orders, contracts, purchases, reactions, comments, ratings, loyalty] = await Promise.all([
  load<LegacyAuthUser>("legacy-auth-users.json"),
  load<LegacyProfile>("legacy-profiles.json"),
  load<LegacyOrder>("legacy-orders.json"),
  load<LegacyContract>("legacy-contracts.json"),
  load<LegacyPurchase>("legacy-beat-purchases.json"),
  load<LegacyReaction>("legacy-beat-reactions.json"),
  load<LegacyComment>("legacy-content-comments.json"),
  load<LegacyRating>("legacy-content-ratings.json"),
  load<LegacyLoyalty>("legacy-loyalty-points.json"),
]);

// ── users ───────────────────────────────────────────────────────────────────
const ROLE_MAP: Record<string, UserRole> = { admin: "ADMIN", editor: "EDITOR", artist: "ARTIST", user: "USER" };
const profileById = new Map(profiles.map((p) => [p.id, p]));

const mappedUsers: Prisma.UserCreateManyInput[] = authUsers.map((u) => {
  if (!isUuid(u.id)) throw new Error(`Bad user id`);
  if (u.deleted_at) throw new Error(`Refusing to import a soft-deleted user ${u.id}`);
  if (u.is_anonymous) throw new Error(`Refusing to import an anonymous user ${u.id}`);
  const email = u.email.trim().toLowerCase();
  if (!email || email !== u.email || !/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error(`Bad/unnormalised email for ${u.id}`);

  const hash = u.encrypted_password?.trim() || null;
  const passwordHash = hash && /^\$2[aby]?\$/.test(hash) ? hash : null;
  if (hash && !passwordHash) throw new Error(`User ${u.id} has a non-bcrypt password hash — unexpected`);

  const profile = profileById.get(u.id);
  const role: UserRole = profile ? (ROLE_MAP[profile.role] ?? "USER") : "USER";

  return {
    id: u.id,
    email,
    passwordHash,
    emailVerifiedAt: ts(u.email_confirmed_at, "email_confirmed_at"),
    role,
    displayName: u.display_name?.trim() || null,
    lastSignInAt: ts(u.last_sign_in_at, "last_sign_in_at"),
    createdAt: reqTs(u.created_at, "user.created_at"),
    updatedAt: ts(u.updated_at, "user.updated_at") ?? reqTs(u.created_at, "user.created_at"),
  };
});

// profiles must all resolve to an imported auth user
for (const p of profiles) {
  if (!authUsers.some((u) => u.id === p.id)) throw new Error(`Profile ${p.id} has no matching auth user`);
  if (!ROLE_MAP[p.role]) throw new Error(`Profile ${p.id} has an unknown role`);
}

const userIds = new Set(mappedUsers.map((u) => u.id));
const withPassword = mappedUsers.filter((u) => u.passwordHash).length;
const admins = mappedUsers.filter((u) => u.role === "ADMIN").length;

// ── orders ──────────────────────────────────────────────────────────────────
const int = (v: unknown, field: string): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) throw new Error(`Non-integer ${field}: ${String(v)}`);
  return n;
};
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const nstr = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const mappedOrders: Prisma.OrderCreateManyInput[] = orders.map((o) => {
  if (!isUuid(o.id) || !isUuid(o.beat_id)) throw new Error("Bad order id/beat_id");
  if (o.buyer_user_id !== null && !isUuid(o.buyer_user_id)) throw new Error(`Bad buyer_user_id for order ${o.id}`);
  if (o.buyer_user_id && !userIds.has(o.buyer_user_id)) throw new Error(`Order ${o.id} references missing user`);
  const legacyPdf = nstr(o.contract_pdf_path);
  if (legacyPdf) throw new Error(`Order ${o.id} has a legacy contract_pdf_path — storage-object check needed before mapping`);
  return {
    id: o.id,
    beatId: o.beat_id,
    buyerUserId: (o.buyer_user_id as string | null) ?? null,
    buyerEmail: str(o.buyer_email),
    buyerName: nstr(o.buyer_name),
    buyerCountry: nstr(o.buyer_country),
    buyerCity: nstr(o.buyer_city),
    buyerPhone: nstr(o.buyer_phone),
    buyerFullName: nstr(o.buyer_full_name),
    buyerStageName: nstr(o.buyer_stage_name),
    basePriceUsd: int(o.base_price_usd, "base_price_usd"),
    finalPriceUsd: int(o.final_price_usd, "final_price_usd"),
    basePrice: int(o.base_price ?? 0, "base_price"),
    finalPrice: int(o.final_price ?? 0, "final_price"),
    discountPercent: int(o.discount_percent ?? 0, "discount_percent"),
    currency: str(o.currency) || "USD",
    market: str(o.market) || "global",
    provider: str(o.provider) || "paypal",
    paymentProvider: nstr(o.payment_provider),
    status: str(o.status) || "draft",
    licenseType: str(o.license_type) || "basic",
    contractLanguage: str(o.contract_language) || "ru",
    rightsFormStatus: str(o.rights_form_status) || "not_started",
    contractTemplateType: nstr(o.contract_template_type),
    contractPdfKey: null,
    paymentExternalId: nstr(o.payment_external_id),
    paymentUrl: nstr(o.payment_url),
    downloadToken: nstr(o.download_token),
    expiresAt: ts(o.expires_at as string | null, "expires_at"),
    paidAt: ts(o.paid_at as string | null, "paid_at"),
    createdAt: reqTs(o.created_at as string, "order.created_at"),
    updatedAt: ts(o.updated_at as string | null, "order.updated_at") ?? reqTs(o.created_at as string, "order.created_at"),
  };
});
const orderIds = new Set(mappedOrders.map((o) => o.id));

// ── contracts ───────────────────────────────────────────────────────────────
const mappedContracts: Prisma.ContractCreateManyInput[] = contracts.map((c) => {
  if (!isUuid(c.id) || !isUuid(c.order_id) || !isUuid(c.beat_id)) throw new Error("Bad contract ids");
  if (!orderIds.has(c.order_id)) throw new Error(`Contract ${c.id} references missing order`);
  if (nstr(c.pdf_path)) throw new Error(`Contract ${c.id} has legacy pdf_path — storage-object check needed`);
  const html = str(c.html_snapshot);
  if (html.trim().length === 0) throw new Error(`Contract ${c.id} has an empty html_snapshot`);
  return {
    id: c.id,
    orderId: c.order_id,
    beatId: c.beat_id,
    buyerEmail: str(c.buyer_email),
    htmlSnapshot: html,
    pdfKey: null,
    issuedAt: reqTs(c.issued_at as string, "contract.issued_at"),
    createdAt: reqTs(c.created_at as string, "contract.created_at"),
  };
});

// ── purchases ───────────────────────────────────────────────────────────────
const mappedPurchases: Prisma.BeatPurchaseCreateManyInput[] = purchases.map((p) => {
  if (!isUuid(p.id) || !isUuid(p.beat_id) || !isUuid(p.user_id)) throw new Error("Bad purchase ids");
  if (!userIds.has(p.user_id)) throw new Error(`Purchase ${p.id} references missing user`);
  if (p.order_id !== null && p.order_id !== undefined && !isUuid(p.order_id)) throw new Error("Bad purchase order_id");
  const discount = int(p.discount_percent, "purchase.discount_percent");
  if (![0, 50, 100].includes(discount)) throw new Error(`Purchase ${p.id} discount not in {0,50,100}`);
  return {
    id: p.id,
    beatId: p.beat_id,
    beatTitle: str(p.beat_title),
    userId: p.user_id,
    userEmail: str(p.user_email),
    basePriceUsd: int(p.base_price_usd, "purchase.base_price_usd"),
    discountPercent: discount,
    finalPriceUsd: int(p.final_price_usd, "purchase.final_price_usd"),
    pointsEarned: int(p.points_earned ?? 1, "purchase.points_earned"),
    orderId: (p.order_id as string | null) ?? null,
    createdAt: reqTs(p.created_at as string, "purchase.created_at"),
  };
});

// ── reactions ───────────────────────────────────────────────────────────────
const mappedReactions: Prisma.BeatReactionCreateManyInput[] = reactions.map((r) => {
  if (!isUuid(r.id) || !isUuid(r.beat_id) || !isUuid(r.user_id)) throw new Error("Bad reaction ids");
  if (!userIds.has(r.user_id)) throw new Error(`Reaction ${r.id} references missing user`);
  if (!["like", "dislike"].includes(str(r.reaction))) throw new Error(`Reaction ${r.id} invalid value`);
  return {
    id: r.id,
    beatId: r.beat_id,
    userId: r.user_id,
    userEmail: str(r.user_email),
    reaction: str(r.reaction),
    createdAt: reqTs(r.created_at as string, "reaction.created_at"),
    updatedAt: ts(r.updated_at as string | null, "reaction.updated_at") ?? reqTs(r.created_at as string, "reaction.created_at"),
  };
});

// ── comments / ratings ──────────────────────────────────────────────────────
const mappedComments: Prisma.ContentCommentCreateManyInput[] = comments.map((c) => {
  if (!isUuid(c.id) || !isUuid(c.content_id) || !isUuid(c.user_id)) throw new Error("Bad comment ids");
  if (!userIds.has(c.user_id)) throw new Error(`Comment ${c.id} references missing user`);
  if (!["beat", "track"].includes(str(c.content_type))) throw new Error(`Comment ${c.id} invalid content_type`);
  const text = str(c.comment);
  if (text.length < 2 || text.length > 500) throw new Error(`Comment ${c.id} length out of range`);
  return {
    id: c.id,
    contentType: str(c.content_type),
    contentId: c.content_id,
    userId: c.user_id,
    userEmail: str(c.user_email),
    comment: text,
    createdAt: reqTs(c.created_at as string, "comment.created_at"),
  };
});

const mappedRatings: Prisma.ContentRatingCreateManyInput[] = ratings.map((r) => {
  if (!isUuid(r.id) || !isUuid(r.content_id) || !isUuid(r.user_id)) throw new Error("Bad rating ids");
  if (!userIds.has(r.user_id)) throw new Error(`Rating ${r.id} references missing user`);
  if (!["beat", "track"].includes(str(r.content_type))) throw new Error(`Rating ${r.id} invalid content_type`);
  const value = int(r.rating, "rating.rating");
  if (value < 1 || value > 5) throw new Error(`Rating ${r.id} out of 1..5`);
  return {
    id: r.id,
    contentType: str(r.content_type),
    contentId: r.content_id,
    userId: r.user_id,
    userEmail: str(r.user_email),
    rating: value,
    createdAt: reqTs(r.created_at as string, "rating.created_at"),
    updatedAt: ts(r.updated_at as string | null, "rating.updated_at") ?? reqTs(r.created_at as string, "rating.created_at"),
  };
});

// ── loyalty ─────────────────────────────────────────────────────────────────
const mappedLoyalty: Prisma.LoyaltyPointCreateManyInput[] = loyalty.map((l) => {
  if (!isUuid(l.user_id)) throw new Error("Bad loyalty user_id");
  if (!userIds.has(l.user_id)) throw new Error(`Loyalty row references missing user`);
  const points = int(l.points ?? 0, "loyalty.points");
  if (points < 0) throw new Error("Negative loyalty points");
  return {
    userId: l.user_id,
    userEmail: str(l.user_email),
    points,
    updatedAt: reqTs(l.updated_at as string, "loyalty.updated_at"),
  };
});

// duplicate id / unique-key guards
function assertUniqueIds(label: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} id in import`);
}
assertUniqueIds("user", mappedUsers.map((u) => u.id!));
assertUniqueIds("order", mappedOrders.map((o) => o.id!));
assertUniqueIds("contract", mappedContracts.map((c) => c.id!));
assertUniqueIds("purchase", mappedPurchases.map((p) => p.id!));
assertUniqueIds("reaction", mappedReactions.map((r) => r.id!));
assertUniqueIds("comment", mappedComments.map((c) => c.id!));
assertUniqueIds("rating", mappedRatings.map((r) => r.id!));
if (new Set(mappedContracts.map((c) => c.orderId)).size !== mappedContracts.length) throw new Error("Two contracts for one order");
if (new Set(mappedReactions.map((r) => `${r.beatId}:${r.userId}`)).size !== mappedReactions.length) throw new Error("Duplicate (beat,user) reaction");
if (new Set(mappedRatings.map((r) => `${r.contentType}:${r.contentId}:${r.userId}`)).size !== mappedRatings.length) throw new Error("Duplicate rating key");
if (new Set(mappedLoyalty.map((l) => l.userId)).size !== mappedLoyalty.length) throw new Error("Duplicate loyalty user");

console.log(`users=${mappedUsers.length} (with_password=${withPassword}, google_only=${mappedUsers.length - withPassword}, admins=${admins})`);
console.log(`orders=${mappedOrders.length}; contracts=${mappedContracts.length}; purchases=${mappedPurchases.length}`);
console.log(`reactions=${mappedReactions.length}; comments=${mappedComments.length}; ratings=${mappedRatings.length}; loyalty=${mappedLoyalty.length}`);

if (mode === "--dry-run") {
  console.log("DRY RUN — validating foreign keys against the live database…");
}

const prisma = new PrismaClient();
try {
  // FK targets that live in already-migrated tables
  const beatIds = new Set(
    [...mappedOrders.map((o) => o.beatId), ...mappedContracts.map((c) => c.beatId), ...mappedPurchases.map((p) => p.beatId), ...mappedReactions.map((r) => r.beatId)],
  );
  const foundBeats = await prisma.beat.findMany({ where: { id: { in: [...beatIds] } }, select: { id: true } });
  const missingBeats = [...beatIds].filter((id) => !foundBeats.some((b) => b.id === id));
  if (missingBeats.length) throw new Error(`${missingBeats.length} referenced beat id(s) are not in the database`);
  console.log(`fk: ${beatIds.size} distinct beat ids all present`);

  // content_id sanity: for content_type='beat' it must be a real beat; 'track' a real track
  const beatContentIds = [...mappedComments, ...mappedRatings].filter((x) => x.contentType === "beat").map((x) => x.contentId);
  const trackContentIds = [...mappedComments, ...mappedRatings].filter((x) => x.contentType === "track").map((x) => x.contentId);
  if (beatContentIds.length) {
    const n = await prisma.beat.count({ where: { id: { in: beatContentIds } } });
    if (n !== new Set(beatContentIds).size) throw new Error("A beat comment/rating points at a missing beat");
  }
  if (trackContentIds.length) {
    const n = await prisma.track.count({ where: { id: { in: trackContentIds } } });
    if (n !== new Set(trackContentIds).size) throw new Error("A track comment/rating points at a missing track");
  }
  console.log(`fk: content comment/rating targets present (beat=${new Set(beatContentIds).size}, track=${new Set(trackContentIds).size})`);

  if (mode === "--dry-run") {
    console.log("DRY RUN OK — no rows written.");
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    const counts = {
      users: await tx.user.count(),
      orders: await tx.order.count(),
      contracts: await tx.contract.count(),
      purchases: await tx.beatPurchase.count(),
      reactions: await tx.beatReaction.count(),
      comments: await tx.contentComment.count(),
      ratings: await tx.contentRating.count(),
      loyalty: await tx.loyaltyPoint.count(),
    };
    const nonEmpty = Object.entries(counts).filter(([, n]) => n !== 0);
    if (nonEmpty.length) throw new Error(`Target tables not empty: ${nonEmpty.map(([k, n]) => `${k}=${n}`).join(", ")}`);

    const w = async (label: string, n: number, expected: number) => {
      if (n !== expected) throw new Error(`Inserted ${label} ${n}/${expected}`);
    };
    w("users", (await tx.user.createMany({ data: mappedUsers })).count, mappedUsers.length);
    w("orders", (await tx.order.createMany({ data: mappedOrders })).count, mappedOrders.length);
    w("contracts", (await tx.contract.createMany({ data: mappedContracts })).count, mappedContracts.length);
    w("purchases", (await tx.beatPurchase.createMany({ data: mappedPurchases })).count, mappedPurchases.length);
    w("reactions", (await tx.beatReaction.createMany({ data: mappedReactions })).count, mappedReactions.length);
    w("comments", (await tx.contentComment.createMany({ data: mappedComments })).count, mappedComments.length);
    w("ratings", (await tx.contentRating.createMany({ data: mappedRatings })).count, mappedRatings.length);
    w("loyalty", (await tx.loyaltyPoint.createMany({ data: mappedLoyalty })).count, mappedLoyalty.length);
  });

  const after = {
    users: await prisma.user.count(),
    orders: await prisma.order.count(),
    contracts: await prisma.contract.count(),
    purchases: await prisma.beatPurchase.count(),
    reactions: await prisma.beatReaction.count(),
    comments: await prisma.contentComment.count(),
    ratings: await prisma.contentRating.count(),
    loyalty: await prisma.loyaltyPoint.count(),
  };
  console.log(`IMPORT COMPLETE: ${Object.entries(after).map(([k, v]) => `${k}=${v}`).join(" ")}`);
} finally {
  await prisma.$disconnect();
}
