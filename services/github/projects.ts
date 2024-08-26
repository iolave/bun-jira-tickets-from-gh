import promises, { type SafePromise } from "../../helpers/promises";
import sync from "../../helpers/sync";

type ProjectFields = { id: string, name: string, options?: { id: string, name: string }[] }[];
async function getProjectFields(token: string, id: string): SafePromise<ProjectFields> {
	const headers = new Headers();
	headers.append("authorization", `Bearer ${token}`);

	const body = JSON.stringify({
		query: `query{ node(id: "${id}") { ... on ProjectV2 { fields(first: 100) { nodes { ... on ProjectV2Field { id name } ... on ProjectV2IterationField { id name configuration { iterations { startDate id }}} ... on ProjectV2SingleSelectField { id name options { id name }}}}}}}`,
	});

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

		if (parseErr) return [null, new Error("Unable to retrieve project fields", { cause: parseErr })];

		return [null, json]


	}

	const [fetchJson, fetchJsonErr] = await promises.safePromise(fetchResult.json());

	if (fetchJsonErr) return [null, fetchJsonErr];

	const fetchJsonTyped = fetchJson as { data: { node: { fields: { nodes: ProjectFields[] } } } }

	// @ts-ignore
	return [fetchJsonTyped.data.node.fields.nodes, null];
}


type ProjectList = { id: string, title: string }[];

async function listOrganizationProjects(token: string, org: string): SafePromise<ProjectList> {
	const headers = new Headers();
	headers.append("Authorization", `Bearer ${token}`);

	const body = JSON.stringify({
		query: `query{organization(login: "${org}") {projectsV2(first: 100) {nodes {id title}}}}`,
	});

	const requestInit: RequestInit = {
		method: "POST",
		headers,
		body,
	};

	const url = "https://api.github.com/graphql";

	const [fetchResult, err] = await promises.safePromise(fetch(url, requestInit));

	if (err) return [null, err];

	if (fetchResult.status !== 200) {
		const [resText, textErr] = await promises.safePromise(fetchResult.text());

		if (textErr) return [null, textErr];

		const [json, parseErr] = sync.safeFunc(JSON.parse, [resText]);

		if (parseErr) return [null, new Error("Unable to retrieve project fields", { cause: parseErr })];

		return [null, json]
	}

	const [fetchJson, fetchJsonErr] = await promises.safePromise(fetchResult.json());

	if (fetchJsonErr) return [null, fetchJsonErr];

	const fetchJsonTyped = fetchJson as { data: { organization: { projectsV2: { nodes: ProjectList } } } }

	return [fetchJsonTyped.data.organization.projectsV2.nodes, null];
}

type ProjectItems = {
	title: string | null;
	status: string | null;
	estimate: number | null;
	jira: string | null;
	assignee: string | null;
	comments: string[];
	repo: string | null;
}[];
async function getProjectItems(token: string, id: string): SafePromise<ProjectItems> {
	const headers = new Headers();
	headers.append("authorization", `Bearer ${token}`);

	const body = JSON.stringify({
		query: `query{ node(id: "${id}") { ... on ProjectV2 {
			items(first: 100) {
				pageInfo{startCursor endCursor hasNextPage hasPreviousPage} 
				nodes{
					content{
						__typename
						... on Issue {comments(first:100) {nodes{body}}}
					}
					title: fieldValueByName(name: "Title") {
						__typename
						... on ProjectV2ItemFieldTextValue {text}
					}
					status: fieldValueByName(name: "Status") {
						... on ProjectV2ItemFieldSingleSelectValue {name optionId}
					}
					assignees: fieldValueByName(name: "Assignees") {
						__typename
						... on ProjectV2ItemFieldUserValue {users(first:1){nodes {login}}}
					}
					estimate: fieldValueByName(name: "Estimate") {
						__typename
						... on ProjectV2ItemFieldNumberValue {number}
					}
					jira: fieldValueByName(name: "Jira") {
						... on ProjectV2ItemFieldSingleSelectValue {name optionId}
					}
					jiraUrl: fieldValueByName(name: "Jira URL") {
						__typename
						... on ProjectV2ItemFieldTextValue {text}
					}
					repo: fieldValueByName(name: "Repository") {
						__typename
						... on ProjectV2ItemFieldRepositoryValue {repository{nameWithOwner}}
					}
				}
			}
		}}}}`,
	});

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

		if (parseErr) return [null, new Error("Unable to retrieve project fields", { cause: parseErr })];

		return [null, json]


	}

	const [fetchJson, fetchJsonErr] = await promises.safePromise(fetchResult.json());

	if (fetchJsonErr) return [null, fetchJsonErr];
	if ("errors" in fetchJson) return [null, new Error(fetchJson.errors.at(0).message)];

	const result = fetchJson?.data?.node?.items?.nodes.map((obj: any) => ({
		title: obj?.title?.text ?? null,
		status: obj?.status?.name ?? null,
		estimate: obj?.estimate?.number ?? null,
		jira: obj?.jira?.name ?? null,
		jiraUrl: obj?.jiraUrl?.text ?? null,
		repo: obj?.repo?.repository?.nameWithOwner ?? null,
		assignee: obj?.assignees?.users?.nodes?.at(0)?.login ?? null,
		comments: obj?.content?.comments?.nodes.map((c: any) => c.body ?? []) ?? [],
	})) as unknown as ProjectItems;

	return [result, null];
}

export default {
	getProjectFields,
	listOrganizationProjects,
	getProjectItems,
}
