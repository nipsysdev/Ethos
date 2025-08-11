import type { MetadataStore } from "@/storage/MetadataStore.js";

/**
 * Error types for crawl operations
 */
export type CrawlErrorType = "listing" | "content";

/**
 * Interface for error categorization logic
 */
export interface ErrorCategorizer {
	categorizeErrors(errors: string[]): {
		listingErrors: string[];
		contentErrors: string[];
	};
}

/**
 * Default error categorizer based on content patterns
 */
export class PatternBasedErrorCategorizer implements ErrorCategorizer {
	categorizeErrors(errors: string[]): {
		listingErrors: string[];
		contentErrors: string[];
	} {
		const listingErrors: string[] = [];
		const contentErrors: string[] = [];

		for (const error of errors) {
			// Check for listing-specific patterns first
			if (
				error.includes("Optional field") ||
				error.includes("Required field") ||
				error.includes("missing required fields") ||
				error.includes("no extractable data")
			) {
				listingErrors.push(error);
			}
			// Check for content-specific patterns
			else if (
				error.includes("content") ||
				error.includes("extraction") ||
				error.includes("Content extraction") ||
				error.includes("Content page") ||
				error.includes("Content parsing")
			) {
				contentErrors.push(error);
			}
			// If no specific pattern matches, categorize as content error by default
			else {
				contentErrors.push(error);
			}
		}

		return { listingErrors, contentErrors };
	}
}

/**
 * Centralized error management for crawl sessions
 * Provides a consistent interface for storing and categorizing errors
 */
export class CrawlErrorManager {
	private metadataStore: MetadataStore;
	private sessionId: string;
	private errorCategorizer: ErrorCategorizer;

	constructor(
		metadataStore: MetadataStore,
		sessionId: string,
		errorCategorizer: ErrorCategorizer = new PatternBasedErrorCategorizer(),
	) {
		this.metadataStore = metadataStore;
		this.sessionId = sessionId;
		this.errorCategorizer = errorCategorizer;
	}

	/**
	 * Add errors of a specific type directly
	 */
	addErrors(type: CrawlErrorType, errors: string[]): void {
		if (errors.length === 0) return;
		this.metadataStore.addSessionErrors(this.sessionId, type, errors);
	}

	/**
	 * Add errors with automatic categorization
	 */
	addErrorsWithCategorization(errors: string[]): void {
		if (errors.length === 0) return;

		const { listingErrors, contentErrors } =
			this.errorCategorizer.categorizeErrors(errors);

		if (listingErrors.length > 0) {
			this.addErrors("listing", listingErrors);
		}

		if (contentErrors.length > 0) {
			this.addErrors("content", contentErrors);
		}
	}

	/**
	 * Add listing-specific errors (for filtered items, missing fields, etc.)
	 */
	addListingErrors(errors: string[]): void {
		this.addErrors("listing", errors);
	}

	/**
	 * Add content extraction errors
	 */
	addContentErrors(errors: string[]): void {
		this.addErrors("content", errors);
	}

	/**
	 * Add field extraction warnings with automatic categorization
	 */
	addFieldExtractionWarnings(warnings: string[]): void {
		this.addErrorsWithCategorization(warnings);
	}

	/**
	 * Get all errors for the session from the database
	 */
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
