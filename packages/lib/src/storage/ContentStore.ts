import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ContentData, CrawledData } from "@/core/types.js";
import { generateContentHash } from "@/utils/hash.js";
import { MetadataStore, type MetadataStoreOptions } from "./MetadataStore.js";

export interface StorageResult {
	hash: string;
	path: string;
	existed: boolean;
	storedAt: Date;
	metadata?: {
		id: number;
		stored: boolean;
	};
}

export interface ContentStoreOptions {
	storageDir?: string;
	enableMetadata?: boolean;
	metadataOptions?: MetadataStoreOptions;
}

export class ContentStore {
	private readonly storageDir: string;
	private readonly metadataStore?: MetadataStore;
	private readonly enableMetadata: boolean;

	constructor(options: ContentStoreOptions = {}) {
		this.storageDir = resolve(options.storageDir ?? "./storage/content");
		this.enableMetadata = options.enableMetadata ?? true;

		if (this.enableMetadata) {
			this.metadataStore = new MetadataStore(options.metadataOptions);
		}
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
	 * Extract pure content data from crawled data (removing tracking metadata)
	 */
	private extractContentData(data: CrawledData): ContentData {
		const { url, title, content, author, publishedDate, image } = data;
		return {
			url,
			title,
			content,
			...(author && { author }),
			...(publishedDate && { publishedDate }),
			...(image && { image }),
		};
	}

	/**
	 * Store crawled data using content-addressed storage
	 * @param data The crawled data to store
	 * @returns Storage result with hash, path, and whether file already existed
	 */
	async store(data: CrawledData): Promise<StorageResult> {
		// Create content hash based only on URL (natural unique identifier)
		const hash = this.generateHash(data.url);

		// Extract only the content data for JSON storage (no tracking metadata)
		const contentData = this.extractContentData(data);
		const serialized = JSON.stringify(contentData, null, 2);
		const filename = `${hash}.json`;
		const filePath = join(this.storageDir, filename);

		try {
			// Check if file already exists (deduplication)
			const existed = await this.fileExists(filePath);

			let metadataResult: { id: number; stored: boolean } | undefined;
			if (!existed) {
				// Ensure storage directory exists
				await this.ensureDirectoryExists(this.storageDir);

				// Write the file
				await writeFile(filePath, serialized, "utf8");

				// Store metadata if enabled
				if (this.metadataStore) {
					try {
						const metadata = await this.metadataStore.store(data, hash);
						metadataResult = {
							id: metadata.id as number,
							stored: true,
						};
					} catch (metadataError) {
						// Log but don't fail the whole operation
						console.warn(
							`Failed to store metadata: ${metadataError instanceof Error ? metadataError.message : "Unknown error"}`,
						);
					}
				}
			} else {
				// File exists, check if metadata also exists
				if (this.metadataStore && !this.metadataStore.existsByHash(hash)) {
					try {
						const metadata = await this.metadataStore.store(data, hash);
						metadataResult = {
							id: metadata.id as number,
							stored: true,
						};
					} catch (metadataError) {
						// Metadata might already exist, that's ok
						console.warn(
							`Failed to store metadata for existing file: ${metadataError instanceof Error ? metadataError.message : "Unknown error"}`,
						);
					}
				}
			}

			return {
				hash,
				path: filePath,
				existed,
				storedAt: new Date(),
				metadata: metadataResult,
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
	 * @returns The stored content data if found, null otherwise
	 */
	async retrieve(url: string): Promise<ContentData | null> {
		const hash = this.generateHash(url);
		const filePath = join(this.storageDir, `${hash}.json`);

		try {
			if (await this.fileExists(filePath)) {
				const { readFile } = await import("node:fs/promises");
				const content = await readFile(filePath, "utf8");
				const parsed = JSON.parse(content);

				return parsed as ContentData;
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
		// Use metadata store for fast lookup if available
		if (this.metadataStore) {
			return this.metadataStore.existsByUrl(url);
		}

		// Fallback to filesystem check
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

	/**
	 * Get the metadata store instance
	 */
	getMetadataStore(): MetadataStore | undefined {
		return this.metadataStore;
	}

	/**
	 * Close any open connections
	 */
	close(): void {
		if (this.metadataStore) {
			this.metadataStore.close();
		}
	}
}
