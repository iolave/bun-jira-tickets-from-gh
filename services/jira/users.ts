import logger, { safeString } from "../../helpers/logger";
import promises, { type SafePromise } from "../../helpers/promises";
import sync from "../../helpers/sync";

const logName = "jira.users";

type JiraUser = { accountId: string, accountType: string, emailAddress: string, displayName: string };
async function searchByEmail(token: string, subdomain: string, email: string): SafePromise<JiraUser> {
	const headers = new Headers();
	headers.append("authorization", `Basic ${token}`);
	headers.append("content-type", `application/json`);

	const requestInit: RequestInit = {
		method: "GET",
		headers,
	};

	const url = new URL(`https://${subdomain}.atlassian.net/rest/api/3/user/search`);
	url.searchParams.set("query", email);

	logger.debug(logName, "sending searchByEmail request", { token: safeString(token), subdomain, email });
	const [fetchResult, err] = await promises.safePromise(fetch(url, requestInit));

	if (err) return [null, err];

	if (fetchResult.status !== 200) {
		const [resText, textErr] = await promises.safePromise(fetchResult.text());

		if (textErr) return [null, textErr];

		const [json, parseErr] = sync.safeFunc(JSON.parse, [resText]);
		if (parseErr) return [null, new Error("Unable to create new issue", { cause: parseErr })];

		return [null, json]
	}

	const [fetchJson, fetchJsonErr] = await promises.safePromise<JiraUser[]>(fetchResult.json());

	if (fetchJsonErr) return [null, fetchJsonErr];
	const user = fetchJson.at(0);

	if (!user) return [null, new Error(`user not found for email address "${email}"`)];

	return [user, null];
}

export default {
	searchByEmail,
}
