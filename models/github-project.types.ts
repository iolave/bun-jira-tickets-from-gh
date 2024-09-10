import { z } from "zod"

export enum env {
	PROJECT_FILE = "GITHUB_PROJECT_FILE",
}

export enum itemStatus {
	TODO = "Todo",
	WIP = "In Progress",
	DONE = "Done",
}

export function parseItemStatus(status: string): itemStatus | undefined {
	if (Object.keys(itemStatus).includes(status)) {
		// @ts-ignore;
		return itemStatus[status]
	}
	return undefined;
}

export enum itemField {
	JIRA_URL = "Jira URL",
	JIRA_ISSUE_TYPE = "Jira issue type",
	TITLE = "Title",
	ESTIMATE = "Estimate",
	STATUS = "Status",
	ASSIGNEES = "Assignees",
	REPO = "Repository",
}

export const itemSchema = z.object({
	id: z.string(),
	[itemField.TITLE]: z.object({ id: z.string(), value: z.string() }),
	[itemField.STATUS]: z.object({ id: z.string(), value: z.nativeEnum(itemStatus).nullish() }),
	[itemField.ASSIGNEES]: z.object({ id: z.string(), value: z.array(z.string()) }),
	[itemField.REPO]: z.object({ id: z.string(), value: z.string().nullish() }),
	[itemField.ESTIMATE]: z.object({ id: z.string(), value: z.number().nullish() }),
	[itemField.JIRA_ISSUE_TYPE]: z.object({ id: z.string(), value: z.string().nullish() }),
	[itemField.JIRA_URL]: z.object({ id: z.string(), value: z.string().nullish() }),
});

export type Item = ReturnType<typeof itemSchema["parse"]>

export type Project = {
	id: string,
	items: Item[],
}
