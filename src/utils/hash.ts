import { createHash } from "node:crypto";

export function generateStringHash(input: string): string {
	const hash = createHash("sha1");
	hash.update(input);
	return hash.digest("hex");
}

export function isHashValid(hash: string): boolean {
	// SHA1 hashes are 40 characters long and contain only hexadecimal characters
	return /^[a-f0-9]{40}$/i.test(hash);
}
