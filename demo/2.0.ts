import { create, middleware, Request } from "../src/2.0";

const app = create();
const port = 8080;

interface AuthRequest extends Request<"userId" | "id"> {
	user: { userId: string; id: string; roles: string[] };
}

const authMiddleware = middleware((req: AuthRequest, res: any, next: any) => {
	console.log(req.params, req.body, req.query);
	const { userId = "", id = "" } = req.params;
	req.user = { userId, id, roles: ["admin"] };
	console.log("Console:", `Hello, ${userId}!`);
	next();
}).doc({
	security: [{ bearerAuth: [] }],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
			},
		},
	},
});

const route = app
	.get("/hello/:userId/:id")
	.handler(authMiddleware)
	.handler((req, res, next) => {
		const { user } = req;
		console.log("Console:", `Hello, ${user.id}! Your ID is ${user.userId}.`);
		next();
	})
	.doc({
		tags: ["Users"],
	})
	.handler((req, res) => {
		const { userId } = req.params;
		res.send(`Hello, ${userId}! Your ID is ${req.user.userId}.`);
	})
	.doc({
		summary: "Get router",
	});

console.log(JSON.stringify((app as any).__chain_docs__, null, 2));

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
