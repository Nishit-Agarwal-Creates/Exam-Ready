import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/db";

const COOKIE = "er_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8;

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function secrets() {
  const env = await getEnv();
  return {
    password: env.ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD,
    secret: env.SESSION_SECRET ?? process.env.SESSION_SECRET,
  };
}

export async function isAdminConfigured(): Promise<boolean> {
  const { password, secret } = await secrets();
  return Boolean(password && password.length >= 8 && secret && secret.length >= 32);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const { password, secret } = await secrets();
  if (!password || !secret || password.length < 8 || secret.length < 32) return false;
  // Compare HMACs so timing does not depend on the password contents.
  const [a, b] = await Promise.all([hmac(secret, candidate), hmac(secret, password)]);
  return timingSafeEqual(a, b);
}

export async function createAdminSession(): Promise<void> {
  const { secret } = await secrets();
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `admin.${expires}`;
  const sig = await hmac(secret, payload);
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const { secret } = await secrets();
  if (!secret || secret.length < 32) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [role, expires, sig] = parts;
  if (role !== "admin" || !Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return false;
  const expected = await hmac(secret, `${role}.${expires}`);
  return timingSafeEqual(sig, expected);
}

/** Call at the top of every admin page and server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
