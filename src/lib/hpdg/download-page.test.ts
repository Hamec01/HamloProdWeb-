import test from "node:test";
import assert from "node:assert/strict";
import { downloadCopy, downloadErrorMessage, isInstallerUrl, pickDownloadLocale } from "./download-page";

test("status codes map to the right message in both languages", () => {
  for (const locale of ["en", "ru"] as const) {
    const e = downloadCopy[locale].errors;
    assert.equal(downloadErrorMessage(401, locale), e.invalid);
    assert.equal(downloadErrorMessage(403, locale), e.revoked);
    assert.equal(downloadErrorMessage(429, locale), e.limit);
    assert.equal(downloadErrorMessage(404, locale), e.noRelease);
    assert.equal(downloadErrorMessage(500, locale), e.other);
  }
});

test("?lang wins over the cookie only for ru / en", () => {
  assert.equal(pickDownloadLocale("ru", "en"), "ru");
  assert.equal(pickDownloadLocale("en", "ru"), "en");
  assert.equal(pickDownloadLocale("fi", "ru"), "ru");
  assert.equal(pickDownloadLocale(undefined, "en"), "en");
});

test("only presigned links to hamloprod-private/hpdg/<file> are followed", () => {
  assert.ok(isInstallerUrl("https://usc1.contabostorage.com/hamloprod-private/hpdg/HPDG_VST3_Setup_0.1.0-beta.5.exe?X-Amz-Signature=x"));
  for (const bad of [
    "http://usc1.contabostorage.com/hamloprod-private/hpdg/a.exe",
    "https://evil.com/hamloprod-private/hpdg/a.exe",
    "https://usc1.contabostorage.com/hamloprod-public/hpdg/a.exe",
    "https://usc1.contabostorage.com/hamloprod-private/hpdg/sub/a.exe",
    "https://usc1.contabostorage.com/hamloprod-private/hpdg/%2e%2e/a.exe",
    "javascript:alert(1)",
    42,
  ]) assert.ok(!isInstallerUrl(bad), String(bad));
});
