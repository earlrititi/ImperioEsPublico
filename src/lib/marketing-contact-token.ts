import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const normalizedContactEmail = (email: string) => email.trim().toLowerCase();
export function contactVerificationToken(id: string, expires: string, secret: string) {
  if(secret.length<32)throw Error("MARKETING_VERIFICATION_SECRET_REQUIRED");
  return createHmac("sha256",secret).update(`marketing-opt-in:v1:${id}:${new Date(expires).toISOString()}`).digest("hex");
}
export const contactTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function validContactToken(id: string, expires: string, token: string, secret: string, now=Date.now()) {
  if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/.test(token)||!Number.isFinite(Date.parse(expires))||Date.parse(expires)<now)return false;
  const expected=contactVerificationToken(id,expires,secret);
  return timingSafeEqual(Buffer.from(expected),Buffer.from(token));
}
