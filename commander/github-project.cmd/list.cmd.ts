import { Command } from "commander";
import listAction from "./list.action";
import listOptions from "./list.options";

const name = "list";
const listCmd = new Command(name)
	.addOption(listOptions.organization)
	.addOption(listOptions.user)
	.action(listAction);

export default listCmd;

