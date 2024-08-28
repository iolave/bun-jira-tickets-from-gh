import { ExitStatus } from "typescript";

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

export default {
	error,
	success,
	numberArrayFromString,
}
