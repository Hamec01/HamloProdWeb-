import test from "node:test";
import assert from "node:assert/strict";
import { buildKeyEmail, getMailConfig, MailNotConfiguredError, sendEmail } from "./key-email";

test("email carries the key, the download page in both languages and no installer link", () => {
  const mail = buildKeyEmail({ key: "HPDG-7K3M-2Q9X-ABCD-EF01" });
  for (const body of [mail.text, mail.html]) {
    assert.ok(body.includes("HPDG-7K3M-2Q9X-ABCD-EF01"));
    assert.ok(body.includes("hpdg/download?lang=en") && body.includes("hpdg/download?lang=ru"));
    assert.ok(!body.includes("contabostorage") && !body.includes(".exe"));
  }
  assert.match(mail.subject, /HPDG/);
});

test("config: API key required, default sender", () => {
  assert.throws(() => getMailConfig({}), MailNotConfiguredError);
  assert.deepEqual(getMailConfig({ RESEND_API_KEY: "re_x" }), { apiKey: "re_x", from: "HamloProd <hello@hamloprod.org>", replyTo: null });
  assert.equal(getMailConfig({ RESEND_API_KEY: "re_x", HPDG_MAIL_FROM: "A <a@hamloprod.org>", HPDG_MAIL_REPLY_TO: "me@x.io" }).replyTo, "me@x.io");
});

test("sendEmail posts to Resend with auth + idempotency key and surfaces errors", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
  }) as unknown as typeof fetch;
  const result = await sendEmail("b@x.io", buildKeyEmail({ key: "HPDG-0000-0000-0000-0000" }), { apiKey: "re_x", from: "HamloProd <hello@hamloprod.org>" }, { idempotencyKey: "cs_1", fetchImpl: ok });
  assert.equal(result.id, "em_1");
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer re_x");
  assert.equal(headers["Idempotency-Key"], "cs_1");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)).to, ["b@x.io"]);

  const failing = (async () => new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(sendEmail("b@x.io", buildKeyEmail({ key: "HPDG-0000-0000-0000-0000" }), { apiKey: "re_x", from: "x" }, { fetchImpl: failing }), /403: domain not verified/);
});
