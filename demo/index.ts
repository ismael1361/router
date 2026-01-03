import { middleware, handler, create, route, Middlewares, Request, doc } from "../src";

const app = create();
const port = 8080;

app.layers.addListener("add", (route) => console.log(route));

app.enable("trust proxy");

app.middleware(Middlewares.cors());

app.middleware(Middlewares.json());

app.middleware((req, res, next) => {
	console.log("main middleware");
	next();
});

interface AuthRequest extends Request<"userId" | "id", { user?: { id: string; roles: string[] } }> {
	user: { id: string; roles: string[] };
}

interface FileRequest extends Request<"key", { fileName: string }> {
	files: File[];
}

export const authMiddleware = middleware<AuthRequest>(
	(req, res, next) => {
		req.executeOnce();
		console.log("authMiddleware");
		req.user = { id: "123", roles: ["admin"] };
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
	console.log("fileMiddleware");
	next();
});

// 3. Use o middleware em uma rota.
const userRouter = create().middleware(authMiddleware);

const getProfileDoc = doc({
	summary: "Get user profile",
});

const getProfile = middleware(authMiddleware) // Aplica o middleware à rota
	.middleware(fileMiddleware) // Aplica o middleware à rota
	.handler((req, res) => {
		// 'req.user' está disponível e fortemente tipado aqui.
		res.json({ profile: req.user });
	}, getProfileDoc);

userRouter.get("/profile").handler(getProfile);

const post_profile = handler(
	(req, res) => {
		res.json({});
	},
	{
		summary: "Post user profile",
	},
);

userRouter.post("/profile").handler(post_profile);

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

userRouter.route("/teste-route").by(v1_router);

userRouter.get("/routes").handler((req, res) => res.json(app.layers.routes));

setTimeout(() => {
	v1_router.get("/userId").handler((req, res) => res.json({ users: [] }));
}, 1000 * 5);

app.by(userRouter);

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

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
