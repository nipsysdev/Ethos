module.exports = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat",
				"fix",
				"docs",
				"style",
				"refactor",
				"perf",
				"test",
				"build",
				"ci",
				"chore",
				"revert",
				"deps",
			],
		],
		"subject-case": [2, "never", ["pascal-case", "upper-case"]],
		"subject-max-length": [2, "always", 72],
		"body-max-line-length": [2, "always", 100],
	},
};
