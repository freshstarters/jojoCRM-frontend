# jojoCRM Backlog

Status: stories for the milestones in [SCOPE.md](SCOPE.md).

Product behavior is defined in [PRD.md](PRD.md). Acceptance item numbers refer to the numbered list under "Acceptance" in the PRD. A story is one slice a reviewer can accept. These stories are not split into models, endpoints, and screens, and they are not issue-tracker tickets.

A story that misses its milestone carries into the next milestone. The calendar does not pause. The checks under each story are what the reviewer walks through.

## Sprint 1 — Tenancy and auth

Unlocks acceptance 1 and the sign-in half of acceptance 2.

Prerequisite: hosting region, transactional email, IP geolocation provider, and Google and Microsoft OAuth apps for sign-in.

The interface is English. Each user has a timezone. Amounts are GHS. One account belongs to one workspace, and the workspace is a slug on a single app domain.

### S1.1 Ghana workspace

Serves acceptance 1.

Signup calls the geolocation provider and reads the country of the connection. Registration continues only when that country is clearly `GH`. A failed lookup, an unknown country, a VPN or hosting result that is not clearly Ghana, and any other country are refused with the same outcome. The screen describes this as a connection-location check.

The reviewer confirms:

- A clear GH connection can name a workspace and land inside it.
- Each non-GH and unknown result is refused before a workspace exists.
- The workspace URL is a slug on the one app domain.

### S1.2 Email and password

Serves acceptance 2.

The account is the verified email. The workspace is not usable for that person until the verification message has been used. They can set a new password from a reset message.

The reviewer confirms:

- Signup sends a verification message, and the workspace stays closed until it is used.
- Password reset sends a message and then accepts the new password.
- A wrong password is refused.

### S1.3 Additional sign-in

Serves acceptance 2.

Google, Microsoft, and a passkey are further ways into the same verified email. They do not create a second account when the email matches. A passkey is optional. It is not a second factor that the other methods require. Signing in with Google or Microsoft does not connect that mailbox.

The reviewer confirms:

- Each of the three methods opens the account that already owns that email.
- The account can still use email and password after a passkey is registered.
- A Google or Microsoft sign-in leaves mailbox connection unset.

### S1.4 Invites

Serves acceptance 1.

The Owner, or a role that has the users-and-roles switch, sends an email invite. The invited person joins this workspace only. They are not location-checked, including when their connection is outside Ghana. After they join, later logins are not location-checked for anyone.

The reviewer confirms:

- An invite from outside Ghana is accepted.
- That person cannot create or join a second workspace.
- A founder who signed up in Ghana can later sign in from another country.

### S1.5 Owner, Staff, and audit

Serves acceptance 3.

The creator is the Owner. The Owner cannot be removed and is the only role that will manage the seat plan and the SMS wallet. Non-Owner members can be deactivated or reactivated by the Owner or a role with the users-and-roles switch; deactivating a member immediately invalidates their active sessions, blocks sign-in, and excludes them from active paid seats. A default Staff role exists so later stories can clone it. Visiting `/` or `/login` while already signed in and verified opens the user's `/{slug}` workspace directly via session recovery. From Settings, a signed-in user can change their password (verifying the current password), update their timezone, and unlink a connected Google or Microsoft sign-in identity without affecting email and password login. Every later record change can store the actor, the time, the previous value, the new value, and whether the actor was a person, a script, an automation, or the agent. This story proves the person case.

The reviewer confirms:

- The Owner remains after another user is invited and cannot be deactivated or removed.
- Staff exists and can be told apart from the Owner.
- Deactivating a non-Owner member ends their active session and blocks sign-in, and reactivating them restores access.
- Visiting `/` or `/login` while signed in opens the user's `/{slug}` workspace directly.
- A signed-in user can update their password and timezone and unlink a linked Google or Microsoft identity from Settings.
- A change written in this sprint appears in the audit with actor, time, and values.

