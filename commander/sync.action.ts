import type { ProgramGlobalOptions } from ".";
import logger from "../helpers/logger";
import githubProjectModel from "../models/github-project.model";
import { itemField, itemStatus, type Item, type Project } from "../models/github-project.types";
import GithubClient from "../services/github";
import JiraClient from "../services/jira";
import syncCmd, { type SyncOptions } from "./sync.cmd";
import util from "./util";

const logname = "syncCmd.action";

export default async function(): Promise<void> {
	const globalOpts = syncCmd.optsWithGlobals<ProgramGlobalOptions>();
	if (globalOpts.verbose) logger.enableVerboseMode();

	const actionOpts = syncCmd.opts<SyncOptions>();

	logger.debug(logname, "parsed options", { actionOpts });

	const project = await githubProjectModel.getProject(actionOpts.ghProjectId);
	logger.debug(logname, "loaded local project data", { projectId: project.id, itemsAmt: project.items.length });

	const gh = new GithubClient(util.getGithubToken(globalOpts));
	const jira = new JiraClient(util.getJiraToken(globalOpts), actionOpts.jiraSubdomain);

	// Find and replace jira account ids
	if (actionOpts.ghAssigneesMap) for (const [ghUser, jiraEmail] of Object.entries(actionOpts.ghAssigneesMap)) {
		const [userRes, userErr] = await jira.users.searchByEmail(jiraEmail!);
		if (userErr) return util.error(userErr);
		actionOpts.ghAssigneesMap[ghUser] = userRes.accountId;
		logger.debug(logname, "mapped github user", { ghUser, jiraEmail, jiraAccountId: userRes.accountId });
	}


	// if no there are no items in our local project data
	// it probably means the data was lost or its simply
	// the first execution and therefore:
	//	1) [OK] remote data need to be retrieved from github.
	//	2) [OK] items need to be synced with jira.
	//		- if the item doesnt have a jira url:
	//			1) [OK] create jira issue.
	//			2) [OK] update remote jira url field.
	//			3) [OK] update local jira url field.
	//			4) [OK] transition it to the current status
	//		- if the item have a jira url.
	//			1) [OK] try to update the issue status
	//			
	if (project.items.length === 0) {
		const [remoteItems, remoteItemsErr] = await gh.projects.getProjectItems2(project.id);

		if (remoteItemsErr) return util.error(remoteItemsErr);
		const upsertErr = await githubProjectModel.upsertItems(project, ...remoteItems);
		if (upsertErr) return util.error(upsertErr);
		for (const item of githubProjectModel.getItemsWithUrl(project)) {
			await updateJiraIssueFromGhTaskWithUrl({
				jira,
				item,
			});
		}
		for (const item of githubProjectModel.getItemsWithoutUrl(project)) {
			await createJiraIssueFromGhTaskWithoutUrl({
				jira,
				gh,
				project,
				item,
			})
		}

	}

	while (actionOpts.sleepTime && actionOpts.sleepTime >= 0) {
		logger.info(logname, `sleeping for ${actionOpts.sleepTime}ms...`)
		await new Promise(res => setTimeout(() => res(undefined), actionOpts.sleepTime));

		logger.info(logname, `refreshing github project items`, { projectId: actionOpts.ghProjectId })
		const [refreshedItems, refreshedItemsErr] = await gh.projects.getProjectItems2(actionOpts.ghProjectId);

		if (refreshedItemsErr) {
			logger.error(logname, "unable to refresh items", { projectId: actionOpts.ghProjectId, err: refreshedItemsErr });
			continue;
		}

		for (const entry of githubProjectModel.findItemsWithDiff(project, refreshedItems)) {
			const issueKey = entry.item[itemField.JIRA_URL].value?.split("/").pop();
			const { item } = entry;

			if (!issueKey) {
				await createJiraIssueFromGhTaskWithoutUrl({ gh, jira, item, project });
				continue;
			}

			if (entry.prevStatus === itemStatus.TODO) {
				if (entry.newStatus === itemStatus.WIP) {
					const err = await transitionJiraIssueToWip(jira, issueKey, item.id);
					if (err) continue;
					await githubProjectModel.upsertItems(project, item);
				}
				else if (entry.newStatus === itemStatus.DONE) {
					await transitionJiraIssueToWip(jira, issueKey, item.id);
					const err = await transitionJiraIssueToDone(jira, issueKey, item.id);
					if (err) continue;
					await githubProjectModel.upsertItems(project, item);
				}
				continue;
			}
			else if (entry.prevStatus === itemStatus.WIP) {
				if (entry.newStatus === itemStatus.DONE) {
					const err = await transitionJiraIssueToDone(jira, issueKey, item.id);
					if (err) continue;
					await githubProjectModel.upsertItems(project, item);
				}
				continue;
			}
		}

		for (const item of githubProjectModel.findNewItems(project, refreshedItems)) {
			await createJiraIssueFromGhTaskWithoutUrl({ jira, gh, item, project });
		}


		// to refresh the item, use the github client to retrieve all items again.
		// - then check for new github items and create and update
		// - then check for items with changes (status field for now) and update jira status.
	}
}

