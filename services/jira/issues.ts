import promises, { type SafePromise } from "../../helpers/promises";
import sync from "../../helpers/sync";

function buildIssueBody(projectKey: string, summary: string, issueName: string, accountId: string, content: any): string {
	return JSON.stringify({
		fields: {
			issuetype: { name: issueName },
			project: { key: projectKey },
			fixVersions: [],
			priority: { id: "3" },
			labels: [],
			assignee: { accountId },
			components: [],
			description: { type: "doc", version: 1, content: content },
			attachment: [],
			summary,
		}
	});

}

async function create(token: string, subdomain: string, projectKey: string, summary: string, issueName: string, accountId: string, content: any): SafePromise<{ issueId: string, issueKey: string, issueUrl: string }> {
	const headers = new Headers();
	headers.append("authorization", `Basic ${token}`);
	headers.append("content-type", `application/json`);

	const requestInit: RequestInit = {
		method: "POST",
		headers,
		body: buildIssueBody(projectKey, `[JTFG] ${summary}`, issueName, accountId, content),
	};

	const url = new URL(`https://${subdomain}.atlassian.net/rest/api/3/issue`);

	const [fetchResult, err] = await promises.safePromise(fetch(url, requestInit));

	if (err) return [null, err];

	if (fetchResult.status !== 201) {
		const [resText, textErr] = await promises.safePromise(fetchResult.text());

		if (textErr) return [null, textErr];

		const [json, parseErr] = sync.safeFunc(JSON.parse, [resText]);
		if (parseErr) return [null, new Error("Unable to create new issue", { cause: parseErr })];

		return [null, json]
	}

	const [fetchJson, fetchJsonErr] = await promises.safePromise(fetchResult.json());

	if (fetchJsonErr) return [null, fetchJsonErr];

	return [{
		issueId: fetchJson?.id ?? "",
		issueKey: fetchJson?.key ?? "",
		issueUrl: `https://${subdomain}.atlassian.net/browse/${fetchJson?.key ?? ""}`,
	}, null]
}

export default {
	create,
}