## Sprint 2 — Core and the catalog

Unlocks acceptance 3 and 4, and the business-type part of acceptance 1.

### S2.0 Business type and packs

Serves acceptance 1 and 4.

While creating the workspace the tenant picks one of the 20 business types. That creates the core (Account, Contact, Activity, File, Tag) and the 12 objects in that type's pack. The workspace then has 17 tables. Healthcare labels Contact as Patient. Education labels Contact as Student or Guardian. Nonprofit, faith, and membership labels Contact as Donor or Member. The Owner can turn on another pack later. Tables that already hold records stay. Empty tables from a pack can be turned off. The business-type label can be renamed. Switching sidebar panes or Settings subtabs updates the URL path/query (or persisted navigation state) so refreshing the page or using browser Back/Forward returns to the same pane and subtab.

The reviewer confirms:

- General services shows its 12 pack tables plus the core, 17 in all, including Lead, Deal, Job, Appointment, Ticket, and Invoice.
- Healthcare shows Contact as Patient, includes Appointment and Visit, and does not show Deal.
- A second pack can be turned on, and a record already saved in the first pack remains.
- An empty table from a pack can be turned off, and a table that holds a record cannot.
- Refreshing the browser on a workspace pane or subtab returns to that same pane and subtab rather than resetting to the default view.

### S2.1 Core and pack objects

Serves acceptance 3 and 4.

On a General services workspace, Account, Contact, Lead, Deal, Activity, Job, Appointment, and Ticket can be created, read, updated, and deleted according to the caller's role. Activity types in this sprint are note, task, call, and meeting. A Contact can sit on an Account. A Lead is separate until conversion. A Job has a status, an assignee, a due date, and a linked Account or Contact. An Appointment has a time, a status, an assignee, and a linked Contact.

The reviewer confirms:

- A role with update rights can edit each of those objects, and a role without those rights cannot.
- A note, a task, a call, and a meeting can be saved on a record.
- A Job and an Appointment save and show their links.
- One workspace cannot read another workspace's records.
- Food and beverage, which has no Deal, does not offer a Deal table.

### S2.2 Lead conversion

Serves acceptance 4.

On General services, converting a lead creates an Account, a Contact, and a Deal. The lead stays on record and is marked converted. Converting the same lead again does not create a second set. A pack without Deal does not offer conversion.

The reviewer confirms:

- The three new records exist and point at the lead.
- The lead is still listed, with the converted mark.
- A second conversion is refused.
- Healthcare does not offer lead-to-deal conversion.

### S2.3 Pipeline

Serves acceptance 4.

A General services workspace has one pipeline: New, Qualified, Proposal, Won, Lost. A role that can manage the sales settings can rename, reorder, add, and remove stages. Deals on a removed stage are moved to a stage the reviewer chooses. The deal board is a kanban grouped by stage.

The reviewer confirms:

- The default stages are present on General services.
- Reordering stages changes the kanban.
- Dragging a deal to another stage saves that stage.
- Healthcare has no kanban, because it has no Deal.

### S2.4 Roles and sharing

Serves acceptance 3.

Cloning Staff copies its object rights, field rights, and switches. Object rights are create, read, update, and delete. Field rights are hidden, read-only, and editable. The switches are import, export, automations, scripts, users and roles, theme and layouts, and unattended agent. Switches for features that arrive in later sprints are stored now and enforced when those features arrive. The Owner, or a role with the users-and-roles switch, can choose a non-Owner role when sending an invite and can reassign an existing non-Owner member to another non-Owner role in Settings. Role reassignments and role permission updates apply immediately on the API and prompt or trigger active client sessions for affected users to refresh their permissions cleanly. A signed-in verified user whose account has no password yet can set an initial password in Settings without using the signed-out reset flow, and can rename a registered passkey label.

