import { middleware, create, route, Request } from "../src";
import express from "express";

const app = express();
const port = 8080;

app.enable("trust proxy");

interface AuthRequest extends Request<"userId" | "id", any> {
	body: { user?: { id: string; roles: string[] } };
	user: { id: string; roles: string[] };
}

interface FileRequest extends Request<"key", { fileName: string }> {
	files: File[];
}

export const authMiddleware = middleware<AuthRequest>(
	(req, res, next) => {
		next();
	},
	{
		security: [{ BearerAuth: [] }],
		components: {
			securitySchemes: {
				BearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
				},
			},
		},
	},
);

export const fileMiddleware = middleware<FileRequest>((req, res, next) => {
	next();
});

// 3. Use o middleware em uma rota.
const userRouter = create().middleware(authMiddleware);

userRouter
	.get("/profile")
	.middleware(authMiddleware) // Aplica o middleware à rota
	.middleware(fileMiddleware) // Aplica o middleware à rota
	.handler((req, res) => {
		// 'req.user' está disponível e fortemente tipado aqui.
		req.body.user?.id;
		req.files;
		res.json({ profile: req.user });
	})
	.doc({
		summary: "Get user profile",
	});

userRouter
	.post("/profile")
	.handler((req, res) => {
		res.json({});
	})
	.doc({
		summary: "Post user profile",
	});

userRouter
	.get("/teste")
	.handler((req, res) => {
		res.json({});
	})
	.doc({
		summary: "Get router",
	});

const v1_router = route("/v1");

v1_router
	.get("/users")
	.handler((req, res) => res.json({ users: [] }))
	.doc({
		summary: "Listar todos os usuários",
		tags: ["Users"],
	});
v1_router.post("/users").handler((req, res) => res.json({ users: [] }));

userRouter.by(v1_router);

console.log(userRouter.router.stack);

userRouter.get("/routes").handler((req, res) => res.json(userRouter.router.stack));

userRouter.get("/doc").handler((req, res) =>
	res.json(
		userRouter.getSwagger(
			{ openapi: "3.0.0", info: { title: "My API", version: "1.0.0" } },
			{
				400: { description: "Dados inválidos" },
				401: {
					description: "Falha na autenticação",
				},
				403: { description: "Acesso negado" },
				500: { description: "Erro interno do servidor" },
			},
		),
	),
);

app.use(userRouter.router);

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
