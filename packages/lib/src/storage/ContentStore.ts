import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CrawledData } from "@/core/types.js";
import { generateContentHash } from "@/utils/hash.js";

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
		this.storageDir = resolve(options.storageDir ?? "./storage/content");
	}

	/**
	 * Type guard to check if an error is a Node.js errno exception
	 */
	private static isErrnoException(
		error: unknown,
	): error is NodeJS.ErrnoException {
		return (
			error != null &&
			typeof error === "object" &&
			"code" in error &&
			typeof (error as Record<string, unknown>).code === "string"
		);
	}

	/**
	 * Store crawled data using content-addressed storage
	 * @param data The crawled data to store
	 * @returns Storage result with hash, path, and whether file already existed
	 */
	async store(data: CrawledData): Promise<StorageResult> {
		// Create content hash based only on URL (natural unique identifier)
		const hash = this.generateHash(data.url);

		// Serialize the full data for storage
		const serialized = JSON.stringify(data, null, 2);
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
	 * Retrieve stored data by URL
	 * @param url The URL to look up
	 * @returns The stored data if found, null otherwise
	 */
	async retrieve(url: string): Promise<CrawledData | null> {
		const hash = this.generateHash(url);
		const filePath = join(this.storageDir, `${hash}.json`);

		try {
			if (await this.fileExists(filePath)) {
				const { readFile } = await import("node:fs/promises");
				const content = await readFile(filePath, "utf8");
				const parsed = JSON.parse(content);

				// Convert timestamp back to Date object
				if (parsed.timestamp) {
					parsed.timestamp = new Date(parsed.timestamp);
				}

				return parsed as CrawledData;
			}
			return null;
		} catch (error) {
			throw new Error(
				`Failed to retrieve content for URL ${url}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Check if content exists for a given URL
	 * @param url The URL to check
	 * @returns True if content exists, false otherwise
	 */
	async exists(url: string): Promise<boolean> {
		const hash = this.generateHash(url);
		const filePath = join(this.storageDir, `${hash}.json`);
		return this.fileExists(filePath);
	}

	/**
	 * Generate a content hash for the given data (SHA-1 for shorter 40-char hashes)
	 */
	protected generateHash(content: string): string {
		return generateContentHash(content);
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
		// Try up to 3 times with a small delay
		let retries = 3;
		let lastError: unknown;

		while (retries > 0) {
			try {
				await mkdir(dirPath, { recursive: true });
				return; // Success
			} catch (error) {
				lastError = error;
				retries--;

				// Don't retry on permission or path errors
				if (ContentStore.isErrnoException(error)) {
					if (error.code === "EACCES") {
						throw new Error(`Permission denied creating directory ${dirPath}`);
					}
					if (error.code === "ENOTDIR") {
						throw new Error(
							`Invalid path: ${dirPath} contains a file where a directory is expected`,
						);
					}
				}

				// If we have retries left, wait a bit and try again
				if (retries > 0) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			}
		}

		// All retries exhausted
		throw new Error(
			`Failed to create directory ${dirPath} after 3 attempts: ${lastError instanceof Error ? lastError.message : "Unknown error"}`,
		);
	}

	/**
	 * Get the storage directory path
	 */
	getStorageDirectory(): string {
		return this.storageDir;
	}
}