A record's visibility is one of three: its owner, one role, or the whole workspace. Hidden fields are omitted for that role. Read-only fields are shown and cannot be saved by that role. Rights apply to the objects the pack turned on, including Job, Appointment, and Visit.

The reviewer confirms:

- A clone can hide one field, freeze another, and leave a third editable.
- A cloned role can be selected on an invite or assigned to a non-Owner member in Settings, and the change is audited.
- Updating a non-Owner member's role or object permissions updates their active client session permissions without requiring manual logout/login.
- A signed-in user can set an initial password when none is configured and rename a registered passkey in Settings.
- The same record is visible or invisible according to the three sharing choices.
- The Owner still sees the hidden field.

### S2.5 Search and audit

Serves acceptance 4.

Global search covers the objects the workspace has. Foreign-key/relation pickers (`Account`, `Contact`, etc.) support server-backed search and pagination so workspaces with more than 250 linkable records can find and attach any readable record. Opening a record in the inspector drawer updates the URL query or path (`?inspect=...` or record route) so refreshing, sharing a link, or navigating Back/Forward returns to that inspected record. A stage change from S2.3 writes an audit entry with the person, the time, the old stage, and the new stage. Global search results and the audit history drawer paginate results rather than returning unbounded lists. The workspace audit log drawer filters by actor kind, object type, action (`create`, `update`, `delete`), and search query, and opening a record in the inspector drawer shows that record's own audit change history.

The reviewer confirms:

- Search finds a record by a distinctive name and does not return another workspace's row.
- Search on Healthcare does not offer Deal.
- Relation pickers can search and select readable records beyond the first 250 entries.
- Refreshing the browser while inspecting a record reopens that record's inspector drawer cleanly.
- The stage change is in the deal's inspector history and in the filtered workspace audit drawer after a refresh.
- Large search results and audit histories paginate cleanly across pages and filter by object type, action, and search term.

### S2.6 Visit

Serves acceptance 6.

On Healthcare, a Visit stores a date, a reason, notes, and a follow-up, linked to a Patient. It does not store a chart, a lab, or a prescription.

The reviewer confirms:

- A Visit saves against a Patient and shows those four fields.
- There is no field for a diagnosis code, a lab result, or a prescription.
- General services does not include Visit.

### S2.7 Response and workspace caching

Supports all acceptance items reliably at scale.

Configure Django `CACHES` and HTTP caching (`ETag` / `Cache-Control`) for static starter catalog endpoints (`/api/v1/catalog/business-types/`) and workspace-scoped caching for frequently accessed metadata: workspace catalog summary, table record counts, dashboard summaries, and CRM dropdown options (`/crm/options/`). Cache keys are strictly isolated by workspace (and caller role/permissions where applicable) and are invalidated immediately whenever packs, tables, roles, members, or CRM records are created, updated, or deleted. On the frontend, deduplicate concurrent session/catalog/options fetches and retain short-lived in-memory lookup caches across pane navigation without leaking state across workspaces or sign-outs.

The reviewer confirms:

- Repeated requests for the starter business-type catalog return `304 Not Modified` / cache-hit responses without re-serializing static payloads.
- Workspace summary, pack record counts, and CRM lookup options serve from cache on repeat reads and immediately reflect mutations after creating/editing a record, toggling a table, or updating a role.
- One workspace never receives another workspace's cached payloads, and switching or signing out clears client-side caches.

### S2.8 Demo seed data for manual testing

Supports manual QA across acceptance 3–10 without affecting production signups.

Provide an idempotent Django management command (`manage.py seed_demo_data`, supporting `--reset` and `--only <pack_key>`) restricted to non-production/debug environments (`DEBUG=True` or explicit `--force`) that populates verified Owner and Staff test accounts across representative business types (such as General services, Retail and trading, Healthcare and wellness, and Financial services). Each seeded tenant includes realistic Ghanaian `Account`, `Contact`/`Patient`, `Lead`, `Deal` (spanning all pipeline stages so Kanban boards and stage distribution charts render), `Job`, `Appointment`, `Ticket`, and `Activity` records—and later Sprint 3–5 stories extend the command to populate invoices, payments, stock, and custom dashboard widgets. Self-serve production workspaces continue to start empty.

