import listCmd from "./list.cmd";
import util from "../util";
import type { ProgramGlobalOptions } from "../index.options";
import type { ListCmdOptions } from "./list.options";
import listOptions from "./list.options";
import logger from "../../helpers/logger";
import GithubClient from "../../services/github";

const logName = "github-project.list";

export default async function(): Promise<void> {
	const globalOpts = listCmd.optsWithGlobals<ProgramGlobalOptions>();
	const opts = listCmd.opts<ListCmdOptions>();
	util.checkOneOfOptions(opts, listOptions.organization, listOptions.user);
	if (globalOpts.verbose) logger.enableVerboseMode();
	const ghToken = util.getGithubToken(globalOpts);

	logger.debug(logName, "parsed args", { opts });
	logger.debug(logName, "creating github client");
	const githubClient = new GithubClient(ghToken);


	if ("user" in opts) {
		logger.debug(logName, "retrieving user projects");
		const [project, err] = await githubClient.projects.listUserProjects(opts.user);

		if (err) throw err;

		if (!logger.verbose()) console.log(JSON.stringify(project))
		else logger.debug(logName, "success", project);
		return util.success();
	} else {
		logger.debug(logName, "retrieving organization projects");
		const [project, err] = await githubClient.projects.listOrganizationProjects(opts.org);

		if (err) throw err;

		if (!logger.verbose()) console.log(JSON.stringify(project))
		else logger.debug(logName, "success", project);
		return util.success();
	}
}
