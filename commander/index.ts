import { Command, Option } from "commander";
import PackageJson from "../package.json"
import GithubClient from "../services/github";
import { env } from "bun";
import util from "./util";

type ProgramGlobalOptions = {
	ghToken?: string,
}
const program = new Command(PackageJson.name)
program.version(PackageJson.version);
program.description("generate Jira tickets from github project");
program.option("--gh-token <TOKEN>", "GitHub token");

const listOrganizationProjectsCmd = new Command("listOrganizationProjects");
listOrganizationProjectsCmd.description("list GitHub projects for a given organization");
listOrganizationProjectsCmd.requiredOption("--org <ORG>", "GitHub organization");
listOrganizationProjectsCmd.action(async () => {
	var { ghToken } = listOrganizationProjectsCmd.optsWithGlobals<ProgramGlobalOptions>();

	if (!ghToken) ghToken = env["GITHUB_TOKEN"];

	if (!ghToken) return util.error(`either set "GITHUB_TOKEN" environment variable or the --gh-token option`);

	const args = listOrganizationProjectsCmd.opts<{ org: string }>();

	const gh = new GithubClient(ghToken);
	const [project, err] = await gh.projects.listOrganizationProjects(args.org);

	if (err) throw err;

	console.log(JSON.stringify(project))

	return util.success();
});
program.addCommand(listOrganizationProjectsCmd);

const syncCmd = new Command("sync");
syncCmd.description("sync GitHub project tickets with Jira");
const mapGhAssigneeOption = new Option("--gh-assignees-map [GH_USER:JIRA_USER,...]", "map of GitHub users to Jira ones");
mapGhAssigneeOption.argParser<Record<string, string | undefined>>((value, _prev) => {
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
syncCmd.requiredOption("--project-id [id]", "Github project ID")
syncCmd.action(async () => {
	const requiredFields = [
		{ name: "Estimate", select: false },
		{ name: "Jira", select: true },
		{ name: "Jira URL", select: false },
		{ name: "Status", select: true },
		{ name: "Assignees", select: false },
		{ name: "Title", select: false },
		{ name: "Repository", select: false }
	];
	var { ghToken } = syncCmd.optsWithGlobals<ProgramGlobalOptions>();
	if (!ghToken) ghToken = env["GITHUB_TOKEN"];
	if (!ghToken) return util.error(`either set "GITHUB_TOKEN" environment variable or the --gh-token option`);

	const { projectId, ghAssigneesMap } = syncCmd.opts<{ projectId: string, ghAssigneesMap: Record<string, string | undefined> }>();

	const gh = new GithubClient(ghToken);
	const [projectFields, projectFieldsErr] = await gh.projects.getProjectFields(projectId);

	if (projectFieldsErr) throw projectFieldsErr;

	for (const rf of requiredFields) {
		const filter = projectFields?.filter(pf => pf.name === rf.name);
		if (!filter) return util.error(`field "${rf.name}" not found in GitHub project`);
		if (filter.length === 0) return util.error(`field "${rf.name}" not found in GitHub project`);
		if (filter.length !== 1) return util.error(`field "${rf.name}" is duplicated GitHub project`);
		const pf = filter[0];
		if (rf.select && !pf.options) return util.error(`field "${rf.name}" is not of type select`);
		if (!rf.select && pf.options) return util.error(`field "${rf.name}" is of type select`);
	}

	const [projectItems, projectItemsErr] = await gh.projects.getProjectItems(projectId);
	if (projectItemsErr !== null) return util.error(projectItemsErr);

	for (const pi of projectItems) {
		if (pi.title === null) return util.error(`missing task title`);
	}
});
program.addCommand(syncCmd);

export default program

