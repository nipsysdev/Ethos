import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CrawledData } from "../core/types.js";

export interface StorageResult {
	hash: string;
	path: string;
	existed: boolean;
	storedAt: Date;
}

export interface ContentStoreOptions {
	storageDir?: string;
}

export class ContentStore {
	private readonly storageDir: string;

	constructor(options: ContentStoreOptions = {}) {
		this.storageDir = options.storageDir ?? "./storage/content";
	}

	/**
	 * Store crawled data using content-addressed storage
	 * @param data The crawled data to store
	 * @returns Storage result with hash, path, and whether file already existed
	 */
	async store(data: CrawledData): Promise<StorageResult> {
		// Serialize the data for hashing and storage
		const serialized = JSON.stringify(data, null, 2);

		// Generate content hash
		const hash = this.generateHash(serialized);
		const filename = `${hash}.json`;
		const filePath = join(this.storageDir, filename);

		try {
			// Check if file already exists (deduplication)
			const existed = await this.fileExists(filePath);

			if (!existed) {
				// Ensure storage directory exists
				await this.ensureDirectoryExists(this.storageDir);

				// Write the file
				await writeFile(filePath, serialized, "utf8");
			}

			return {
				hash,
				path: filePath,
				existed,
				storedAt: new Date(),
			};
		} catch (error) {
			throw new Error(
				`Failed to store content: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Generate a content hash for the given data (SHA-1 for shorter 40-char hashes)
	 */
	private generateHash(content: string): string {
		return createHash("sha1").update(content, "utf8").digest("hex");
	}

	/**
	 * Check if a file exists
	 */
	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Ensure a directory exists, creating it if necessary
	 */
	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		try {
			await mkdir(dirPath, { recursive: true });
		} catch (error) {
			throw new Error(
				`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
