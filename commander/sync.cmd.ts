import { Command, Option } from "commander";
import util from "./util";
import type { ProgramGlobalOptions } from ".";
import logger from "../helpers/logger";
import { env } from "bun";
import GithubClient from "../services/github";
import JiraClient from "../services/jira";

type SyncOptions = {
	ghProjectId: string,
	ghAssigneesMap: Record<string, string | undefined>,
	jiraProjectKey: string,
	jiraSubdomain: string,
}

const syncCmdName = "sync";
const syncCmd = new Command(syncCmdName);
syncCmd.description("sync GitHub project tickets with Jira");

const mapGhAssigneeOption = new Option("--gh-assignees-map <GH_USER|JIRA_USER,...>", "map of GitHub users to Jira ones");
mapGhAssigneeOption.argParser<SyncOptions["ghAssigneesMap"]>((value, _prev) => {
	const map: Record<string, string | undefined> = {}
	const commaSplitted = value.split(",");

	for (const pair of commaSplitted) {
		const pairSplitted = pair.split("|");
		if (pairSplitted.length !== 2) util.error(`"${mapGhAssigneeOption.name()}" option does not match format "${mapGhAssigneeOption.flags.split(" ").at(1)}"`);

		map[`${pairSplitted[0]}`] = pairSplitted[1];
	}
	return map;
});
syncCmd.addOption(mapGhAssigneeOption);
syncCmd.requiredOption("--gh-project-id <STRING>", "Github project ID");
syncCmd.requiredOption("--jira-project-key <STRING>", "Jira project KEY");
syncCmd.requiredOption("--jira-subdomain <STRING>", "Jira subdomain");
syncCmd.action(async () => {
	const logName = "syncCmd.action";
	var { ghToken, verbose, jiraToken } = syncCmd.optsWithGlobals<ProgramGlobalOptions>();
	if (verbose) logger.enableVerboseMode();

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

	const requiredFields = {
		"Estimate": { select: false },
		"Jira issue type": { select: true },
		"Jira URL": { select: false },
		"Status": { select: true },
		"Assignees": { select: false },
		"Title": { select: false },
		"Repository": { select: false },
	} as const;

	logger.debug(logName, "required fields", { requiredFields });

	const args = syncCmd.opts<SyncOptions>();
	logger.debug(logName, "parsed args", { args });

	const gh = new GithubClient(ghToken);
	logger.debug(logName, "created new github client");

	const [projectFields, projectFieldsErr] = await gh.projects.getProjectFields(args.ghProjectId);
	if (projectFieldsErr) throw projectFieldsErr;
	logger.debug(logName, "retrieved project fields", projectFields);

	for (const rf of Object.entries(requiredFields)) {
		const [name, opts] = rf;
		logger.debug(logName, "validating project field type", { field: name });
		const filter = projectFields?.filter(pf => pf.name === name);
		if (!filter) return util.error(`field "${name}" not found in GitHub project`);
		if (filter.length === 0) return util.error(`field "${name}" not found in GitHub project`);
		if (filter.length !== 1) return util.error(`field "${name}" is duplicated GitHub project`);
		const pf = filter[0];
		if (opts.select && !pf.options) return util.error(`field "${name}" is not of type select`);
		if (!opts.select && pf.options) return util.error(`field "${name}" is of type select`);
	}

	const [projectItems, projectItemsErr] = await gh.projects.getProjectItems(args.ghProjectId);
	if (projectItemsErr !== null) return util.error(projectItemsErr);
	logger.debug(logName, "retrieved project items", projectItems);

	/* THIS IS WIP CODE TO TEST THE JIRA ISSUE CREATION!!!!! */
	const jira = new JiraClient(jiraToken, args.jiraSubdomain);
	logger.debug(logName, "created new jira client");

	for (const pi of projectItems) {
		logger.debug(logName, "validating project item properties", { item: pi });
		if (pi.title === null) return util.error(`missing task title`);

		// TODO: if task already have a jira issue sync issue and task
		if (pi.jiraUrl) {
			logger.info(logName, "skipping creation, issue already created", { title: pi.title, url: pi.jiraUrl });

			continue;
		}

		logger.info(logName, "creating jira issue", { title: pi.title });
		const accountId = pi.assignee ? args.ghAssigneesMap[pi.assignee] ?? "" : "";
		const [createRes, createErr] = await jira.issues.create(args.jiraProjectKey, pi.title ?? "", accountId, pi.jiraIssueType);
		if (createErr) {
			logger.error(logName, "error in issue creation", createErr);
			continue;
		}

		logger.info(logName, "created issue", { url: createRes.issueUrl });
		// UPDATE URL FIELD
		const urlFieldId = projectFields.filter(pf => pf.name === "Jira URL").at(0)?.id ?? "";
		const [updateUrlRes, updateUrlErr] = await gh.projects.updateProjectItemField({
			projectId: args.ghProjectId,
			itemId: pi.id,
			fieldId: urlFieldId,
			newValue: { text: createRes.issueUrl }
		});

		if (updateUrlErr) logger.error(logName, "unable to update jira url in github", updateUrlErr);
		else logger.info(logName, "updated jira url in github", { updateId: updateUrlRes.data.updateProjectV2ItemFieldValue.clientMutationId });

	}
});

export default syncCmd;

