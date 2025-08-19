import * as os from "node:os";
import * as path from "node:path";

const ETHOS_DIR_NAME = ".ethos";
export const CONTENT_DIR_NAME = "content";
export const METADATA_DB_NAME = "metadata.db";

export function getStoragePath(): string {
	const isRunningGlobally =
		typeof process.env.npm_execpath === "string" &&
		(process.env.npm_execpath.includes("npx") ||
			process.env.npm_execpath.includes("dlx"));

	if (isRunningGlobally) {
		return path.join(os.homedir(), ETHOS_DIR_NAME);
	} else {
		return path.join(process.cwd(), ETHOS_DIR_NAME);
	}
}

export function getContentDirPath(): string {
	return path.join(getStoragePath(), CONTENT_DIR_NAME);
}
