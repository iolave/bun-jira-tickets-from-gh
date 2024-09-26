import { ExitStatus } from "typescript";
import environment from "./environment";
import options, { type ProgramGlobalOptions } from "./index.options";
import { Option } from "commander";

function error(err: string | Error): never {
	if (err instanceof Error) console.log(`error: ${err.message}`)
	else console.log(`error: ${err}`);
	process.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
}

function checkOneOfOptions(options: Record<string, any>, ...oneOf: Option[]): void {
	for (const i of oneOf) {
		if (i.name() in options) return;
	}

	const oneOfAsString = oneOf.map(i => i.flags).join(", ");
	const message = `specify one of the following options "${oneOfAsString}"`;

	return error(message);
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

	return error(`provide a jira cloud token via "${environment.jiraToken}" environment variable or the "${options.jiraToken.flags}" option`);
}

function getGithubToken(opts: ProgramGlobalOptions): string {
	if (opts.ghToken) return opts.ghToken;

	return error(`provide a GitHub token via "${environment.githubToken}" environment variable or the "${options.githubToken.flags}" option`);
}

export default {
	error,
	success,
	numberArrayFromString,
	getGithubToken,
	getJiraToken,
	checkOneOfOptions,
}