The reviewer confirms:

- Running `seed_demo_data` twice is idempotent and populates rich, non-empty tables, linked records, and charts across the seeded test tenants.
- Running `seed_demo_data --reset` cleanly refreshes demo tenants without touching non-seeded workspaces.
- Normal self-serve workspace signup continues to create an empty workspace, and running the command with `DEBUG=False` without `--force` is refused.

## Sprint 3 — Stock and invoicing

Unlocks acceptance 5 and 6.

The reviewer uses Retail and trading for stock and invoices, and Healthcare for the customer subscription. Financial services is used for Policy.

### S3.1 Invoice

Serves acceptance 5.

On Retail and trading, Product, line item, Invoice, and Payment are available. A line item points at a Product and can belong to a Deal, an Invoice, a Contract, or a Customer subscription when that parent is on. An Invoice stores an issue date and a due date so unpaid and overdue balances and date-offset automations can be evaluated. Invoice statuses start as Draft, Issued, Partially paid, Paid, and Void. The tenant can edit that list. The PDF shows the number, customer, issue date, due date, lines, GHS totals, and status. A Payment stores amount, date, method, and status against one invoice. Payments exceeding the invoice's remaining unpaid balance are refused. Once an invoice leaves Draft (Issued, Partially paid, or Paid), its line items cannot be edited or deleted directly. Recording a payment does not charge a card and does not move stock. Deleting a Product or Account referenced by an issued invoice or contract is refused while those commercial links exist.

The reviewer confirms:

- A retail invoice with issue date, due date, and two products downloads as that PDF.
- A partial payment leaves the invoice partially paid, payments that meet the total leave it paid, and an overpayment above the remaining balance is refused.
- Editing or deleting line items on an Issued, Partially paid, or Paid invoice is refused.
- Nothing in this flow asks the customer for a card.
- Attempting to delete a Product or Account linked to an issued invoice is refused.

### S3.2 Warehouses

Serves acceptance 5.

A Retail and trading workspace can hold more than one warehouse, with one marked default. Each product stores quantity on hand and a reorder level in each warehouse. An invoice line can pick a warehouse. Quantity falls when the invoice is issued and returns when an unpaid Issued invoice is voided; voiding a Partially paid or Paid invoice with settled payments is refused while active payments remain. A transfer record moves quantity from one warehouse to another, and both sides are in the audit history. The transfer cannot exceed the source quantity. A pack without Inventory, such as General services, has no warehouses.

The reviewer confirms:

- Issuing a retail invoice decreases only the chosen warehouse.
- Voiding an unpaid issued invoice restores that quantity, and voiding a partially paid or paid invoice is refused.
- A transfer changes both warehouses and names the person who did it.
- Paying the invoice leaves the quantities unchanged.
- General services does not offer Inventory.

### S3.3 Contract

Serves the catalog scope of the PRD.

On a pack that includes Contract, such as Wholesale and distribution, a contract links an Account and a Contact. It has a status, a start date, an end date, a GHS value, and a renewal date. Its line items use the same Product rules as an invoice when Product is on. A file can be attached once S4.3 is done; until then the contract itself is enough for this story.

The reviewer confirms:

- The contract shows those fields and its lines.
- A contract in one workspace is invisible from another.

### S3.4 Customer subscription

Serves acceptance 6.

On Healthcare, a customer subscription is the clinic billing its own customer. It is not the jojoCRM seat plan. It links an Account and a Product, with an interval of week, month, or year, a GHS amount, and a status. Each interval creates a Draft invoice linked to the subscription. That draft does not change warehouse quantities. Issuing it uses the stock rules in S3.2. A Product or Account linked to an active customer subscription cannot be deleted while that subscription remains active.

