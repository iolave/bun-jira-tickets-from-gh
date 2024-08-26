import projects from "./projects";

export default class GithubClient {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	public projects = {
		listOrganizationProjects: (org: string) => projects.listOrganizationProjects(this.token, org),
		getProjectFields: (id: string) => projects.getProjectFields(this.token, id),
		getProjectItems: (id: string) => projects.getProjectItems(this.token, id),
	}
}
