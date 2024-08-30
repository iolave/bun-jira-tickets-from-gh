import { safeErr, safePromise, safeRes, type SafePromise } from "../../helpers/functions";
import logger, { safeString } from "../../helpers/logger";

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
	const [fetchResult, err] = await safePromise(fetch(url, requestInit));

	if (err) return safeErr(err);

	if (fetchResult.status !== 200) {
		const [resText, textErr] = await safePromise(fetchResult.text());

		if (textErr) return safeErr(textErr);

		return safeErr(new Error(resText));
	}

	const [fetchJson, fetchJsonErr] = await safePromise<JiraUser[]>(fetchResult.json());

	if (fetchJsonErr) return safeErr(fetchJsonErr);
	const user = fetchJson.at(0);

	if (!user) return safeErr(new Error(`user not found for email address "${email}"`));

	return safeRes(user);
}

export default {
	searchByEmail,
}
