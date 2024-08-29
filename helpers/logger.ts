
const logger = {
	debug: (functionName: string, msg: string, info?: Record<string, any>) => {
		if (!verbose) return;

		console.log(`[DEBUG]\t${functionName.padEnd(40, " ")}\t${msg.padEnd(60, " ")}\t${!info ? "" : JSON.stringify(info)}`);
	},
	info: (functionName: string, msg: string, info?: Record<string, any>) => {
		console.log(`[INFO]\t${functionName.padEnd(40, " ")}\t${msg.padEnd(60, " ")}\t${!info ? "" : JSON.stringify(info)}`);
	},
	error: (functionName: string, msg: string, info?: Record<string, any>) => {
		console.log(`[ERROR]\t${functionName.padEnd(40, " ")}\t${msg.padEnd(60, " ")}\t${!info ? "" : JSON.stringify(info)}`);
	},
	warn: (functionName: string, msg: string, info?: Record<string, any>) => {
		console.log(`[WARN]\t${functionName.padEnd(40, " ")}\t${msg.padEnd(60, " ")}\t${!info ? "" : JSON.stringify(info)}`);
	},
	enableVerboseMode: () => { verbose = true },
	verbose: () => verbose,
};

export function safeString(s: string): string {
	if (s.length === 0) return "";
	return `${s[0]}********${s[s.length - 1] ?? "a"}`;
}

export var verbose: boolean = false;

export default logger;

