import test from "node:test";
import assert from "node:assert/strict";
import { assertPostgresUrl, DatabaseConfigError, describeDatabaseConfig, getDataBackend, isDatabaseConfigured } from "./config";

const URL_APP = "postgresql://hamloprod_app:secret@127.0.0.1:55434/hamloprod?schema=public";

test("assertPostgresUrl accepts a valid postgres URL and returns it", () => {
  assert.equal(assertPostgresUrl(URL_APP), URL_APP);
  assert.equal(assertPostgresUrl("postgres://u:p@db:5432/x"), "postgres://u:p@db:5432/x");
});

test("assertPostgresUrl rejects empty, non-URL and wrong-protocol values", () => {
  assert.throws(() => assertPostgresUrl(undefined), DatabaseConfigError);
  assert.throws(() => assertPostgresUrl(""), DatabaseConfigError);
  assert.throws(() => assertPostgresUrl("not a url"), DatabaseConfigError);
  assert.throws(() => assertPostgresUrl("mysql://u:p@h/db"), DatabaseConfigError);
});

test("assertPostgresUrl names the variable in the error, not its value", () => {
  try {
    assertPostgresUrl("mysql://u:sup3rsecret@h/db", "DIRECT_URL");
    assert.fail("expected throw");
  } catch (error) {
    assert.ok(error instanceof DatabaseConfigError);
    assert.match(error.message, /DIRECT_URL/);
    assert.doesNotMatch(error.message, /sup3rsecret/);
  }
});

test("isDatabaseConfigured reflects DATABASE_URL presence", () => {
  assert.equal(isDatabaseConfigured({}), false);
  assert.equal(isDatabaseConfigured({ DATABASE_URL: URL_APP }), true);
});

test("describeDatabaseConfig exposes host + database name only, no credentials", () => {
  const described = describeDatabaseConfig({ DATABASE_URL: URL_APP, DIRECT_URL: "postgresql://m:p@127.0.0.1:55434/hamloprod" });

  assert.deepEqual(described, {
    configured: true,
    host: "127.0.0.1",
    database: "hamloprod",
    hasDirectUrl: true,
  });
  assert.doesNotMatch(JSON.stringify(described), /secret/);
});

test("getDataBackend: unset / postgres → postgres; legacy supabase recognised; typo fails closed", () => {
  assert.equal(getDataBackend({}), "postgres");
  assert.equal(getDataBackend({ DATA_BACKEND: "" }), "postgres");
  assert.equal(getDataBackend({ DATA_BACKEND: "postgres" }), "postgres");
  assert.equal(getDataBackend({ DATA_BACKEND: "POSTGRES" }), "postgres");
  assert.equal(getDataBackend({ DATA_BACKEND: "supabase" }), "supabase");
  assert.throws(() => getDataBackend({ DATA_BACKEND: "mysql" }), DatabaseConfigError);
  assert.throws(() => getDataBackend({ DATA_BACKEND: "pg" }), DatabaseConfigError);
});

test("getDataBackend error never contains DATABASE_URL", () => {
  try {
    getDataBackend({ DATA_BACKEND: "nope", DATABASE_URL: "postgresql://u:leaky@h/db" });
    assert.fail("expected throw");
  } catch (error) {
    assert.ok(error instanceof DatabaseConfigError);
    assert.doesNotMatch(error.message, /leaky|postgresql:\/\//);
  }
});
