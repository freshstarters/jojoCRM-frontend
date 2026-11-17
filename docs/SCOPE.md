# jojoCRM Project Scope

Status: delivery boundary for the product in [PRD.md](PRD.md).

This document says what the build delivers, what it leaves out, and when the project is finished. Product behavior is defined in the PRD. Stories and their reviewer checks are listed in [BACKLOG.md](BACKLOG.md). The delivery agreement is [SOW.md](SOW.md).

## Objective

Deliver the jojoCRM product described in the PRD. A tenant is any business. During workspace creation they choose one of 20 business types and receive the shared core plus that type's pack, 17 tables in all. A person whose connection is clearly in Ghana can then run that business on those tables, and can later turn on more packs.

The build is the existing Django project as a JSON API, on PostgreSQL, and a separate responsive web app in this repository. The interface is English. Each user has a timezone. Money is GHS.

The schedule is eight two-week sprints. Sprint 8 is the public release of the full product. The sprint list is the order of work. It is not a set of optional releases. A story that misses its sprint is carried forward. It is not dropped.

## In scope

Each line is one milestone. The stories under it are in [BACKLOG.md](BACKLOG.md).

1. **Tenancy and auth.** Workspaces on one app domain, the Ghana connection check, email and password, Google, Microsoft, passkey, invites, the Owner and Staff roles, and the audit record.
2. **Core and the catalog.** The business-type choice, the five core tables, the catalog, the General services and Healthcare packs, lead conversion, pipelines, Jobs, Appointments, Visits, field permissions, sharing, search, response/workspace caching, and non-production QA seed tooling.
3. **Stock and invoicing.** Product, line items, commercial invoice PDF, payments, contracts, customer subscriptions, warehouses, and transfers, including the Retail and trading pack.
4. **Campaigns and files.** Tickets, campaign records, files, tags, CSV import and export, saved list views, and cross-record activities/tasks view, on workspaces whose packs include those objects. Sending campaigns waits for milestone 6.
5. **Custom platform and theme.** Tenant-created tables and fields, the script sandbox, dashboard and record layouts, and theme tokens.
6. **Mail, SMS, and automations.** Mailbox send and two-way sync, Hubtel campaigns, the prepaid SMS wallet, call campaigns, and if/else automations.
7. **AI.** Every on-demand assist, exact-match merge, duplicate suggestions, and the unattended agent.
8. **Billing, privacy, and production.** Paystack seat billing, the 60-day trial, the unpaid workspace, the privacy notice, workspace export and delete, and production hardening.

Integration with a prerequisite provider is in scope in the sprint that first needs it. Opening the provider account, or filing an approval, is not part of the build.

## Out of scope

The product exclusions are the list under "Out of the product" in [PRD.md](PRD.md). This project also excludes:

- A build fee or an outside commissioning client.
- Rewriting the SaaS prices. Those remain in the Billing section of the PRD.
- Splitting stories into data models, endpoints, and screens.
- Opening tickets in an issue tracker.
- Opening merchant accounts, OAuth app approvals, Hubtel sender-ID approvals, or the Data Protection Commission registration. Those are prerequisites below.

## Prerequisites

A prerequisite is an account or approval the build cannot create. The Product owner supplies it. The named sprint cannot be acceptance-tested for the dependent stories until it exists. Delivery still builds the integration in that sprint.

| Needed by | Prerequisite | What the sprint can then prove |
| --- | --- | --- |
| Sprint 1 | Hosting region chosen | The API and web app run somewhere the later privacy notice can name |
| Sprint 1 | Transactional email provider | Verification, password reset, and invite messages arrive |
| Sprint 1 | IP geolocation provider | Signup is allowed only when the lookup is clearly `GH`, and every other result is refused |
| Sprint 1 | Google and Microsoft OAuth apps for sign-in | Those two sign-in methods attach to the verified email |
| Sprint 6 | Mailbox scopes on those OAuth apps | A user can send from a record, and can turn on two-way sync, without that consent becoming their login |
| Sprint 6 | Hubtel business account, and a path to approve an 11-character sender ID | A campaign shows the tenant's sender ID and can be refused before approval |
| Sprint 6 | Paystack merchant account | The Owner can top up the SMS wallet by card or mobile money |
| Sprint 7 | Model-provider account | An assist runs on records the caller is allowed to see, and the privacy notice can name the provider |
| Sprint 8 | Paystack plan configuration for seat billing | A card trial, a renewal, and a mobile-money prepay all change the workspace subscription status |
| Sprint 8 | Data Protection Commission registration under Act 843 | The launch can claim the registration the PRD requires |

