import { Command, Option } from "commander";
import util from "./util";
import syncAction from "./sync.action";

export type SyncOptions = {
	ghProjectId: string,
	ghAssigneesMap?: Record<string, string | undefined>,
	jiraProjectKey: string,
	jiraSubdomain: string,
	transitionsToWip?: number[],
	transitionsToDone?: number[],
	sleepTime?: number,
	jiraIssuePrefix?: string,
	jiraEstimateField?: string,
}

const syncCmdName = "sync";
const syncCmd = new Command(syncCmdName);
syncCmd.description("sync GitHub project tickets with Jira");

const transitionsToWipOption = new Option("--transitions-to-wip <number,...>", "list of jira issue transitions in order to have a wip task");
transitionsToWipOption.argParser<SyncOptions["transitionsToWip"]>((value, _prev) => {
	const [option, error] = util.numberArrayFromString(value, ",");
	if (error) return util.error(error);
	return option
});
syncCmd.addOption(transitionsToWipOption);

const transitionsToDoneOption = new Option("--transitions-to-done <number,...>", "list of jira issue transitions in order to have a done task");
transitionsToDoneOption.argParser<SyncOptions["transitionsToWip"]>((value, _prev) => {
	const [option, error] = util.numberArrayFromString(value, ",");
	if (error) return util.error(error);
	return option
});
syncCmd.addOption(transitionsToDoneOption);

const mapGhAssigneeOption = new Option("--gh-assignees-map <gh_user:jira_user,...>", "map of GitHub users to Jira ones (email)");
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
syncCmd.requiredOption("--gh-project-id <string>", "Github project ID");
syncCmd.requiredOption("--jira-project-key <string>", "Jira project KEY");
syncCmd.requiredOption("--jira-subdomain <string>", "Jira subdomain");
// Jira issue prefix to be appended to title
const jiraIssuePrefixOption = new Option("--jira-issue-prefix <string>", "prefix to be added to jira issue title");
syncCmd.addOption(jiraIssuePrefixOption);

const jiraEstimateFieldOpt = new Option("--jira-estimate-field <string>", "Jira field name that holds estiamte value");
syncCmd.addOption(jiraEstimateFieldOpt);

syncCmd.action(syncAction);

export default syncCmd;

