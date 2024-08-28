import { sendGqlRequest } from ".";
import { type SafePromise } from "../../helpers/promises";
import type { IProjectItemUpdateField, UpdateProjectItemFieldResponse } from "./update-project-item-field.query";
import updateProjectItemFieldQuery from "./update-project-item-field.query";

async function updateProjectItemField(args: { token: string, projectId: string, fieldId: string, itemId: string, newValue: IProjectItemUpdateField }): SafePromise<UpdateProjectItemFieldResponse> {
	const [reqRes, reqErr] = await sendGqlRequest<UpdateProjectItemFieldResponse>(args.token, updateProjectItemFieldQuery(args.projectId, args.fieldId, args.itemId, args.newValue));

	if (reqErr) return [null, reqErr];

	if (!reqRes.data?.updateProjectV2ItemFieldValue.clientMutationId) {
		const err = new Error(JSON.stringify(reqRes));;
		return [null, err];
	}

	return [reqRes as UpdateProjectItemFieldResponse, null];
}


type ProjectFields = { id: string, name: string, options?: { id: string, name: string }[] }[];
async function getProjectFields(token: string, id: string): SafePromise<ProjectFields> {
	const query = `query{ node(id: "${id}") { ... on ProjectV2 { fields(first: 100) { nodes { ... on ProjectV2Field { id name } ... on ProjectV2IterationField { id name configuration { iterations { startDate id }}} ... on ProjectV2SingleSelectField { id name options { id name }}}}}}}`;

	const [reqRes, reqErr] = await sendGqlRequest<{ data: { node: { fields: { nodes: ProjectFields[] } } } }>(token, query);
	if (reqErr) return [null, reqErr];

	if (!reqRes.data?.node.fields.nodes) return [null, new Error(JSON.stringify(reqRes))];

	// @ts-ignore
	return [reqRes.data?.node.fields.nodes, null];
}


type ProjectList = { id: string, title: string }[];

async function listOrganizationProjects(token: string, org: string): SafePromise<ProjectList> {
	const query = `query{organization(login: "${org}") {projectsV2(first: 100) {nodes {id title}}}}`;

	const [reqRes, reqErr] = await sendGqlRequest<{ data: { organization: { projectsV2: { nodes: ProjectList } } } }>(token, query);

	if (reqErr) return [null, reqErr];


	if (!reqRes.data?.organization?.projectsV2?.nodes) return [null, new Error(JSON.stringify(reqRes))];

	return [reqRes.data.organization.projectsV2.nodes, null];
}

type ProjectItems = {
	id: string;
	title: string | null;
	status: string | null;
	estimate: number | null;
	jiraIssueType: string;
	jiraUrl: string | null;
	assignee: string | null;
	comments: string[];
	repo: string | null;
}[];
async function getProjectItems(token: string, id: string): SafePromise<ProjectItems> {
	const query = `query{ node(id: "${id}") { ... on ProjectV2 {
		items(first: 100) {
			pageInfo{startCursor endCursor hasNextPage hasPreviousPage} 
			nodes{
				id
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
				jiraIssueType: fieldValueByName(name: "Jira issue type") {
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
	}}}}`;

	const [reqRes, reqErr] = await sendGqlRequest<{ data: { node: { items: { nodes: ProjectItems } } } }>(token, query);

	if (reqErr) return [null, reqErr];

	if (!reqRes.data?.node?.items?.nodes) return [null, new Error(JSON.stringify(reqRes))];

	const result = reqRes?.data.node.items.nodes.map((obj: any) => ({
		id: obj?.id ?? "",
		title: obj?.title?.text ?? null,
		status: obj?.status?.name ?? null,
		estimate: obj?.estimate?.number ?? null,
		jiraIssueType: obj?.jiraIssueType?.name ?? "",
		jiraUrl: obj?.jiraUrl?.text ?? null,
		repo: obj?.repo?.repository?.nameWithOwner ?? null,
		assignee: obj?.assignees?.users?.nodes?.at(0)?.login ?? null,
		comments: obj?.content?.comments?.nodes.map((c: any) => c.body ?? []) ?? [],
	})) as unknown as ProjectItems;

	return [result, null];
}

export default {
	updateProjectItemField,
	getProjectFields,
	listOrganizationProjects,
	getProjectItems,
}
