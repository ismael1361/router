import express from "express";
import { router } from "./router";
import { IApplication, IStackLog } from "./type";
import fs from "fs";
import path from "path";

export const create = () => {
	const app = express();

	const innerRouter = router();
	app.use(innerRouter as any);

	const innerApplication = function (req: express.Request, res: express.Response, next: express.NextFunction) {
		return app(req, res, next);
	} as unknown as IApplication;

	innerApplication.listen = app.listen.bind(app);
	innerApplication.disable = app.disable.bind(app);
	innerApplication.enable = app.enable.bind(app);
	innerApplication.disabled = app.disabled.bind(app);
	innerApplication.enabled = app.enabled.bind(app);
	innerApplication.engine = app.engine.bind(app);
	innerApplication.param = app.param.bind(app);
	innerApplication.render = app.render.bind(app);

	innerApplication.getStacks = () => {
		const filePath = "./stacks.log";
		if (!fs.existsSync(path.resolve(process.cwd(), filePath))) {
			return [];
		}

		const records = fs
			.readFileSync(path.resolve(process.cwd(), filePath), "utf-8")
			.trim()
			.split(/\n(?=time=)/);
		const result: IStackLog[] = [];

		const pairRegex = /(\w+)=(?:"((?:\\[^]|[^"\\])*)"|(\S+))/g;

		for (const record of records) {
			if (!record.trim()) continue;

			const entry: IStackLog = {
				time: new Date(),
				level: "INFO",
				name: "",
				message: "",
				source: "",
				statusCode: 0,
				duration: 0,
				meta: "",
			};

			let match;
			pairRegex.lastIndex = 0; // reinicia a busca para cada registro

			while ((match = pairRegex.exec(record)) !== null) {
				const key = match[1];
				try {
					switch (key) {
						case "time":
							entry.time = new Date(match[2] || match[3]);
							continue;
						case "level":
							entry.level = (match[2] || match[3]) as any;
							continue;
						case "name":
							entry.name = match[2] || match[3] || "";
							continue;
						case "message":
							entry.message = match[2] || match[3] || "";
							continue;
						case "source":
							entry.source = match[2] || match[3] || "";
							continue;
						case "statusCode":
							entry.statusCode = Number(match[2] || match[3] || 0);
							continue;
						case "duration":
							entry.duration = Number(match[2] || match[3] || 0);
							continue;
						case "meta":
							try {
								entry.meta = match[2] || match[3] || "";
							} catch {
								entry.meta = "";
							}
							continue;
						default:
							(entry as any)[key] = (match[2] !== undefined ? match[2] : match[3]) ?? (entry as any)[key];
							continue;
					}
				} catch {}
			}

			result.push(entry);
		}

		return result;
	};

	innerApplication.defineStacks = (options) => {
		return {
			stacksPath: "",
		};
	};

	return Object.setPrototypeOf(innerApplication, Object.getPrototypeOf(innerRouter)) as unknown as IApplication;
};
