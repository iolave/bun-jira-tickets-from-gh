import { Command } from "commander";
import PackageJson from "../package.json"
import GithubClient from "../services/github";
import { env } from "bun";
import { ExitStatus } from "typescript";

const program = new Command(PackageJson.name)

program.version(PackageJson.version);
program.description("Generate Jira tickets from github project");

const listOrganizationProjectsCmd = new Command("listOrganizationProjects");
listOrganizationProjectsCmd.description("List GitHub projects for a given organization");
listOrganizationProjectsCmd.requiredOption("--org <ORG>", "GitHub organization");

listOrganizationProjectsCmd.action(async () => {
	const args = listOrganizationProjectsCmd.opts<{ org: string }>();
	const token = env["GITHUB_TOKEN"];

	if (!token) {
		console.log(`Please set "GITHUB_TOKEN" environment variable`);
		process.exit(ExitStatus.DiagnosticsPresent_OutputsSkipped)
	}

	const gh = new GithubClient(token);
	const [project, err] = await gh.projects.listOrganizationProjects(args.org);

	if (err) throw err;

	console.log(JSON.stringify(project))

	process.exit(ExitStatus.Success);
});

program.addCommand(listOrganizationProjectsCmd);

export default program

