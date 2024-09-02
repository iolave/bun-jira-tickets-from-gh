import { Command, Option } from "commander";
import util from "./util";
import type { ProgramGlobalOptions } from ".";
import logger from "../helpers/logger";
import { env } from "bun";
import GithubClient from "../services/github";
import JiraClient from "../services/jira";
import GithubProject from "../business-logic/github-project";

type SyncOptions = {
	ghProjectId: string,
	ghAssigneesMap?: Record<string, string | undefined>,
	jiraProjectKey: string,
	jiraSubdomain: string,
	transitionsToWip?: number[],
	transitionsToDone?: number[],
	sleepTime?: number,
}

const syncCmdName = "sync";
const syncCmd = new Command(syncCmdName);
syncCmd.description("sync GitHub project tickets with Jira");

const transitionsToWipOption = new Option("--transitions-to-wip <NUMBER,...>", "list of jira issue transitions in order to have a wip task");
transitionsToWipOption.argParser<SyncOptions["transitionsToWip"]>((value, _prev) => {
	const [option, error] = util.numberArrayFromString(value, ",");
	if (error) return util.error(error);
	return option
});
syncCmd.addOption(transitionsToWipOption);

const transitionsToDoneOption = new Option("--transitions-to-done <NUMBER,...>", "list of jira issue transitions in order to have a done task");
transitionsToDoneOption.argParser<SyncOptions["transitionsToWip"]>((value, _prev) => {
	const [option, error] = util.numberArrayFromString(value, ",");
	if (error) return util.error(error);
	return option
});
syncCmd.addOption(transitionsToDoneOption);

const mapGhAssigneeOption = new Option("--gh-assignees-map <GH_USER:JIRA_USER,...>", "map of GitHub users to Jira ones (email)");
mapGhAssigneeOption.argParser<SyncOptions["ghAssigneesMap"]>((value, _prev) => {
	const map: Record<string, string | undefined> = {}
	const commaSplitted = value.split(",");

	for (const pair of commaSplitted) {
		const pairSplitted = pair.split(":");
		if (pairSplitted.length !== 2) util.error(`"${mapGhAssigneeOption.name()}" option does not match format "${mapGhAssigneeOption.flags.split(" ").at(1)}"`);

		map[`${pairSplitted[0]}`] = pairSplitted[1];
	}
	return map;
});
syncCmd.addOption(mapGhAssigneeOption);
syncCmd.option("--sleep-time <ms>", "sleep time between executions. If not specified the program will run once");
syncCmd.requiredOption("--gh-project-id <STRING>", "Github project ID");
syncCmd.requiredOption("--jira-project-key <STRING>", "Jira project KEY");
syncCmd.requiredOption("--jira-subdomain <STRING>", "Jira subdomain");
syncCmd.action(async () => {
	const logName = "syncCmd.action";
	var { ghToken, verbose, jiraToken } = syncCmd.optsWithGlobals<ProgramGlobalOptions>();
	const args = syncCmd.opts<SyncOptions>();
	if (verbose) logger.enableVerboseMode();

	logger.debug(logName, "parsed args", { args });

	if (!ghToken) {
		logger.debug(logName, "unable to find github token in options");
		ghToken = env["GITHUB_TOKEN"]
	}

	if (!ghToken) {
		logger.debug(logName, "unable to find github token in env");
		return util.error(`either set "GITHUB_TOKEN" environment variable or the --gh-token option`)
	}

	if (!jiraToken) {
		logger.debug(logName, "unable to find jira token in options");
		jiraToken = env["JIRA_TOKEN"]
	}

	if (!jiraToken) {
		logger.debug(logName, "unable to find jira token in env");
		return util.error(`either set "JIRA_TOKEN" environment variable or the --jira-token option`)
	}

	const gh = new GithubClient(ghToken);
	logger.debug(logName, "created new github client");

	const project = new GithubProject(gh);
	logger.info(logName, "loading github project", { id: args.ghProjectId })
	const initErr = await project.init(args.ghProjectId);
	if (initErr) return util.error(initErr);

	/* THIS IS WIP CODE TO TEST THE JIRA ISSUE CREATION!!!!! */
	const jira = new JiraClient(jiraToken, args.jiraSubdomain);
	logger.debug(logName, "created new jira client");

	if (args.ghAssigneesMap) for (const [ghUser, jiraEmail] of Object.entries(args.ghAssigneesMap)) {
		const [userRes, userErr] = await jira.users.searchByEmail(jiraEmail!);
		if (userErr) return util.error(userErr);
		args.ghAssigneesMap[ghUser] = userRes.accountId;
		logger.debug(logName, "mapped github user", { ghUser, jiraEmail, jiraAccountId: userRes.accountId });
	}

	do {
		const [items, itemsErr] = project.getItems();
		if (itemsErr) return util.error(itemsErr);

		for (const pi of items) {
			// TODO: if task already have a jira issue sync issue and task
			if (pi.jiraUrl) {
				logger.debug(logName, "skipping creation, issue already created", { itemId: pi.id, title: pi.title, url: pi.jiraUrl });

				continue;
			}

			logger.info(logName, "creating jira issue", { itemId: pi.id, title: pi.title });
			var accountId = "";
			if (args.ghAssigneesMap) accountId = pi.assignee ? args.ghAssigneesMap[pi.assignee] ?? "" : "";

			const [createRes, createErr] = await jira.issues.create({
				projectKey: args.jiraProjectKey,
				summary: pi.title,
				accountId,
				issueName: pi.jiraIssueType
			});
			if (createErr) {
				logger.error(logName, "error in issue creation", createErr);
				continue;
			}

			logger.info(logName, "created issue", { itemId: pi.id, url: createRes.issueUrl });
			// UPDATE URL FIELD
			const updateUrlErr = await project.updateJiraUrl(pi.id, createRes.issueUrl);
			if (updateUrlErr) logger.error(logName, "unable to update jira url in github", updateUrlErr);

			// UPDATE TASK STATUS
			var transitions: number[] = [];
			if (pi.status === "In Progress" && args.transitionsToWip)
				transitions = args.transitionsToWip;
			else if (pi.status === "Done" && args.transitionsToWip && args.transitionsToDone)
				transitions = [...args.transitionsToWip, ...args.transitionsToDone];

			// TODO: detect next transition instead of trying em all
			for (const t of transitions) {
				const err = await jira.issues.transition(createRes.issueKey, t);
				if (!err) {
					logger.info(logName, `transitioned task "${createRes.issueKey}" with transition "${t}"`, { itemId: pi.id });
					continue;
				}

				logger.error(logName, `unable to transition task "${createRes.issueKey}" with transition "${t}"`, { itemId: pi.id });
				continue;
			}

		}

		if (args.sleepTime && args.sleepTime >= 0) {
			logger.info(logName, `sleeping for ${args.sleepTime}ms...`)
			await new Promise(res => setTimeout(() => res(undefined), args.sleepTime))


			logger.info(logName, `refreshing github project items`, { projectId: args.ghProjectId })
			const refreshErr = await project.refreshProjectItems();
			if (refreshErr) logger.error(logName, "got an error when refreshing github project items", refreshErr);
		}
	} while (args.sleepTime && args.sleepTime >= 0);
});

export default syncCmd;

