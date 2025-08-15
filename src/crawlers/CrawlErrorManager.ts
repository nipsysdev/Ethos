import type { MetadataStore } from "@/storage/MetadataStore.js";

export type CrawlErrorType = "listing" | "content";

export function categorizeErrors(errors: string[]): {
	listingErrors: string[];
	contentErrors: string[];
} {
	const listingErrors: string[] = [];
	const contentErrors: string[] = [];

	for (const error of errors) {
		if (
			error.includes("Optional field") ||
			error.includes("Required field") ||
			error.includes("missing required fields") ||
			error.includes("no extractable data")
		) {
			listingErrors.push(error);
		} else {
			contentErrors.push(error);
		}
	}

	return { listingErrors, contentErrors };
}

/**
 * Centralized error management for crawl sessions
 * Provides a consistent interface for storing and categorizing errors
 */
export class CrawlErrorManager {
	private metadataStore: MetadataStore;
	private sessionId: string;

	constructor(metadataStore: MetadataStore, sessionId: string) {
		this.metadataStore = metadataStore;
		this.sessionId = sessionId;
	}

	addErrors(type: CrawlErrorType, errors: string[]): void {
		if (errors.length === 0) return;
		this.metadataStore.addSessionErrors(this.sessionId, type, errors);
	}

	addErrorsWithCategorization(errors: string[]): void {
		if (errors.length === 0) return;

		const { listingErrors, contentErrors } = categorizeErrors(errors);

		if (listingErrors.length > 0) {
			this.addErrors("listing", listingErrors);
		}

		if (contentErrors.length > 0) {
			this.addErrors("content", contentErrors);
		}
	}

	addListingErrors(errors: string[]): void {
		this.addErrors("listing", errors);
	}

	addContentErrors(errors: string[]): void {
		this.addErrors("content", errors);
	}

	addFieldExtractionWarnings(warnings: string[]): void {
		this.addErrorsWithCategorization(warnings);
	}

	getSessionErrors(): { listingErrors: string[]; contentErrors: string[] } {
		const session = this.metadataStore.getSession(this.sessionId);
		if (!session) {
			return { listingErrors: [], contentErrors: [] };
		}

		const sessionMetadata = JSON.parse(session.metadata);
		return {
			listingErrors: sessionMetadata.listingErrors || [],
			contentErrors: sessionMetadata.contentErrors || [],
		};
	}
}
