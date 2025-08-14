/**
 * CLI Constants and Labels
 *
 * Centralized constants for reusable CLI labels, messages, and navigation values
 * to maintain consistency across the application.
 */

export const NAV_VALUES = {
	BACK: "back",
	EXIT: "exit",
	MAIN: "main",
	CRAWL: "crawl",
	VIEW: "view",
	ERRORS: "errors",
	SESSIONS: "sessions",
} as const;

export const MENU_LABELS = {
	BACK_TO_MAIN: "Back to main menu",
	BACK_TO_SOURCE_SELECTION: "Back to source selection",
	BACK_TO_SESSIONS_LIST: "Back to sessions list",
	BACK_TO_MENU: "Back to menu",
	EXIT_PROGRAM: "Exit the program",
} as const;

export const CLEAN_LABELS = {
	DELETE_CONTENT: "content",
	DELETE_SESSIONS: "sessions",
	DELETE_EVERYTHING: "both",
} as const;

export const ERROR_MESSAGES = {
	STORAGE_NOT_AVAILABLE: "Error: Storage not available",
	METADATA_STORE_NOT_AVAILABLE: "Error: Metadata store not available",
	NO_CONTENT_FOUND: "No content found. Nothing to clean!",
	NO_SESSIONS_FOUND:
		"No crawl sessions found. Start a crawl to create your first session!",
	NO_ERRORS_FOUND: "No errors found during crawling!",
	NO_STORED_FILES_FOUND: "No stored files found.",
	NO_SOURCES_CONFIGURED:
		"No sources configured. Please add sources to config/sources.yaml",
	SOURCE_NOT_FOUND: "Source not found",
	CRAWL_FAILED: "Crawl failed",
} as const;

export const INFO_MESSAGES = {
	CRAWL_COMPLETED: "Crawl completed successfully!",
	CLEANING_CANCELLED: "Cleaning cancelled.",
	CRAWLING: "Crawling",
	DELETED_CONTENT_RECORDS: "content records from database",
	DELETED_CONTENT_FILES: "content files from disk",
	DELETED_SESSIONS: "sessions from database",
} as const;

export const PROMPT_MESSAGES = {
	SELECT_SOURCE_TO_CRAWL: "Select a source to crawl:",
	SELECT_SOURCE_TO_CLEAN: "Select a source to clean:",
	SELECT_CLEAN_TYPE: "What would you like to clean?",
	SELECT_CRAWL_SESSION: "Select a crawl session to view",
	MAX_PAGES_TO_CRAWL: "Max pages to crawl (leave empty for no limit):",
	STOP_ON_ALL_DUPLICATES:
		"Stop crawling when all items on a page are already in database?",
	RECRAWL_EXISTING: "Re-crawl existing content?",
} as const;

export const FIELD_NAMES = {
	SELECTED_SOURCE_ID: "selectedSourceId",
	SELECTED_SOURCE: "selectedSource",
	SELECTED_SESSION_ID: "selectedSessionId",
	CLEAN_TYPE: "cleanType",
	CONFIRMED: "confirmed",
	MAX_PAGES: "maxPages",
	STOP_ON_ALL_DUPLICATES: "stopOnAllDuplicates",
	RECRAWL_EXISTING: "reCrawlExisting",
} as const;

export const VALIDATION_MESSAGES = {
	POSITIVE_NUMBER_OR_EMPTY:
		"Please enter a positive number greater than 0 or leave empty",
} as const;
