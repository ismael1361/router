import { create, middleware, router, Request } from "../src/2.0";

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

app.get("/hello/:userId/:id")
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
		parameters: [
			{
				name: "userId",
				in: "path",
				required: true,
				schema: { type: "string" },
			},
			{
				name: "id",
				in: "path",
				required: true,
				schema: { type: "string" },
			},
		],
		summary: "Get router",
	});

const routeV1 = router();

routeV1
	.get("/test/route")
	.handler((req, res) => {
		res.send(`Hello from route!`);
	})
	.doc({
		summary: "Get router v1",
		tags: ["V1"],
	});

app.route("/v1", routeV1, {
	security: [{ bearerAuth: [] }],
	responses: {
		"400": {
			description: "Account not found",
		},
		"404": {
			description: "Not found",
		},
	},
});

app.defineSwagger({
	openapi: "3.0.0",
	info: { title: "My API", version: "1.0.0" },
	defaultResponses: {
		400: { description: "Dados inválidos" },
		401: {
			description: "Falha na autenticação",
		},
		403: { description: "Acesso negado" },
		500: { description: "Erro interno do servidor" },
	},
});

// console.log(JSON.stringify(app.getSwagger(), null, 2));

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
