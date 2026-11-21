# S2.7 Response and Workspace Caching

Implemented in `/home/demiz/Projects/jojo_crm_venv/jojoCRM` and `/home/demiz/Projects/jojoCRM-frontend`.

## Overview

S2.7 configures server-side caching (`CACHES`), HTTP conditional caching (`ETag`, `Cache-Control`, `Vary`, `304 Not Modified`, and `X-Cache`), strictly workspace- and caller-isolated metadata caching with immediate write invalidation, and frontend request deduplication + short-lived in-memory lookup caches with cross-tab synchronization.

## Backend Configuration (`jojoCRM/settings.py` & `.env.example`)

`build_cache_settings()` configures `CACHES['default']` via `python-decouple`:

- **Default backend**: `django.core.cache.backends.redis.RedisCache`
  - Local dev (`DEBUG=True`) defaults to `redis://127.0.0.1:6379/1` when `REDIS_URL` / `CACHE_LOCATION` are unset.
  - Production (`DEBUG=False`) **fails closed** with `ImproperlyConfigured` if `REDIS_URL` and `CACHE_LOCATION` are missing, or if `LocMemCache` / `DummyCache` is configured without `ALLOW_LOCAL_MEMORY_CACHE=True`.
  - Automated Django test runs (`RUNNING_TESTS=True`) default to `LocMemCache` (`jojocrm-test`) unless `CACHE_BACKEND` is explicitly overridden, isolating tests from live dev Redis.
- **Environment variables**:
  - `REDIS_URL` (default in `.env.example`: `redis://127.0.0.1:6379/1`)
  - `CACHE_BACKEND`, `CACHE_LOCATION`, `CACHE_KEY_PREFIX` (default `jojocrm`), `CACHE_DEFAULT_TIMEOUT` (default `300`)
  - `STATIC_CATALOG_CACHE_TTL` (default `86400`), `WORKSPACE_CACHE_TTL` (default `300`)
  - `ALLOW_LOCAL_MEMORY_CACHE` (default `False`)

## Server-Side & HTTP Caching (`mainapp/service/cache_service.py`)

### Static Starter Catalog
- **`GET /api/v1/catalog/business-types/`** ([`mainapp/views/public_views.py`](../mainapp/views/public_views.py)):
  - Caches pre-serialized canonical UTF-8 JSON text and strong SHA-256 `ETag` under `static:catalog:business_types:v2` (`STATIC_CATALOG_CACHE_TTL`).
  - `ActiveSessionEnforcementMiddleware` bypasses session inspection on `PUBLIC_STATELESS_PATHS` (`/api/v1/catalog/business-types/`, `/api/v1/hello/`) so anonymous catalog responses emit `Vary: Accept-Encoding` without `Vary: Cookie`.
  - Cache hits never re-run `serialize_business_type_catalog()` or `json.dumps()`.
  - Emits `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`, `Vary: Accept-Encoding`, `ETag`, and `X-Cache: HIT | MISS`.
  - Supports RFC 9110 weak/strong `If-None-Match` comparison (including `W/` prefixes, comma-separated lists, and `*`) returning `HttpResponseNotModified()` (`304 Not Modified` without injecting a `text/html` `Content-Type`).

### Workspace & Caller-Scoped Caching
Workspace caches use per-workspace UUID version tokens across **5 invalidation domains**:
1. `catalog`: `Workspace`, `WorkspacePack`, `WorkspaceTable`
2. `records`: `Account`, `Contact`, `Activity`, `Lead`, `Deal`, `Job`, `Appointment`, `Visit`, `Ticket`, `Pipeline`, `PipelineStage`
3. `lookup_records`: `Account`, `Contact`, `Pipeline`, `PipelineStage`
4. `members`: `User` (ignoring `last_login`-only saves) and session invalidations
5. `roles`: `Role` and `User` role/active/verified updates

