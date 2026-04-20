export const postSections = ["general", "vst", "beats", "tracks", "artists"] as const;

export type PostSection = (typeof postSections)[number];

export type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  section: PostSection;
  coverPalette: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  published: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};
