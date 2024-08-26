export type SafePromise<T> = Promise<[T, null] | [null, Error]>;

async function safePromise<T>(prom: Promise<T>): SafePromise<T> {
	const res = await prom.then(v => ({ v, e: null }))
		.catch((e: Error) => ({ v: null, e }))

	if (res.e !== null) return [null, res.e]
	return [res.v, res.e]
}

async function error(err: Error) {
	return Promise.resolve([null, err]);
}

async function result<T>(value: T) {
	return Promise.resolve([value, null]);
}

export default {
	safePromise,
	error,
	result,
}
