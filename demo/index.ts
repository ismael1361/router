import { middleware, create, route, Request } from "../src";

interface AuthRequest extends Request<"userId" | "id", { userId: string; user?: Record<string, any> }> {
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
		req.body.user?.name;
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
	.get("/v1")
	.handler((req, res) => {
		res.json({});
	})
	.doc({
		summary: "Get router",
	});

const router = route("/v1");

userRouter.by(router);

console.log(
	JSON.stringify(
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
		null,
		4,
	),
);
