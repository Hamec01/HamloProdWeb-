/**
 * HPDG release record validation and version ordering. Pure — no Prisma import.
 * The plugin accepts installer links only for `hamloprod-private/hpdg/<file>`, so
 * the object key is one file directly under `hpdg/`.
 */

import { z } from "zod";

export const HPDG_PLATFORM = "windows-x64";
export const HPDG_DEFAULT_PAGE = "https://hamloprod.org/en/vst";
export const HPDG_OBJECT_PREFIX = "hpdg/";
export const MAX_NOTES_LENGTH = 600;
export const MAX_INSTALLER_BYTES = 1024 * 1024 * 1024;

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/;
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.exe$/;

export type ParsedVersion = { major: number; minor: number; patch: number; label: string | null; labelNumber: number };

export function parseVersion(version: string): ParsedVersion | null {
  const match = VERSION_RE.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    label: match[4] ?? null,
    labelNumber: match[5] ? Number(match[5]) : 0,
  };
}

/** semver-style: 0.1.0-beta.3 < 0.1.0-beta.4 < 0.1.0-rc.1 < 0.1.0. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) throw new Error(`Invalid version: ${!left ? a : b}`);
  for (const part of ["major", "minor", "patch"] as const) {
    if (left[part] !== right[part]) return left[part] < right[part] ? -1 : 1;
  }
  if (left.label === right.label) return Math.sign(left.labelNumber - right.labelNumber);
  if (left.label === null) return 1;
  if (right.label === null) return -1;
  return left.label < right.label ? -1 : 1;
}

export function isInstallerFileName(name: string): boolean {
  return FILE_NAME_RE.test(name) && name.length <= 200;
}

export function installerObjectKey(fileName: string): string {
  if (!isInstallerFileName(fileName)) throw new Error("Installer file name must look like HPDG_VST3_Setup_0.1.0-beta.4.exe");
  return `${HPDG_OBJECT_PREFIX}${fileName}`;
}

export function isHamloprodPage(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "hamloprod.org" || url.hostname === "www.hamloprod.org") && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const releaseInputSchema = z.object({
  version: z.string().trim().refine((v) => parseVersion(v) !== null, "Version must look like 0.1.0-beta.4, 0.1.0-rc.1 or 1.0.0."),
  title: z.string().trim().min(1, "Title is required.").max(120),
  notes: z.string().trim().max(MAX_NOTES_LENGTH, `Notes: up to ${MAX_NOTES_LENGTH} characters.`).default(""),
  page: z.string().trim().default(HPDG_DEFAULT_PAGE).refine(isHamloprodPage, "Page must be an https://hamloprod.org link."),
  fileName: z.string().trim().refine(isInstallerFileName, "Installer file name must look like HPDG_VST3_Setup_0.1.0-beta.4.exe"),
  sha256: z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/, "SHA-256 must be 64 hex characters."),
  size: z.number().int().positive().max(MAX_INSTALLER_BYTES),
  makeCurrent: z.boolean().default(true),
});

export type ReleaseInput = z.infer<typeof releaseInputSchema>;

/** Public `/api/hpdg/latest` body — never the object key. */
export function publicRelease(release: { version: string; title: string; notes: string; page: string }) {
  return {
    version: release.version,
    title: release.title,
    notes: release.notes,
    page: isHamloprodPage(release.page) ? release.page : HPDG_DEFAULT_PAGE,
  };
}
