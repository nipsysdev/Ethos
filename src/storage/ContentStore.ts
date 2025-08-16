import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ContentData, CrawledData } from "@/core/types.js";
import {
	createMetadataStore,
	type MetadataStore,
	type MetadataStoreOptions,
} from "@/storage/MetadataStore";
import { generateStringHash } from "@/utils/hash.js";

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

export interface ContentStore {
	store(data: CrawledData): Promise<StorageResult>;
	retrieve(url: string): Promise<ContentData | null>;
	exists(url: string): Promise<boolean>;
	getStorageDirectory(): string;
	getMetadataStore(): MetadataStore | undefined;
	deleteContentFiles(
		hashes: string[],
	): Promise<{ deleted: number; errors: string[] }>;
	close(): void;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
	return (
		error != null &&
		typeof error === "object" &&
		"code" in error &&
		typeof (error as Record<string, unknown>).code === "string"
	);
}

function extractContentData(data: CrawledData): ContentData {
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

function generateHash(content: string): string {
	return generateStringHash(content);
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function ensureDirectoryExists(dirPath: string): Promise<void> {
	let retries = 3;
	let lastError: unknown;

	while (retries > 0) {
		try {
			await mkdir(dirPath, { recursive: true });
			return;
		} catch (error) {
			lastError = error;
			retries--;

			if (isErrnoException(error)) {
				if (error.code === "EACCES") {
					throw new Error(`Permission denied creating directory ${dirPath}`);
				}
				if (error.code === "ENOTDIR") {
					throw new Error(
						`Invalid path: ${dirPath} contains a file where a directory is expected`,
					);
				}
			}

			if (retries > 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}
	}

	throw new Error(
		`Failed to create directory ${dirPath} after 3 attempts: ${lastError instanceof Error ? lastError.message : "Unknown error"}`,
	);
}

async function storeContent(
	data: CrawledData,
	storageDir: string,
	metadataStore?: MetadataStore,
): Promise<StorageResult> {
	const hash = generateHash(data.url);

	const contentData = extractContentData(data);
	const serialized = JSON.stringify(contentData, null, 2);
	const filename = `${hash}.json`;
	const filePath = join(storageDir, filename);

	try {
		const existed = await fileExists(filePath);

		let metadataResult: { id: number; stored: boolean } | undefined;
		if (!existed) {
			await ensureDirectoryExists(storageDir);

			await writeFile(filePath, serialized, "utf8");

			if (metadataStore) {
				try {
					const metadata = await metadataStore.store(data, hash);
					metadataResult = {
						id: metadata.id as number,
						stored: true,
					};
				} catch (metadataError) {
					console.warn(
						`Failed to store metadata: ${metadataError instanceof Error ? metadataError.message : "Unknown error"}`,
					);
				}
			}
		} else {
			if (metadataStore) {
				if (!metadataStore.existsByHash(hash)) {
					try {
						const metadata = await metadataStore.store(data, hash);
						metadataResult = {
							id: metadata.id as number,
							stored: true,
						};
					} catch (metadataError) {
						console.warn(
							`Failed to store metadata for existing file: ${metadataError instanceof Error ? metadataError.message : "Unknown error"}`,
						);
					}
				} else {
					const existingMetadata = metadataStore.getByHash(hash);
					if (existingMetadata?.id) {
						metadataResult = {
							id: existingMetadata.id,
							stored: false,
						};
					}
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

async function retrieveContent(
	url: string,
	storageDir: string,
): Promise<ContentData | null> {
	const hash = generateHash(url);
	const filePath = join(storageDir, `${hash}.json`);

	try {
		if (await fileExists(filePath)) {
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

async function contentExists(
	url: string,
	storageDir: string,
	metadataStore?: MetadataStore,
): Promise<boolean> {
	if (metadataStore) {
		return metadataStore.existsByUrl(url);
	}

	const hash = generateHash(url);
	const filePath = join(storageDir, `${hash}.json`);
	return fileExists(filePath);
}

async function deleteContentFiles(
	hashes: string[],
	storageDir: string,
): Promise<{ deleted: number; errors: string[] }> {
	const { unlink } = await import("node:fs/promises");
	const errors: string[] = [];
	let deleted = 0;

	for (const hash of hashes) {
		try {
			const filePath = join(storageDir, `${hash}.json`);
			await unlink(filePath);
			deleted++;
		} catch (error) {
			if (isErrnoException(error) && error.code === "ENOENT") {
				deleted++;
			} else {
				errors.push(`Failed to delete ${hash}.json: ${error}`);
			}
		}
	}

	return { deleted, errors };
}

export function createContentStore(
	options: ContentStoreOptions = {},
): ContentStore {
	const storageDir = resolve(options.storageDir ?? "./storage/content");
	const enableMetadata = options.enableMetadata ?? true;
	const metadataStore = enableMetadata
		? createMetadataStore(options.metadataOptions)
		: undefined;

	return {
		async store(data: CrawledData): Promise<StorageResult> {
			return storeContent(data, storageDir, metadataStore);
		},

		async retrieve(url: string): Promise<ContentData | null> {
			return retrieveContent(url, storageDir);
		},

		async exists(url: string): Promise<boolean> {
			return contentExists(url, storageDir, metadataStore);
		},

		getStorageDirectory(): string {
			return storageDir;
		},

		getMetadataStore(): MetadataStore | undefined {
			return metadataStore;
		},

		async deleteContentFiles(
			hashes: string[],
		): Promise<{ deleted: number; errors: string[] }> {
			return deleteContentFiles(hashes, storageDir);
		},

		close(): void {
			if (metadataStore) {
				metadataStore.close();
			}
		},
	};
}
