import { randomBytes } from "crypto";

/** Cuid-ish opaque id for rows that must know their id before insert (hash-chain). */
export function createId(): string {
  return `c${randomBytes(16).toString("hex")}`;
}
