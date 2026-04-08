import { mockArtists, mockBeats, mockTracks, siteSettings } from "@/services/mock-data";

export async function getSiteSettings() {
  return siteSettings;
}

export async function getFeaturedBeats() {
  return mockBeats.filter((beat) => beat.featured);
}

export async function getBeats() {
  return mockBeats;
}

export async function getTracks() {
  return mockTracks;
}

export async function getArtists() {
  return mockArtists;
}