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

	const root = router() as unknown as IApp;
	app.use(root);

	root.listen = app.listen.bind(app);

	return root;
};
