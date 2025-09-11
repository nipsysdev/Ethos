import { sources } from "@/config/sources/index.js";
import type { ProcessingPipeline } from "@/core/ProcessingPipeline";
import type { FieldExtractionStats } from "@/core/types";
import {
	ERROR_MESSAGES,
	FIELD_NAMES,
	MENU_LABELS,
	NAV_VALUES,
	PROMPT_MESSAGES,
	VALIDATION_MESSAGES,
} from "@/ui/constants";

export function checkRequiredStores(pipeline: ProcessingPipeline) {
	const metadataStore = pipeline.getMetadataStore();
	const contentStore = pipeline.getContentStore();

	if (!metadataStore || !contentStore) {
		console.log(ERROR_MESSAGES.STORAGE_NOT_AVAILABLE);
		return { error: true as const, metadataStore: null, contentStore: null };
	}

	return { error: false as const, metadataStore, contentStore };
}

export interface SourceWithStats {
	id: string;
	name: string;
	count: number;
}

/**
 * Get source display name by ID
 */
export function getSourceName(sourceId: string): string {
	const source = sources.find((s) => s.id === sourceId);
	return source?.name || sourceId;
}

/**
 * Create source list with statistics for display
 */
export function createSourceListWithStats(
	sourceStats: Array<{ source: string; count: number }>,
): SourceWithStats[] {
	return sourceStats.map((stat) => ({
		id: stat.source,
		name: getSourceName(stat.source),
		count: stat.count,
	}));
}

export function createSourceChoices(sources: SourceWithStats[]) {
	return [
		...sources.map((source) => ({
			name: source.name,
			value: source.id,
		})),
		{
			name: MENU_LABELS.BACK_TO_MAIN,
			value: NAV_VALUES.BACK,
		},
	];
}

export function createSourceChoicesWithBackLabel(
	sources: SourceWithStats[],
	backLabel: string,
) {
	return [
		...sources.map((source) => ({
			name: source.name,
			value: source.id,
		})),
		{
			name: backLabel,
			value: NAV_VALUES.BACK,
		},
	];
}

export async function promptSourceSelection(
	inquirer: typeof import("inquirer").default,
	sources: SourceWithStats[],
	message: string = PROMPT_MESSAGES.SELECT_SOURCE_TO_CRAWL,
) {
	const { selectedSource } = await inquirer.prompt([
		{
			type: "list",
			name: FIELD_NAMES.SELECTED_SOURCE,
			message,
			choices: createSourceChoices(sources),
		},
	]);

	return selectedSource;
}

export function validatePositiveIntegerOrEmpty(input: string): true | string {
	if (input === "") return true;
	const num = Number.parseInt(input, 10);
	if (Number.isNaN(num) || num <= 0) {
		return VALIDATION_MESSAGES.POSITIVE_NUMBER_OR_EMPTY;
	}
	return true;
}

export function calculateRequiredFieldIssues(
	fieldStats: FieldExtractionStats[],
) {
	return fieldStats.filter(
		(stat) => !stat.isOptional && stat.successCount < stat.totalAttempts,
	);
}
