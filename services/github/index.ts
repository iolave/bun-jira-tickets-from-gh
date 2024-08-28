import type { SafePromise } from "../../helpers/promises";
import promises from "../../helpers/promises";
import sync from "../../helpers/sync";
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

	const [fetchResult, err] = await promises.safePromise(fetch(url, requestInit));

	if (err) return [null, err];

	if (fetchResult.status !== 200) {
		const [resText, textErr] = await promises.safePromise(fetchResult.text());

		if (textErr) return [null, textErr];

		const [json, parseErr] = sync.safeFunc(JSON.parse, [resText]);

		if (parseErr) return [null, new Error(`Failed to send request to "${url.toString()}"`, { cause: parseErr })];

		return [null, json]


	}

	const [fetchJson, fetchJsonErr] = await promises.safePromise<Partial<T>>(fetchResult.json());
	if (fetchJsonErr) return [null, fetchJsonErr];

	return [fetchJson, null];
}

