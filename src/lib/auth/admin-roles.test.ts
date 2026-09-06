import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_ROLES, isAdminRole } from "./admin-roles";

test("only ADMIN and EDITOR are admin roles", () => {
  assert.deepEqual([...ADMIN_ROLES], ["ADMIN", "EDITOR"]);
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isAdminRole("EDITOR"), true);
  assert.equal(isAdminRole("ARTIST"), false);
  assert.equal(isAdminRole("USER"), false);
  assert.equal(isAdminRole(null), false);
  assert.equal(isAdminRole(undefined), false);
  assert.equal(isAdminRole("admin"), false); // case-sensitive
});
