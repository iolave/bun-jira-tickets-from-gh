import { Command } from "commander";
import PackageJson from "../package.json"
import githubProjectsCmd from "./github-projects.cmd";
import syncCmd from "./sync.cmd";

export type ProgramGlobalOptions = {
	ghToken?: string,
	verbose?: boolean,
}

const program = new Command(PackageJson.name)
program.version(PackageJson.version);
program.description("generate Jira tickets from github project");
program.option("--gh-token <TOKEN>", "GitHub token");
program.option("-v --verbose", "verbose mode");

program.addCommand(githubProjectsCmd);
program.addCommand(syncCmd);

export default program

