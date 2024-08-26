import { ExitStatus } from "typescript";

function error(err: string | Error): never {
	if (err instanceof Error) console.log(`error: ${err.message}`)
	else console.log(`error: ${err}`);
	process.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
}

function success(): never {
	process.exit(ExitStatus.Success);
}

export default {
	error,
	success,
}
