import { describe, it, expect } from "bun:test";
import { itemField, type Item, type Project } from "./github-project.types";
import githubProjectModel from "./github-project.model";

function createItem(url: string | undefined): Item {
	return {
		id: crypto.randomUUID(),
		[itemField.TITLE]: { id: crypto.randomUUID(), value: crypto.randomUUID() },
		[itemField.REPO]: { id: crypto.randomUUID(), value: crypto.randomUUID() },
		[itemField.ESTIMATE]: { id: crypto.randomUUID(), value: Math.random() * 100 },
		[itemField.STATUS]: { id: crypto.randomUUID(), value: undefined },
		[itemField.JIRA_ISSUE_TYPE]: { id: crypto.randomUUID(), value: undefined },
		[itemField.ASSIGNEES]: { id: crypto.randomUUID(), value: [] },
		[itemField.JIRA_URL]: { id: crypto.randomUUID(), value: url },

	}
}

describe(`${githubProjectModel.getItemsWithUrl.name}`, () => {
	it("should retrieve items with proper urls", () => {
		const subdomain = "test";

		const project: Project = {
			id: crypto.randomUUID(),
			items: [],
		};

		project.items.push(createItem(`https://${subdomain}.atlassian.net/browse/ITEM1`));
		project.items.push(createItem("invalid url"));
		project.items.push(createItem(undefined));

		const items = githubProjectModel.getItemsWithUrl(project, subdomain);

		expect(items).toHaveLength(1);
	});

	it("should retrieve those items whose url is not valid", () => {
		const subdomain = "test";

		const project: Project = {
			id: crypto.randomUUID(),
			items: [],
		};

		project.items.push(createItem(`https://${subdomain}.atlassian.net/browse/ITEM1`));
		project.items.push(createItem("invalid url"));
		project.items.push(createItem(undefined));

		const items = githubProjectModel.getItemsWithoutUrl(project, subdomain);

		expect(items).toHaveLength(2);
	});
});

