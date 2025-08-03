import { spawn } from "node:child_process";
import type { ProcessingResult } from "@/index.js";

async function isLessAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		// Use appropriate command based on platform
		const isWindows = process.platform === "win32";
		const command = isWindows ? "where" : "which";
		const args = ["less"];

		const testProcess = spawn(command, args, {
			stdio: "ignore",
		});
		testProcess.on("close", (code) => {
			resolve(code === 0);
		});
		testProcess.on("error", () => {
			resolve(false);
		});
	});
}

export async function showExtractedData(
	result: ProcessingResult,
): Promise<void> {
	const inquirer = (await import("inquirer")).default;

	// Filter items that have storage info
	const storedItems = result.data.filter((item) => item.storage);

	if (storedItems.length === 0) {
		console.log("No stored files found.");
		return;
	}

	// Create choices with titles and file info
	const choices = storedItems.map((item, index) => ({
		name: `${index + 1}. ${item.title}`,
		value: item.storage?.path || "",
		short: item.title,
	}));

	choices.push({
		name: "← Back to menu",
		value: "back",
		short: "Back",
	});

	const { selectedFile } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedFile",
			message: `Select an item to view (${storedItems.length} files):`,
			choices,
			pageSize: 15,
		},
	]);

	if (selectedFile === "back") {
		return;
	}

	try {
		if (await isLessAvailable()) {
			const less = spawn("less", ["-R", selectedFile], {
				stdio: "inherit",
			});

			await new Promise<void>((resolve, reject) => {
				less.on("close", (code) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`less exited with code ${code}`));
					}
				});

				less.on("error", (err) => {
					console.error("Error opening less viewer:", err.message);
					reject(err);
				});
			});
		} else {
			console.log(
				"Less viewer not available. Please install 'less' to view files.",
			);
			console.log(`File location: ${selectedFile}`);
		}
	} catch (error) {
		console.error(
			"Error viewing file:",
			error instanceof Error ? error.message : error,
		);
	}

	// Loop back to file selection
	await showExtractedData(result);
}
