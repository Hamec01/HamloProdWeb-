import test from "node:test";
import assert from "node:assert/strict";
import { buildUpdateEmail, defaultUpdateEmail, sendUpdateEmail, UpdateSendError, deliveryState } from "./update-email";

test("Beta 7 buyer template links the guide and manual download without internal notes or keys", () => {
  const mail = defaultUpdateEmail({ version: "0.1.0-beta.7", title: "HPDG", notes: "", page: "" });
  assert.match(mail.text, /919/);
  assert.match(mail.text, /hpdg\/download\?lang=en/);
  assert.match(mail.text, /HPDG_Beta7_Guide_EN.pdf/);
  assert.doesNotMatch(mail.text, /Agent note|SITE_AGENT|VERIFICATION|contabostorage|HPDG-[A-Z0-9]{4}/);
  const html = buildUpdateEmail({ subject: "Test", text: '<script>bad()</script> https://hamloprod.org/hpdg/download?lang=en&x="oops"' }).html;
  assert.doesNotMatch(html, /<script>|x="oops"/);
  assert.match(html, /&lt;script&gt;/);
});

test("provider acceptance requires an ID; rejection and ambiguous failure remain distinct", async () => {
  const config = { apiKey: "test", from: "test@example.com" };
  const mail = buildUpdateEmail({ subject: "Update", text: "Update available" });
  const fake = (status: number, body: object) => (async (_url: unknown, init?: RequestInit) => {
    assert.equal((init?.headers as Record<string, string>)["Idempotency-Key"], "campaign/recipient");
    assert.deepEqual(JSON.parse(init?.body as string).to, ["buyer@example.com"]);
    return Response.json(body, { status });
  }) as typeof fetch;
  assert.equal(await sendUpdateEmail("buyer@example.com", mail, config, "campaign/recipient", fake(200, { id: "message" })), "message");
  for (const [status, uncertain] of [[403, false], [429, false], [500, true], [409, true], [200, true]] as const) {
    await assert.rejects(sendUpdateEmail("buyer@example.com", mail, config, "campaign/recipient", fake(status, {})), (e) => e instanceof UpdateSendError && e.uncertain === uncertain);
  }
});

test("acceptance is distinct from delivery and bounce", () => {
  assert.equal(deliveryState("sent"), "accepted");
  assert.equal(deliveryState("delivered"), "delivered");
  assert.equal(deliveryState("bounced"), "bounced");
  assert.equal(deliveryState("failed"), "failed");
});
