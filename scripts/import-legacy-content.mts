/** Import legacy posts and site settings into Prisma, preserving identifiers. */

import { readFile } from "node:fs/promises";
import { PrismaClient, type Prisma } from "@prisma/client";

type LegacyPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  section: string;
  cover_palette: string;
  cta_label: string | null;
  cta_url: string | null;
  published: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

type LegacySiteSetting = {
  key: string;
  title: string;
  subtitle: string;
  archive_headline: string;
  archive_description: string;
  created_at: string;
  updated_at: string;
};

const VALID_SECTIONS = new Set(["general", "vst", "beats", "tracks", "artists"]);

function lines<T>(input: string): T[] {
  return input.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
}

function date(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid ${field}`);
  return parsed;
}

const [postsArg, settingsArg, mode] = process.argv.slice(2);
if (!postsArg || !settingsArg || !["--dry-run", "--apply"].includes(mode)) {
  throw new Error("Usage: import-legacy-content.mts <posts.jsonl> <site-settings.jsonl> (--dry-run|--apply)");
}

const posts = lines<LegacyPost>(await readFile(postsArg, "utf8"));
const settings = lines<LegacySiteSetting>(await readFile(settingsArg, "utf8"));

const mappedPosts: Prisma.PostCreateManyInput[] = posts.map((post) => {
  if (!post.id || !post.title.trim() || !post.slug.trim()) throw new Error("Required post identity field missing");
  if (!VALID_SECTIONS.has(post.section)) throw new Error(`Invalid post section for ${post.id}`);
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    section: post.section,
    coverPalette: post.cover_palette,
    ctaLabel: post.cta_label,
    ctaUrl: post.cta_url,
    published: post.published,
    featured: post.featured,
    createdAt: date(post.created_at, `post created_at for ${post.id}`),
    updatedAt: date(post.updated_at, `post updated_at for ${post.id}`),
  };
});

const mappedSettings: Prisma.SiteSettingCreateManyInput[] = settings.map((setting) => {
  if (!setting.key.trim()) throw new Error("Site settings key is blank");
  return {
    key: setting.key,
    title: setting.title,
    subtitle: setting.subtitle,
    archiveHeadline: setting.archive_headline,
    archiveDescription: setting.archive_description.replace(/\s*Final content will come from Supabase, not from page code\.?/i, ""),
    createdAt: date(setting.created_at, `site setting created_at for ${setting.key}`),
    updatedAt: date(setting.updated_at, `site setting updated_at for ${setting.key}`),
  };
});

if (new Set(mappedPosts.map((post) => post.id)).size !== mappedPosts.length ||
    new Set(mappedPosts.map((post) => post.slug)).size !== mappedPosts.length ||
    new Set(mappedSettings.map((setting) => setting.key)).size !== mappedSettings.length) {
  throw new Error("Duplicate post id/slug or site settings key in import");
}

console.log(`posts=${mappedPosts.length}; published=${mappedPosts.filter((post) => post.published).length}`);
console.log(`site_settings=${mappedSettings.length}`);
if (mode === "--dry-run") process.exit(0);

const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const [existingPosts, existingSettings] = await Promise.all([tx.post.count(), tx.siteSetting.count()]);
    if (existingPosts || existingSettings) {
      throw new Error(`Target content tables are not empty (posts=${existingPosts}, site_settings=${existingSettings})`);
    }
    const insertedPosts = await tx.post.createMany({ data: mappedPosts });
    const insertedSettings = await tx.siteSetting.createMany({ data: mappedSettings });
    if (insertedPosts.count !== mappedPosts.length || insertedSettings.count !== mappedSettings.length) {
      throw new Error(`Inserted posts ${insertedPosts.count}/${mappedPosts.length}; site settings ${insertedSettings.count}/${mappedSettings.length}`);
    }
  });
  console.log(`IMPORT COMPLETE: posts ${mappedPosts.length}/${mappedPosts.length}; site_settings ${mappedSettings.length}/${mappedSettings.length}`);
} finally {
  await prisma.$disconnect();
}
