export type ReleaseType = "album" | "ep" | "mixtape";

export type ReleaseTrack = {
  id: string;
  title: string;
  slug: string;
  trackNumber: number;
  mp3FilePath: string | null;
  createdAt: string;
};

export type Release = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  releaseType: ReleaseType;
  coverPalette: string;
  coverImageUrl: string | null;
  coverImagePath: string | null;
  description: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  youtubeUrl: string;
  releaseDate: string;
  published: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  tracks: ReleaseTrack[];
};