## Milestones

A milestone is met when a reviewer can complete its checklist on the web app against the API. Acceptance item numbers refer to the numbered list under "Acceptance" in [PRD.md](PRD.md). The story-level checks are in [BACKLOG.md](BACKLOG.md).

### 1. Tenancy and auth

The workspace exists before any CRM record does. Signup looks up the connection. The result must be clearly Ghana. A failed lookup, an unknown country, or any other country stops registration. The check is described as a connection-location check. It does not claim to know citizenship.

The reviewer can:

- Create a workspace on a slug of the single app domain, and see a second attempt from a non-GH or unknown connection refused.
- Verify an email, reset a password, and sign in with that password, with Google, with Microsoft, and with a passkey, all on the same account. The passkey is a way in, not a second factor that blocks the other ways.
- Invite a second user. That person is not location-checked, belongs to this one workspace, and can sign in from outside Ghana.
- Resolve an active signed-in verified session directly into its workspace (`/{slug}`) when visiting `/` or sign-in routes, update password and timezone from Settings, and unlink a Google or Microsoft sign-in identity.
- See one Owner who cannot be removed, a default Staff role, deactivate or reactivate a non-Owner member (ending their active sessions and blocking sign-in), and read an audit entry that records the actor, the time, the previous value, the new value, and the kind of actor.

Unlocks acceptance 1 and the sign-in half of acceptance 2. Mailbox connection is still ahead, in milestone 6.

Depends on the sprint 1 prerequisites.

### 2. Core and the catalog

Creating a workspace includes choosing a business type. That creates the core (Account, Contact, Activity, File, Tag) and the 12 tables of that pack. A General services workspace has Lead, Deal, Job, Appointment, Ticket, Product, Line item, Invoice, Payment, Contract, Campaign, and Supplier. A Healthcare workspace labels Contact as Patient and includes Appointment and Visit. A pack that does not include Deal does not show a pipeline. The Owner can turn on a second pack. Tables that already hold records stay.

Activity types here are note, task, call, and meeting. Logged email arrives with the mailbox, in milestone 6. A new workspace whose pack includes Deal starts with the pipeline New, Qualified, Proposal, Won, Lost.

The reviewer can:

- Choose General services and see 17 tables, and choose Healthcare and see Contact labeled Patient, with Appointment and Visit present and Deal absent.
- Turn on a second pack and keep the records already stored in the first.
- Create and edit the core and the pack's objects as a role that has those rights, and be blocked when the role does not.
- On General services, convert a lead and keep the lead on record, marked converted, with a new Account, Contact, and Deal. Create a Job with an assignee and a due date.
- Move a deal across stages on a kanban and read that change in the audit history.
- On Healthcare, book an Appointment and record a Visit with reason, notes, and follow-up.
- Clone Staff, assign roles on invites and non-Owner members, set a field to hidden, read-only, or editable, share one record with its owner only, with one role, or with the whole workspace, immediately refresh permissions on open client sessions when roles or rights change, and set an initial password or rename passkeys in Settings.
- Find the workspace's records from global search (and searchable/paginated foreign-key pickers beyond 250 options), and not find an object the pack turned off.
- Preserve the active workspace pane, subtab, and inspected record across page refreshes, shareable links, and browser history navigation, paginate global search results and the audit history drawer, filter the workspace audit log by actor kind, object type, action, and search query, and inspect per-record audit history inside the record inspector drawer.
- Benefit from server/client caching with immediate write invalidation for catalog, workspace summary, and lookup options, and run the non-production QA seed command to populate representative test tenants and charts for manual verification.

Unlocks acceptance 3 and 4.

### 3. Stock and invoicing

Commercial documents and stock are in for packs that include them. The reviewer uses a Retail and trading workspace. An invoice is a PDF the tenant downloads. jojoCRM does not file it with the Ghana Revenue Authority, and it does not charge the tenant's customer by card. A Payment is a record: amount, date, method, and status.