The reviewer confirms:

- The interval produces one Draft invoice, not an Issued one.
- Warehouse quantities are unchanged while it stays a draft.
- Issuing it then moves stock.
- Deleting a Product or Account referenced by an active customer subscription is refused.

### S3.5 Policy

Serves the Financial services pack in the PRD.

A Policy stores a product, a premium, a status, and a renewal, linked to an Account or Contact. It does not collect a bank account number or a KYC document.

The reviewer confirms:

- A Policy saves with those fields on a Financial services workspace.
- The form has no bank-account or KYC upload.
- Retail and trading does not include Policy.

## Sprint 4 — Campaigns and files

Completes the saved-view part of acceptance 10. Sending waits for sprint 6. Tickets are reviewed on Healthcare. Campaigns are reviewed on Retail and trading.

### S4.1 Ticket

Serves acceptance 6 and the Healthcare pack.

A ticket is a support case on an Account or a Patient. Statuses start as New, Open, Pending, Resolved, and Closed. The tenant can edit that list. Role rights from S2.4 apply. A pack without Ticket does not show the table. Food and beverage has no Ticket.

The reviewer confirms:

- A new healthcare ticket starts at New.
- Moving it through the default statuses is saved.
- A role without update rights cannot change the status.
- Food and beverage does not offer Ticket.

### S4.2 Campaign record

Serves acceptance 7 once sprint 6 can send it.

On Retail and trading, a campaign has a name, one channel (email, SMS, or phone-call tasks), a status, a start, an end, and a list of Leads and Contacts. Saving it does not send mail or SMS and does not create call activities. Membership is a list on the campaign, not a many-to-many field type. Energy and fuel has no Campaign.

The reviewer confirms:

- One campaign can be saved for each channel.
- A saved campaign produces no outbound message and no call activity.
- A Lead or Contact can be added to and removed from the retail list.
- Energy and fuel does not offer Campaign.

### S4.3 Files and tags

Serves the starter-object scope of the PRD.

A file attaches to any starter record, and later to a tenant-created record. A tag is a workspace label that can be applied to a record. Tags are not relation fields.

The reviewer confirms:

- The same file control works on an Account and on an Invoice.
- A tag created once can be applied to two records.
- Removing the tag from one record leaves the other tagged.

### S4.4 CSV

Serves the import and export scope of the PRD.

A role with the import switch can bring starter-object rows in from CSV after previewing and confirming column mappings. A role with the export switch can take them out. Rows that fail validation stay reported in a structured error summary (row number, field, and reason) and are not silently dropped. This is record import and export. Exporting or deleting the whole workspace is S8.3.

The reviewer confirms:

- A small CSV of contacts previews its column mapping and round-trips through export.
- A row with a missing required value is listed in the structured failure summary with its row number, field, and reason, and is not created.
- A role without the matching switch cannot import or export.

### S4.5 Saved views

Serves acceptance 10.

A list can change columns, filters, and sort, and that combination can be saved and reopened. The deal kanban from S2.3 remains available beside the deal list. Record lists paginate rows with page controls that preserve active columns, filters, and sort, and deep-linking to an inspected record (`?inspect=...`) preserves view context across refresh and history navigation. Foreign-key/relation pickers support server-backed search/pagination beyond 250 options.

The reviewer confirms:

- A saved view reopens with the same columns, filter, and sort.
- Another user does not lose their own saved view.
- A hidden field from S2.4 does not appear as a column for a role that cannot see it.
- Navigating between pages on a filtered, sorted saved view preserves the view settings, and refreshing a deep-linked record reopens its inspector inside the view.

### S4.6 Activities and tasks view

Serves acceptance 4 and 10.

Provide a dedicated cross-record Activities workspace view where users can list, filter (by activity type `note`, `task`, `call`, `meeting`, completion status, assignee, and search query), create/complete tasks, and jump directly to each activity's parent CRM record, respecting S2.4 object, field, and sharing permissions.

