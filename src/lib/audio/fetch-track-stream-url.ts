export async function fetchTrackStreamUrl(trackId: string): Promise<string> {
  const response = await fetch(`/api/tracks/${trackId}/stream`);
  if (!response.ok) {
    return "";
  }

  const data = (await response.json()) as { url?: string };
  return data.url ?? "";
}