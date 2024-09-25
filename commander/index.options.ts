import { Option } from "commander";
import environment from "./environment";

export type ProgramGlobalOptions = {
	ghToken?: string,
	jiraToken?: string,
	verbose?: boolean,
}

const verbose = new Option("-v --verbose", "verbose mode");

const githubToken = new Option("--gh-token <string>", "GitHub token")
	.env(environment.githubToken);

const jiraToken = new Option("--jira-token <string>", "Jira token")
	.env(environment.jiraToken);

export default {
	verbose,
	githubToken,
	jiraToken,
}
