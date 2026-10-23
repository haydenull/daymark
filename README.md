# Bun Fullstack Template

Bun + Hono + Drizzle + React 的全栈 TypeScript 模板。前后端通过共享 Zod schema 和 Hono RPC 保持端到端类型安全，数据库使用 `bun:sqlite`。

## 技术栈

- 运行时：Bun
- 后端：Hono、`@hono/zod-openapi`、Scalar
- 数据库：Drizzle ORM、SQLite
- 前端：React、TanStack Router、TanStack Query、Tailwind CSS
- 共享：TypeScript、Zod、ky、dayjs

## 快速开始

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

前端开发服务器是 <http://localhost:5173>，API 服务器是 <http://localhost:3000>。API 文档在 <http://localhost:5173/api/doc>。

## 常用命令

```bash
bun run dev              # 同时启动前端和后端
bun run dev:client       # 仅启动 Vite
bun run dev:server       # 仅启动 Hono
bun run build:client     # 以 production 构建前端到 dist
bun run start            # 启动生产服务器
bun run test             # 运行 Vitest
bun run typecheck        # tsc --noEmit
bun run lint             # Biome lint
bun run lint:fix         # 应用 Biome 的安全 lint 修复
bun run format           # 用 Biome 格式化
bun run format:check     # 只检查格式
bun run check            # 格式、lint 和 import 整理
bun run check:fix        # 应用安全的自动修复
bun run db:generate      # 根据 schema 生成 SQL 迁移
bun run db:migrate       # 用 Bun 执行迁移
bun run db:studio        # 打开 Drizzle Studio
```

修改 `server/db/schema.ts` 后，先执行 `db:generate`，再执行 `db:migrate`。`drizzle-kit` 运行在 Node 上，不能直接打开 `bun:sqlite`，所以迁移由 `server/db/migrate.ts` 执行。

## 目录结构

```
├── client/                 # React 应用
│   ├── routes/             # TanStack Router 文件路由
│   ├── components/
│   └── libs/
├── server/
│   ├── api/                # Hono 路由
│   └── db/                 # Drizzle schema、连接和迁移脚本
├── shared/schema/          # 前后端共享的 Zod schema
├── drizzle/                # drizzle-kit 生成的迁移，不要手改
└── env.ts                  # 环境变量
```

`client/routeTree.gen.ts` 由路由插件生成。`data/` 存放 SQLite 文件，不进入版本库。

## 如何新增一个 API

1. 在 `shared/schema/` 用 Zod 定义请求和响应，并用 `.openapi()` 补充说明。
2. 在 `server/api/` 创建 `OpenAPIHono` 路由，用 `createRoute` 声明参数和响应，再在 `server/index.ts` 里 `app.route()` 挂载。
3. 在前端用 `hc<该路由的类型>()` 调用，并把请求放进 TanStack Query。

Todo 示例对应 `shared/schema/todo.ts`、`server/api/todo.ts` 和 `client/routes/todo/-query.ts`。

## 关键约束

- 不要手改 `client/routeTree.gen.ts`。
- 不要手改 `drizzle/` 里已生成的迁移文件。
