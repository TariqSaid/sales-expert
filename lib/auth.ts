import { createHmac, createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "auth";

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordOk(input: string) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  return safeEqual(input, pw);
}

export function makeToken() {
  return createHmac("sha256", process.env.AUTH_SECRET!)
    .update("sales-expert-v1")
    .digest("hex");
}

export async function isAuthed() {
  if (!process.env.AUTH_SECRET) return false;
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return !!value && safeEqual(value, makeToken());
}