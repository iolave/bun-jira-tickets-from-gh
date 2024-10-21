import { Err, Ok, type PResult, type Result } from "@iolave/utils/results";
import { safePromise } from "@iolave/utils/functions";

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

function buildIssueBody(args: { projectKey: string, summary: string, issueName: string, accountId?: string, content: any, storyPointsField?: { name: string, points: number } }): string {
	const fields = {
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

	if (args.storyPointsField)
		Object.assign(fields, { [`${args.storyPointsField.name}`]: args.storyPointsField.points });

	return JSON.stringify({ fields });
}

type CreateResponse = {
	issueId: string,
	issueKey: string,
	issueUrl: string,
}

type CreateOptions = {
	token: string,
	subdomain: string,
	projectKey: string,
	summary: string,
	issueName: string,
	accountId?: string,
	content: any,
	storyPointsField?: { name: string, points: number },
}

async function create(args: CreateOptions): Promise<Result<CreateResponse>> {
	const { token, subdomain, projectKey, summary, issueName, accountId, content, storyPointsField } = args;
	const headers = new Headers();
	headers.append("authorization", `Basic ${token}`);
	headers.append("content-type", `application/json`);

	const requestInit: RequestInit = {
		method: "POST",
		headers,
		body: buildIssueBody({
			projectKey,
			summary,
			issueName,
			accountId,
			content,
			storyPointsField,
		}),
	};

	const url = new URL(`https://${subdomain}.atlassian.net/rest/api/3/issue`);

	const [fetchResult, err] = await safePromise(fetch(url, requestInit));

	if (err) return Err(err);

	if (fetchResult.status !== 201) {
		const [resText, textErr] = await safePromise(fetchResult.text());

		if (textErr) return Err(textErr);
		return Err(new Error(resText));

	}

	const [fetchJson, fetchJsonErr] = await safePromise(fetchResult.json());

	if (fetchJsonErr) return Err(fetchJsonErr);

	return Ok({
		issueId: fetchJson?.id ?? "",
		issueKey: fetchJson?.key ?? "",
		issueUrl: `https://${subdomain}.atlassian.net/browse/${fetchJson?.key ?? ""}`,
	});
}



export default {
	create,
	transitionIssue,
}
