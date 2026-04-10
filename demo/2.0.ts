import { create, middleware, router, handler, doc, Request, Middlewares } from "../src/2.0";

const app = create();
const port = 3030;

interface AuthRequest extends Request<"userId" | "id"> {
	user: { userId: string; id: string; roles: string[] };
}

const authMiddleware = middleware((req: AuthRequest, res: any, next: any) => {
	req.executeOnce?.();
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

const getUserDoc = doc({ tags: ["Users"] });

const getUserHandler = handler(authMiddleware)
	.handler((req, res, next) => {
		const { user } = req;
		console.log("Console {handler}:", `Hello, ${user.id}! Your ID is ${user.userId}.`);
		next();
	})
	.doc(getUserDoc);

const routeV1 = router();

routeV1
	.get("/hello/:userId/:id")
	.handler(getUserHandler)
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
}).defineSwagger({
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
	servers: [
		{
			url: "http://localhost:3030/v1",
			description: "Servidor Local",
		},
	],
});

// app.all("*", (req: any, res: any) => {
// 	res.status(404).send({ error: "Not found" });
// });

// console.log(JSON.stringify(app.getSwagger(), null, 2));

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
