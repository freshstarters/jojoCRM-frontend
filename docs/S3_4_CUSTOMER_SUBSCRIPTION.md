# S3.4 — Customer subscription

Implements recurring **Customer subscriptions** (a workspace billing its own customer on a weekly, monthly, or yearly interval, distinct from any jojoCRM seat plan) across `jojoCRM` and `jojoCRM-frontend`.

> **Scope note:** External billing / payment gateways (`S3.5`) and file attachments (`S4.3`) remain outside this story.

---

## Backend Architecture (`jojoCRM`)

### Models (`mainapp/models/commercial.py`)
- **`CustomerSubscription`** (`OBJECT_KEY = 'customer_subscription'`): workspace-scoped recurring sale record storing:
  - `account` (FK to `Account`) + `account_name` snapshot
  - `product` (FK to `Product`) + `product_name` / `product_sku` snapshots
  - `warehouse` (optional FK to `Warehouse`) + `warehouse_name` snapshot
  - `quantity` (`DecimalField`, > 0, defaults to `1.00`)
  - `amount` (`DecimalField`, GHS amount per interval, > 0)
  - `interval` (`week`, `month`, `year`)
  - `status` (`Active`, `Paused`, `Cancelled`; defaults to `Active`)
  - `start_date`, `next_billing_date`, optional `last_billed_date`, and `notes`
- **`Invoice`**: extended with `source_subscription` (`ForeignKey` to `CustomerSubscription`, `on_delete=SET_NULL`), `subscription_period_date` (`DateField`), and partial `UniqueConstraint` (`unique_sub_period_invoice_per_workspace`) so one billing interval never produces two Draft invoices.
- **`Activity.VALID_TARGET_OBJECTS`**: includes `'customer_subscription'`.

### Services (`mainapp/service/`)
- **`subscription_service.py`**:
  - CRUD for `customer_subscription` (`SUB-<id>`) with `next_billing_date` calendar arithmetic (`advance_billing_date`), `summary` metrics (`total_count`, `active_amount`, `due_count`, `interval_counts`), optional `generate_first_invoice` flag on creation, S2.4 field-level permission enforcement (`hidden` fields stripped from serialized records/summaries/search; `read_only`/`hidden` writes rejected with `403`; `can_manage_sharing` emitted), and S2.7 cached list bundle (`get_cached_customer_subscriptions_bundle`).
  - `generate_subscription_draft_invoice`: atomically creates **one** `Draft` `Invoice` linked to the subscription with a snapshot `LineItem` for the subscription's `Product`, `quantity`, exact `amount`, and `warehouse` (defaulting to the active default warehouse when `inventory` is enabled). **Never deducts warehouse stock** while Draft; issuing via S3.2 (`issue_invoice_record`) runs `deduct_stock_for_invoice`. Advances `last_billed_date` and `next_billing_date`.
  - `run_due_subscription_intervals` & `run_due_for_all_workspaces`: generate Draft invoices for `Active` subscriptions with `next_billing_date <= as_of`.
  - `set_invoice_line_warehouse`: lets a user pick or change the fulfillment warehouse on a `Draft` subscription invoice line even on packs (such as **Healthcare and wellness**) where `line_item` is disabled.
  - `delete_subscription`: refuses (`409`) deleting an `Active` subscription (must be `Paused` or `Cancelled` first).
- **`commercial_service.py`**:
  - `assert_product_can_be_deleted`: refuses (`409`) deleting a `Product` while referenced by any `Active` `CustomerSubscription` (alongside issued invoices, contracts, non-zero stock, and stock transfers).
  - `assert_account_can_be_deleted`: refuses (`409`) deleting an `Account` while referenced by any `Active` `CustomerSubscription` (alongside issued invoices and contracts).
- **`crm_service.py`**, **`role_service.py`**, **`search_service.py`**, **`audit_service.py`**, **`catalog_service.py`**, **`commercial_seed_service.py`**, **`signals.py`**:
  - Registers `customer_subscription` (`SUB-<id>`) for S2.4 permissions, global search, scoped audit trail (`inspect_pane_id: 'invoicing'`, `inspect_subtab_id: 'subscriptions'`), `linked_records` on `Account` / `Product` / `Invoice`, table record counts, cache invalidation, and demo data seeding.

### Endpoints & CLI
- `GET, POST /api/v1/workspaces/<slug>/customer-subscriptions/` (`GET` emits `Cache-Control: private, no-cache`, `Vary: Cookie`, `ETag`, `X-Cache: HIT | MISS`, and `304 Not Modified` on `If-None-Match`)
- `GET, PATCH, PUT, DELETE /api/v1/workspaces/<slug>/customer-subscriptions/<subscription_id>/`
- `POST /api/v1/workspaces/<slug>/customer-subscriptions/<subscription_id>/generate-invoice/`
- `POST /api/v1/workspaces/<slug>/customer-subscriptions/run-due/`
- `PATCH, PUT, POST /api/v1/workspaces/<slug>/records/invoice/<record_id>/lines/<line_id>/warehouse/`
- `python manage.py process_due_subscriptions [--workspace <slug>] [--as-of YYYY-MM-DD]`

---

## Frontend Screens & Components (`jojoCRM-frontend`)

- **`src/service/commercialService.js`**: `SUBSCRIPTION_INTERVALS`, `SUBSCRIPTION_STATUSES`, status/interval helpers, `listCustomerSubscriptions`, `getCustomerSubscription`, `createCustomerSubscription`, `updateCustomerSubscription`, `deleteCustomerSubscription`, `generateSubscriptionDraftInvoice`, `runDueSubscriptionIntervals`, and `setInvoiceLineWarehouse`.
- **`src/components/invoicing/CustomerSubscriptionsSection.jsx`**: Subscriptions list subtab in `InvoicingPane` with **Agreements**, **Active recurring amount**, **Due now**, **Billing interval** mix bar (`Weekly` / `Monthly` / `Yearly`), searchable `RecordRelationPicker` Account filter, search/status/interval filters, **Run Due Intervals**, per-row **Generate Draft Invoice** action, S2.4 field-rights gating, and one-click navigation to generated Draft invoices.
- **`src/components/invoicing/CustomerSubscriptionFormModal.jsx`** & **`CustomerSubscriptionFields.jsx`**: Modal for creating subscriptions with searchable `RecordRelationPicker` controls for Account and Product (auto-suggesting `unit_price * quantity`), Quantity, GHS Amount, Interval, Status, Next billing date, Fulfillment warehouse (when `inventory` is enabled), Notes, Sharing, S2.4 field-rights gating (`hidden`/`read_only`), and optional unchecked `"Generate first Draft invoice now"` checkbox.
- **`src/components/invoicing/CustomerSubscriptionInspectorDrawer.jsx`**: Built on `RecordInspectorDrawer` (`objectKey="customer_subscription"`) to edit permitted fields, pause/cancel/reactivate, generate a Draft invoice, open generated invoices, inspect **Linked Records**, manage **Record Access / Sharing**, log/view **Activity Timeline**, review **Record Audit History**, and delete (when Paused/Cancelled).
- **`src/components/invoicing/InvoiceInspectorDrawer.jsx`**: Shows the linked `Customer Subscription` (`SUB-<id>`) and—when `line_item` is disabled (e.g., Healthcare)—displays the subscription line summary with a `Select` warehouse picker on `Draft` invoices before issuing.
