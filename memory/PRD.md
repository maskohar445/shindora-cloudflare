# ShinDora Nesub - OpenNext Cloudflare & Turso Database PRD

## Original Problem Statement
Clone https://github.com/maskohar445/shindora-cloudflare.git, configure OpenNext Cloudflare, migrate database from Cloudflare D1 to Turso (LibSQL), ensure deployment on Cloudflare Workers runs smoothly, and verify all UI and features match the original code.

## Architecture & Technology Stack
- **Framework**: Next.js 15 (App Router)
- **Edge Deployment**: `@opennextjs/cloudflare` + Cloudflare Workers (`workerd` runtime)
- **Primary Database**: Turso Database (LibSQL) with pure fetch-based HTTP Edge Pipeline engine (`/v2/pipeline`), `@libsql/client`, and local SQLite fallback (`local_sqlite.db`)
- **Seeding & Migrations**: `turso_init.sql` (120 Doraemon episodes, 9 categories, settings, admin user) and `scripts/seed-turso.js`
- **Configuration**: `open-next.config.ts`, `wrangler.json`, `wrangler.toml`

## Key Features Implemented & Migrated
1. **Turso Database Engine**:
   - Replaced Cloudflare D1 with Turso (LibSQL) as the #1 primary database.
   - Pure fetch HTTP pipeline engine enables zero-cold-start queries in Cloudflare Worker edge runtime with zero native C++ binding dependencies.
   - Built-in local fallback to `local_sqlite.db` for offline development and testing.
2. **OpenNext Cloudflare Setup**:
   - Configured `@opennextjs/cloudflare` build producing `.open-next/worker.js` and `.open-next/assets`.
   - Removed obsolete D1 bindings and configured Turso secrets (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`).
3. **UI & Fullstack Features (Identical to Source)**:
   - Homepage with 120 Doraemon episodes, categories, search, filter, and pagination.
   - Video watch page (`/watch/[slug]`) with video player, metadata, JSON-LD, comments, and related episodes.
   - TV mode (`/tv`) with Smart TV interface, remote control keyboard, and autoplay.
   - Admin & Moderator dashboards (`/admin`, `/moderator`) with video management, categories, settings, and user auth.
   - Manual player (`/putar-manual`).
4. **Automated Seeding & Guides**:
   - `TURSO_DATABASE_SETUP.md`: Comprehensive step-by-step Turso setup & deployment guide.
   - `OPENNEXT_CLOUDFLARE_GUIDE.md`: Cloudflare Workers deploy guide with `wrangler deploy`.
   - `scripts/seed-turso.js` & `turso_init.sql`: One-click data migration into any Turso instance.

## Verification Status
- OpenNext Cloudflare Worker build: PASSED (`.open-next/worker.js` generated)
- Pytest public API & authentication suite: PASSED (2/2 tests)
- UI and Mobile responsiveness: VERIFIED (120 watch links, responsive layouts)
