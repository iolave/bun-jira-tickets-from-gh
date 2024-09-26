import { Err, Ok, type PResult } from "@iolave/utils/results";
import { safePromise } from "@iolave/utils/functions";
import projects from "./projects";
import type { IProjectItemUpdateField } from "./update-project-item-field.query";

export default class GithubClient {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	public projects = {
		listOrganizationProjects: (org: string) => projects.listOrganizationProjects(this.token, org),
		listUserProjects: (user: string) => projects.listUserProjects(this.token, user),
		getProjectFields: (id: string) => projects.getProjectFields(this.token, id),
		getProjectItems: (id: string) => projects.getProjectItems(this.token, id),
		getProjectItems2: (id: string) => projects.getProjectItems2(this.token, id),
		updateProjectItemField: (args: { projectId: string, fieldId: string, itemId: string, newValue: IProjectItemUpdateField }) => projects.updateProjectItemField({
			token: this.token,
			projectId: args.projectId,
			fieldId: args.fieldId,
			itemId: args.itemId,
			newValue: args.newValue,
		}),
	}
}

export async function sendGqlRequest<T>(token: string, query: string): PResult<Partial<T>> {
	const headers = new Headers();
	headers.append("authorization", `Bearer ${token}`);

	const body = JSON.stringify({ query })

	const requestInit: RequestInit = {
		method: "POST",
		headers,
		body,
	};

	const url = new URL("https://api.github.com/graphql");

	const [fetchResult, err] = await safePromise(fetch(url, requestInit));

	if (err) return Err(err);

	if (fetchResult.status !== 200) {
		const [resText, textErr] = await safePromise(fetchResult.text());

		if (textErr) return Err(textErr);
		return Err(new Error(resText));
	}

	const [fetchJson, fetchJsonErr] = await safePromise<Partial<T>>(fetchResult.json());
	if (fetchJsonErr) return Err(fetchJsonErr);

	return Ok(fetchJson);
}

