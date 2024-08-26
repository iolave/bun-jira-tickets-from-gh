import promises, { type SafePromise } from "../../helpers/promises";
import sync from "../../helpers/sync";

async function getProjectFields(token: string, id: string): SafePromise<any> {
	const headers = new Headers();
	headers.append("authorization", token);

	const body = JSON.stringify({
		query: `query{ node(id: "${id}") { ... on ProjectV2 { fields(first: 20) { nodes { ... on ProjectV2Field { id name } ... on ProjectV2IterationField { id name configuration { iterations { startDate id }}} ... on ProjectV2SingleSelectField { id name options { id name }}}}}}}`,
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

	return [fetchResult, null];
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


export default {
	getProjectFields,
	listOrganizationProjects,
}
