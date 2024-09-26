import { Option } from "commander";

export type ListCmdOptions = {
	org: string,
} | {
	user: string,
}

const organization = new Option("--org <string>", "GitHub organization");
const user = new Option("--user <string>", "GitHub user");

organization.conflicts(user.name());
user.conflicts(organization.name());

export default {
	organization,
	user,
}
