import { create, Request } from "../src/2.0";

const app = create();
const port = 8080;

interface AuthRequest extends Request<"userId" | "id", { user?: { id: string; roles: string[] } }> {
	user: { id: string; roles: string[] };
}

app.get("/hello/:username")
	.handle((req: AuthRequest, res, next) => {
		const { user } = req;
		console.log("Console:", `Hello, ${user.id}!`);
		next();
	})
	.handle<{
		id: string;
	}>((req, res, next) => {
		const {} = req.params;
		const { name, id } = req.body;
		console.log("Console:", `Hello, ${name}! Your ID is ${id}.`);
		next();
	})
	.handle((req, res) => {
		const { name, id } = req.body;
		res.send(`Hello, ${name}!`);
	});

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
