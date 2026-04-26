export const BEAT_GENRES = ["boombap", "rap", "trap", "drill", "another"] as const;

export type BeatGenre = (typeof BEAT_GENRES)[number];

export const BEAT_SUBSTYLES: Record<BeatGenre, string[]> = {
  boombap: ["Classic", "Underground", "Jazzy", "Lo-Fi"],
  rap: ["Classic", "Storytelling", "Punchy", "Melodic"],
  trap: ["Dark", "Melodic", "Rage", "Experimental"],
  drill: ["UK Drill", "NY Drill", "Dark", "Melodic"],
  another: ["Phonk", "Cloud", "Ambient", "Hybrid"],
};

export const BEAT_MOODS = [
  "Sad",
  "Melancholic",
  "Nostalgic",
  "Calm",
  "Dreamy",
  "Romantic",
  "Energetic",
  "Uplifting",
  "Angry",
  "Aggressive",
] as const;

export type BeatMood = (typeof BEAT_MOODS)[number];

export function getGenreLabel(genre: BeatGenre, locale: "ru" | "en") {
  const labels: Record<BeatGenre, { ru: string; en: string }> = {
    boombap: { ru: "BoomBap", en: "BoomBap" },
    rap: { ru: "Rap", en: "Rap" },
    trap: { ru: "Trap", en: "Trap" },
    drill: { ru: "Drill", en: "Drill" },
    another: { ru: "Another", en: "Another" },
  };

  return labels[genre][locale];
}

export function inferGenreFromMoodText(mood: string): BeatGenre {
  const value = mood.toLowerCase();

  if (value.includes("boom bap") || value.includes("boombap") || value.includes("bap")) {
    return "boombap";
  }
  if (value.includes("drill")) {
    return "drill";
  }
  if (value.includes("trap")) {
    return "trap";
  }
  if (value.includes("rap")) {
    return "rap";
  }

  return "another";
}

export function getDefaultSubstyle(genre: BeatGenre): string {
  return BEAT_SUBSTYLES[genre][0] ?? "Hybrid";
}
