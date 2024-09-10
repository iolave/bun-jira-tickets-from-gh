import { loadFile, writeProject } from "./github-project.core"
import { type Item, type Project } from "./github-project.types";

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

export default {
	upsertItems,
	getProject,
	getItem,
}
