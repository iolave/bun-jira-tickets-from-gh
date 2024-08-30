export type SafeReturn<T> = [T, null] | [null, Error];
export type SafePromise<T> = Promise<SafeReturn<T>>;

export async function safePromise<T>(prom: Promise<T>): SafePromise<T> {
	const res = await prom.then(v => ({ v, e: null }))
		.catch((e: Error) => ({ v: null, e }))

	if (res.e) return safeErr(res.e);
	return safeRes(res.v);
}

// @ts-expect-error Function doesnt match () => {} const
export function safeFunc<T extends Function>(fn: T, args: Parameters<T>): SafeReturn<ReturnType<T>> {
	try {
		return [fn(...args), null];
	} catch (e) {
		if (e instanceof Error) return [null, e];
		return [null, new Error(JSON.stringify(e))];
	}
}

export function safeErr(err: Error): SafeReturn<any> {
	return [null, err];
}

export function safeRes<T>(value: T): SafeReturn<T> {
	return [value, null];
}

export default {
	safeFunc,
	safePromise,
	safeRes,
	safeErr,
}
