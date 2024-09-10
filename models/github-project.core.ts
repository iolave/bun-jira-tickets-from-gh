import * as files from "@iolave/utils/files";
import { safe } from "@iolave/utils/functions";
import fs from "fs";
import { itemSchema, type Item, type Project } from "./github-project.types";
import logger from "../helpers/logger";
import * as json from "@iolave/utils/json";

const log = {
	loader: "models.githubProject.loader",
} as const;

export async function loadFile(projectId: string): Promise<Project> {
	const projectFile = `./data/ghp_${projectId}.json`;

	if (!fs.existsSync(projectFile)) {
		logger.debug(log.loader, "file does not exists", { projectFile });
		const err = await files.writeAtTheEnd(projectFile, "");
		if (err) {
			logger.fatal(log.loader, "file to create empty file", { projectFile, err });
		}

		logger.debug(log.loader, "empty file created", { projectFile, err });
	}


	logger.debug(log.loader, "reading file", { projectFile });
	const [buf, bufErr] = safe(() => fs.readFileSync(projectFile));
	if (bufErr) {
		logger.fatal(log.loader, "failed to read file", bufErr);
	}

	const items: Item[] = [];
	const lines = buf!.toString().split("\n");
	for (const line of lines) {
		if (line === "") continue;
		const [jsonLine, jsonLineErr] = json.parse(line);
		if (jsonLineErr) {
			logger.fatal(log.loader, "failed to parse line to json", { line, projectFile, err: jsonLineErr });
		}

		const zResult = itemSchema.safeParse(jsonLine);
		if (zResult.error) logger.fatal(log.loader, "line schema contains invalid content", { projectFile, line, err: zResult.error });
		items.push(zResult.data!)
	}

	return { id: projectId, items };
}

export async function writeProject(project: Project): Promise<Error | undefined> {
	const content = project.items.map(i => JSON.stringify(i)).join("\n");
	const projectFile = `./data/ghp_${project.id}.json`;
	const tmpPath = `./data/ghp_${project.id}.json.tmp`;

	const [_2, rmErr] = safe(() => fs.rmSync(tmpPath, { force: true }));
	if (rmErr) return rmErr;

	const writeErr = await files.writeAtTheEnd(tmpPath, content);
	if (writeErr) return writeErr;


	const [_3, mvErr] = safe(() => fs.renameSync(tmpPath, projectFile));
	if (mvErr) return mvErr;
	return undefined;
}

