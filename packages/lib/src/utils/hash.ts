import { createHash } from "node:crypto";

/**
 * Generate a content hash for the given data (SHA-1 for shorter 40-char hashes)
 * Used consistently across ContentStore and ArticleListingCrawler for content addressing
 */
export function generateContentHash(content: string): string {
	return createHash("sha1").update(content, "utf8").digest("hex");
}
