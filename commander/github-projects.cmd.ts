import { Command } from "commander";
import logger from "../helpers/logger";
import type { ProgramGlobalOptions } from ".";
import { env } from "bun";
import util from "./util";
import GithubClient from "../services/github";

const githubProjectsCmdName = "github-projects";
const githubProjectsCmd = new Command(githubProjectsCmdName);
githubProjectsCmd.description("GitHub projects utilities");

const listOrganizationProjectsCmdName = "listOrganization";
const listOrganizationProjectsCmd = new Command(listOrganizationProjectsCmdName);
listOrganizationProjectsCmd.description("list GitHub projects for a given organization");
listOrganizationProjectsCmd.requiredOption("--org <ORG>", "GitHub organization");
listOrganizationProjectsCmd.action(async () => {
	const logName = "listOrganizationProjectsCmd.action";
	var { ghToken, verbose } = listOrganizationProjectsCmd.optsWithGlobals<ProgramGlobalOptions>();
	if (verbose) logger.enableVerboseMode();

	if (!ghToken) {
		logger.debug(logName, "unable to find github token in options");
		ghToken = env["GITHUB_TOKEN"]
	}

	if (!ghToken) {
		logger.debug(logName, "unable to find github token in env");
		return util.error(`either set "GITHUB_TOKEN" environment variable or the --gh-token option`)
	}

	const args = listOrganizationProjectsCmd.opts<{ org: string }>();
	logger.debug(logName, "parsed args", { args });

	const gh = new GithubClient(ghToken);
	logger.debug(logName, "created new github client");

	const [project, err] = await gh.projects.listOrganizationProjects(args.org);

	if (err) throw err;

	if (!logger.verbose()) console.log(JSON.stringify(project))
	else logger.debug(logName, "success", project);
	return util.success();
});

githubProjectsCmd.addCommand(listOrganizationProjectsCmd);

export default githubProjectsCmd;
