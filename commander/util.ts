import { ExitStatus } from "typescript";

function error(msg: string): never {
	console.log(`error: ${msg}`);
	process.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped);
}

function success(): never {
	process.exit(ExitStatus.Success);
}

export default {
	error,
	success,
}
