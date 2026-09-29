# Graph Report - boyalone99-jft  (2026-09-30)

## Corpus Check
- Corpus is ~21,627 words - fits in a single context window. You may not need a graph.

## Summary
- 507 nodes · 633 edges · 49 communities (24 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Routing & Page Shell
- Backend API & Twitch
- Angular App & SSR Config
- Admin Package References
- Frontend Package References
- Admin Build Config
- Frontend Build Config
- Admin Dashboard Logic
- Admin Project Metadata
- Frontend Project Metadata
- Admin Angular Dependencies
- Admin Dev Dependencies
- Frontend Angular Dependencies
- Frontend Dev Dependencies
- Backend Dependencies
- AloneCoin Feature
- Profile Feature Frontend
- Admin Rewards Feature
- Frontend Rewards Feature
- Admin Profile Feature
- Admin Guide & Twitch Points
- HTML Page Concepts
- Docker CI Workflows
- Admin Auth & 2FA
- History Feature
- Admin Angular Guidelines
- Login Callback Flow
- Graphify Instructions
- MCP Server Config
- Admin Local Dev Setup
- OTP & QR Auth UI
- Admin Login Flow
- Docker Compose Services
- App Shell & Alert Bar
- pnpm Watcher Config
- OAuth Providers
- Profile Email Epic Fields
- Frontend Signals State
- Frontend Standalone Components
- TypeScript Best Practices
- Admin CLI Docs
- Admin Vitest Docs
- Router Outlet
- Admin App Root
- Accessibility Docs
- pnpm Build Allowlist
- Frontend CLI Docs
- Frontend Dev Server Docs
- Graphify Wiki Index

## God Nodes (most connected - your core abstractions)
1. `Admin` - 28 edges
2. `AloneCoin` - 10 edges
3. `Profile` - 10 edges
4. `options` - 9 edges
5. `options` - 9 edges
6. `Rewards` - 9 edges
7. `Rewards` - 8 edges
8. `environment` - 8 edges
9. `boyalone99-jft` - 7 edges
10. `scripts` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Admin Rewards Page` --semantically_similar_to--> `Rewards Page`  [INFERRED] [semantically similar]
  admin/src/app/rewards/rewards.html → frontend/src/app/rewards/rewards.html
- `Admin Docker Image CI workflow` --semantically_similar_to--> `Backend Docker Image CI workflow`  [INFERRED] [semantically similar]
  .github/workflows/admin.yml → .github/workflows/main.yml
- `Angular Best Practices` --semantically_similar_to--> `Angular Best Practices`  [INFERRED] [semantically similar]
  admin/AGENTS.md → admin/CLAUDE.md
- `Standalone Components Best Practice` --semantically_similar_to--> `Standalone Components Best Practice`  [INFERRED] [semantically similar]
  frontend/AGENTS.md → frontend/CLAUDE.md
- `Signals State Management` --semantically_similar_to--> `Signals State Management`  [INFERRED] [semantically similar]
  frontend/AGENTS.md → frontend/CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Alone Coin acquisition and management flow** — admin_src_app_alone_coin_alone_coin_alone_coin_guide, admin_src_app_admin_admin_users_alone_coin, admin_src_app_admin_admin_history_redemptions [INFERRED 0.75]

## Communities (49 total, 25 thin omitted)

### Community 0 - "Routing & Page Shell"
Cohesion: 0.08
Nodes (28): AdminReward, AdminUser, adminAuthGuard(), AloneCoin, Component, routes, DiscordUser, Reward (+20 more)

### Community 1 - "Backend API & Twitch"
Cohesion: 0.06
Nodes (37): app, axios, cors, crypto, doRefresh(), ensureTenureTable(), express, getTwitchAppToken() (+29 more)

### Community 2 - "Angular App & SSR Config"
Cohesion: 0.08
Nodes (23): App, appConfig, config, serverConfig, serverRoutes, Component, angularApp, app (+15 more)

### Community 3 - "Admin Package References"
Cohesion: 0.06
Nodes (34): @angular/build, @angular/cli, @angular/common, @angular/compiler, @angular/compiler-cli, @angular/core, @angular/forms, @angular/platform-browser (+26 more)

### Community 4 - "Frontend Package References"
Cohesion: 0.06
Nodes (34): @angular/build, @angular/cli, @angular/common, @angular/compiler, @angular/compiler-cli, @angular/core, @angular/forms, @angular/platform-browser (+26 more)

### Community 5 - "Admin Build Config"
Cohesion: 0.07
Nodes (31): build, serve, test, architect, builder, configurations, defaultConfiguration, options (+23 more)

### Community 6 - "Frontend Build Config"
Cohesion: 0.07
Nodes (31): build, serve, test, architect, builder, configurations, defaultConfiguration, options (+23 more)

### Community 8 - "Admin Project Metadata"
Cohesion: 0.14
Nodes (13): prefix, projectType, root, schematics, sourceRoot, cli, analytics, packageManager (+5 more)

### Community 9 - "Frontend Project Metadata"
Cohesion: 0.14
Nodes (13): prefix, projectType, root, schematics, sourceRoot, cli, analytics, packageManager (+5 more)

### Community 10 - "Admin Angular Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/platform-server, @angular/router (+5 more)

### Community 11 - "Admin Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, jsdom, postcss, prettier, tailwindcss (+5 more)

### Community 12 - "Frontend Angular Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/platform-server, @angular/router (+5 more)

### Community 13 - "Frontend Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, jsdom, postcss, prettier, tailwindcss (+5 more)

### Community 14 - "Backend Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, axios, cors, dotenv, express, jsonwebtoken, mysql2, otplib (+1 more)

### Community 20 - "Admin Guide & Twitch Points"
Cohesion: 0.33
Nodes (6): Admin dashboard, Redemptions and Coin History, Rewards management, Users Alone Coin management, Alone Coin guide, Twitch Channel Points exchange

### Community 21 - "HTML Page Concepts"
Cohesion: 0.60
Nodes (6): Admin Rewards Page, Alone Coin Guide Page, Coin Reward History Page, Login Page, Profile Page, Rewards Page

### Community 22 - "Docker CI Workflows"
Cohesion: 0.33
Nodes (6): Admin Docker Image CI workflow, docker/build-push-action, docker/login-action, docker/metadata-action, Backend Docker Image CI workflow, docker/metadata-action

### Community 25 - "Admin Angular Guidelines"
Cohesion: 0.50
Nodes (4): Angular Best Practices, Signals State Management, Standalone Components, Angular Best Practices

### Community 27 - "Graphify Instructions"
Cohesion: 0.50
Nodes (4): graphify explain, graphify-out/graph.json, graphify path, graphify query

### Community 28 - "MCP Server Config"
Cohesion: 0.50
Nodes (3): npx, angular-cli, @angular/cli

### Community 29 - "Admin Local Dev Setup"
Cohesion: 0.67
Nodes (3): Admin local dev on localhost:4001, docker compose admin.yml, environment.ts apiUrl localhost:3000

### Community 30 - "OTP & QR Auth UI"
Cohesion: 0.67
Nodes (3): OTP Input, 2FA QR Code, 2FA Admin Access

### Community 32 - "Docker Compose Services"
Cohesion: 0.67
Nodes (3): Admin Service, Backend Service, Db Service

### Community 33 - "App Shell & Alert Bar"
Cohesion: 0.67
Nodes (3): Alert Bar Component Usage, App Shell Router Outlet, Frontend App Root Shell

## Knowledge Gaps
- **264 isolated node(s):** `npx`, `@angular/cli`, `$schema`, `version`, `packageManager` (+259 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 330 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Admin` connect `Admin Dashboard Logic` to `Routing & Page Shell`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Backend Dependencies` to `Backend API & Twitch`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `Profile` connect `Profile Feature Frontend` to `Routing & Page Shell`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `npx`, `@angular/cli`, `$schema` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Routing & Page Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.08082706766917293 - nodes in this community are weakly interconnected._
- **Should `Backend API & Twitch` be split into smaller, more focused modules?**
  _Cohesion score 0.06155632984901278 - nodes in this community are weakly interconnected._
- **Should `Angular App & SSR Config` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._