The reviewer confirms:

- A user can view open tasks, calls, and meetings across multiple Accounts, Contacts, Deals, Jobs, and Tickets from one workspace Activities view.
- Completing a task or filtering by assignee/type updates the parent record's timeline, and records hidden by sharing/role rules remain excluded.

## Sprint 5 — Custom platform and theme

Unlocks the custom-table and script parts of acceptance 9, and the rest of acceptance 10.

### S5.1 Custom tables

Serves acceptance 9.

A role with the right object rights can add a table and fields of type text, long text, number, date, single-select, checkbox, many-to-one relation, and script. A relation points many rows at one row. Many-to-many is done by creating a third table. Records in the new table follow the same role, sharing, search, file, and tag rules as starter records.

The reviewer confirms:

- A new table accepts a row with each non-script field type. The script type is proven in S5.2.
- A many-to-one field can point at an Account, and many rows can point at that Account.
- A many-to-many field type is not offered.

### S5.2 Script sandbox

Serves acceptance 9.

A script field runs for at most one second. It can read and write records in the same workspace only. It has no filesystem and cannot call another script. It cannot change billing, roles, or scripts. It may call HTTPS URLs on an allowlist only the Owner edits. Private, loopback, and link-local addresses are refused even if someone puts them on the list. HTTP time and response size are capped. The functions inside a script are arithmetic, text, IF, empty checks, date math, lookup along a relation, and SUM, COUNT, MIN, and MAX from child records.

The reviewer confirms:

- A script writes a computed field the reviewer can see after save.
- A lookup and a child rollup return the related values.
- A private-network URL is refused.
- A script cannot read a row from another workspace.

### S5.3 Layout builder

Serves acceptance 10.

The home dashboard is a set of widgets of type number, chart, and list. Each widget is bound to an object and filters (including cross-record Activity task/meeting lists from S4.6). A record page is ordered sections and fields. The tenant who has the theme-and-layouts switch can rearrange those. There is no free-form canvas and no custom HTML.

The reviewer confirms:

- Adding, removing, and reordering widgets changes the home dashboard.
- Reordering fields on a record page survives a reload.
- A widget respects the viewer's sharing and hidden fields.

### S5.4 Theme tokens

Serves acceptance 10.

The same switch can set a logo, primary, accent, and surface colors, light or dark, and a font from the short list. Preset themes are included. The shell, the dashboard, and record pages all use those tokens. Pasted CSS is not accepted.

The reviewer confirms:

- A logo and a changed primary color show on the shell and on a record page.
- Light and dark both apply the tokens.
- A CSS value pasted into a color or font control is rejected.

## Sprint 6 — Mail, SMS, and automations

Completes acceptance 2, 7, 8, and 9.

Prerequisite: mailbox scopes on the Google and Microsoft OAuth apps, a Hubtel business account and a path to approve a sender ID, and a Paystack merchant account for the SMS wallet.

### S6.1 Send from a record

Serves acceptance 2 and 7.

The user connects Google or Microsoft for mail. That consent is separate from sign-in. They can send from a record as themselves. The send is stored as an email Activity on that record. Disconnecting the mailbox stops further sends from it.

The reviewer confirms:

- Connecting the mailbox does not change how they sign in.
- A send appears as an Activity and is visible to someone who can see that record.
- After disconnect, a new send is refused until they connect again.

### S6.2 Two-way sync

Serves acceptance 8.

The user can choose two-way sync instead of send-only. Messages that match a Contact's email address are copied onto that Contact. Messages that match no Contact stay in the mailbox and are not stored in the CRM. Disconnecting stops further copies. Existing copied messages remain on the record.

The reviewer confirms:

- A message to a known Contact appears on that Contact.
- A message to an unknown address does not create a Contact and does not appear in search.
- Disconnecting stops new copies.

