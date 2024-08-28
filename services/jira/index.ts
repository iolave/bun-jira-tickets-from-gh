import issues from "./issues";
import users from "./users";

export default class JiraClient {
	private token: string;
	private subdomain: string;

	constructor(token: string, subdomain: string) {
		this.token = token;
		this.subdomain = subdomain;
	}

	public users = {
		searchByEmail: (email: string) => users.searchByEmail(this.token, this.subdomain, email),
	}

	public issues = {
		create: (projectKey: string, summary: string, assigneeEmail: string, issueName: string) => {
			return issues.create(this.token, this.subdomain, projectKey, summary, issueName, assigneeEmail, [])
		},
	}
}
