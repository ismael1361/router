# @ismael1361/router

[![npm version](https://img.shields.io/npm/v/@ismael1361/router.svg)](https://www.npmjs.com/package/@ismael1361/router)
[![License](https://img.shields.io/npm/l/@ismael1361/router.svg)](https://github.com/ismael1361/router/blob/main/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Módulo para Express.js com tipagem encadeada forte para `body`, `params`, `query` e propriedades customizadas de `Request`/`Response`. Gera automaticamente documentação OpenAPI 3.0 (Swagger UI, ReDoc e Markdown), code snippets multi-linguagem e oferece sistema de logging por stacks integrado.

## 📋 Índice

- [Características](#-características)
- [Instalação](#-instalação)
- [Início Rápido](#-início-rápido)
- [API](#-api)
  - [`create()`](#create)
  - [`router()`](#router)
  - [`handler()`](#handler)
  - [`middleware()`](#middleware)
  - [`HandleError`](#handleerror)
  - [`Middlewares`](#middlewares)
- [Interfaces e Tipos](#-interfaces-e-tipos)
  - [`IApplication`](#iapplication)
  - [`IRouter`](#irouter)
  - [`IHandler`](#ihandler)
  - [`IMiddleware`](#imiddleware)
  - [`Request`](#request)
  - [`Response`](#response)
  - [`SwaggerOptions`](#swaggeroptions)
- [Métodos HTTP](#-métodos-http)
- [Rotas e Sub-routers](#-rotas-e-sub-routers)
- [Documentação OpenAPI/Swagger](#-documentação-openapiswagger)
- [Sistema de Stacks (Logging)](#-sistema-de-stacks-logging)
- [Exemplos Avançados](#-exemplos-avançados)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

## ✨ Características

- **Tipagem Forte Encadeada** — tipos de `Request` e `Response` acumulados automaticamente a cada `.handler()` encadeado via `JoinRequest`/`JoinResponse`
- **Inferência de Parâmetros de Rota** — `req.params` tipado diretamente a partir da string de rota (ex.: `"/users/:id"` → `req.params.id: string`)
- **Documentação OpenAPI 3.0 Automática** — geração de spec, Swagger UI, ReDoc e Markdown a partir de `.doc()` em handlers, middlewares e rotas
- **Code Snippets** — geração automática de exemplos de código em 20+ linguagens (cURL, Python, Node.js, C#, Go, etc.)
- **Middlewares Tipados com `.doc()`** — middlewares criados via `middleware()` carregam documentação OpenAPI que é mesclada automaticamente na spec
- **Sub-routers Modulares** — `router()` e `.route()` permitem compor APIs em módulos independentes com prefixos
- **Tratamento de Erros Centralizado** — `HandleError` com código HTTP, nível de log e integração automática com o sistema de stacks
- **Sistema de Stacks** — logging automatizado de erros, warnings e informações em arquivo, com UI HTML acessível por rota
- **CORS Configurável** — middleware `Middlewares.cors()` com controle granular de origens, métodos, headers e credenciais
- **Upload de Arquivos** — middleware `Middlewares.files()` com parsing de `multipart/form-data` e filtragem por MIME type
- **Execução Única de Middleware** — `req.executeOnce()` impede re-execução de middlewares em rotas aninhadas

## 📦 Instalação

```bash
npm install @ismael1361/router
```

```bash
yarn add @ismael1361/router
```

## 🚀 Início Rápido

```typescript
import { create, router, middleware, Middlewares, Request } from "@ismael1361/router";

const app = create();

// Middlewares globais
app.use(Middlewares.json());
app.use(Middlewares.cors({ allowOrigin: "*" }));

// Rota simples com inferência de parâmetros
app.get("/users/:id")
  .handler((req, res) => {
    // req.params.id é automaticamente inferido como string
    res.json({ id: req.params.id, name: "John Doe" });
  })
  .doc({
    tags: ["Users"],
    summary: "Obter usuário por ID",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
    responses: {
      200: { description: "Usuário encontrado" },
      404: { description: "Usuário não encontrado" },
    },
  });

// Documentação Swagger
app.defineSwagger({
  openapi: "3.0.0",
  info: { title: "Minha API", version: "1.0.0" },
});

app.listen(3000, () => {
  console.log("Servidor: http://localhost:3000");
  console.log("Swagger:  http://localhost:3000/doc/swagger");
  console.log("ReDoc:    http://localhost:3000/doc/redoc");
});
```

---

## 📖 API

### `create()`

Cria uma instância de `IApplication`, que encapsula uma aplicação Express com roteamento tipado, documentação OpenAPI e sistema de stacks.

```typescript
function create(): IApplication;
```

**Retorno:** `IApplication` — herda todos os métodos de `IRouter` (`.get()`, `.post()`, `.route()`, `.use()`, `.defineSwagger()`) e métodos do Express (`listen`, `enable`, `disable`, etc.).

```typescript
import { create } from "@ismael1361/router";

const app = create();

app.get("/hello/:name")
  .handler((req, res) => {
    res.send(`Hello, ${req.params.name}!`);
  });

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
```

---

### `router()`

Cria uma instância independente de `IRouter` para modularizar a API. Pode ser montado em outro router ou aplicação via `.route()` ou `.use()`.

```typescript
function router(): IRouter;
```

```typescript
import { create, router } from "@ismael1361/router";

const app = create();

const usersRouter = router();

usersRouter.get("/")
  .handler((req, res) => {
    res.json([{ id: "1", name: "Alice" }]);
  })
  .doc({ tags: ["Users"], summary: "Listar usuários" });

usersRouter.post("/")
  .handler((req, res) => {
    res.status(201).json({ id: "2", ...req.body });
  })
  .doc({ tags: ["Users"], summary: "Criar usuário" });

// Montar com prefixo
app.route("/users", usersRouter);
```

---

### `handler()`

Cria um handler encadeável que combina execução de middlewares com documentação OpenAPI. Cada chamada a `.handler()` adiciona um middleware à cadeia e mescla os tipos de `Request` e `Response` via `JoinRequest`/`JoinResponse`.

```typescript
function handler<Rq extends Request, Rs extends Response>(
  fn: RequestHandler<Rq, Rs>
): IHandler<Rq, Rs>;
```

```typescript
import { handler } from "@ismael1361/router";

const myHandler = handler((req, res, next) => {
  console.log("Primeiro middleware");
  next();
})
  .handler((req, res) => {
    res.json({ status: "ok" });
  })
  .doc({
    tags: ["Health"],
    summary: "Health check",
  });
```

> Na maioria dos casos, `handler()` é usado internamente pelo router ao registrar rotas (`.get()`, `.post()`, etc.). O uso direto é raro.

---

### `middleware()`

Cria um middleware reutilizável com suporte a documentação OpenAPI. Os tipos genéricos do middleware são mesclados automaticamente quando encadeado via `.handler()`.

```typescript
function middleware<Req extends Request, Res extends Response>(
  fn: RequestHandler<Req, Res>
): IMiddleware<Req, Res>;
```

O middleware retornado **não** possui o método `.handler()` — apenas `.doc()`. Ele deve ser encadeado via `.handler()` de um `IHandler`.

#### Middleware simples

```typescript
import { middleware } from "@ismael1361/router";

const logMiddleware = middleware((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get("/users")
  .handler(logMiddleware)
  .handler((req, res) => {
    res.json([]);
  });
```

#### Middleware com tipo customizado e documentação

```typescript
import { middleware, Request } from "@ismael1361/router";

interface AuthRequest extends Request {
  user: { userId: string; roles: string[] };
}

const authMiddleware = middleware((req: AuthRequest, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Token ausente" });
    return;
  }
  req.user = { userId: "123", roles: ["admin"] };
  next();
}).doc({
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
});

// Ao encadear, req.user é inferido automaticamente
app.get("/profile")
  .handler(authMiddleware)
  .handler((req, res) => {
    // req.user.userId está disponível com tipagem
    res.json({ userId: req.user.userId });
  });
```

#### Middleware de validação de body

```typescript
interface BodyRequest extends Request<string, { name: string; email: string }> {}

const validateBody = middleware((req: BodyRequest, res, next) => {
  if (!req.body.name || !req.body.email) {
    res.status(400).json({ error: "name e email são obrigatórios" });
    return;
  }
  next();
}).doc({
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["name", "email"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
          },
        },
      },
    },
  },
});

app.post("/users")
  .handler(validateBody)
  .handler((req, res) => {
    // req.body.name e req.body.email inferidos como string
    res.status(201).json({ name: req.body.name, email: req.body.email });
  });
```

---

### `HandleError`

Classe de erro para tratamento padronizado de erros HTTP. Integra-se automaticamente com o sistema de stacks e o tratamento centralizado de erros do router.

```typescript
class HandleError extends Error {
  constructor(
    message: string,
    name?: string,                   // default: "DEFAULT"
    cause?: number | Error | string, // código HTTP ou causa
    level?: "ERROR" | "WARN" | "INFO" | "NONE", // default: "ERROR"
    source?: string,
    duration?: number,
  );

  get code(): number;   // código HTTP extraído de cause
  get status(): { code: number; message: string };
  get meta(): any;
}
```

```typescript
import { HandleError } from "@ismael1361/router";

// Erro 404
throw new HandleError("Recurso não encontrado", "NOT_FOUND", 404);

// Erro de validação (nível WARN, não polui logs de erro)
throw new HandleError("Campo email inválido", "VALIDATION_ERROR", 400, "WARN");

// Uso em handler
app.get("/users/:id")
  .handler((req, res) => {
    const user = findUser(req.params.id);
    if (!user) {
      throw new HandleError("Usuário não encontrado", "NOT_FOUND", 404);
    }
    res.json(user);
  });
```

O erro é capturado automaticamente pelo sistema interno (`tryHandler`) e retorna resposta JSON padronizada:

```json
{ "message": "Usuário não encontrado", "name": "NOT_FOUND", "code": 404 }
```

---

### `Middlewares`

Namespace com middlewares prontos para uso, importável via `Middlewares`.

```typescript
import { Middlewares } from "@ismael1361/router";
```

#### `Middlewares.json(options?)`

Analisa corpos de requisição JSON. Wrapper de `body-parser.json()`.

```typescript
app.use(Middlewares.json());
app.use(Middlewares.json({ limit: "10mb" }));
```

#### `Middlewares.raw(options?)`

Analisa corpos de requisição como `Buffer`.

```typescript
app.use(Middlewares.raw({ type: "application/octet-stream", limit: "10mb" }));
```

#### `Middlewares.text(options?)`

Analisa corpos de requisição como texto.

```typescript
app.use(Middlewares.text({ type: "text/plain" }));
```

#### `Middlewares.urlencoded(options?)`

Analisa dados de formulário `application/x-www-form-urlencoded`.

```typescript
app.use(Middlewares.urlencoded({ extended: true }));
```

#### `Middlewares.cors(options?)`

Configura CORS com controle granular.

```typescript
// Permitir todas as origens
app.use(Middlewares.cors({ allowOrigin: "*" }));

// Origem específica com opções
app.use(Middlewares.cors({
  allowOrigin: "https://meusite.com",
  allowedMethods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  exposeHeaders: ["Content-Length"],
}));

// Sintaxe alternativa: string + objeto
app.use(Middlewares.cors("https://meusite.com", {
  allowedMethods: ["GET", "POST"],
  credentials: true,
}));
```

**`CorsOptions`:**

| Propriedade      | Tipo                        | Descrição                                                        |
|------------------|-----------------------------|------------------------------------------------------------------|
| `allowOrigin`    | `string`                    | Origem permitida (`"*"` para todas)                              |
| `allowedMethods` | `string[] \| string`        | Métodos HTTP permitidos                                          |
| `allowedHeaders` | `string[] \| string`        | Headers que o cliente pode enviar                                |
| `credentials`    | `boolean`                   | Permite cookies e headers de autenticação                        |
| `exposeHeaders`  | `string[] \| string`        | Headers adicionais legíveis pelo cliente                         |

#### `Middlewares.files(...allowedMimes)`

Parsing de arquivos `multipart/form-data`. Os arquivos ficam disponíveis em `req.file` (primeiro) e `req.files` (todos).

```typescript
import { Middlewares } from "@ismael1361/router";

// Aceitar qualquer tipo de arquivo
app.post("/upload")
  .handler(Middlewares.files())
  .handler((req, res) => {
    // req.file: FileInfo (primeiro arquivo)
    // req.files: FileInfo[] (todos os arquivos)
    res.json({
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });

// Aceitar apenas imagens e PDFs
app.post("/upload-docs")
  .handler(Middlewares.files("image/jpeg", "image/png", "application/pdf"))
  .handler((req, res) => {
    res.json({ count: req.files.length });
  });
```

**`FileInfo`:**

| Propriedade    | Tipo       | Descrição                   |
|----------------|------------|-----------------------------|
| `fieldname`    | `string`   | Nome do campo do formulário |
| `originalname` | `string`   | Nome original do arquivo    |
| `mimetype`     | `string`   | Tipo MIME do arquivo        |
| `size`         | `number`   | Tamanho em bytes            |
| `buffer`       | `Buffer`   | Conteúdo do arquivo         |
| `stream`       | `Readable` | Stream legível              |

---

## 🔷 Interfaces e Tipos

### `IApplication`

Estende `IRouter` com capacidades de servidor HTTP e sistema de stacks.

```typescript
interface IApplication extends IRouter {
  listen: express.Application["listen"];
  disable: express.Application["disable"];
  enable: express.Application["enable"];
  disabled: express.Application["disabled"];
  enabled: express.Application["enabled"];
  engine: express.Application["engine"];
  param: express.Application["param"];
  render: express.Application["render"];

  getStacks(): IStackLog[];
  defineStacks(options?: IStacksOptions): { stacksPath: string };
}
```

---

### `IRouter`

Interface principal do router. Expõe métodos HTTP, sub-rotas, middlewares e configuração Swagger.

```typescript
interface IRouter extends RequestHandler {
  // Métodos HTTP — retornam IHandler com parâmetros inferidos da rota
  all:     IRouterMatcher<"all">;
  get:     IRouterMatcher<"get">;
  post:    IRouterMatcher<"post">;
  put:     IRouterMatcher<"put">;
  delete:  IRouterMatcher<"delete">;
  patch:   IRouterMatcher<"patch">;
  options: IRouterMatcher<"options">;
  head:    IRouterMatcher<"head">;

  parent: IRouter | null;
  path: string;

  param: express.Application["param"];

  route(prefix: string, doc?: MiddlewareFCDoc): IRouter;
  route(prefix: string, router: IRouter, doc?: MiddlewareFCDoc): IRouter;
  route(router: IRouter, doc?: MiddlewareFCDoc): IRouter;

  use(prefix: string, doc?: MiddlewareFCDoc): IHandler;
  use(prefix: string, handler: IRouter | RequestHandler, doc?: MiddlewareFCDoc): void;
  use(handler: IRouter | RequestHandler, doc?: MiddlewareFCDoc): void;

  defineSwagger(options: SwaggerOptions): void;
  getSwagger(): swaggerJSDoc.Options;
}
```

---

### `IHandler`

Handler encadeável que combina execução de middlewares com documentação OpenAPI. Cada `.handler()` mescla tipos cumulativamente.

```typescript
interface IHandler<Rq extends Request, Rs extends Response> extends RequestHandler<Rq, Rs> {
  handler<Req extends Request, Res extends Response>(
    fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs>
  ): IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;

  doc(
    operation: MiddlewareFCDoc | swaggerJSDoc.Operation,
    components?: swaggerJSDoc.Components
  ): IHandler<Rq, Rs>;
}
```

**Encadeamento e mesclagem de tipos:**

```typescript
interface AuthRequest extends Request {
  user: { id: string; roles: string[] };
}

interface PaginatedRequest extends Request<string, any, { page: number; limit: number }> {}

app.get("/items")
  .handler(authMiddleware)          // req agora tem .user
  .handler(paginationMiddleware)    // req agora tem .user + .query.page + .query.limit
  .handler((req, res) => {
    // Todos os tipos estão disponíveis simultaneamente
    console.log(req.user.id);       // string
    console.log(req.query.page);    // number
    res.json([]);
  });
```

---

### `IMiddleware`

Middleware sem `.handler()`, apenas `.doc()`. Deve ser encadeado dentro de um `IHandler`.

```typescript
interface IMiddleware<Rq extends Request, Rs extends Response> extends RequestHandler<Rq, Rs> {
  doc(
    operation: MiddlewareFCDoc | swaggerJSDoc.Operation,
    components?: swaggerJSDoc.Components
  ): IMiddleware<Rq, Rs>;
}
```

---

### `Request`

Estende `express.Request` com parâmetros genéricos tipados.

```typescript
interface Request<
  P extends string = string,      // Parâmetros de rota
  ReqBody = {},                   // Corpo da requisição
  ReqQuery = core.Query,          // Query string
  ResBody = any                   // Corpo da resposta
> extends core.Request<ParamsDictionary<P>, ResBody, ReqBody, ReqQuery> {
  clientIp?: string;
  executeOnce?: (isOnce?: boolean) => void;
}
```

```typescript
// Parâmetros inferidos da rota
app.get("/users/:userId/posts/:postId")
  .handler((req, res) => {
    req.params.userId;  // string ✓
    req.params.postId;  // string ✓
  });

// Tipo explícito de body
interface CreateUser extends Request<string, { name: string; email: string }> {}

app.post("/users")
  .handler((req: CreateUser, res) => {
    req.body.name;   // string ✓
    req.body.email;  // string ✓
  });
```

---

### `Response`

Estende `express.Response`.

```typescript
interface Response<ResBody = any> extends core.Response<ResBody> {}
```

---

### `SwaggerOptions`

Configuração para geração de documentação OpenAPI.

```typescript
interface SwaggerOptions extends swaggerJSDoc.OAS3Definition {
  path?: string;                    // Prefixo das rotas de doc (default: "/doc")
  defaultResponses?: Responses;     // Respostas padrão para todas as rotas
  targets?: SnippetTargets[];       // Linguagens para code snippets
}
```

**`SnippetTargets` disponíveis:**

`c_libcurl`, `csharp_restsharp`, `csharp_httpclient`, `go_native`, `java_okhttp`, `java_unirest`, `javascript_jquery`, `javascript_xhr`, `node_native`, `node_request`, `node_unirest`, `objc_nsurlsession`, `ocaml_cohttp`, `php_curl`, `php_http1`, `php_http2`, `python_python3`, `python_requests`, `ruby_native`, `shell_curl`, `shell_httpie`, `shell_wget`, `swift_nsurlsession`

---

## 🔀 Métodos HTTP

Todos os métodos HTTP retornam um `IHandler` com inferência automática de parâmetros de rota.

```typescript
// Assinatura
app.get<Path extends string>(path: Path, doc?: MiddlewareFCDoc): IHandler<Request<ExtractRouteParameters<Path>>>;
```

**Métodos disponíveis:** `get`, `post`, `put`, `delete`, `patch`, `options`, `head`, `all`

```typescript
// GET — leitura de recursos
app.get("/status")
  .handler((req, res) => {
    res.json({ status: "ok" });
  })
  .doc({ tags: ["Health"], summary: "Status da API" });

// POST — criação de recursos
app.post("/users")
  .handler((req, res) => {
    res.status(201).json({ id: Date.now(), ...req.body });
  })
  .doc({
    tags: ["Users"],
    summary: "Criar usuário",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "email"],
            properties: {
              name: { type: "string" },
              email: { type: "string", format: "email" },
            },
          },
        },
      },
    },
    responses: { 201: { description: "Usuário criado" } },
  });

// PUT — substituição completa
app.put("/users/:id")
  .handler((req, res) => {
    res.json({ id: req.params.id, ...req.body });
  })
  .doc({ tags: ["Users"], summary: "Substituir usuário" });

// PATCH — atualização parcial
app.patch("/users/:id")
  .handler((req, res) => {
    res.json({ id: req.params.id, updated: true });
  })
  .doc({ tags: ["Users"], summary: "Atualizar usuário parcialmente" });

// DELETE — remoção
app.delete("/users/:id")
  .handler((req, res) => {
    res.sendStatus(204);
  })
  .doc({ tags: ["Users"], summary: "Remover usuário" });

// ALL — responde a qualquer método
app.all("/proxy/*")
  .handler((req, res) => {
    res.json({ method: req.method, url: req.url });
  });
```

**Documentação inline via segundo argumento:**

```typescript
app.post("/items", { tags: ["Items"], summary: "Criar item" })
  .handler((req, res) => {
    res.status(201).json({ id: 1 });
  });
```

---

## 🔗 Rotas e Sub-routers

### `.route()` — Sub-router com prefixo

```typescript
// Criar sub-router inline
const usersRoute = app.route("/users");
usersRoute.get("/").handler((req, res) => res.json([]));
usersRoute.get("/:id").handler((req, res) => res.json({ id: req.params.id }));

// Anexar router existente com documentação global
const v1 = router();

v1.get("/items")
  .handler((req, res) => res.json([]))
  .doc({ tags: ["Items"], summary: "Listar itens" });

v1.post("/items")
  .handler((req, res) => res.status(201).json(req.body))
  .doc({ tags: ["Items"], summary: "Criar item" });

// Documentação aplicada a todas as rotas do sub-router
app.route("/v1", v1, {
  security: [{ bearerAuth: [] }],
  responses: {
    400: { description: "Dados inválidos" },
    404: { description: "Não encontrado" },
  },
});
```

### `.use()` — Middleware ou sub-router

```typescript
// Middleware global
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Middleware em prefixo (retorna IHandler encadeável)
app.use("/api")
  .handler((req, res, next) => {
    console.log("Requisição na /api");
    next();
  });

// Sub-router via use
const adminRouter = router();
app.use("/admin", adminRouter);
```

### Organização modular

```typescript
// routes/users.ts
import { router } from "@ismael1361/router";

export const usersRouter = router();

usersRouter.get("/")
  .handler((req, res) => res.json([]))
  .doc({ tags: ["Users"], summary: "Listar usuários" });

usersRouter.post("/")
  .handler((req, res) => res.status(201).json(req.body))
  .doc({ tags: ["Users"], summary: "Criar usuário" });

// routes/products.ts
import { router } from "@ismael1361/router";

export const productsRouter = router();

productsRouter.get("/")
  .handler((req, res) => res.json([]))
  .doc({ tags: ["Products"], summary: "Listar produtos" });

// app.ts
import { create, Middlewares } from "@ismael1361/router";
import { usersRouter } from "./routes/users";
import { productsRouter } from "./routes/products";

const app = create();
app.use(Middlewares.json());

app.route("/users", usersRouter);
app.route("/products", productsRouter);

app.defineSwagger({
  openapi: "3.0.0",
  info: { title: "API Modular", version: "1.0.0" },
});

app.listen(3000);
```

---

## 📚 Documentação OpenAPI/Swagger

### `.doc()` — Documentação em handlers e middlewares

Anexa metadados OpenAPI sem alterar o fluxo de execução. Pode ser chamado em qualquer ponto da cadeia.

```typescript
app.get("/users/:userId")
  .handler(authMiddleware)
  .doc({
    tags: ["Users"],
    summary: "Buscar usuário por ID",
    parameters: [
      { name: "userId", in: "path", required: true, schema: { type: "string" } },
    ],
  })
  .handler((req, res) => {
    res.json({ userId: req.params.userId });
  });
```

**`.doc()` com componentes:**

```typescript
app.delete("/users/:id")
  .handler(authMiddleware)
  .doc(
    {
      tags: ["Users"],
      summary: "Remover usuário",
      security: [{ bearerAuth: [] }],
    },
    {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  )
  .handler((req, res) => {
    res.sendStatus(204);
  });
```

### `.defineSwagger()` — Configuração completa

Habilita a geração de documentação e cria automaticamente as seguintes rotas:

| Rota                          | Descrição                        |
|-------------------------------|----------------------------------|
| `/doc/swagger`                | Interface Swagger UI             |
| `/doc/swagger/definition.json`| Spec OpenAPI JSON                |
| `/doc/redoc`                  | Interface ReDoc                  |
| `/doc/markdown`               | Documentação em Markdown         |
| `/doc/.md`                    | Markdown raw                     |

```typescript
app.defineSwagger({
  openapi: "3.0.0",
  info: {
    title: "API de Exemplo",
    version: "1.0.0",
    description: "Documentação completa da API",
    contact: { name: "Suporte", email: "suporte@example.com" },
  },
  servers: [
    { url: "http://localhost:3000", description: "Desenvolvimento" },
    { url: "https://api.exemplo.com", description: "Produção" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  // Respostas de erro aplicadas a todas as rotas
  defaultResponses: {
    400: { description: "Dados inválidos" },
    401: { description: "Falha na autenticação" },
    403: { description: "Acesso negado" },
    500: { description: "Erro interno do servidor" },
  },
  // Linguagens de code snippets (opcional)
  targets: ["shell_curl", "javascript_xhr", "node_native", "python_python3"],
});
```

### `.getSwagger()` — Obter spec programaticamente

```typescript
const spec = app.getSwagger();
console.log(JSON.stringify(spec.definition, null, 2));
```

---

## 📊 Sistema de Stacks (Logging)

Disponível apenas em `IApplication` (criado via `create()`). Registra erros, warnings e informações em arquivo de log, com UI HTML acessível por rota.

### `.defineStacks(options?)`

```typescript
interface IStacksOptions {
  path?: string;       // Rota da UI (default: "/stacks")
  limit?: number;      // Máximo de registros no arquivo (default: 100)
  filePath?: string;   // Caminho do arquivo de log (default: "./stacks.log")
  beforeStack?(...stacks: IStackLog[]): Array<IStackLog | string | Error>;
}
```

```typescript
const { stacksPath } = app.defineStacks({
  path: "/stacks",
  limit: 200,
  filePath: "./logs/stacks.log",
  beforeStack(...stacks) {
    // Filtrar ou transformar antes de salvar
    return stacks.filter((s) => typeof s !== "string" && s.level === "ERROR");
  },
});

console.log(`Stacks UI: http://localhost:3000${stacksPath}`);
```

Ao ativar stacks, `console.error()`, `console.warn()` e `console.info()` são interceptados automaticamente e registrados no arquivo de log. Erros não capturados (`unhandledRejection`, `uncaughtException`) também são registrados.

### `.getStacks()`

```typescript
const logs: IStackLog[] = app.getStacks();
logs.forEach((log) => {
  console.log(`[${log.level}] ${log.name}: ${log.message} (${log.duration}ms)`);
});
```

**`IStackLog`:**

| Propriedade  | Tipo                                        | Descrição                      |
|--------------|---------------------------------------------|--------------------------------|
| `time`       | `Date`                                      | Timestamp do registro          |
| `level`      | `"ERROR" \| "WARN" \| "INFO" \| "DEBUG"`   | Nível de severidade            |
| `name`       | `string`                                    | Nome/categoria do log          |
| `message`    | `string`                                    | Mensagem descritiva            |
| `source`     | `string`                                    | Origem do log                  |
| `statusCode` | `number`                                    | Código HTTP associado          |
| `duration`   | `number`                                    | Duração em ms                  |
| `meta`       | `string`                                    | Metadados adicionais           |

---

## 🎯 Exemplos Avançados

### Autenticação e Autorização

```typescript
import { create, middleware, Middlewares, Request } from "@ismael1361/router";

interface AuthRequest extends Request {
  user: { id: string; roles: string[] };
}

const authenticate = middleware((req: AuthRequest, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }
  req.user = { id: "123", roles: ["admin"] };
  next();
}).doc({
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
});

const authorize = (...roles: string[]) =>
  middleware((req: AuthRequest, res, next) => {
    if (!req.user.roles.some((r) => roles.includes(r))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    next();
  });

const app = create();
app.use(Middlewares.json());

app.get("/admin/users")
  .handler(authenticate)
  .handler(authorize("admin"))
  .handler((req, res) => {
    // req.user está tipado
    res.json({ adminId: req.user.id, users: [] });
  })
  .doc({
    tags: ["Admin"],
    summary: "Listar usuários (Admin)",
    responses: { 200: { description: "Lista de usuários" } },
  });
```

### Encadeamento de múltiplos handlers com tipos acumulados

```typescript
interface AuthRequest extends Request {
  user: { userId: string; id: string; roles: string[] };
}

const authMiddleware = middleware((req: AuthRequest, res, next) => {
  req.user = { userId: "123", id: "abc", roles: ["admin"] };
  next();
}).doc({
  security: [{ bearerAuth: [] }],
});

app.get("/hello/:userId/:id")
  .handler(authMiddleware)        // req ganha .user
  .handler((req, res, next) => {
    // req.user e req.params.userId/id estão disponíveis
    console.log(`Usuário: ${req.user.userId}`);
    next();
  })
  .doc({
    tags: ["Users"],
    summary: "Saudação personalizada",
    parameters: [
      { name: "userId", in: "path", required: true, schema: { type: "string" } },
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
  })
  .handler((req, res) => {
    res.send(`Hello, ${req.params.userId}! ID: ${req.user.id}`);
  });
```

### Execução única de middleware

```typescript
const expensiveMiddleware = middleware((req, res, next) => {
  req.executeOnce?.(); // Garante uma única execução por requisição
  console.log("Operação custosa executada uma vez");
  next();
});

// Mesmo aplicado em vários níveis, executa apenas uma vez
app.use("/api")
  .handler(expensiveMiddleware)
  .handler((req, res, next) => { next(); });

app.get("/api/data")
  .handler(expensiveMiddleware) // Não executa novamente
  .handler((req, res) => {
    res.json({ data: [] });
  });
```

### Aplicação completa com sub-routers, Swagger e stacks

```typescript
import { create, router, middleware, Middlewares, Request } from "@ismael1361/router";

const app = create();

app.use(Middlewares.json());
app.use(Middlewares.cors({ allowOrigin: "*" }));

// --- Middleware de autenticação ---
interface AuthRequest extends Request<"userId" | "id"> {
  user: { userId: string; id: string; roles: string[] };
}

const authMiddleware = middleware((req: AuthRequest, res, next) => {
  const { userId = "", id = "" } = req.params;
  req.user = { userId, id, roles: ["admin"] };
  next();
}).doc({
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
});

// --- Rota direta na aplicação ---
app.get("/hello/:userId/:id")
  .handler(authMiddleware)
  .handler((req, res, next) => {
    console.log(`Hello, ${req.user.id}!`);
    next();
  })
  .doc({ tags: ["Users"] })
  .handler((req, res) => {
    res.send(`Hello, ${req.params.userId}! ID: ${req.user.userId}`);
  })
  .doc({
    summary: "Saudação com autenticação",
    parameters: [
      { name: "userId", in: "path", required: true, schema: { type: "string" } },
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
  });

// --- Sub-router v1 ---
const v1 = router();

v1.get("/test/route")
  .handler((req, res) => {
    res.send("Hello from route!");
  })
  .doc({ tags: ["V1"], summary: "Rota de teste v1" });

app.route("/v1", v1, {
  security: [{ bearerAuth: [] }],
  responses: {
    400: { description: "Account not found" },
    404: { description: "Not found" },
  },
});

// --- Swagger ---
app.defineSwagger({
  openapi: "3.0.0",
  info: { title: "My API", version: "1.0.0" },
  defaultResponses: {
    400: { description: "Dados inválidos" },
    401: { description: "Falha na autenticação" },
    403: { description: "Acesso negado" },
    500: { description: "Erro interno do servidor" },
  },
});

// --- Stacks ---
app.defineStacks({
  path: "/stacks",
  limit: 100,
  filePath: "./stacks.log",
});

app.listen(8080, () => {
  console.log("Server: http://localhost:8080");
  console.log("Swagger: http://localhost:8080/doc/swagger");
  console.log("ReDoc:   http://localhost:8080/doc/redoc");
  console.log("Stacks:  http://localhost:8080/stacks");
});
```

---

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](MIT) para mais detalhes.

---

Desenvolvido com ❤️ por [Ismael Souza Silva](https://github.com/ismael1361)
