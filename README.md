# @ismael1361/router

[![npm version](https://img.shields.io/npm/v/@ismael1361/router.svg)](https://www.npmjs.com/package/@ismael1361/router)
[![License](https://img.shields.io/npm/l/@ismael1361/router.svg)](https://github.com/ismael1361/router/blob/main/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Um módulo moderno e robusto para criar e gerenciar rotas em Express.js com tipagem encadeada forte, útil para tipar conteúdo de escopo e propriedades de requisição como `body`, `params` e `query`. Oferece geração automática de documentação OpenAPI/Swagger integrada.

## 📋 Índice

- [Características](#-características)
- [Instalação](#-instalação)
- [Início Rápido](#-início-rápido)
- [API Completa](#-api-completa)
  - [create](#create)
  - [middleware](#middleware)
  - [route](#route)
  - [Classe Router](#classe-router)
- [Exemplos Avançados](#-exemplos-avançados)
- [Documentação OpenAPI/Swagger](#-documentação-openapiswagger)
- [TypeScript](#-typescript)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

## ✨ Características

- 🔒 **Tipagem Forte**: Suporte completo a TypeScript com tipos encadeados
- 📚 **Documentação Automática**: Geração de documentação OpenAPI/Swagger integrada
- 🔗 **API Fluente**: Interface encadeável e intuitiva para definição de rotas
- 🛡️ **Middlewares Documentados**: Middlewares com documentação automática
- 🎯 **Organização Modular**: Suporte a sub-roteadores e rotas agrupadas
- ⚡ **Performance**: Construído sobre Express.js, mantendo sua eficiência
- 🧩 **Extensível**: Fácil de estender com tipos personalizados

## 📦 Instalação

```bash
npm install @ismael1361/router
```

ou

```bash
yarn add @ismael1361/router
```

## 🚀 Início Rápido

```typescript
import { create, Middlewares } from '@ismael1361/router';

const app = create();

app.middleware(Middlewares.json());

// Crie o roteador com middleware JSON
const router = app.route();

// Defina rotas com documentação
router
  .get('/users/:id')
  .handle((req, res) => {
    res.json({ 
      id: req.params.id, 
      name: 'John Doe' 
    });
  })
  .doc({
    summary: 'Obter usuário por ID',
    description: 'Retorna os detalhes de um usuário específico',
    tags: ['Users'],
    params: {
      id: {
        description: 'ID do usuário',
        type: 'string',
        required: true
      }
    },
    responses: {
      200: { description: 'Usuário encontrado' },
      404: { description: 'Usuário não encontrado' }
    }
  });

app.listen(3000, () => {
  console.log('🚀 Servidor rodando na porta 3000');
});
```

## 📖 API Completa

### create

Cria uma nova instância do roteador aprimorado.

```typescript
create<Req extends Request, Res extends Response>(): Router<Req, Res>
```

**Retorno:** Nova instância do Router com métodos encadeáveis

**Exemplo:**

```typescript
import { create, Request, Response } from '@ismael1361/router';

interface CustomRequest extends Request {
  user?: { id: string; name: string };
}

const router = create<CustomRequest>()
  .middleware(express.json());
```

### middleware

Cria middlewares reutilizáveis com documentação integrada.

```typescript
middleware<Req extends Request, Res extends Response>(
  callback: MiddlewareFC<Req, Res>,
  doc?: MiddlewareFCDoc
): MiddlewareFC<Req, Res>
```

**Parâmetros:**
- `callback`: Função de middleware padrão do Express `(req, res, next)`
- `doc` (opcional): Objeto com metadados para documentação OpenAPI

**Retorno:** Função de middleware com metadados de documentação anexados

**Exemplo:**

```typescript
import { middleware, Request } from '@ismael1361/router';

interface AuthRequest extends Request {
  user: { id: string; roles: string[] };
}

const isAuthenticated = middleware<AuthRequest>(
  (req, res, next) => {
    const token = req.headers.authorization;
    
    if (token === 'Bearer meu-token-secreto') {
      req.user = { id: '123', roles: ['admin', 'user'] };
      return next();
    }
    
    res.status(401).json({ message: 'Não autorizado' });
  },
  {
    security: [{ bearerAuth: [] }],
    responses: {
      401: { 
        description: 'Token de autenticação inválido ou não fornecido' 
      }
    }
  }
);

// Usar o middleware
router
  .get('/profile')
  .middleware(isAuthenticated)
  .handle((req, res) => {
    res.json({ user: req.user });
  });
```

### route

Cria uma instância de rota para agrupar múltiplos métodos HTTP sob o mesmo caminho.

```typescript
route<Req extends Request, Res extends Response>(
  path?: string
): Router<Req, Res>
```

**Parâmetros:**
- `path`: Caminho da URL para a rota

**Retorno:** Nova instância do Router "travada" no path especificado

**Exemplo:**

```typescript
import { route } from '@ismael1361/router';

const tasksRouter = route('/tasks');

// GET /tasks/items
tasksRouter
  .get('/items')
  .handle((req, res) => {
    res.json([{ id: 1, title: 'Aprender @ismael1361/router' }]);
  })
  .doc({
    summary: 'Listar todas as tarefas',
    tags: ['Tasks'],
    responses: { 200: { description: 'Lista de tarefas' } }
  });

// POST /tasks/item
tasksRouter
  .post('/item')
  .handle((req, res) => {
    const newTask = req.body;
    res.status(201).json({ id: 2, ...newTask });
  })
  .doc({
    summary: 'Criar nova tarefa',
    tags: ['Tasks'],
    body: { description: 'Dados da nova tarefa' },
    responses: { 201: { description: 'Tarefa criada' } }
  });

// Adicionar ao roteador principal
mainRouter.by(tasksRouter);
```

### Classe Router

A classe principal que encapsula o roteador do Express com API fluente e tipada.

#### Propriedades

##### `.app`
```typescript
router: express.Express
```
Instância do Express subjacente.

##### `.routes`
```typescript
routes: Array<{
  path: string;
  methods: string[];
  type: "ROUTE" | "MIDDLEWARE";
  swagger?: Pick<swaggerJSDoc.OAS3Definition, "paths" | "components">;
}>
```
Array de rotas e middlewares registrados para geração de documentação.

#### Métodos HTTP

##### `.get(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota GET.

```typescript
router
  .get('/status')
  .handle((req, res) => {
    res.json({ status: 'ok' });
  })
  .doc({
    summary: 'Verificar status da API',
    tags: ['Health'],
    responses: { 200: { description: 'API funcionando' } }
  });
```

##### `.post(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota POST.

```typescript
router
  .post('/users')
  .handle((req, res) => {
    const newUser = req.body;
    res.status(201).json({ id: Date.now(), ...newUser });
  })
  .doc({
    summary: 'Criar novo usuário',
    tags: ['Users'],
    body: {
      description: 'Dados do usuário',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        }
      }
    },
    responses: { 201: { description: 'Usuário criado' } }
  });
```

##### `.put(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota PUT para substituição completa de recursos.

##### `.patch(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota PATCH para atualizações parciais.

##### `.delete(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota DELETE para remoção de recursos.

##### `.options(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota OPTIONS para requisições de pré-voo CORS.

##### `.head(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota HEAD para obter metadados sem corpo de resposta.

##### `.all(path: string, doc?: MiddlewareFCDoc)`
Registra uma rota que responde a todos os métodos HTTP.

#### Métodos de Configuração

##### `.use(path: string, doc?: MiddlewareFCDoc)`
Monta middlewares em um caminho específico.

```typescript
router.use('/api').handle((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
```

##### `.route(path: string)`
Cria um sub-roteador com prefixo.

```typescript
const usersRouter = mainRouter.route('/users');

usersRouter
  .get('/')
  .handle((req, res) => {
    res.json([{ id: '1', name: 'Alice' }]);
  });
```

##### `.middleware(callback: MiddlewareFC, doc?: MiddlewareFCDoc)`
Aplica middleware a todas as rotas subsequentes.

```typescript
const router = create(app)
  .middleware(express.json())
  .middleware(authMiddleware);
```

##### `.handler(callback: HandlerFC, doc?: MiddlewareFCDoc)`
Define a função controladora para processar requisições.

```typescript
router
  .get('/status')
  .handler((req, res) => {
    res.json({ status: 'ok' });
  });
```

##### `.by(router: ExpressRouter | Router)`
Anexa um roteador existente ao atual.

```typescript
const productsRouter = route('/products');
// ... definir rotas

mainRouter.by(productsRouter);
```

##### `.getSwagger(options?, defaultResponses?)`
Gera a especificação OpenAPI completa.

```typescript
import swaggerJSDoc from 'swagger-jsdoc';
// import swaggerUi from 'swagger-ui-express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Minha API',
    version: '1.0.0',
    description: 'API com documentação automática'
  },
  servers: [{ url: 'http://localhost:3000' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

const swaggerOptions = router.getSwagger(swaggerDefinition);
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log(swaggerSpec);
```

## 🎯 Exemplos Avançados

### Autenticação e Autorização

```typescript
import { create, middleware, Middlewares, Request } from '@ismael1361/router';

interface AuthRequest extends Request {
  user: { id: string; roles: string[] };
}

// Middleware de autenticação
const authenticate = middleware<AuthRequest>(
  (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }
    
    // Validar token (exemplo simplificado)
    req.user = { id: '123', roles: ['user'] };
    next();
  },
  {
    security: [{ bearerAuth: [] }],
    responses: {
      401: { description: 'Não autorizado' }
    }
  }
);

// Middleware de autorização
const authorize = (...roles: string[]) => 
  middleware<AuthRequest>(
    (req, res, next) => {
      if (!req.user.roles.some(role => roles.includes(role))) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      next();
    },
    {
      responses: {
        403: { description: 'Acesso negado' }
      }
    }
  );

const app = create<AuthRequest>()
  .middleware(Middlewares.json());

// Rota protegida
app
  .get('/admin/users')
  .middleware(authenticate)
  .middleware(authorize('admin'))
  .handle((req, res) => {
    res.json({ users: [] });
  })
  .doc({
    summary: 'Listar usuários (Admin)',
    tags: ['Admin'],
    responses: { 200: { description: 'Lista de usuários' } }
  });
```

### Validação de Dados

```typescript
import { middleware, Request } from '@ismael1361/router';

interface ValidatedRequest extends Request {
  validated: {
    body?: any;
    params?: any;
    query?: any;
  };
}

const validate = (schema: any) => 
  middleware<ValidatedRequest>(
    (req, res, next) => {
      // Implementar validação (ex: usando Zod, Joi, etc)
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: result.error.errors 
        });
      }
      
      req.validated = { body: result.data };
      next();
    },
    {
      responses: {
        400: { description: 'Dados de entrada inválidos' }
      }
    }
  );

router
  .post('/users')
  .middleware(validate(userSchema))
  .handle((req, res) => {
    const validatedData = req.validated.body;
    res.status(201).json(validatedData);
  });
```

### Organização Modular

```typescript
// routes/users.routes.ts
import { route } from '@ismael1361/router';

export const usersRouter = route('/users');

usersRouter
  .get('/')
  .handle((req, res) => {
    res.json([]);
  })
  .doc({
    summary: 'Listar usuários',
    tags: ['Users']
  });

usersRouter
  .post('/')
  .handle((req, res) => {
    res.status(201).json(req.body);
  })
  .doc({
    summary: 'Criar usuário',
    tags: ['Users']
  });

// routes/products.routes.ts
export const productsRouter = route('/products');
// ... definir rotas

// app.ts
import { create } from '@ismael1361/router';
import { usersRouter } from './routes/users.routes';
import { productsRouter } from './routes/products.routes';

const app = express();
const router = create(app)
  .middleware(express.json());

router
  .by(usersRouter)
  .by(productsRouter);
```

## 📚 Documentação OpenAPI/Swagger

O módulo gera automaticamente documentação OpenAPI 3.0 compatível com Swagger UI.

### Configuração Completa

```typescript
import { create, Middlewares } from '@ismael1361/router';

const app = create().middleware(Middlewares.json());

// Definir rotas com documentação
app
  .get('/users/:id')
  .handle((req, res) => {
    res.json({ id: req.params.id, name: 'John Doe' });
  })
  .doc({
    summary: 'Obter usuário',
    description: 'Retorna um usuário pelo ID',
    tags: ['Users'],
    params: {
      id: {
        description: 'ID do usuário',
        type: 'string',
        required: true,
        example: '123'
      }
    },
    responses: {
      200: {
        description: 'Usuário encontrado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        }
      },
      404: { description: 'Usuário não encontrado' }
    }
  });

// Configurar Swagger
app.defineSwagger({
  openapi: '3.0.0',
  info: {
    title: 'API de Exemplo',
    version: '1.0.0',
    description: 'Documentação automática gerada com @ismael1361/router',
    contact: {
      name: 'Suporte',
      email: 'suporte@exemplo.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor de desenvolvimento'
    },
    {
      url: 'https://api.exemplo.com',
      description: 'Servidor de produção'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT no formato Bearer'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    }
  },
  defaultResponses: {
    500: { description: 'Erro interno do servidor' },
    429: { description: 'Muitas requisições' }
  }
});

app.listen(3000, () => {
  console.log('🚀 Servidor: http://localhost:3000');
  console.log('📚 Docs-swagger: http://localhost:3000/docs/swagger');
  console.log('📚 Docs-redoc: http://localhost:3000/docs/redoc');
});
```

## 🔷 TypeScript

O módulo é totalmente tipado e oferece excelente suporte ao TypeScript.

### Tipos Personalizados

```typescript
import { Request, Response } from '@ismael1361/router';

// Estender Request
interface CustomRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  requestId: string;
  startTime: number;
}

// Estender Response
interface CustomResponse extends Response {
  sendSuccess: (data: any) => void;
  sendError: (message: string, code?: number) => void;
}

// Usar tipos personalizados
const router = create<CustomRequest, CustomResponse>(app);

router
  .get('/profile')
  .handle((req, res) => {
    // req.user está totalmente tipado
    // res.sendSuccess está disponível
    res.sendSuccess({ user: req.user });
  });
```

### Inferência de Tipos

```typescript
// Os tipos são inferidos automaticamente
router
  .get('/users/:id')
  .handle((req, res) => {
    // req.params.id é string
    // req.query é Record<string, any>
    // req.body é any (pode ser tipado com middleware)
    const userId: string = req.params.id;
  });
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, siga estas etapas:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](MIT) para mais detalhes.

## 🙏 Agradecimentos

- Express.js pela base sólida
- Swagger/OpenAPI pela especificação de documentação
- A comunidade TypeScript

---

Desenvolvido com ❤️ por [Ismael Souza Silva](https://github.com/ismael1361)