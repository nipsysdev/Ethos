import type { ProcessingPipeline, SourceRegistry } from "@/index.js";
import {
	CLEAN_LABELS,
	ERROR_MESSAGES,
	FIELD_NAMES,
	INFO_MESSAGES,
	MENU_LABELS,
	NAV_VALUES,
	PROMPT_MESSAGES,
} from "../constants.js";
import {
	checkRequiredStores,
	createEnhancedSourceList,
	promptSourceSelection,
} from "../utils.js";

/**
 * Handle the clean storage command
 */
export async function handleClean(
	sourceRegistry: SourceRegistry,
	pipeline: ProcessingPipeline,
): Promise<"main" | "exit"> {
	try {
		const storeCheck = checkRequiredStores(pipeline);
		if (storeCheck.error) {
			return NAV_VALUES.MAIN;
		}
		const { metadataStore, contentStore } = storeCheck;

		// Get all sources with counts
		const sources = metadataStore.getSources();

		if (sources.length === 0) {
			console.log(ERROR_MESSAGES.NO_CONTENT_FOUND);
			return NAV_VALUES.MAIN;
		}

		// Enhance sources with full names from source registry
		const sourcesWithNames = await createEnhancedSourceList(
			sources,
			sourceRegistry,
		);

		while (true) {
			// Let user select source using utility function
			const inquirer = (await import("inquirer")).default;
			const selectedSource = await promptSourceSelection(
				inquirer,
				sourcesWithNames,
				PROMPT_MESSAGES.SELECT_SOURCE_TO_CLEAN,
			);

			if (selectedSource === NAV_VALUES.BACK) {
				return NAV_VALUES.MAIN;
			} // Find the selected source with its name
			const selectedSourceData = sourcesWithNames.find(
				(source) => source.id === selectedSource,
			);
			const sourceName = selectedSourceData?.name || selectedSource;

			// Get session count for the selected source
			const sessionCount = metadataStore.countSessionsBySource(selectedSource);
			const contentCount = metadataStore.countBySource(selectedSource);

			while (true) {
				// Let user select what to clean
				const { cleanType } = await inquirer.prompt([
					{
						type: "list",
						name: FIELD_NAMES.CLEAN_TYPE,
						message: PROMPT_MESSAGES.SELECT_CLEAN_TYPE,
						choices: [
							{
								name: `Delete all content for ${sourceName} (${contentCount} items)`,
								value: CLEAN_LABELS.DELETE_CONTENT,
							},
							{
								name: `Delete all sessions for ${sourceName} (${sessionCount} sessions)`,
								value: CLEAN_LABELS.DELETE_SESSIONS,
							},
							{
								name: `Delete everything for ${sourceName} (${contentCount} items + ${sessionCount} sessions)`,
								value: CLEAN_LABELS.DELETE_EVERYTHING,
							},
							{
								name: MENU_LABELS.BACK_TO_SOURCE_SELECTION,
								value: NAV_VALUES.BACK,
							},
						],
					},
				]);

				if (cleanType === NAV_VALUES.BACK) {
					break; // Go back to source selection
				}

				// Confirm deletion
				let confirmMessage = "";
				switch (cleanType) {
					case CLEAN_LABELS.DELETE_CONTENT:
						confirmMessage = `Delete ${contentCount} content items from ${sourceName}?`;
						break;
					case CLEAN_LABELS.DELETE_SESSIONS:
						confirmMessage = `Delete ${sessionCount} sessions from ${sourceName}?`;
						break;
					case CLEAN_LABELS.DELETE_EVERYTHING:
						confirmMessage = `Delete ${contentCount} content items and ${sessionCount} sessions from ${sourceName}?`;
						break;
				}

				const { confirmed } = await inquirer.prompt([
					{
						type: "confirm",
						name: FIELD_NAMES.CONFIRMED,
						message: confirmMessage,
						default: false,
					},
				]);

				if (!confirmed) {
					console.log(INFO_MESSAGES.CLEANING_CANCELLED);
					continue; // Go back to clean type selection
				}

				// Perform the deletion
				console.log("Cleaning...");

				try {
					if (
						cleanType === CLEAN_LABELS.DELETE_CONTENT ||
						cleanType === CLEAN_LABELS.DELETE_EVERYTHING
					) {
						// Get content hashes before deleting from database
						const hashes =
							metadataStore.getContentHashesBySource(selectedSource);

						// Delete from database first
						const deletedRows =
							metadataStore.deleteContentBySource(selectedSource);
						console.log(
							`Deleted ${deletedRows} ${INFO_MESSAGES.DELETED_CONTENT_RECORDS}`,
						);

						// Delete files from disk
						const fileResult = await contentStore.deleteContentFiles(hashes);
						console.log(
							`Deleted ${fileResult.deleted} ${INFO_MESSAGES.DELETED_CONTENT_FILES}`,
						);

						if (fileResult.errors.length > 0) {
							console.log("Some file deletion errors occurred:");
							for (const error of fileResult.errors) {
								console.log(`  ${error}`);
							}
						}
					}

					if (
						cleanType === CLEAN_LABELS.DELETE_SESSIONS ||
						cleanType === CLEAN_LABELS.DELETE_EVERYTHING
					) {
						const deletedSessions =
							metadataStore.deleteSessionsBySource(selectedSource);
						console.log(
							`Deleted ${deletedSessions} ${INFO_MESSAGES.DELETED_SESSIONS}`,
						);
					}

					console.log("Cleaning completed successfully!");
					return NAV_VALUES.MAIN; // Return to main menu after successful cleaning
				} catch (error) {
					console.log(`Cleaning failed: ${error}`);
					// Continue the loop to allow user to try again or go back
				}
			}
		}
	} catch (error) {
		console.log(`Error during cleaning: ${error}`);
		return NAV_VALUES.MAIN;
	}
}
