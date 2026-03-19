import express from "express";
import { router } from "./router";

export const create = () => {
	const app = express();

	const r = router();
	app.use(r);

	return {
		listen: app.listen.bind(app),
		...r,
	};
};
