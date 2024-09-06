import { Ok, type PResult, type Result } from "@iolave/utils/functions";
import logger from "../helpers/logger";
import GithubClient from "../services/github";
import type { GithubProjectField, GithubProjectItem } from "../services/github/projects";

const logName = {
	loadProject: "GithubProject.internal.loadProject",
	newProject: "GithuProject",
	projectInit: "GithuProject.init",
	updateItem: "GithuProject.update",
	refreshItems: "GithuProject.refresh",
}

export const FIELD_ESTIMATE = "Estimate";
export const FIELD_JIRA_ISSUE_TYPE = "Jira issue type";
export const FIELD_JIRA_URL = "Jira URL";
export const FIELD_STATUS = "Status";
export const FIELD_ASSIGNEES = "Assignees";
export const FIELD_TITLE = "Title";
export const FIELD_REPO = "Repository";
export const FIELD_STATUS_WIP = "In Progress";
export const FIELD_STATUS_TODO = "Todo";
export const FIELD_STATUS_DONE = "Done";

const projectFieldTypesMap = {
	[`${FIELD_ESTIMATE}`]: { select: false },
	[`${FIELD_JIRA_ISSUE_TYPE}`]: { select: true, values: null },
	[`${FIELD_JIRA_URL}`]: { select: false },
	[`${FIELD_STATUS}`]: { select: true, values: [FIELD_STATUS_DONE, FIELD_STATUS_TODO, FIELD_STATUS_WIP] },
	[`${FIELD_ASSIGNEES}`]: { select: false },
	[`${FIELD_TITLE}`]: { select: false },
	[`${FIELD_REPO}`]: { select: false },
} as const;

type FieldStatusType = typeof projectFieldTypesMap[typeof FIELD_STATUS]["values"];

type GithubSyncProjectFields = {
	[FIELD_ESTIMATE]: { id: string },
	[FIELD_JIRA_ISSUE_TYPE]: { id: string, options: GithubProjectField["options"] },
	[FIELD_JIRA_URL]: { id: string },
	[FIELD_STATUS]: { id: string, options: { id: string, name: FieldStatusType }[] },
	[FIELD_ASSIGNEES]: { id: string },
	[FIELD_TITLE]: { id: string },
	[FIELD_REPO]: { id: string },
}

type GithubProjectProps = {
	id: string;
	fields: GithubSyncProjectFields;
	items: GithubProjectItem[];
}

var githubProject: GithubProject | undefined = undefined;

async function loadProject(client: GithubClient, id: string): PResult<GithubProjectProps> {
	// Creates tmp project with id
	var project: GithubProjectProps = {
		id,
		// @ts-ignore
		fields: {},
		items: [],
	}

	// Retrieving project fields
	const [fields, fieldsErr] = await client.projects.getProjectFields(id);
	if (fieldsErr) {
		githubProject = undefined;
		return [null, fieldsErr]
	}

	// Validates fields types
	for (const [fName, opts] of Object.entries(projectFieldTypesMap)) {
		const name = fName as keyof GithubSyncProjectFields;

		// Validating if project fields exists
		logger.debug(logName.loadProject, "validating field type", { projectId: id, field: name });

		const filteredFields = fields.filter(f => f.name === name);
		if (filteredFields.length === 0) return [null, new Error(`field "${name}" not found in GitHub project`)];
		if (filteredFields.length !== 1) return [null, new Error(`field "${name}" is duplicated GitHub project`)];

		// At this point, the project field exists
		// and thus, we set the id
		const field = filteredFields[0];

		// @ts-expect-error id is the required prop here
		project.fields[name] = { id: field.id }


		// Check if the field is of type selection
		if (opts.select === false) {
			if (field.options) return [null, new Error(`field "${name}" was expected to be of type text`)];
			continue;
		}

		if (!field.options) return [null, new Error(`field "${name}" was expected to be of type select`)];
		if (opts.values === null) {
			// @ts-expect-error we know for a fact the options field here is required
			project.fields[name].options = field.options;
			continue;
		}

		if (fName === FIELD_STATUS) {
			const optionsNames = field.options.map(o => o.name);
			for (const optionName of opts.values) {
				if (optionsNames.includes(optionName)) continue;
				const err = new Error(`field "${name}" of type select expected values "${opts.values}" but got "${optionsNames}"`)
				return [null, err];
			}

			// @ts-expect-error we know for a fact the options field here is required and it matches
			// the FIELD_STATUS values
			project.fields[name].options = field.options;
			continue;
		}

		return [null, new Error(`missing field "${name}" select values validation`)];
	}

	// Retrieve project items and set em in the tmp project var
	logger.debug(logName.loadProject, "retrieving project items", { projectId: id });
	const [projectItems, projectItemsErr] = await client.projects.getProjectItems(id);
	if (projectItemsErr !== null) return [null, projectItemsErr];
	project.items = projectItems;

	return [project, null];
}

type ItemDiff = {
	id: string;
	fields: { id: string, new: boolean, newValue: string | string[] | number | null }[]
}

class GithubProject {
	private client: GithubClient;
	private props: GithubProjectProps | undefined = undefined;
	private itemsDiff: ItemDiff[] | undefined = undefined;

	constructor(client: GithubClient) {
		logger.debug(logName.newProject, "creating new github client");
		this.client = client;
	}

