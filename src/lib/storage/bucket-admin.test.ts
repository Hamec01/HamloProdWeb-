import test from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_BROWSER_ORIGINS, buildCorsRules, buildPublicReadPolicy } from "./bucket-admin";

test("public-read policy: anonymous s3:GetObject on every object, nothing else", () => {
  const policy = JSON.parse(buildPublicReadPolicy("hamloprod-public")) as {
    Version: string;
    Statement: Array<{ Effect: string; Principal: unknown; Action: string[]; Resource: string[] }>;
  };

  assert.equal(policy.Version, "2012-10-17");
  assert.equal(policy.Statement.length, 1);
  const s = policy.Statement[0];
  assert.equal(s.Effect, "Allow");
  assert.deepEqual(s.Principal, { AWS: ["*"] });
  assert.deepEqual(s.Action, ["s3:GetObject"]);
  assert.deepEqual(s.Resource, ["arn:aws:s3:::hamloprod-public/*"]);

  // no ListBucket / PutObject / DeleteObject anywhere
  assert.doesNotMatch(buildPublicReadPolicy("hamloprod-public"), /ListBucket|PutObject|DeleteObject|s3:\*/);
});

test("CORS rules: exact origins, PUT/GET/HEAD, ETag exposed, no wildcard origin", () => {
  const rules = buildCorsRules();
  assert.equal(rules.length, 1);
  const r = rules[0];
  assert.deepEqual(r.AllowedOrigins, [
    "https://hamloprod.org",
    "https://www.hamloprod.org",
    "http://localhost:3000",
  ]);
  assert.deepEqual(r.AllowedMethods, ["PUT", "GET", "HEAD"]);
  assert.deepEqual(r.AllowedHeaders, ["*"]);
  assert.deepEqual(r.ExposeHeaders, ["ETag"]);
  assert.equal(r.MaxAgeSeconds, 3000);
  assert.ok(!r.AllowedOrigins?.includes("*"), "no wildcard origin");
});

test("CORS accepts a custom origin list but the default matches the constant", () => {
  assert.deepEqual(buildCorsRules(["https://preview.example"])[0].AllowedOrigins, ["https://preview.example"]);
  assert.deepEqual(buildCorsRules()[0].AllowedOrigins, [...ALLOWED_BROWSER_ORIGINS]);
});
