import { SignJWT, jwtVerify } from "jose";
import { User } from "./config";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "content-dashboard-secret-change-me"
);

export async function createToken(user: User): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload as { user: User }).user;
  } catch {
    return null;
  }
}

// Simple hash for demo - in production use bcrypt
export function hashPassword(password: string): string {
  // Using a simple approach since bcryptjs has issues in edge runtime
  let hash = 0;
  const str = password + "itscoll-salt-2026";
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return "h_" + Math.abs(hash).toString(36);
}
