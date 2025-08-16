import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { validateSources } from "@/core/sourceValidation";
import type {
	SourceRegistry as ISourceRegistry,
	SourceConfig,
} from "@/core/types";

export function createSourceRegistry(configPath?: string): ISourceRegistry {
	const sources: Map<string, SourceConfig> = new Map();
	const resolvedConfigPath =
		configPath || join(process.cwd(), "config", "sources.yaml");

	async function loadSources(): Promise<SourceConfig[]> {
		try {
			const configContent = await readFile(resolvedConfigPath, "utf-8");
			const config = parse(configContent);

			if (!config.sources || !Array.isArray(config.sources)) {
				throw new Error("Invalid config: 'sources' must be an array");
			}

			sources.clear();

			const validatedSources: SourceConfig[] = validateSources(config.sources);
			for (const source of validatedSources) {
				sources.set(source.id, source);
			}

			return Array.from(sources.values());
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to load sources: ${error.message}`);
			}
			throw error;
		}
	}

	async function getSource(id: string): Promise<SourceConfig | undefined> {
		if (sources.size === 0) {
			await loadSources();
		}
		return sources.get(id);
	}

	async function getAllSources(): Promise<SourceConfig[]> {
		if (sources.size === 0) {
			await loadSources();
		}
		return Array.from(sources.values());
	}

	return {
		loadSources,
		getSource,
		getAllSources,
	};
}
