import assert from "node:assert/strict";
import test from "node:test";
import { isPublicImageAddress } from "./remote-image";

test("diary remote images reject local, private and documentation addresses", () => {
  for (const address of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "172.16.2.3", "192.168.1.5", "203.0.113.9", "::1", "fd00::1", "fe80::1", "2001:db8::1"]) {
    assert.equal(isPublicImageAddress(address), false, address);
  }
});

test("diary remote images accept public IPv4 and IPv6 addresses", () => {
  assert.equal(isPublicImageAddress("8.8.8.8"), true);
  assert.equal(isPublicImageAddress("2606:4700:4700::1111"), true);
});
