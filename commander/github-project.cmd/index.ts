import { Command } from "commander";
import listCmd from "./list.cmd";

const name = "github-project";
const githubProjectCmd = new Command(name);
githubProjectCmd.addCommand(listCmd);

export default githubProjectCmd;
