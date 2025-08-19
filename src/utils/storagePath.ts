import * as path from "node:path";

const ETHOS_DIR_NAME = ".ethos";
export const CONTENT_DIR_NAME = "content";
export const METADATA_DB_NAME = "metadata.db";

export function getStoragePath(): string {
	return path.join(process.cwd(), ETHOS_DIR_NAME);
}

export function getContentDirPath(): string {
	return path.join(getStoragePath(), CONTENT_DIR_NAME);
}
