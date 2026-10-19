import test from "node:test";
import assert from "node:assert/strict";
import { compareVersions, installerObjectKey, isHamloprodPage, parseVersion, publicRelease, releaseInputSchema } from "./release";

test("versions parse and order like the plugin", () => {
  assert.deepEqual(parseVersion("0.1.0-beta.4"), { major: 0, minor: 1, patch: 0, label: "beta", labelNumber: 4 });
  assert.equal(parseVersion("0.1"), null);
  assert.equal(parseVersion("v0.1.0"), null);
  const ordered = ["0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.10", "0.1.0-rc.1", "0.1.0", "0.1.1", "1.0.0"];
  for (let i = 1; i < ordered.length; i += 1) {
    assert.equal(compareVersions(ordered[i - 1], ordered[i]), -1, `${ordered[i - 1]} < ${ordered[i]}`);
    assert.equal(compareVersions(ordered[i], ordered[i - 1]), 1);
  }
  assert.equal(compareVersions("0.1.0-beta.4", "0.1.0-beta.4"), 0);
});

test("installer key is one file directly under hpdg/", () => {
  assert.equal(installerObjectKey("HPDG_VST3_Setup_0.1.0-beta.4.exe"), "hpdg/HPDG_VST3_Setup_0.1.0-beta.4.exe");
  for (const bad of ["../x.exe", "a/b.exe", "x.zip", ".hidden.exe", "x y.exe", "x%2fy.exe"]) {
    assert.throws(() => installerObjectKey(bad), bad);
  }
});

test("page must be on hamloprod.org over https", () => {
  assert.ok(isHamloprodPage("https://hamloprod.org/en/vst"));
  assert.ok(isHamloprodPage("https://www.hamloprod.org/ru/vst"));
  for (const bad of ["http://hamloprod.org/en/vst", "https://hamloprod.org.evil.com/", "https://evil.com/?hamloprod.org", "https://user@hamloprod.org/", "not a url"]) {
    assert.ok(!isHamloprodPage(bad), bad);
  }
  assert.equal(publicRelease({ version: "1.0.0", title: "t", notes: "", page: "https://evil.com" }).page, "https://hamloprod.org/en/vst");
});

test("release input: defaults, lowercase hash, limits", () => {
  const parsed = releaseInputSchema.parse({
    version: "0.1.0-beta.4",
    title: "HPDG 0.1.0 Beta 4",
    fileName: "HPDG_VST3_Setup_0.1.0-beta.4.exe",
    sha256: "A".repeat(64),
    size: 113853262,
  });
  assert.equal(parsed.sha256, "a".repeat(64));
  assert.equal(parsed.page, "https://hamloprod.org/en/vst");
  assert.equal(parsed.makeCurrent, true);
  assert.ok(!releaseInputSchema.safeParse({ ...parsed, notes: "x".repeat(601) }).success);
  assert.ok(!releaseInputSchema.safeParse({ ...parsed, sha256: "abc" }).success);
  assert.ok(!releaseInputSchema.safeParse({ ...parsed, version: "beta4" }).success);
});
