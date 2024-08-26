import { Command } from "commander";
import PackageJson from "../package.json"
import GithubClient from "../services/github";
import { env } from "bun";
import util from "./util";

type ProgramGlobalOptions = {
	ghToken?: string,
}
const program = new Command(PackageJson.name)
program.version(PackageJson.version);
program.description("Generate Jira tickets from github project");
program.option("--gh-token <TOKEN>", "GitHub token");

const listOrganizationProjectsCmd = new Command("listOrganizationProjects");
listOrganizationProjectsCmd.description("List GitHub projects for a given organization");
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

export default program

