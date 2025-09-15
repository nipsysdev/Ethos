import type { MetadataStore } from "@/storage/MetadataStore.js";

export type CrawlErrorType = "listing" | "content";

export interface CrawlErrorManager {
	addErrors(type: CrawlErrorType, errors: string[]): void;
	addListingErrors(errors: string[]): void;
	addContentErrors(errors: string[]): void;
	getSessionErrors(): { listingErrors: string[]; contentErrors: string[] };
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

		addListingErrors(errors: string[]): void {
			this.addErrors("listing", errors);
		},

		addContentErrors(errors: string[]): void {
			this.addErrors("content", errors);
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
