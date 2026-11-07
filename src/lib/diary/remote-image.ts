import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { isIP } from "node:net";

const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSION = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function isPublicImageAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family === 6) {
    const value = address.toLowerCase().split("%", 1)[0];
    if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd")) return false;
    if (/^fe[89ab]/.test(value) || value.startsWith("ff") || value.startsWith("2001:db8")) return false;
    if (value.startsWith("::ffff:")) return isPublicImageAddress(value.slice(7));
    return true;
  }
  return false;
}

function parsedUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Only public HTTPS image URLs are allowed.");
  return url;
}

async function pinnedAddress(hostname: string) {
  const literalFamily = isIP(hostname);
  const addresses = literalFamily ? [{ address: hostname, family: literalFamily }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => !isPublicImageAddress(item.address))) throw new Error("Private image addresses are not allowed.");
  return addresses[0];
}

async function requestImage(url: URL, redirects = 0): Promise<{ bytes: Uint8Array; contentType: string; extension: string }> {
  if (redirects > 3) throw new Error("Too many image redirects.");
  const address = await pinnedAddress(url.hostname);

  return new Promise((resolve, reject) => {
    const request = get(url, {
      headers: { Accept: "image/jpeg,image/png,image/webp", "User-Agent": "HamloProd-Diary/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        let next: URL;
        try { next = parsedUrl(new URL(response.headers.location, url).toString()); }
        catch (error) { reject(error); return; }
        requestImage(next, redirects + 1).then(resolve, reject);
        return;
      }
      if (status !== 200) { response.resume(); reject(new Error(`Image server returned ${status}.`)); return; }

      const contentType = String(response.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
      const extension = MIME_EXTENSION.get(contentType);
      const declared = Number(response.headers["content-length"] ?? 0);
      if (!extension) { response.resume(); reject(new Error("Unsupported pasted image type.")); return; }
      if (declared > MAX_BYTES) { response.resume(); reject(new Error("Pasted image is larger than 10 MB.")); return; }

      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) response.destroy(new Error("Pasted image is larger than 10 MB."));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ bytes: new Uint8Array(Buffer.concat(chunks)), contentType, extension }));
    });
    request.setTimeout(15_000, () => request.destroy(new Error("Pasted image download timed out.")));
    request.on("error", reject);
  });
}

export async function downloadRemoteDiaryImage(raw: string) {
  return requestImage(parsedUrl(raw));
}
