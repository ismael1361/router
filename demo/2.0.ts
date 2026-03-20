import { create, Request } from "../src/2.0";

const app = create();
const port = 8080;

interface AuthRequest extends Request<"userId" | "id", { user?: { id: string; roles: string[] } }> {
	user: { id: string; roles: string[] };
}

const authMiddleware = (req: AuthRequest, res: any, next: any) => {
	const { user } = req;
	console.log("Console:", `Hello, ${user.id}!`);
	next();
};

app.get("/hello/:username/:id")
	.handle(authMiddleware)
	.handle<
		Request<
			any,
			{
				id: string;
			}
		>
	>((req, res, next) => {
		const { user } = req;
		const { id } = req.body;
		console.log("Console:", `Hello, ${user.id}! Your ID is ${id}.`);
		next();
	})
	.handle((req, res) => {
		const { username } = req.params;
		const { id } = req.body;
		res.send(`Hello, ${username}! Your ID is ${id}.`);
	});

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
