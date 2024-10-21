import { loadFile, writeProject } from "./github-project.core"
import { itemField, itemStatus, type Item, type Project } from "./github-project.types";

async function upsertItems(project: Project, ...items: Item[]): Promise<undefined | Error> {
	for (const item of items) {
		if (items.filter(i => i.id === item.id).length > 1) {
			return new Error("items argument contains duplicated items");
		}
		project.items = project.items.filter(i => i.id !== item.id);
	}

	project.items.push(...items);
	return writeProject(project);
}

function getItem(project: Project, itemId: string): Item | undefined {
	return project.items.findLast(i => i.id === itemId);
}

async function getProject(id: string): Promise<Project> {
	return loadFile(id);
}

function getItemsWithoutUrl(project: Project, jiraSubdomain: string): Item[] {
	const urlPrefix = `https://${jiraSubdomain}.atlassian.net/browse/`;

	return project.items.filter(i => {
		if (i[itemField.JIRA_URL].value === undefined) return true;
		if (i[itemField.JIRA_URL].value === null) return true;

		return !i[itemField.JIRA_URL].value.startsWith(urlPrefix);
	});
}

function getItemsWithUrl(project: Project, jiraSubdomain: string): Item[] {
	const urlPrefix = `https://${jiraSubdomain}.atlassian.net/browse/`;

	return project.items.filter(i => {
		if (i[itemField.JIRA_URL].value === undefined) return false;
		if (i[itemField.JIRA_URL].value === null) return false;

		return i[itemField.JIRA_URL].value.startsWith(urlPrefix);
	});
}

function findNewItems(project: Project, items: Item[]): Item[] {
	const newItems: Item[] = [];
	for (const item of items) {
		const projectItem = getItem(project, item.id);
		if (projectItem) continue;
		newItems.push(item);
	}
	return newItems;
}

function findItemsWithDiff(project: Project, refreshedItems: Item[]): { prevStatus: itemStatus, newStatus: itemStatus, item: Item }[] {
	const newItems: { prevStatus: itemStatus, newStatus: itemStatus, item: Item }[] = [];
	for (const item of refreshedItems) {
		const projectItem = getItem(project, item.id);
		if (!projectItem) continue;

		if (projectItem[itemField.STATUS].value === itemStatus.DONE) {
			continue;
		}

		if (projectItem[itemField.STATUS].value === itemStatus.WIP && item[itemField.STATUS].value === itemStatus.DONE) {
			newItems.push({
				prevStatus: projectItem[itemField.STATUS].value,
				newStatus: item[itemField.STATUS].value,
				item,
			});
			continue;
		}

		if (projectItem[itemField.STATUS].value === itemStatus.TODO && (item[itemField.STATUS].value === itemStatus.DONE || item[itemField.STATUS].value === itemStatus.WIP)) {
			newItems.push({
				prevStatus: projectItem[itemField.STATUS].value,
				newStatus: item[itemField.STATUS].value,
				item,
			});
			continue;
		}
	}

	return newItems;
}

export default {
	upsertItems,
	getProject,
	getItem,
	getItemsWithoutUrl,
	getItemsWithUrl,
	findNewItems,
	findItemsWithDiff,
}
