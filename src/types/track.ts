export type Track = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  coverPalette: string;
  coverImageUrl: string | null;
  coverImagePath: string | null;
  mp3FilePath: string | null;
  spotifyUrl: string;
  appleMusicUrl: string;
  youtubeUrl: string;
  releaseDate: string;
  releaseId: string | null;
  trackNumber: number | null;
  isDemo: boolean;
  createdAt: string;
};

export type TrackDownloadLog = {
  id: string;
  trackId: string;
  trackTitle: string;
  userId: string;
  userEmail: string;
  downloadedAt: string;
};