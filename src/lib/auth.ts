import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { get } from "./db";
import type { Role } from "./roles";

const COOKIE_NAME = "coop_session";
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-cambiar-en-produccion-0000000000"
);
const SESSION_DAYS = 14;

export type SessionUser = {
  id: number;
  nombre: string;
  email: string;
  rol: Role;
  nucleo_id: number | null;
};

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSessionCookie(user: SessionUser) {
  const token = await new SignJWT({ uid: user.id, rol: user.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(SECRET);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const uid = payload.uid as number;
    const row = get<any>(
      `SELECT id, nombre, email, rol, nucleo_id, activo FROM users WHERE id = ?`,
      [uid]
    );
    if (!row || !row.activo) return null;
    return {
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
      nucleo_id: row.nucleo_id,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}
