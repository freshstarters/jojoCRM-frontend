# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-17

### Breaking Changes
- **Replaced Vite starter application**: Removed `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, and `src/assets/vite.svg`, and replaced the starter counter page and CSS with the jojoCRM SPA, custom design tokens, and workspace URL routing (`a4b94c0`, `e919263`, `a175d0f`; `index.html`, `src/App.jsx`, `src/index.css`, `src/main.jsx`).
- **Backend API dev proxy coupling**: Configured Vite dev server on port `5173` to proxy `/api` requests to `http://127.0.0.1:8000` (`a4b94c0`; `vite.config.js`).

### Added
- **Design system and reusable UI primitives**: Configured Tailwind CSS (`tailwindcss`, `postcss`, `autoprefixer`), light/dark theme persistence (`jojocrm_theme`), and shared components (`Button`, `Card`, `Checkbox`, `Drawer`, `Modal`, `Select`, `Subtabs`, `FeedbackNotice`, `AuthCardShell`, `ThemeToggleButton`, `RefreshButton`, `CrmTooltipLayer`) (`a4b94c0`, `e919263`, `a96c314`, `9ffed21`, `dd4aaed`; `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `src/utils/theme.js`, `src/components/`).
- **Authentication, invite acceptance, and session recovery screens**: Added `/signup` (with 20-business-type selector and 17-table preview), `/login` (password, Google, Microsoft, and WebAuthn passkeys), `/verify-email`, `/forgot-password`, `/reset-password`, `/accept-invite` (with IANA timezone selection), closed-workspace verification gates, and CSRF/deduplicated API helpers (`e919263`, `a175d0f`, `40d29a4`, `67bd86a`; `src/App.jsx`, `src/screens/`, `src/utils/api.js`, `src/utils/webauthn.js`, `src/utils/timezones.js`).
- **Dynamic workspace shell, Settings, and Audit Log drawer**: Added hover-expanding sidebar navigation driven by `enabled_object_keys` and adapted Contact labels, URL pane/subtab persistence (`/{slug}/{pane}/{subtab}`), disabled-module and future-sprint directory previews, the `36rem` `AuditLogDrawer`, and `SettingsPane` covering **Workspace**, **Packs**, **People**, **Roles** (with interactive per-object CRUD permissions matrix), and **Account & Security** (`a96c314`, `a175d0f`, `67bd86a`, `dd4aaed`; `src/screens/WorkspaceShell.jsx`, `src/screens/SettingsPane.jsx`, `src/components/Settings*.jsx`, `src/components/AuditLogDrawer.jsx`, `src/utils/catalog.js`).
- **Live CRM dashboard, record panes, inspector drawer, and activities**: Added `crmService`, `useCrmRecordsPane`, tabular GHS and timezone-aware formatters, `CrmListPage`, `PaginationBar`, `RecordInspectorDrawer`, `RecordLinksSection`, `ActivityTimeline` (inline quick-composer, edits, completion toggles, and >100-item overflow notice), mini distribution charts (`SummaryMiniCharts`, `PipelineStageDistribution`), and wired `DashboardPane`, `AccountsPane`, `ContactsPane`, `LeadsPane`, `DealsPane` (Table and read-only Stage Board views), `JobsPane`, `AppointmentsPane`, and `TicketsPane` (`40d29a4`, `9ffed21`, `7591ab1`; `src/service/crmService.js`, `src/hooks/useCrmRecordsPane.js`, `src/components/crm/`, `src/screens/`, `src/utils/formatters.js`, `src/utils/crmFormOptions.js`).
- **Lead-to-Deal conversion workflow**: Added `ConvertLeadModal` (server-backed Lead search picker, Account/Contact match banners with Create vs Reuse options and search fallback, Deal creation fields), `ConversionResultBanner` with direct record links, `canUserConvertLead` gating, and conversion actions plus provenance tags across Leads, Deals, Accounts, and Contacts (`0b93a55`, `d50de63`; `src/components/crm/ConvertLeadModal.jsx`, `src/components/crm/ConversionResultBanner.jsx`, `src/components/crm/RecordLinksSection.jsx`, `src/screens/LeadsPane.jsx`, `src/screens/DealsPane.jsx`, `src/screens/AccountsPane.jsx`, `src/screens/ContactsPane.jsx`, `src/service/crmService.js`).

### Changed
- **Checkbox styling consistency**: Replaced native browser checkboxes in `SettingsRolesSection` and `ActivityTimeline` with the custom frosted `Checkbox` component (`dd4aaed`; `src/components/Checkbox.jsx`, `src/index.css`).

### Documentation & Maintenance
- **UI template, startup guide, and product docs**: Added `UI-template/jojocrm_workspace_ui.html`, updated `README.md` with local API/Vite startup steps and `Checkbox` usage notes, added `docs/PRD.md`, `docs/SCOPE.md`, `docs/SOW.md`, and `docs/BACKLOG.md`, and added `.env`, `.agent/*`, and `.cursor/*` to `.gitignore` (`a4b94c0`, `3d22e78`, `9450e65`, `dd4aaed`).

### Upgrade & Deployment Notes
- **Dependencies and API server**: Run `npm install` to install `tailwindcss`, `postcss`, and `autoprefixer`, and ensure the `jojoCRM` backend server is running at `http://127.0.0.1:8000` before starting `npm run dev` on `http://localhost:5173`.
- **Manifest version alignment**: `package.json` on `alpha` still carries `"version": "0.0.0"`; update it to `1.0.0` (or your chosen release tag) when cutting a release.
