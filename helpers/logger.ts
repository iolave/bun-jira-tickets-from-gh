
const logger = {
	debug: (functionName: string, msg: string, info?: Record<string, any>) => {
		if (!verbose) return;
		console.log(buildLogEntry("DEBUG", functionName, msg, info));
	},
	info: (functionName: string, msg: string, info?: Record<string, any>) => {
		console.log(buildLogEntry("INFO", functionName, msg, info));
	},
	error: (functionName: string, msg: string, info?: Record<string, any>) => {
		console.log(buildLogEntry("ERROR", functionName, msg, info));
	},
	warn: (functionName: string, msg: string, info?: Record<string, any>) => {
		console.log(buildLogEntry("WARN", functionName, msg, info));
	},
	enableVerboseMode: () => { verbose = true },
	verbose: () => verbose,
};

function buildLogEntry(type: string, functionName: string, msg: string, info?: Record<string, any>): string {
	const date = new Date();
	const dateString = `${date.getFullYear()}-${date.getMonth().toString().padStart(2, "0")}-${date.getDay().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
	return `[${dateString}][${type}]\t${functionName.padEnd(40, " ")}\t${msg.padEnd(60, " ")}\t${!info ? "" : JSON.stringify(info)}`
}

export function safeString(s: string): string {
	if (s.length === 0) return "";
	return `${s[0]}********${s[s.length - 1] ?? "a"}`;
}

export var verbose: boolean = false;

export default logger;

