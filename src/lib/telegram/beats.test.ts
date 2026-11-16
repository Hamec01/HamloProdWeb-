import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { publishBeatToTelegram } from "./beats";

const base = "https://media.example/public";
const input = { title: "Test beat", slug: "test-beat", genre: "trap", substyle: "Dark", bpm: 90, mood: "Calm", priceRub: 2500, priceUsd: 30, coverImageUrl: `${base}/cover.png`, previewUrl: `${base}/preview.mp3` };
const config = { token: "test-token", chatId: "test-channel" };

async function mock(fail?: "download" | "photo" | "audio") {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#c9533e" } }).png().toBuffer();
  const calls: Array<{ method: string; form: FormData }> = [];
  const fetcher = (async (url: URL | RequestInfo, init?: RequestInit) => {
    const u = new URL(String(url));
    if (u.hostname === "media.example") {
      if (fail === "download" && u.pathname.endsWith("preview.mp3")) return new Response("missing", { status: 404 });
      return new Response(u.pathname.endsWith(".png") ? new Uint8Array(png) : new Uint8Array([73, 68, 51, 1, 2, 3]));
    }
    assert.equal(u.hostname, "api.telegram.org");
    assert.equal(init?.method, "POST");
    assert.ok(init.body instanceof FormData);
    const method = u.pathname.split("/").at(-1)!;
    calls.push({ method, form: init.body });
    return Response.json({ ok: !((fail === "photo" && method === "sendPhoto") || (fail === "audio" && method === "sendAudio")), description: "Mock Telegram rejection" });
  }) as typeof fetch;
  return { calls, deps: { config, publicBaseUrl: base, fetch: fetcher, downloadUrl: async (url: URL) => url.href } };
}

test("Telegram gets an actual JPEG and MP3 upload instead of URLs", async () => {
  const { calls, deps } = await mock();
  assert.deepEqual(await publishBeatToTelegram(input, deps), { ok: true });
  assert.deepEqual(calls.map((call) => call.method), ["sendPhoto", "sendAudio"]);
  const photo = calls[0].form.get("photo");
  const audio = calls[1].form.get("audio");
  assert.ok(photo instanceof Blob && audio instanceof Blob);
  assert.equal(photo.type, "image/jpeg");
  assert.equal(audio.type, "audio/mpeg");
  assert.equal((await sharp(Buffer.from(await photo.arrayBuffer())).metadata()).format, "jpeg");
  assert.equal(calls[0].form.get("chat_id"), config.chatId);
  assert.match(String(calls[0].form.get("caption")), /Test beat/);
});

test("a failed media download does not publish a partial announcement", async () => {
  const { calls, deps } = await mock("download");
  await assert.rejects(publishBeatToTelegram(input, deps));
  assert.equal(calls.length, 0);
});

test("Telegram errors are never retried automatically", async () => {
  const { calls, deps } = await mock("photo");
  await assert.rejects(publishBeatToTelegram(input, deps), /Mock Telegram rejection/);
  assert.equal(calls.length, 1);
});

test("a partially published post reports that the cover already exists", async () => {
  const { calls, deps } = await mock("audio");
  await assert.rejects(publishBeatToTelegram(input, deps), /Обложка уже опубликована/);
  assert.equal(calls.length, 2);
});

test("media outside the configured public storage cannot be fetched for posting", async () => {
  const { calls, deps } = await mock();
  await assert.rejects(publishBeatToTelegram({ ...input, coverImageUrl: "https://other.example/private" }, deps), /Недопустимая ссылка/);
  assert.equal(calls.length, 0);
});
