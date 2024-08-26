import projects from "./projects";

export default class GithubClient {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	public projects = {
		listOrganizationProjects: (org: string) => projects.listOrganizationProjects(this.token, org),
	}
}