Invoice statuses start as Draft, Issued, Partially paid, Paid, and Void. The tenant can edit that list. Line items point at a Product and can sit on a Deal, an Invoice, a Contract, or a Customer subscription when that parent is on. One warehouse is the default. Each product has a quantity and a reorder level in each warehouse. A Financial services workspace can open a Policy with product, premium, status, and renewal.

The reviewer can:

- Issue a retail invoice with issue and due dates, lines, and a chosen warehouse, download the PDF, and record a payment (refusing payments above the remaining balance, locking line items once issued, and refusing voiding while active payments exist). Stock drops on issue and returns on void of unpaid issued invoices. Marking the invoice paid does not move stock again.
- Transfer quantity between warehouses and see both sides in the audit history.
- Open a contract with its Account, Contact, status, dates, GHS value, and renewal date.
- On Healthcare, create a customer subscription on a weekly, monthly, or yearly interval and see the interval produce a Draft invoice. Stock stays put until a person issues that invoice.
- On Financial services, save a Policy and see that it does not ask for a bank account or a KYC file.
- See deletion of a Product or Account refused while it is referenced by issued invoices, contracts, or active customer subscriptions.

Unlocks acceptance 5 and 6.

### 4. Campaigns and files

Support and the campaign record exist on packs that include them, before any message is sent. The reviewer uses Retail and trading, which includes Campaign, and Healthcare, which includes Ticket. Ticket statuses start as New, Open, Pending, Resolved, and Closed, and the tenant can edit them. A campaign has one channel: email, SMS, or phone-call tasks. Membership of a campaign is its own list.

The reviewer can:

- Work a healthcare ticket through the default statuses.
- Save a retail campaign of each channel, with its leads and contacts, without sending it.
- Attach a file to a record and apply a tag. A tag is a built-in label, not a relation field.
- Import and export rows for objects the pack includes, as CSV, with column-mapping preview and structured row-level error reporting for failed rows.
- Choose columns, filters, and sort, save that list view, preserve deep-linked inspection and paginated picker state, and paginate record list tables while keeping those view settings.
- Filter and view workspace activities (notes, tasks, calls, meetings) across records in a cross-record Activities view.

Completes the saved-view part of acceptance 10. Acceptance 7 stays open until milestone 6 sends the campaign. Full workspace export and delete stay in milestone 8.

### 5. Custom platform and theme

Tenants can add tables when the starter set is not enough. Field types are text, long text, number, date, single-select, checkbox, many-to-one relation, and script. A many-to-many link is a table the tenant creates, not a field type.

The reviewer can:

- Add a table, add those field types, and point a many-to-one relation at another record.
- Run a script that writes a field in the same workspace, using the standard functions, and see a call to a private, loopback, or link-local address refused. The script has no filesystem, cannot call another script, and cannot change billing, roles, or scripts.
- Rearrange dashboard widgets (number, chart, and list, each bound to an object and filters) and the sections and fields on a record page.
- Set a logo, primary, accent, and surface colors, light or dark, and a font from the short list, and see the shell, dashboard, and record pages use those tokens.

Unlocks the custom-table and script parts of acceptance 9, and the rest of acceptance 10. There is no custom CSS, custom HTML, or free-form canvas.

### 6. Mail, SMS, and automations

Messages leave the workspace. Each user chooses send-from-record or two-way sync. Disconnecting the mailbox stops further sync. SMS uses jojoCRM's Hubtel account and the tenant's own approved sender ID of at most 11 characters. The wallet is prepaid GHS, topped up by the Owner through Paystack, and is separate from the seat subscription. The rate per segment is configuration.

The reviewer can:

- Connect Google or Microsoft for mail without that connection counting as sign-in, send from a record, and see an email Activity.
- Turn on two-way sync and see only messages that match a Contact copied onto the record.
- Submit a sender ID, be blocked until Hubtel approves it, send only to Leads and Contacts with SMS consent, include opt-out instructions, turn consent off with an audit log entry when the provider reports an opt-out, and see a send refused when the wallet cannot cover it.
- Run an email campaign, an SMS campaign, and a call campaign. The call campaign creates call activities for the campaign owner.
- Save an automation with a trigger, field conditions, if/else, and an action that creates a record, updates a record, sends email, notifies in the app (readable and dismissible in the topbar notification center), or calls a webhook (enforcing SSRF private/loopback/link-local blocks and timeout/size caps), and inspect its execution and refusal history. One branch may run one script. There is no loop and no custom code step.

