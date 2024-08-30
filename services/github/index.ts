import { safeErr, safePromise, safeRes, type SafePromise } from "../../helpers/functions";
import projects from "./projects";
import type { IProjectItemUpdateField } from "./update-project-item-field.query";

export default class GithubClient {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	public projects = {
		listOrganizationProjects: (org: string) => projects.listOrganizationProjects(this.token, org),
		getProjectFields: (id: string) => projects.getProjectFields(this.token, id),
		getProjectItems: (id: string) => projects.getProjectItems(this.token, id),
		updateProjectItemField: (args: { projectId: string, fieldId: string, itemId: string, newValue: IProjectItemUpdateField }) => projects.updateProjectItemField({
			token: this.token,
			projectId: args.projectId,
			fieldId: args.fieldId,
			itemId: args.itemId,
			newValue: args.newValue,
		}),
	}
}

export async function sendGqlRequest<T>(token: string, query: string): SafePromise<Partial<T>> {
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

	if (err) return safeErr(err);

	if (fetchResult.status !== 200) {
		const [resText, textErr] = await safePromise(fetchResult.text());

		if (textErr) return safeErr(textErr);
		return safeErr(new Error(resText));
	}

	const [fetchJson, fetchJsonErr] = await safePromise<Partial<T>>(fetchResult.json());
	if (fetchJsonErr) return safeErr(fetchJsonErr);

	return safeRes(fetchJson);
}