Cached surfaces:
- **Workspace catalog summary** (`serialize_workspace_catalog_summary` in [`mainapp/service/catalog_service.py`](../mainapp/service/catalog_service.py)) — domain: `catalog`.
- **Workspace table record counts** (`get_workspace_table_record_counts` in `catalog_service.py`) — domain: `records` (dynamic `OBJECT_RECORD_COUNT_RESOLVERS` are overlaid live when registered).
- **Active seat count** (`count_active_seats` in [`mainapp/service/role_service.py`](../mainapp/service/role_service.py)) — domain: `members`.
- **`GET /api/v1/workspaces/<slug>/`** ([`mainapp/views/workspace_views.py`](../mainapp/views/workspace_views.py)) — domains: `catalog`, `members`, `roles`; scoped per `user.id` + `build_caller_cache_scope()`.
- **`GET /api/v1/workspaces/<slug>/packs/`** (`workspace_views.py` / `get_cached_workspace_packs_detail_bundle`) — domains: `catalog`, `records`.
- **`GET /api/v1/workspaces/<slug>/dashboard/`** ([`mainapp/views/crm_views.py`](../mainapp/views/crm_views.py) / `get_cached_dashboard_summary_bundle`) — domains: `catalog`, `records`, `roles`, `members`; scoped per caller (`owner.<perm_hash>` or `user.<id>.<perm_hash>`). Returns KPI counts, `deal_summary`, `task_summary`, `activity_breakdown`, `active_deals`, `recent_visits`, `upcoming_appointments`, `active_tickets`, `ghana_hubs`, `velocity_series`, and `latest_audit`.
- **`GET /api/v1/workspaces/<slug>/pipelines/`** ([`mainapp/views/pipeline_views.py`](../mainapp/views/pipeline_views.py) / `get_cached_workspace_pipeline_detail_bundle` in [`mainapp/service/pipeline_service.py`](../mainapp/service/pipeline_service.py)) — domains: `catalog`, `records`, `roles`; scoped per caller (`owner` or `user.<id>.<perm_hash>`).
- **`GET /api/v1/workspaces/<slug>/warehouses/`** ([`mainapp/views/inventory_views.py`](../mainapp/views/inventory_views.py) / `get_cached_warehouses_bundle` in [`mainapp/service/inventory_service.py`](../mainapp/service/inventory_service.py)) — domains: `catalog`, `records`, `roles`; scoped per `include_inactive` and caller (`owner.<perm_hash>` or `user.<id>.<perm_hash>`).
- **`GET /api/v1/workspaces/<slug>/inventory/`** ([`mainapp/views/inventory_views.py`](../mainapp/views/inventory_views.py) / `get_cached_inventory_overview_bundle` in [`mainapp/service/inventory_service.py`](../mainapp/service/inventory_service.py)) — domains: `catalog`, `records`, `roles`; scoped per caller and SHA-256 query signature (`warehouse_id`, `q`, `low_stock_only`, `include_inactive`).
- **`GET /api/v1/workspaces/<slug>/customer-subscriptions/`** ([`mainapp/views/subscription_views.py`](../mainapp/views/subscription_views.py) / `get_cached_customer_subscriptions_bundle` in [`mainapp/service/subscription_service.py`](../mainapp/service/subscription_service.py)) — domains: `catalog`, `records`, `roles`; scoped per caller (`owner.<perm_hash>` or `user.<id>.<perm_hash>`) and SHA-256 query signature (`status`, `interval`, `account_id`, `product_id`, `visibility`, `q`).
- **`GET /api/v1/workspaces/<slug>/crm/options/`** (`crm_views.py` / `get_cached_crm_options_bundle`) — domains: `catalog`, `lookup_records`, `members`, `roles`; scoped per caller (`owner.<perm_hash>` or `user.<id>.<perm_hash>`).
- **`GET /api/v1/auth/session/`** ([`mainapp/views/auth_views.py`](../mainapp/views/auth_views.py)) — emits `Cache-Control: private, no-store` and `Vary: Cookie` while internally reusing cached workspace catalog summary and active seat count.

