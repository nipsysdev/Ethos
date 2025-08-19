import * as os from "node:os";
import * as path from "node:path";

const ETHOS_DIR_NAME = ".ethos";
export const CONTENT_DIR_NAME = "content";
export const METADATA_DB_NAME = "metadata.db";

export function getStoragePath(): string {
	const isNpxContext = process.argv.some(
		(arg) =>
			arg.includes("npx") ||
			process.env.npm_lifecycle_event === "npx" ||
			process.env._?.includes("npx") ||
			import.meta.url.includes("node_modules"),
	);

	if (isNpxContext) {
		return path.join(os.homedir(), ETHOS_DIR_NAME);
	} else {
		return path.join(process.cwd(), ETHOS_DIR_NAME);
	}
}

export function getContentDirPath(): string {
	return path.join(getStoragePath(), CONTENT_DIR_NAME);
}
