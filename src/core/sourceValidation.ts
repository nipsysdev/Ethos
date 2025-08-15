import { CRAWLER_TYPES, type SourceConfig } from "@/core/types";

export const validateSource = (source: unknown): SourceConfig => {
	if (!source || typeof source !== "object") {
		throw new Error("Source must be an object");
	}

	const s = source as Record<string, unknown>;

	if (!s.id || typeof s.id !== "string") {
		throw new Error("Source must have a valid 'id' field");
	}
	if (!s.name || typeof s.name !== "string") {
		throw new Error(`Source '${s.id}' must have a valid 'name' field`);
	}
	if (s.type !== CRAWLER_TYPES.LISTING) {
		throw new Error(
			`Source '${s.id}' must have type '${CRAWLER_TYPES.LISTING}' (only supported type in Phase 1)`,
		);
	}
	if (!s.listing || typeof s.listing !== "object") {
		throw new Error(
			`Source '${s.id}' must have a valid 'listing' configuration`,
		);
	}

	const listing = s.listing as Record<string, unknown>;
	if (!listing.url || typeof listing.url !== "string") {
		throw new Error(`Source '${s.id}' listing must have a valid 'url' field`);
	}
	if (!listing.items || typeof listing.items !== "object") {
		throw new Error(
			`Source '${s.id}' listing must have an 'items' configuration`,
		);
	}

	const items = listing.items as Record<string, unknown>;
	if (
		!items.container_selector ||
		typeof items.container_selector !== "string"
	) {
		throw new Error(
			`Source '${s.id}' items must have a 'container_selector' field`,
		);
	}
	if (!items.fields || typeof items.fields !== "object") {
		throw new Error(
			`Source '${s.id}' items must have a 'fields' configuration`,
		);
	}

	if (!s.content || typeof s.content !== "object") {
		throw new Error(`Source '${s.id}' must have a 'content' configuration`);
	}

	const content = s.content as Record<string, unknown>;
	if (
		!content.container_selector ||
		typeof content.container_selector !== "string"
	) {
		throw new Error(
			`Source '${s.id}' content must have a 'container_selector' field`,
		);
	}
	if (!content.fields || typeof content.fields !== "object") {
		throw new Error(
			`Source '${s.id}' content must have a 'fields' configuration`,
		);
	}

	return source as SourceConfig;
};

export const validateSources = (sources: unknown[]): SourceConfig[] => {
	if (!Array.isArray(sources)) {
		throw new Error("Sources must be an array");
	}

	return sources.map((source, index) => {
		try {
			return validateSource(source);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Source at index ${index} is invalid: ${error.message}`,
				);
			}
			throw error;
		}
	});
};