### S6.3 SMS wallet

Serves acceptance 7.

jojoCRM sends through its own Hubtel account. The workspace submits a sender ID of at most 11 characters. Until Hubtel approves it, SMS does not send. Recipients see that sender ID. The Owner tops up a prepaid GHS wallet by card or mobile money through Paystack. The wallet is separate from the seat plan, including during the later trial. The rate per segment is configuration. A Lead or Contact receives campaign SMS only when SMS consent is on. The message includes opt-out instructions. A provider opt-out turns consent off and records an `AuditLog` entry (previous value `True`, new value `False`, and provider opt-out actor/source). A send the wallet cannot cover does not go out and does not leave a partial debit the reviewer cannot see.

The reviewer confirms:

- An unapproved sender ID cannot send.
- A consented Contact is charged against the wallet at the configured rate, and the balance drops by that amount.
- A Contact with consent off is skipped.
- An opt-out turns consent off and writes an audit entry.
- A balance below the next send blocks the send.

### S6.4 Campaign send

Serves acceptance 7.

The campaign saved in S4.2 can now be sent. Email uses the sender's connected mailbox. SMS uses S6.3. A phone-call campaign creates one call Activity per member, assigned to the campaign owner, and does not send a message.

The reviewer confirms:

- An email campaign logs an Activity for each member who is sent mail.
- An SMS campaign uses the consent and wallet rules.
- A call campaign creates call activities and no SMS or email.

### S6.5 Automations

Serves acceptance 9.

A role with the automations switch can write a rule. Triggers are record created, record updated, field changed, a date-field offset, and a daily schedule. Conditions compare fields. Branches are if/else. Actions are create record, update record, send email, in-app notification, and webhook. Webhook actions enforce the same outbound network safety checks as S5.2 scripts: private, loopback, and link-local IP addresses are refused, and HTTP timeouts and response sizes are capped. One branch may run one script under the S5.2 rules. There is no loop and no custom code step. A person who lacks the switch cannot edit the rule. In-app notifications produced by an automation action appear in a topbar notification center with an unread count, mark-as-read, and dismiss controls. Each automation rule stores and displays an execution history (trigger time, matched condition branch, action outcome, webhook or script errors, and any stored agent refusal from S7.3).

The reviewer confirms:

- A field change that meets a condition sends email, and the other branch does not.
- The script action runs once on that branch, and the automation's execution history records the run and branch outcome.
- A webhook action targeting a private, loopback, or link-local address is refused and logged in execution history.
- A loop or a code step cannot be saved.
- An automation firing an in-app notification displays the unread item in the topbar notification center and allows marking it read or dismissing it.

## Sprint 7 — AI

Unlocks acceptance 11 and 12.

Prerequisite: model-provider account.

Prompts include only records the acting user, or the automation's role, is allowed to see. The provider is the one the privacy notice will name in S8.3.

### S7.1 On-demand assists

Serves acceptance 11.

The reviewer can start each of these when the workspace includes the object it needs. An assist for a missing object is hidden. Within the caller's permissions, the assists are:

- Summarize an Account, Contact, Deal, or Ticket.
- Draft a follow-up email or note.
- Suggest the next step on a Deal.
- Draft a Ticket reply.
- Ask a plain-language question over this workspace's data.
- Create or update a record from pasted text.
- Win probability on a Deal.
- Lead score.
- Duplicate suggestions for Accounts and Contacts.
- Ticket priority and sentiment.
- Cancellation risk on a Customer subscription.
- Campaign message draft.
- Contract summary.

A send or a record edit waits for the person to confirm. A hidden field is absent from the result for a role that cannot see it.

The reviewer confirms:

- Each assist returns on a record the caller can open.
- Declining the confirmation leaves the record and the outbox unchanged.
- A field hidden from the caller does not appear in the summary.

### S7.2 Duplicates

Serves acceptance 11.

