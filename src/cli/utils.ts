/**
 * CLI Utility Functions
 *
 * Reusable utility functions for common CLI patterns to reduce code duplication.
 */

import type { ProcessingPipeline } from "../core/ProcessingPipeline.js";
import type { SourceRegistry } from "../core/SourceRegistry.js";
import {
	ERROR_MESSAGES,
	FIELD_NAMES,
	MENU_LABELS,
	NAV_VALUES,
	PROMPT_MESSAGES,
	VALIDATION_MESSAGES,
} from "./constants.js";

export function checkRequiredStores(pipeline: ProcessingPipeline) {
	const metadataStore = pipeline.getMetadataStore();
	const contentStore = pipeline.getContentStore();

	if (!metadataStore || !contentStore) {
		console.log(ERROR_MESSAGES.STORAGE_NOT_AVAILABLE);
		return { error: true as const, metadataStore: null, contentStore: null };
	}

	return { error: false as const, metadataStore, contentStore };
}

export function checkMetadataStore(pipeline: ProcessingPipeline) {
	const metadataStore = pipeline.getMetadataStore();

	if (!metadataStore) {
		console.log(ERROR_MESSAGES.METADATA_STORE_NOT_AVAILABLE);
		return { error: true as const, metadataStore: null };
	}

	return { error: false as const, metadataStore };
}

export interface EnhancedSource {
	id: string;
	name: string;
	count: number;
}

export async function createEnhancedSourceList(
	sources: Array<{ source: string; count: number }>,
	sourceRegistry: SourceRegistry,
): Promise<EnhancedSource[]> {
	return Promise.all(
		sources.map(async (source) => {
			const sourceConfig = await sourceRegistry.getSource(source.source);
			return {
				id: source.source,
				name: sourceConfig?.name || source.source, // Fallback to ID if name not found
				count: source.count,
			};
		}),
	);
}

export function createSourceChoices(sources: EnhancedSource[]) {
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
	sources: EnhancedSource[],
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
	sources: EnhancedSource[],
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