	public async init(id: string): Promise<Error | undefined> {
		logger.debug(logName.projectInit, "loading project", { id });
		const [props, projectErr] = await loadProject(this.client, id);
		if (projectErr) return projectErr;
		this.props = props;
	}

	private getProps(): [GithubProjectProps, null] | [null, Error] {
		if (this.props) return [this.props, null];
		return [null, new Error(`GithubProject not initialized`)];
	}

	private getItem(id: string): Result<GithubProjectItem | undefined> {
		const [props, propsErr] = this.getProps();
		if (propsErr) return [null, propsErr];

		const itemSearch = props.items.filter(item => item.id === id);
		if (itemSearch.length === 0) {
			return [undefined, null];
		}

		if (itemSearch.length > 1) {
			return [null, new Error(`item with id "${id}" seems to be duplicated`)];
		}

		return [itemSearch[0], null];
	}

	public async refreshProjectItems(): Promise<Error | undefined> {
		const [props, propsErr] = this.getProps();
		if (propsErr) return propsErr;

		const [projectItems, projectItemsErr] = await this.client.projects.getProjectItems(props.id);
		if (projectItemsErr) return projectItemsErr;

		const itemsDiff: ItemDiff[] = [];

		for (const newItem of projectItems) {
			logger.debug(logName.refreshItems, `checking diff for GitHub item`, { id: newItem.id })
			const [currentItem, currentItemErr] = this.getItem(newItem.id);
			if (currentItemErr) return currentItemErr;

			const { id, ...newItemWithoutId } = newItem;
			const fields: ItemDiff["fields"] = [];

			if (!currentItem) {
				logger.debug(logName.refreshItems, `item not found in local storage`, { id: newItem.id })
				for (const [fieldName, newValue] of Object.entries(newItemWithoutId)) {
					const [fieldId, fieldIdErr] = this.getFieldId(fieldName as keyof GithubSyncProjectFields);
					if (fieldIdErr) return fieldIdErr;

					fields.push({ id: fieldId, new: true, newValue });
				}

				itemsDiff.push({ id, fields });
				continue;
			}

			logger.debug(logName.refreshItems, `item found in local storage`, { id: newItem.id })
			for (const [fieldName, newValue] of Object.entries(newItemWithoutId)) {
				const [fieldId, fieldIdErr] = this.getFieldId(fieldName as keyof GithubSyncProjectFields);
				if (fieldIdErr) return fieldIdErr;

				const currentValue = currentItem[fieldName as keyof GithubSyncProjectFields];

				const currentFieldValueHash = new Bun.SHA256().update(JSON.stringify(currentValue)).digest("hex");
				const newFieldValueHash = new Bun.SHA256().update(JSON.stringify(newValue)).digest("hex");

				// no changes in field
				if (currentFieldValueHash === newFieldValueHash) {
					logger.debug(logName.refreshItems, `no changes found for item`, { id: newItem.id })
					continue;
				}
				logger.debug(logName.refreshItems, `changes found for item`, { id: newItem.id, newValue, currentValue });
				fields.push({ id: fieldId, new: false, newValue: newValue });
			}

			if (fields.length > 0) itemsDiff.push({ id, fields });
		}

		props.items = projectItems;
		this.props = props;
		if (itemsDiff.length === 0) this.itemsDiff = undefined;
		else this.itemsDiff = itemsDiff;

		return undefined;
	}

	public getItems(): Result<GithubProjectItem[]> {
		const [props, err] = this.getProps();
		if (err) return [null, err];
		return Ok(props.items);
	}

	public getItemsDiff(): ItemDiff[] | undefined {
		return this.itemsDiff;
	}

	private getFieldId(field: keyof GithubSyncProjectFields): Result<string> {
		const [props, err] = this.getProps();
		if (err) return [null, err];
		return Ok(props.fields[field].id);
	}

	private updateItem(item: GithubProjectItem): Error | undefined {
		const [props, propsErr] = this.getProps();
		if (propsErr) return propsErr;
		const index = props.items.map(i => i.id).lastIndexOf(item.id);
		if (index === -1) return new Error(`item with id "${item.id}" does not exist`);
		props.items[index] = item;
		this.props = props;
		return undefined;
	}

	/**
	 * Updates item jira url both in github and within local storage
	 */
	public async updateJiraUrl(itemId: string, url: string): Promise<Error | undefined> {
		logger.debug(logName.updateItem, "updating jira url", { itemId, url });
		const [props, propsErr] = this.getProps();
		if (propsErr) return propsErr;

		const itemIndex = props.items.map(i => i.id).findLastIndex(i => i === itemId);
		if (itemIndex === -1) return new Error(`item with id "${itemId}" does not exist`);

		const item = props.items[itemIndex];

		const [jiraUrlFieldId, jiraUrlFieldIdErr] = this.getFieldId(FIELD_JIRA_URL);
		if (jiraUrlFieldIdErr) return jiraUrlFieldIdErr;

		const [updateRes, updateErr] = await this.client.projects.updateProjectItemField({
			projectId: props.id,
			itemId,
			fieldId: jiraUrlFieldId,
			newValue: { text: url }
		});
		if (updateErr) return updateErr;
		logger.debug(logName.updateItem, "updated jira url in github", { itemId, url, updateId: updateRes.data.updateProjectV2ItemFieldValue.clientMutationId });

		props.items[itemIndex][FIELD_JIRA_URL] = url;
		const updateItemErr = this.updateItem(item);
		return updateItemErr;
	}
}

export default GithubProject;
