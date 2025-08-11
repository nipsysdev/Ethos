import { createHash } from "node:crypto";

/**
 * Generate a SHA-1 hash for the given string (40-character hex output)
 * Generic utility function for consistent string hashing across the application
 */
export function generateStringHash(content: string): string {
	return createHash("sha1").update(content, "utf8").digest("hex");
}
