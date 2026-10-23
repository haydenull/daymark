# AGENTS.md

This file provides guidance to coding agents working in this repository.

## 项目概述

这是一个 Bun 全栈 TypeScript 模板。后端是 Hono，数据库是 Drizzle 和 `bun:sqlite`，前端是 React、TanStack Router 和 TanStack Query。前后端通过共享 Zod schema 和 Hono RPC 实现端到端类型安全。

## 常用命令

### 开发

```bash
bun install              # 安装依赖
bun run dev              # 同时启动前端（:5173）和后端（:3000）
bun run dev:client       # 仅启动前端 Vite 开发服务器
bun run dev:server       # 仅启动后端 Hono 服务器
```

### 构建 & 生产

```bash
bun run build:client     # 构建前端 React 应用
bun run start            # 启动生产服务器（服务构建后的静态文件）
```

### 数据库

```bash
bun run db:generate      # 根据 server/db/schema.ts 生成 SQL 迁移
bun run db:migrate       # 执行 drizzle/ 中的迁移
bun run db:studio        # 打开 Drizzle Studio
```

`drizzle-kit` 运行在 Node 上，不能使用 `bun:sqlite`。迁移由 `server/db/migrate.ts` 在 Bun 里执行。

### 测试 & 类型检查

```bash
bun run test             # 运行 Vitest
bun run typecheck        # TypeScript 类型检查
```

## 技术架构

### 核心模式：类型安全的 RPC 客户端

```typescript
// 后端定义 (server/api/todo.ts)
export const todo = new OpenAPIHono().basePath('/api/todo')
export type TodoAPI = typeof todo

// 前端调用 (client/routes/todo/-query.ts)
const todoClient = hc<TodoAPI>(import.meta.env.BASE_URL, { fetch: request })
const res = await todoClient.api.todo.$get()
```

### 数据流

1. **后端**: Drizzle → Hono Route → OpenAPI/Zod Schema → JSON Response
2. **前端**: TanStack Query → Hono RPC Client → ky → Backend
3. **共享类型**: `shared/schema/` 中的 Zod schema 与 Drizzle 推导类型对齐

### 目录结构

```
├── client/              # 前端 React 应用
│   ├── routes/          # TanStack Router 文件路由（routeTree.gen.ts 自动生成，禁止修改）
│   ├── components/      # React 组件
│   └── libs/            # 前端工具（request.ts 等）
├── server/              # 后端 Hono 应用
│   ├── api/             # API 路由处理器
│   └── db/              # Drizzle schema、连接和迁移入口
├── shared/schema/       # Zod schema
└── drizzle/             # SQL 迁移（drizzle-kit 生成，禁止修改）
```

## 关键约束

### 禁止修改的文件

- `client/routeTree.gen.ts`：TanStack Router 自动生成
- `drizzle/` 中已生成的迁移文件

### API 文档

访问 `/api/doc` 查看交互式 API 文档（Scalar UI）。

## 开发流程

1. 启动开发环境：`bun run dev`
2. 修改表结构：编辑 `server/db/schema.ts`，执行 `bun run db:generate`，再执行 `bun run db:migrate`
3. 创建前端路由：在 `client/routes/` 添加文件，`routeTree.gen.ts` 会在 dev 或 build 时更新
4. 添加 API：
   - 在 `shared/schema/` 添加 Zod schema
   - 在 `server/api/` 添加 OpenAPIHono 路由，并在 `server/index.ts` 挂载
   - 在对应页面用 `hc()` 创建 RPC 客户端

## 技术栈

**后端**: Hono + Drizzle + SQLite + OpenAPI 3.0 + Scalar
**前端**: React + TanStack Router + TanStack Query + Tailwind CSS
**共享**: TypeScript + Zod + ky + dayjs
**运行时**: Bun
