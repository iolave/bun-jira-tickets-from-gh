import { safeErr, safePromise, safeRes, type SafePromise } from "../../helpers/functions";

const buildTransitionIssueBody = (transitionId: number) => JSON.stringify({
	transition: { id: `${transitionId}` }
});

async function transitionIssue(token: string, subdomain: string, issueKey: string, transitionId: number): Promise<Error | undefined> {
	const headers = new Headers();
	headers.append("authorization", `Basic ${token}`);
	headers.append("content-type", `application/json`);

	const requestInit: RequestInit = {
		method: "POST",
		headers,
		body: buildTransitionIssueBody(transitionId),
	};

	const url = new URL(`https://${subdomain}.atlassian.net/rest/api/3/issue/${issueKey}/transitions`);

	const [fetchResult, fetchErr] = await safePromise(fetch(url, requestInit));

	if (fetchErr) return fetchErr;

	if (fetchResult.status !== 204) {
		const [resText, textErr] = await safePromise(fetchResult.text());

		if (textErr) return textErr;

		return new Error(resText);
	}
	return undefined;
}

function buildIssueBody(args: { projectKey: string, summary: string, issueName: string, accountId?: string, content: any }): string {
	return JSON.stringify({
		fields: {
			issuetype: { name: args.issueName },
			project: { key: args.projectKey },
			fixVersions: [],
			priority: { id: "3" },
			labels: [],
			assignee: { accountId: args.accountId },
			components: [],
			description: { type: "doc", version: 1, content: args.content },
			attachment: [],
			summary: args.summary,
		}
	});
}

async function create(args: { token: string, subdomain: string, projectKey: string, summary: string, issueName: string, accountId?: string, content: any }): SafePromise<{ issueId: string, issueKey: string, issueUrl: string }> {
	const { token, subdomain, projectKey, summary, issueName, accountId, content } = args;
	const headers = new Headers();
	headers.append("authorization", `Basic ${token}`);
	headers.append("content-type", `application/json`);

	const requestInit: RequestInit = {
		method: "POST",
		headers,
		body: buildIssueBody({
			projectKey,
			summary: `[JTFG] ${summary}`,
			issueName,
			accountId,
			content,
		}),
	};

	const url = new URL(`https://${subdomain}.atlassian.net/rest/api/3/issue`);

	const [fetchResult, err] = await safePromise(fetch(url, requestInit));

	if (err) return safeErr(err);

	if (fetchResult.status !== 201) {
		const [resText, textErr] = await safePromise(fetchResult.text());

		if (textErr) return safeErr(textErr);
		return safeErr(new Error(resText));

	}

	const [fetchJson, fetchJsonErr] = await safePromise(fetchResult.json());

	if (fetchJsonErr) return safeErr(fetchJsonErr);

	return safeRes({
		issueId: fetchJson?.id ?? "",
		issueKey: fetchJson?.key ?? "",
		issueUrl: `https://${subdomain}.atlassian.net/browse/${fetchJson?.key ?? ""}`,
	});
}



export default {
	create,
	transitionIssue,
}
