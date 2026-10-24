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
openssl rand -base64 32
bun run db:migrate
bun run dev
```

把 `.env` 里的 `BETTER_AUTH_SECRET` 换成上一条命令的输出。前端开发服务器是 <http://localhost:5173>，API 服务器是 <http://localhost:3000>。浏览器只访问 5173，Vite 会把 `/api` 代理到 3000。API 文档在 <http://localhost:5173/api/doc>。

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

修改 `server/db/schema.ts` 后，先执行 `db:generate`，再执行 `db:migrate`。`drizzle-kit` 运行在 Node 上，不能直接打开 `bun:sqlite`，所以迁移由 `server/db/migrate.ts` 执行。认证表由 Better Auth CLI 生成到 `server/db/auth-schema.ts`，同样通过 `db:generate` 和 `db:migrate` 管理，不要手改 `drizzle/`。

## 账号

注册和登录使用邮箱、密码。注册时填写昵称，成功后自动登录；退出后会话立即失效。会话保存在 HttpOnly Cookie 和数据库中，默认 7 天有效，距离上次更新超过 1 天时刷新。当前不验证邮箱，也没有找回密码。

`BETTER_AUTH_URL` 是浏览器访问的站点来源。本地开发保持 `http://localhost:5173`；部署到生产环境时改为实际的 HTTPS 域名。`BETTER_AUTH_SECRET` 只在服务端使用，用 `openssl rand -base64 32` 生成，不要提交真实密钥。执行迁移不需要这两个变量。

Todo 示例保持公开，不绑定账号。

## 目录结构

```
├── client/                 # React 应用
│   ├── routes/             # TanStack Router 文件路由
│   ├── components/
│   └── libs/
├── server/
│   ├── api/                # Hono 路由
│   ├── auth.ts             # Better Auth 配置
│   └── db/                 # 业务 schema、认证 schema、连接和迁移脚本
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
