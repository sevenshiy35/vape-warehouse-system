import "server-only";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

export async function isWarehouseAdmin() {
  const expected = process.env.ADMIN_SESSION_SECRET;
  const actual = (await cookies()).get("admin_auth")?.value;
  if (!expected || !actual) return false;
  const a = Buffer.from(expected),
    b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
