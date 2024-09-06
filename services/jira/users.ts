import { Err, Ok, safePromise, type PResult } from "@iolave/utils/functions";
import logger, { safeString } from "../../helpers/logger";

const logName = "jira.users";

type JiraUser = { accountId: string, accountType: string, emailAddress: string, displayName: string };
async function searchByEmail(token: string, subdomain: string, email: string): PResult<JiraUser> {
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

	if (err) return Err(err);

	if (fetchResult.status !== 200) {
		const [resText, textErr] = await safePromise(fetchResult.text());

		if (textErr) return Err(textErr);

		return Err(new Error(resText));
	}

	const [fetchJson, fetchJsonErr] = await safePromise<JiraUser[]>(fetchResult.json());

	if (fetchJsonErr) return Err(fetchJsonErr);
	const user = fetchJson.at(0);

	if (!user) return Err(new Error(`user not found for email address "${email}"`));

	return Ok(user);
}

export default {
	searchByEmail,
}
