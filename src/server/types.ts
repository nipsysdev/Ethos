export interface ApiListResponse<T> {
	meta: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
	results: T[];
}

export interface PublicationResponse {
	url: string;
	title: string;
	content: string;
	author?: string;
	publishedDate?: string;
	source: string;
	crawledAt: Date;
	hash: string;
}

export enum ApiErrorType {
	NOT_FOUND = "NOT_FOUND",
	VALIDATION_ERROR = "VALIDATION_ERROR",
	INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface ErrorResponse {
	error: {
		type: ApiErrorType;
		message: string;
	};
}

export interface PublicationsQueryParams {
	page?: number;
	limit?: number;
	source?: string;
	startPublishedDate?: string;
	endPublishedDate?: string;
}

export interface ServerConfig {
	port: number;
	host: string;
	pagination: {
		defaultLimit: number;
		maxLimit: number;
	};
}
