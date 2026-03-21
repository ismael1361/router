import express from "express";
import { IRouter, router } from "./router";

interface IApp extends IRouter {
	listen: express.Application["listen"];
}

export const create = () => {
	const app = express();

	const root = router() as unknown as IApp;
	app.use(root);

	root.listen = app.listen.bind(app);

	return root;
};