Inside one workspace, two Accounts with the same email, or the same phone, merge automatically—including Accounts or Contacts created alongside or prior to lead conversions. The same rule applies to two Contacts. The audit entry records both sides. Any other similarity (such as matching company/person names without exact email/phone) stays a suggestion until a person confirms or links it. Merges do not cross workspaces, and they do not merge an Account with a Contact. The unattended agent does not run a second merge of its own.

The reviewer confirms:

- An exact email match collapses to one record and keeps the audit entry.
- A similar name with a different email stays a suggestion.
- Confirming that suggestion merges it. Dismissing it leaves both records.

### S7.3 Unattended agent

Serves acceptance 12.

The agent is an automation action. The role that has the unattended-agent switch sets the instruction, the objects it may change, and whether it may send email. It does not ask a person to confirm. It cannot change billing, roles, scripts, or automations. One agent step runs per automation run. The instruction, the result, and the field changes are stored on the record.

The reviewer confirms:

- An automation runs the agent and the record shows the instruction and the edits.
- A second agent step in the same run does not run.
- An instruction aimed at billing, roles, scripts, or automations is refused and the refusal is stored.

## Sprint 8 — Billing, privacy, and production

Unlocks acceptance 13 and 14. With every earlier acceptance item still passing, this is full release acceptance.

Prerequisite: Paystack plan configuration for seat billing, and Data Protection Commission registration under Act 843.

### S8.1 Seat billing

Serves acceptance 13.

The Owner manages the seat plan. An active seat is a user who can log in. The GHS price and the monthly or yearly interval are configuration. Every feature stays included. There is no free plan. A 60-day trial requires a card authorization at signup. One trial is allowed per email. The first subscription charge is on day 60. A card renews on its own. Paystack does not retry a failed card charge. Mobile money on MTN, Telecel, or AirtelTigo buys a prepaid month or year and does not auto-renew. jojoCRM stores the subscription status and does not store the card number.

The reviewer confirms:

- A second trial on the same email is refused.
- After day 60 the subscription status shows the card charge, or the failure if the charge fails.
- A mobile-money prepay extends the paid period once and does not renew when that period ends.
- Invited users who can log in count as seats. An unaccepted invite does not.

### S8.2 Unpaid workspace

Serves acceptance 13.

When a card charge fails, or a prepaid period ends without a new payment, the workspace is unpaid. People can still sign in, open records, and export. They cannot create, edit, automate, send, run scripts, or run the agent. A successful payment lifts that limit.

The reviewer confirms:

- An unpaid workspace still opens and still exports.
- A create, an edit, a send, an automation, a script, and the agent are refused while it is unpaid.
- A successful payment allows an edit again.

### S8.3 Privacy and deletion

Serves acceptance 14.

Signup shows a privacy notice and processing terms. The notice names the hosting country and the mail, SMS, payment, and model providers. For CRM records the tenant is the controller and jojoCRM is the processor. A workspace export covers the tenant's data. Deleting the workspace removes that data. Data Protection Commission registration is the Product owner's prerequisite. This story shows the notice, the terms, the export, and the delete.

The reviewer confirms:

- The notice names the country and each provider actually in use.
- Export produces the workspace's records.
- After delete, that workspace cannot be opened and its records are gone.

### S8.4 Production hardening

Serves the release as a whole.

The API and the web app are fit to run the acceptance list on the production host. Secrets stay in configuration. Card numbers are not in the application database. Production caching (`S2.7` `CACHES` backend, HTTP cache headers, and tenant-isolated invalidation) is verified under production settings. A carried-forward story from an earlier sprint is closed here if it was still open, and the fourteen acceptance items are walked through once on that host.

The reviewer confirms:

- The fourteen PRD acceptance items pass on the production workspace.
- The exclusions in the PRD are still absent.
- A card number cannot be found in the application database.
- Cached responses remain strictly isolated per workspace and invalidate cleanly on writes.
