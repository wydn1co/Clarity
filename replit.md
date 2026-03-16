# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a feature-rich Discord bot and a shared backend server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Discord**: discord.js v14
- **AI**: OpenAI via Replit AI Integrations

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   ├── discord-bot/        # AI-powered Discord bot
│   └── mockup-sandbox/     # UI prototyping sandbox
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── data/                   # Per-server JSON config files (created at runtime)
```

## Discord Bot (`artifacts/discord-bot`)

AI-powered Discord bot built with discord.js v14 and OpenAI.

### Features
- **All commands require Administrator permission** (except `/help` and `/ai`)
- Per-server JSON configuration stored in `artifacts/discord-bot/data/<guildId>.json`
- Auto-registers slash commands on startup
- Checks expired temp bans and jails every 60 seconds
- AI chat via prefix command (`!ai <prompt>`) and `/ai` slash command

### Commands
| Command | Description |
|---------|-------------|
| `/setup prefix` | Set bot prefix |
| `/setup logchannel` | Set mod log channel |
| `/setup jailchannel` | Set jail channel |
| `/setup view` | View server config |
| `/servercount` | Bot server stats |
| `/dm <user> <message>` | DM a specific user |
| `/dmall <message>` | Mass DM all members |
| `/nuke [channel]` | Delete all channel messages |
| `/say <message> [channel]` | Bot says something |
| `/embed` | Build custom embed |
| `/jail <user> <reason> [duration]` | Jail user |
| `/unjail <user>` | Release jailed user |
| `/tempkick <user> <reason> <duration>` | Temp kick |
| `/tempban <user> <reason> <duration>` | Temp ban |
| `/lock channel [channel]` | Lock channel |
| `/lock unlock [channel]` | Unlock channel |
| `/ai <prompt>` | AI assistant |
| `/help` | Command list |

### Environment Variables
- `DISCORD_BOT_TOKEN` — Bot token (required)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI integration URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI integration key

### Running
```bash
pnpm --filter @workspace/discord-bot run dev
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
