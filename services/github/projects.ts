import { Err, Ok, type PResult } from "@iolave/utils/results";
import { sendGqlRequest } from ".";
import { FIELD_ASSIGNEES, FIELD_ESTIMATE, FIELD_JIRA_ISSUE_TYPE, FIELD_JIRA_URL, FIELD_REPO, FIELD_STATUS, FIELD_TITLE } from "../../business-logic/github-project";
import type { IProjectItemUpdateField, UpdateProjectItemFieldResponse } from "./update-project-item-field.query";
import updateProjectItemFieldQuery from "./update-project-item-field.query";
import { itemField, parseItemStatus, type Item } from "../../models/github-project.types";
import { z } from "zod";

async function updateProjectItemField(args: { token: string, projectId: string, fieldId: string, itemId: string, newValue: IProjectItemUpdateField }): PResult<UpdateProjectItemFieldResponse> {
	const [reqRes, reqErr] = await sendGqlRequest<UpdateProjectItemFieldResponse>(args.token, updateProjectItemFieldQuery(args.projectId, args.fieldId, args.itemId, args.newValue));

	if (reqErr) return Err(reqErr);

	if (!reqRes?.data?.updateProjectV2ItemFieldValue?.clientMutationId) {
		const err = new Error(JSON.stringify(reqRes));;
		return Err(err);
	}

	return Ok(reqRes as UpdateProjectItemFieldResponse);
}


export type GithubProjectField = { id: string, name: string, options?: { id: string, name: string }[] };
async function getProjectFields(token: string, id: string): PResult<GithubProjectField[]> {
	const query = `query{ node(id: "${id}") { ... on ProjectV2 { fields(first: 100) { nodes { ... on ProjectV2Field { id name } ... on ProjectV2IterationField { id name configuration { iterations { startDate id }}} ... on ProjectV2SingleSelectField { id name options { id name }}}}}}}`;

	const [reqRes, reqErr] = await sendGqlRequest<{ data: { node: { fields: { nodes: GithubProjectField[] } } } }>(token, query);
	if (reqErr) return Err(reqErr);

	if (!reqRes.data?.node.fields.nodes) return Err(new Error(JSON.stringify(reqRes)));

	// @ts-ignore
	return Ok(reqRes.data?.node.fields.nodes);
}


type ProjectList = { id: string, title: string }[];

async function listOrganizationProjects(token: string, org: string): PResult<ProjectList> {
	const query = `query{organization(login: "${org}") {projectsV2(first: 100) {nodes {id title}}}}`;

	const [reqRes, reqErr] = await sendGqlRequest<{ data: { organization: { projectsV2: { nodes: ProjectList } } } }>(token, query);

	if (reqErr) return Err(reqErr);


	if (!reqRes.data?.organization?.projectsV2?.nodes) return Err(new Error(JSON.stringify(reqRes)));

	return Ok(reqRes.data.organization.projectsV2.nodes);
}

export type GithubProjectItem = {
	id: string;
	[FIELD_TITLE]: string;
	[FIELD_STATUS]: string | null;
	[FIELD_ESTIMATE]: number | null;
	[FIELD_JIRA_ISSUE_TYPE]: string;
	[FIELD_JIRA_URL]: string | null;
	[FIELD_ASSIGNEES]: string | null;
	//comments: string[];
	[FIELD_REPO]: string | null;
}

async function getProjectItems2(token: string, id: string): PResult<Item[]> {
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
					... on ProjectV2ItemFieldUserValue {users(first:10){nodes {login}}}
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

	const [reqRes, reqErr] = await sendGqlRequest<{ data: { node: { items: { nodes: unknown[] } } } }>(token, query);

	if (reqErr) return Err(reqErr);

	if (!reqRes?.data?.node?.items?.nodes) return Err(new Error(JSON.stringify(reqRes)));

	const [fields, fieldsErr] = await getProjectFields(token, id);
	if (fieldsErr) return Err(fieldsErr);

	const items: Item[] = [];

	const responseSchema = z.object({
		id: z.string(),
		title: z.object({ text: z.string() }),
		status: z.object({ name: z.string() }).nullish(),
		assignees: z.object({
			users: z.object({
				nodes: z.array(z.object({ login: z.string() })).nullish()
			}).nullish()
		}).nullish(),
		estimate: z.object({ number: z.number().nullish() }).nullish(),
		jiraIssueType: z.object({ name: z.string() }).nullish(),
		jiraUrl: z.object({ text: z.string().nullish() }).nullish(),
		repo: z.object({ repository: z.object({ nameWithOwner: z.string().nullish() }).nullish() }).nullish(),
	})

	for (const unknownObj of reqRes.data.node.items.nodes) {
		const { data, error } = responseSchema.safeParse(unknownObj);
		if (error) return Err(error);
		items.push({
			id: data.id,
			[`${itemField.TITLE}`]: { id: fields.filter(f => f.name === itemField.TITLE).pop()?.id ?? "", value: data.title.text },
			[`${itemField.STATUS}`]: { id: fields.filter(f => f.name === itemField.STATUS).pop()?.id ?? "", value: parseItemStatus(data.status?.name ?? "") },
			[`${itemField.ESTIMATE}`]: { id: fields.filter(f => f.name === itemField.ESTIMATE).pop()?.id ?? "", value: data.estimate?.number },
			[`${itemField.ASSIGNEES}`]: { id: fields.filter(f => f.name === itemField.ASSIGNEES).pop()?.id ?? "", value: data.assignees?.users?.nodes?.map(i => i.login) ?? [] },
			[`${itemField.REPO}`]: { id: fields.filter(f => f.name === itemField.REPO).pop()?.id ?? "", value: data.repo?.repository?.nameWithOwner },
			[`${itemField.JIRA_URL}`]: { id: fields.filter(f => f.name === itemField.JIRA_URL).pop()?.id ?? "", value: data.jiraUrl?.text },
			[`${itemField.JIRA_ISSUE_TYPE}`]: { id: fields.filter(f => f.name === itemField.JIRA_ISSUE_TYPE).pop()?.id ?? "", value: data.jiraIssueType?.name },
		});
	}

	return Ok(items);
}
async function getProjectItems(token: string, id: string): PResult<GithubProjectItem[]> {
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

	const [reqRes, reqErr] = await sendGqlRequest<{ data: { node: { items: { nodes: GithubProjectItem[] } } } }>(token, query);

	if (reqErr) return Err(reqErr);

	if (!reqRes.data?.node?.items?.nodes) return Err(new Error(JSON.stringify(reqRes)));

	const result = reqRes?.data.node.items.nodes.map((obj: any) => ({
		id: obj?.id ?? "",
		[`${FIELD_TITLE}`]: obj?.title?.text ?? "",
		[`${FIELD_STATUS}`]: obj?.status?.name ?? null,
		[`${FIELD_ESTIMATE}`]: obj?.estimate?.number ?? null,
		[`${FIELD_JIRA_ISSUE_TYPE}`]: obj?.jiraIssueType?.name ?? "",
		[`${FIELD_JIRA_URL}`]: obj?.jiraUrl?.text ?? null,
		[`${FIELD_REPO}`]: obj?.repo?.repository?.nameWithOwner ?? null,
		[`${FIELD_ASSIGNEES}`]: obj?.assignees?.users?.nodes?.at(0)?.login ?? null,
		//comments: obj?.content?.comments?.nodes.map((c: any) => c.body ?? []) ?? [],
	})) as unknown as GithubProjectItem[];

	return Ok(result);
}

export default {
	updateProjectItemField,
	getProjectFields,
	listOrganizationProjects,
	getProjectItems,
	getProjectItems2,
}
