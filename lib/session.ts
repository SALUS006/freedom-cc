import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const COOKIE = "fcc_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  memberId: string;
  clubId: string;
  isAdmin: boolean;
  name: string;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export function signSession(session: Session): string {
  return jwt.sign(session, secret(), { expiresIn: MAX_AGE });
}

export async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, secret()) as jwt.JwtPayload & Session;
    return {
      memberId: decoded.memberId,
      clubId: decoded.clubId,
      isAdmin: !!decoded.isAdmin,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Not signed in");
  return session;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
