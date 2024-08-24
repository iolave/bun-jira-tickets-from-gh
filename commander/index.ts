import { Command } from "commander";
import PackageJson from "../package.json"

const program = new Command(PackageJson.name)

program.version(PackageJson.version);
program.description("Generate Jira tickets from github project");

export default program