async function createJiraIssueFromGhTaskWithoutUrl(args: {
	gh: GithubClient,
	jira: JiraClient,
	item: Item,
	project: Project,
}) {
	const { gh, jira, item, project } = args;
	const actionOpts = syncCmd.opts<SyncOptions>();

	if (!item[itemField.JIRA_ISSUE_TYPE].value) {
		logger.warn(logname, "item does not have an issue type, skipping creation", { itemId: item.id, title: item[itemField.TITLE].value })
		return;
	}

	const accountId = actionOpts.ghAssigneesMap ? actionOpts.ghAssigneesMap[item[itemField.ASSIGNEES].value.pop() ?? ""] : undefined

	const [createRes, createErr] = await jira.issues.create({
		projectKey: actionOpts.jiraProjectKey,
		summary: item[itemField.TITLE].value,
		issueName: item[itemField.JIRA_ISSUE_TYPE].value,
		accountId,
	});

	if (createErr) {
		logger.error(logname, "unable to create jira issue", { itemId: item.id, err: createErr });
		return;
	}

	const [_, updateUrlErr] = await gh.projects.updateProjectItemField({
		itemId: item.id,
		fieldId: item[itemField.JIRA_URL].id,
		newValue: { text: createRes.issueUrl },
		projectId: project.id,
	});

	if (updateUrlErr) {
		logger.error(logname, "unable to update jira url in remote", { itemId: item.id, err: updateUrlErr });
		return;
	}

	item[itemField.JIRA_URL].value = createRes.issueUrl;
	const upsertErr = await githubProjectModel.upsertItems(project, item);

	if (upsertErr) {
		logger.error(logname, "unable to update jira url in local storage", { itemId: item.id, err: upsertErr });
		return;
	}

	if (item[itemField.STATUS].value === itemStatus.WIP) {
		await transitionJiraIssueToWip(jira, createRes.issueKey, item.id);
	}
	else if (item[itemField.STATUS].value === itemStatus.DONE) {
		await transitionJiraIssueToWip(jira, createRes.issueKey, item.id);
		await transitionJiraIssueToDone(jira, createRes.issueKey, item.id);
	}
}

async function updateJiraIssueFromGhTaskWithUrl(args: {
	jira: JiraClient,
	item: Item,
}) {
	const { jira, item } = args;

	const key = item[itemField.JIRA_URL].value?.split("/").pop() ?? "";
	if (item[itemField.STATUS].value === itemStatus.WIP) {
		await transitionJiraIssueToWip(jira, key, item.id);
	}
	else if (item[itemField.STATUS].value === itemStatus.DONE) {
		await transitionJiraIssueToWip(jira, key, item.id);
		await transitionJiraIssueToDone(jira, key, item.id);
	}

}

async function transitionJiraIssueToWip(jira: JiraClient, jiraIssueKey: string, ghItemId: string): Promise<Error | undefined> {
	let err: Error | undefined = undefined;
	const actionOpts = syncCmd.opts<SyncOptions>();

	for (const t of actionOpts.transitionsToWip ?? []) {
		err = await jira.issues.transition(jiraIssueKey, t);
		if (err) {
			logger.debug(logname, "unable to transition issue", { itemId: ghItemId, transition: t, err });
		}
	}
	return err;
}

async function transitionJiraIssueToDone(jira: JiraClient, jiraIssueKey: string, ghItemId: string): Promise<Error | undefined> {
	let err: Error | undefined = undefined;
	const actionOpts = syncCmd.opts<SyncOptions>();

	for (const t of actionOpts.transitionsToDone ?? []) {
		err = await jira.issues.transition(jiraIssueKey, t);
		if (err) {
			logger.debug(logname, "unable to transition issue", { itemId: ghItemId, transition: t, err });
		}
	}

	return err;
}
