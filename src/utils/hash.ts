import { createHash } from "node:crypto";

export function generateStringHash(input: string): string {
	const hash = createHash("sha1");
	hash.update(input);
	return hash.digest("hex");
}
