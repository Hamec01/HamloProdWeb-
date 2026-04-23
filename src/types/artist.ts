export type Artist = {
  id: string;
  slug: string;
  artistName: string;
  trackTitle: string;
  beatTitle: string;
  bio: string;
  photoUrl: string | null;
  photoPath: string | null;
  coverPalette: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  youtubeUrl: string;
  vkUrl: string;
  telegramUrl: string;
  yandexMusicUrl: string;
  tidalUrl: string;
  soundcloudUrl: string;
  createdAt: string;
};

export type ArtistPost = {
  id: string;
  artistId: string;
  authorId: string | null;
  title: string;
  body: string;
  imageUrl: string | null;
  imagePath: string | null;
  audioUrl: string | null;
  audioPath: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  entity: "release" | "artist_post" | "beat" | "track";
  contentId: string;
  authorId: string;
  displayName: string;
  body: string;
  stars: number | null;
  createdAt: string;
};
