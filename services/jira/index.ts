import logger, { safeString } from "../../helpers/logger";
import issues from "./issues";
import users from "./users";

const logName = "JiraClient"

export default class JiraClient {
	private token: string;
	private subdomain: string;

	constructor(token: string, subdomain: string) {
		logger.debug(logName, "called constructor", { subdomain, token: safeString(token) });
		this.token = token;
		this.subdomain = subdomain;
	}

	public users = {
		searchByEmail: (email: string) => {
			return users.searchByEmail(this.token, this.subdomain, email)
		},
	}

	public issues = {
		create: (args: { projectKey: string, summary: string, accountId?: string, issueName: string, storyPointsField: { name: string, points?: number }, }) => {
			return issues.create({
				token: this.token,
				subdomain: this.subdomain,
				...args,
				content: []
			});
		},
		transition: (issueKey: string, transitionId: number) => issues.transitionIssue(this.token, this.subdomain, issueKey, transitionId),
	}
}
