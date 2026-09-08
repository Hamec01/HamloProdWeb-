import test from "node:test";
import assert from "node:assert/strict";
import { uploadBeatAsset } from "./client-upload";
const file = new File(["audio"], "preview.mp3", { type: "audio/mpeg" });

test("browser sends signed headers, finalizes before attachment and returns server URLs", async t => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const beat = { id: "beat", previewUrl: "https://media.example/server-resolved.mp3" };
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Response.json(calls.length === 1 ? { key: "generated-key", upload: { url: "https://storage.example/signed", headers: { "Content-Type": "audio/mpeg", "If-None-Match": "*" } } } : calls.length === 4 ? { beat } : {});
  });
  assert.deepEqual(await uploadBeatAsset("beat", "beat-preview", file), beat);
  assert.deepEqual(calls.map(c => c.url), ["/api/admin/storage/upload-url", "https://storage.example/signed", "/api/admin/storage/finalize", "/api/admin/beats/beat/assets"]);
  assert.equal(calls[1].init?.body, file);
  assert.equal(calls[1].init?.credentials, "omit");
  assert.deepEqual(calls[1].init?.headers, { "Content-Type": "audio/mpeg", "If-None-Match": "*" });
  assert.deepEqual(JSON.parse(String(calls[3].init?.body)), { kind: "beat-preview", key: "generated-key" });
});

test("failed PUT or finalize never attaches", async t => {
  for (const failAt of [2, 3]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, "fetch", async () => {
      calls++;
      if (calls === 1) return Response.json({ key: "key", upload: { url: "https://storage.example", headers: {} } });
      return Response.json({ error: "Rejected" }, { status: calls === failAt ? 422 : 200 });
    });
    await assert.rejects(uploadBeatAsset("beat", "beat-preview", file));
    assert.equal(calls, failAt);
    mock.mock.restore();
  }
});

test("cancellation before upload makes no request", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(uploadBeatAsset("beat", "beat-preview", file, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 0);
});

test("timeout aborts outstanding request", async t => {
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
  }));
  await assert.rejects(uploadBeatAsset("beat", "beat-preview", file, { timeoutMs: 10 }), { name: "TimeoutError" });
});

test("progress transport uploads bytes with mandatory headers and reports progress", async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  const headers: Record<string, string> = {};
  const progress: number[] = [];
  class Xhr {
    status = 200;
    upload = { onprogress: (_event: { lengthComputable: boolean; loaded: number; total: number }) => { void _event; } };
    onload = () => {};
    open(method: string, url: string) { assert.equal(method, "PUT"); assert.equal(url, "https://storage.example"); }
    setRequestHeader(name: string, value: string) { headers[name] = value; }
    send(body: File) {
      assert.equal(body, file);
      queueMicrotask(() => { this.upload.onprogress({ lengthComputable: true, loaded: 3, total: 5 }); this.onload(); });
    }
    abort() {}
  }
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: Xhr });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, "XMLHttpRequest", descriptor); else Reflect.deleteProperty(globalThis, "XMLHttpRequest"); });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json(calls === 1 ? { key: "key", upload: { url: "https://storage.example", headers: { "Content-Type": "audio/mpeg", "If-None-Match": "*" } } } : { beat: { id: "beat" } });
  });
  await uploadBeatAsset("beat", "beat-preview", file, { onProgress: value => progress.push(value) });
  assert.deepEqual(progress, [0, 60]);
  assert.equal(headers["If-None-Match"], "*");
  assert.equal(calls, 3);
});
