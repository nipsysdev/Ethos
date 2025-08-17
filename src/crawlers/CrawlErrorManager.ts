import type { MetadataStore } from "@/storage/MetadataStore.js";

export type CrawlErrorType = "listing" | "content";

export interface CrawlErrorManager {
	addErrors(type: CrawlErrorType, errors: string[]): void;
	addErrorsWithCategorization(errors: string[]): void;
	addListingErrors(errors: string[]): void;
	addContentErrors(errors: string[]): void;
	addFieldExtractionWarnings(warnings: string[]): void;
	getSessionErrors(): { listingErrors: string[]; contentErrors: string[] };
}

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

export function createCrawlErrorManager(
	metadataStore: MetadataStore,
	sessionId: string,
): CrawlErrorManager {
	return {
		addErrors(type: CrawlErrorType, errors: string[]): void {
			if (errors.length === 0) return;
			metadataStore.addSessionErrors(sessionId, type, errors);
		},

		addErrorsWithCategorization(errors: string[]): void {
			if (errors.length === 0) return;

			const { listingErrors, contentErrors } = categorizeErrors(errors);

			if (listingErrors.length > 0) {
				this.addErrors("listing", listingErrors);
			}

			if (contentErrors.length > 0) {
				this.addErrors("content", contentErrors);
			}
		},

		addListingErrors(errors: string[]): void {
			this.addErrors("listing", errors);
		},

		addContentErrors(errors: string[]): void {
			this.addErrors("content", errors);
		},

		addFieldExtractionWarnings(warnings: string[]): void {
			this.addErrorsWithCategorization(warnings);
		},

		getSessionErrors(): { listingErrors: string[]; contentErrors: string[] } {
			const session = metadataStore.getSession(sessionId);
			if (!session) {
				return { listingErrors: [], contentErrors: [] };
			}

			const sessionMetadata = JSON.parse(session.metadata);
			return {
				listingErrors: sessionMetadata.listingErrors || [],
				contentErrors: sessionMetadata.contentErrors || [],
			};
		},
	};
}
