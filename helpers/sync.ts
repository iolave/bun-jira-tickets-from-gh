type SafeFunc<T> = [null, Error] | [T, null];

// @ts-ignore
function safeFunc<T extends Function>(fn: T, args: Parameters<T>): SafeFunc<ReturnType<T>> {
	try {
		return [fn(...args), null];
	} catch (e) {
		if (e instanceof Error) return [null, e];
		return [null, new Error(JSON.stringify(e))];
	}
}

export default {
	safeFunc
}