Completes acceptance 2, 7, 8, and 9.

Depends on the sprint 6 prerequisites.

### 7. AI

Assists read only what the caller, or the automation's role, is allowed to see. A person confirms an on-demand assist before it sends or edits a record. The exact-match merge is the exception. The agent does not roam in chat. It runs once, inside an automation, for a role that has the unattended-agent switch.

The reviewer can:

- Run each on-demand assist: summary, follow-up draft, deal next step, ticket reply, workspace question, paste-to-record, win probability, lead score, duplicate suggestions, ticket priority and sentiment, subscription cancellation risk, campaign draft, and contract summary.
- See two Accounts, or two Contacts, in the same workspace merge when the email or the phone matches exactly (including records created prior to or alongside lead conversion), with both sides in the audit entry. A fuzzier pair waits. A merge does not cross workspaces.
- Fire the agent from an automation, read the instruction, the result, and the field changes on the record, and see it refused when it would change billing, roles, scripts, or automations.

Unlocks acceptance 11 and 12.

Depends on the model-provider account.

### 8. Billing, privacy, and production

The workspace can take money for itself and can be closed. An active seat is a user who can log in. The GHS price and the monthly or yearly interval live in configuration. Every feature is included. Card numbers stay at Paystack. A failed card renewal is not retried. Mobile money on MTN, Telecel, or AirtelTigo buys a prepaid period and does not renew itself.

The reviewer can:

- Start one 60-day card trial per email, with the card authorized at signup and the first charge on day 60, then pay per seat by card renewal or by mobile-money prepay.
- Let the subscription lapse and still sign in, view, and export, while creates, edits, sends, automations, scripts, and the agent are refused.
- Read a privacy notice and processing terms that name the hosting country and the mail, SMS, payment, and model providers, then export the workspace and delete it.
- Exercise the release on the hardened API and web app—including configured server/HTTP caching and tenant-isolated invalidation—and complete the carried-forward items from earlier milestones.

Unlocks acceptance 13 and 14. Passing this checklist, with every earlier acceptance item still passing, is release acceptance.

Depends on the sprint 8 prerequisites.

## Carry-forward

The calendar does not wait. When a checklist item misses its milestone, the scope records it on the next milestone and the matching story stays open in [BACKLOG.md](BACKLOG.md). Later milestones start on their dates. The project is accepted once, when all fourteen PRD acceptance items pass at the end of sprint 8.

## Change control

The scope is frozen to [PRD.md](PRD.md). A new request is not built until a scope revision records all of the following:

- The request, in enough detail for a reviewer to test it.
- The PRD section it changes.
- The milestones and story identifiers it affects.
- Whether it fits in the remaining milestones or rewrites their dates.

The revision updates this document, [SOW.md](SOW.md), and [BACKLOG.md](BACKLOG.md) together before work on the request starts.

### Scope revisions

- **Discover S2.0–S2.1 revision (`P2.1–P2.9`)**: Added response/workspace caching (`PRD` *Performance and caching*; `S2.7`, `S8.4`), non-production demo QA seed tooling (`PRD` *Problem and user*; `S2.8` + Sprint 3–5 extensions), cross-record Activities view (`PRD` *Starter objects* & *Layouts*; `S4.6`, `S5.3`), inspected-record URL deep-linking and paginated FK pickers (`PRD` *Layouts*; `S2.5`, `S4.5`), live client permission refresh (`PRD` *Access and roles*; `S2.4`), invoice overpayment/edit-lock/void rules (`PRD` *Invoices and payments*; `S3.1`, `S3.2`), webhook SSRF protections and SMS opt-out audit logging (`PRD` *SMS* & *Automations*; `S6.3`, `S6.5`), and lead-conversion duplicate reconciliation (`PRD` *AI*; `S7.2`). Affects Milestones 2, 3, 4, 6, 7, and 8; the eight two-week milestone dates remain unchanged.

## Definition of done

The project is done when a person whose connection is clearly in Ghana can complete all fourteen acceptance items in the PRD on a production workspace, and the exclusions in the PRD remain excluded.
