import express from "express";
import { router } from "./router";
import { IRouter } from "./type";

interface IApp extends IRouter {
	listen: express.Application["listen"];
	disable: express.Application["disable"];
	enable: express.Application["enable"];
	disabled: express.Application["disabled"];
	enabled: express.Application["enabled"];
	engine: express.Application["engine"];
	param: express.Application["param"];
	render: express.Application["render"];
}

export const create = () => {
	const app = express();

	const innerRouter = router();
	app.use(innerRouter);

	const innerApplication = function (req: express.Request, res: express.Response, next: express.NextFunction) {
		return app(req, res, next);
	} as unknown as IApp;

	innerApplication.listen = app.listen.bind(app);
	innerApplication.disable = app.disable.bind(app);
	innerApplication.enable = app.enable.bind(app);
	innerApplication.disabled = app.disabled.bind(app);
	innerApplication.enabled = app.enabled.bind(app);
	innerApplication.engine = app.engine.bind(app);
	innerApplication.param = app.param.bind(app);
	innerApplication.render = app.render.bind(app);

	return Object.setPrototypeOf(innerApplication, innerRouter) as unknown as IApp;
};
