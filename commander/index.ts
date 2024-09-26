import { Command } from "commander";
import PackageJson from "../package.json"
import syncCmd from "./sync.cmd";
import githubProjectCmd from "./github-project.cmd";
import options from "./index.options";

export type ProgramGlobalOptions = {
	ghToken?: string,
	jiraToken?: string,
	verbose?: boolean,
}

const program = new Command(PackageJson.name)
	.version(PackageJson.version)
	.description("generate Jira tickets from github project")
	.addOption(options.githubToken)
	.addOption(options.jiraToken)
	.addOption(options.verbose)
	.addCommand(githubProjectCmd)
	.addCommand(syncCmd);

export default program;

