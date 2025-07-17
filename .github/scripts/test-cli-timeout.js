#!/usr/bin/env node

const { exec } = require("child_process");

// Get command from arguments
const command = process.argv.slice(2).join(" ");
const timeoutMs = 30000; // 30 seconds

if (!command) {
	console.error("Usage: node test-cli-timeout.js <command>");
	process.exit(1);
}

console.log(`Running: ${command}`);

const child = exec(command);

// Set up timeout
const timeout = setTimeout(() => {
	console.log(`Command timed out after ${timeoutMs / 1000} seconds`);
	child.kill();
	process.exit(124); // Same exit code as timeout command
}, timeoutMs);

// Handle child process exit
child.on("exit", (code) => {
	clearTimeout(timeout);
	console.log(`Command exited with code: ${code}`);
	process.exit(code);
});

// Forward stdout/stderr
child.stdout.on("data", (data) => {
	process.stdout.write(data);
});

child.stderr.on("data", (data) => {
	process.stderr.write(data);
});