All authenticated cached workspace GET endpoints emit `Cache-Control: private, no-cache`, `Vary: Cookie`, workspace+caller-scoped `ETag`, `X-Cache: HIT | MISS`, and `304 Not Modified` on `If-None-Match`.

### Safe Runtime Degradation & Write Invalidation
- Transient Redis/cache transport errors in `cache_service.py` log a warning and degrade cleanly to live PostgreSQL queries without bypassing authentication or permissions.
- `invalidate_workspace_cache()` bumps domain version tokens **immediately** and schedules a coalesced `transaction.on_commit()` re-bump when inside an atomic block.
- Signal receivers in [`mainapp/signals.py`](../mainapp/signals.py) and explicit invalidations in [`mainapp/service/pipeline_service.py`](../mainapp/service/pipeline_service.py), [`mainapp/service/role_service.py`](../mainapp/service/role_service.py), and [`mainapp/service/session_service.py`](../mainapp/service/session_service.py) cover `save`, `delete`, `.update()`, and `bulk_update()`.

## Frontend Caching & Deduplication (`jojoCRM-frontend`)

- **[`src/utils/clientCache.js`](file:///home/demiz/Projects/jojoCRM-frontend/src/utils/clientCache.js)**:
  - Deduplicates concurrent in-flight requests for `/api/v1/auth/session/`, `/api/v1/catalog/business-types/`, `/api/v1/workspaces/<slug>/`, `/dashboard/`, `/crm/options/`, `/packs/`, and `/pipelines/`.
  - Retains short-lived workspace-scoped in-memory lookup caches across pane navigation (`dashboard`: 15s, `options`: 30s, `packs`: 30s, `pipelines`: 30s) with race-safe generation guards and `structuredClone` isolation.
  - Enforces strict single-workspace scope (`setActiveWorkspaceScope(slug)`), purging all cached entries whenever the workspace changes.
  - Clears all workspace caches on logout, `401` session expiry, and `App.jsx` auth state transitions.
  - Automatically invalidates affected workspace lookup domains on successful `POST`/`PATCH`/`PUT`/`DELETE` mutations (including `/customer-subscriptions/` mutations invalidating `dashboard`, `packs`, `options`, and `invoiceStatuses`) and `X-Permissions-Version` changes, and propagates invalidations/sign-outs across browser tabs via `BroadcastChannel('jojocrm-cache-sync')`.
- Wired through [`src/utils/api.js`](file:///home/demiz/Projects/jojoCRM-frontend/src/utils/api.js), [`src/service/crmService.js`](file:///home/demiz/Projects/jojoCRM-frontend/src/service/crmService.js), [`src/App.jsx`](file:///home/demiz/Projects/jojoCRM-frontend/src/App.jsx), [`src/screens/SignupScreen.jsx`](file:///home/demiz/Projects/jojoCRM-frontend/src/screens/SignupScreen.jsx), [`src/screens/DashboardPane.jsx`](file:///home/demiz/Projects/jojoCRM-frontend/src/screens/DashboardPane.jsx), [`src/components/SettingsPacksSection.jsx`](file:///home/demiz/Projects/jojoCRM-frontend/src/components/SettingsPacksSection.jsx), [`src/components/SettingsPipelinesSection.jsx`](file:///home/demiz/Projects/jojoCRM-frontend/src/components/SettingsPipelinesSection.jsx), and [`src/components/SettingsRolesSection.jsx`](file:///home/demiz/Projects/jojoCRM-frontend/src/components/SettingsRolesSection.jsx).

## Automated Tests

- Backend suite: [`mainapp/tests/test_response_and_workspace_caching.py`](../mainapp/tests/test_response_and_workspace_caching.py).
- Frontend cache & deduplication suite: [`src/utils/clientCache.test.mjs`](file:///home/demiz/Projects/jojoCRM-frontend/src/utils/clientCache.test.mjs) (`node --test src/utils/clientCache.test.mjs`).
