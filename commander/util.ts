import { ExitStatus } from "typescript";
import type { ProgramGlobalOptions } from ".";

function error(err: string | Error): never {
	if (err instanceof Error) console.log(`error: ${err.message}`)
	else console.log(`error: ${err}`);
	process.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
}

function success(): never {
	process.exit(ExitStatus.Success);
}

function numberArrayFromString(input: string, separator: string): [number[], null] | [null, Error] {
	const output: number[] = [];
	const splittedInput = input.split(separator);

	for (const item of splittedInput) {
		const trimmedItem = item.trim();
		const num = Number.parseInt(trimmedItem);

		if (Number.isNaN(num)) return [null, new Error(`unable to parse "${item}" to a number`)];

		output.push(num);
	}
	return [output, null];
}

function getJiraToken(opts: ProgramGlobalOptions): string {
	if (opts.jiraToken) return opts.jiraToken;
	if (Bun.env["JIRA_TOKEN"]) return Bun.env["JIRA_TOKEN"];

	return error(`either set "JIRA_TOKEN" environment variable or the --jira-token option`)
}

function getGithubToken(opts: ProgramGlobalOptions): string {
	if (opts.ghToken) return opts.ghToken;
	if (Bun.env["GITHUB_TOKEN"]) return Bun.env["GITHUB_TOKEN"];

	return error(`either set "GITHUB_TOKEN" environment variable or the --gh-token option`)
}

export default {
	error,
	success,
	numberArrayFromString,
	getGithubToken,
	getJiraToken,
}
