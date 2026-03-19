import { create } from "../src/2.0";

const app = create();
const port = 8080;

app.get("/hello/:username")
	.handle<{
		name: string;
	}>((req, res, next) => {
		const { name } = req.body;
		console.log("Console:", `Hello, ${name}!`);
		next();
	})
	.handle((req, res) => {
		const { name } = req.body;
		res.send(`Hello, ${name}!`);
	});

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
