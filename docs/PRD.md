# jojoCRM Product Requirements

Status: agreed product for the public release.

jojoCRM is an AI-enhanced multi-tenant CRM. A tenant is any business or organization. This document is the whole product. The release date is eight two-week sprints from the start of build. Nothing in this document is deferred to a later product.

The backend is the existing Django 6.1.2 project on PostgreSQL. It exposes a JSON API. The frontend is a separate responsive web application in this repository. Native iOS and Android apps are out of the product.

## Problem and user

A business needs one workspace whose starting tables match the kind of work it does. During creation the tenant picks one of 20 business types. jojoCRM then creates a shared core plus that type's pack. The pack is the working set for that business, so a typical tenant can run the business without creating a table. Custom tables remain for something the pack does not cover.

The daily user is a person invited into a workspace. The buyer is the workspace Owner, who pays for seats and for SMS. Signup is self-serve. A stranger with a connection clearly located in Ghana can create a workspace and run the full product on real data.

## Scope

The release includes:

- Workspaces, roles, audit history, and Ghana connection checks at signup
- The starter objects and workflows in this document
- Custom tables, fields, scripts, automations, layouts, and theme tokens
- Email, SMS campaigns, and AI assists, including one unattended agent
- Seat billing through Paystack and a separate SMS wallet through Hubtel
- Privacy terms, export, and workspace deletion

The release excludes the items in [Out of the product](#out-of-the-product).

## Ghana registration

Signup calls an IP geolocation API. The API returns the country of the connection. It does not return citizenship.

Registration proceeds only when the result is clearly Ghana (`GH`). A failed lookup, an unknown country, or any other country is refused. People invited into an existing workspace are not checked. After a workspace exists, login works from any country. The product describes this as a connection-location check.

The interface is English. Each user has a timezone. All money is Ghana cedis (GHS).

Records inside a workspace may use phone numbers and addresses outside Ghana. SMS still follows the Hubtel and consent rules below.

## Access and roles

A person has one account, identified by a verified email address. They can sign in with:

- Email and password, including password reset
- Google
- Microsoft
- A passkey registered on that account

A passkey is another way to sign in. It is not a required second factor. Connecting a Google or Microsoft mailbox is a separate consent from signing in with that provider. A user can view and unlink a connected Google or Microsoft sign-in identity, rename or remove a passkey, set or change their password while signed in, and update their timezone in Settings.

An account belongs to one workspace. A workspace has many users. The workspace is addressed by a slug on a single app domain. Additional users join by email invite. An already signed-in verified account visiting the root or sign-in routes resolves into its workspace (`/{slug}`).

There is one permanent Owner. The Owner cannot be removed. The Owner or a role with the users-and-roles switch can choose a non-Owner role when sending an invite, change an existing non-Owner member's role, and deactivate or reactivate non-Owner members; deactivating a member immediately ends their active sessions and stops them from logging in or counting as an active seat. Only the Owner manages the seat plan and the SMS wallet.

Other roles are cloned from a default Staff role. For each object, a role grants create, read, update, and delete. For each field, a role sets hidden, read-only, or editable. A role may also grant these switches:

- Import
- Export
- Automations
- Scripts
- Users and roles
- Theme and layouts
- Unattended agent

A record is visible to its owner, to one role, or to the whole workspace.

Every record change stores the actor, the time, the previous value, the new value, and whether the actor was a person, a script, an automation, or the agent.

## Starter objects

A new workspace starts from one catalog. The business type turns objects on. It does not create a separate database. Every type receives the core. The chosen pack adds 12 more objects. Every category therefore has 17 tables, which meets the floor of 10.

The Owner can later turn on more packs from the same catalog. Tables that already hold records stay. Empty tables from a pack can be turned off. The business-type label can be renamed. The first choice only decides what exists on day one.

A pack may label Contact on screen as Patient, Student or Guardian, or Donor or Member. The stored object is still Contact. Deal, stock, campaigns, subscriptions, and the AI assists tied to an object appear only when that object is on. Roles, scripts, automations, layouts, theme, billing, and SMS stay on for every type.

### Core

Every workspace has:

| Object | Role |
| --- | --- |
| Account | A company or organization the tenant works with |
| Contact | A person. Healthcare labels this Patient. Education labels this Student or Guardian. Nonprofit, faith, and membership labels this Donor or Member |
| Activity | A note, task, call, meeting, or logged email |
| File | An attachment on any record |
| Tag | A label on a record |

### Catalog

Packs add from this catalog:

| Object | Role |
| --- | --- |
| Lead | A person or company not yet converted |
| Deal | An opportunity on a pipeline |
| Product | Something the tenant sells |
| Line item | A Product quantity and price on a parent record |
| Invoice | A commercial bill to the tenant's customer |
| Payment | Money recorded against an Invoice |
| Inventory | Quantity of a Product in a warehouse |
| Campaign | One outreach by email, SMS, or phone |
| Contract | An agreement with an Account |
| Ticket | A support case |
| Customer subscription | A recurring sale to the tenant's customer |
| Job | A piece of work with status, assignee, due date, and a linked Account or Contact |
| Appointment | A scheduled time with status, assignee, and a linked Contact |
| Supplier | A vendor, with what they supply |
| Purchase | Goods ordered from a Supplier |
| Shipment | A movement of goods, with status, origin, destination, and a linked invoice or purchase |
| Vehicle | A vehicle the business tracks, with identity, status, and a linked Account |
| Property | A site or unit, with address, status, and a linked Account |
| Booking | A reserved stay or resource, with dates, status, and a linked Contact |
| Program | A course or program the tenant offers |
| Enrollment | A Contact joined to a Program, with status and start date |
| Visit | A healthcare meeting record: date, reason, notes, and follow-up. It is not a chart, lab, or prescription |
| Policy | A finance product record: product, premium, status, and renewal. It is not a bank account or a KYC file |
| Membership | A Contact on a plan, with status, start, and end |
| Asset | An item the business owns or tracks, with status and location |

### Business types and packs

Each list is the 12 objects added to the core. The type names are the signup choices.

- **Retail and trading.** Lead, Deal, Product, Line item, Invoice, Payment, Inventory, Campaign, Supplier, Purchase, Shipment, Job.
- **Wholesale and distribution.** Lead, Deal, Product, Line item, Invoice, Payment, Inventory, Contract, Supplier, Purchase, Shipment, Job.
- **Agriculture and agribusiness.** Lead, Deal, Product, Line item, Invoice, Payment, Inventory, Supplier, Purchase, Shipment, Contract, Job.
- **Food and beverage.** Product, Line item, Invoice, Payment, Inventory, Campaign, Supplier, Purchase, Booking, Appointment, Job, Membership.
- **Financial services.** Lead, Deal, Product, Contract, Ticket, Customer subscription, Campaign, Policy, Appointment, Job, Invoice, Payment.
- **Education.** Lead, Deal, Invoice, Payment, Campaign, Ticket, Program, Enrollment, Appointment, Contract, Job, Membership.
- **Healthcare and wellness.** Lead, Ticket, Product, Invoice, Payment, Campaign, Appointment, Visit, Contract, Inventory, Customer subscription, Job.
- **Construction and real estate.** Lead, Deal, Invoice, Payment, Contract, Inventory, Job, Property, Appointment, Supplier, Purchase, Shipment.
- **Transport, logistics, and storage.** Lead, Deal, Ticket, Invoice, Payment, Contract, Vehicle, Shipment, Job, Appointment, Asset, Supplier.
- **ICT and digital services.** Lead, Deal, Ticket, Customer subscription, Invoice, Payment, Contract, Campaign, Job, Asset, Appointment, Product.
- **Professional services.** Lead, Deal, Ticket, Invoice, Payment, Contract, Campaign, Job, Appointment, Product, Line item, Membership.
- **Hospitality and tourism.** Lead, Deal, Invoice, Payment, Campaign, Ticket, Booking, Appointment, Membership, Inventory, Product, Job.
- **Manufacturing and light industry.** Deal, Product, Line item, Invoice, Payment, Inventory, Contract, Supplier, Purchase, Job, Asset, Shipment.
- **Telecom and airtime services.** Lead, Deal, Product, Customer subscription, Ticket, Invoice, Payment, Campaign, Asset, Job, Contract, Appointment.
- **Nonprofit, faith, and membership.** Lead, Campaign, Invoice, Payment, Ticket, Membership, Appointment, Job, Contract, Program, Enrollment, Asset.
- **Beauty and personal care.** Lead, Product, Invoice, Payment, Campaign, Appointment, Inventory, Membership, Ticket, Job, Line item, Customer subscription.
- **Automotive.** Lead, Deal, Product, Line item, Invoice, Payment, Inventory, Ticket, Vehicle, Job, Appointment, Supplier.
- **Media and creative agencies.** Lead, Deal, Campaign, Invoice, Payment, Contract, Ticket, Job, Appointment, Asset, Product, Line item.
- **Energy and fuel.** Product, Inventory, Invoice, Payment, Contract, Supplier, Purchase, Asset, Vehicle, Shipment, Job, Ticket.
- **General services.** Lead, Deal, Job, Appointment, Ticket, Product, Line item, Invoice, Payment, Contract, Campaign, Supplier.

A typical tenant of a type can sell, deliver, bill, or support on that pack alone. Custom tables and fields remain for a record the pack does not include.

### Lead conversion

Where the pack includes Lead and Deal, converting a lead creates an Account, a Contact, and a Deal. The lead stays on record and is marked converted.

### Deals

Where the pack includes Deal, a Deal belongs to a pipeline of ordered stages. The tenant can edit pipelines and stages. A new workspace with Deal starts with one pipeline: New, Qualified, Proposal, Won, Lost. Deals are also shown as a kanban on stage.

### Tickets

Where the pack includes Ticket, statuses start as New, Open, Pending, Resolved, and Closed. The tenant can edit that list.

### Appointments and visits

Appointment is its own table. Activity remains the note, task, call, or meeting log. A Visit records date, reason, notes, and follow-up for a Patient. It does not store a chart, a lab, or a prescription.

### Jobs, purchases, and the rest of the catalog

A Job has a status, an assignee, a due date, and a linked Account or Contact. A Purchase orders goods from a Supplier and can be received into Inventory when the pack includes Inventory. A Shipment records status, origin, destination, and a linked invoice or purchase. A Policy records a finance product, a premium, a status, and a renewal. It is not a bank account or a KYC file. A Booking holds dates and a linked Contact. An Enrollment joins a Contact to a Program.

### Invoices and payments

Where the pack includes Invoice, statuses start as Draft, Issued, Partially paid, Paid, and Void. The tenant can edit that list.

An invoice is a commercial document with an issue date and a due date so unpaid and overdue balances and date-offset automations can be tracked. The tenant can view it and download it as a PDF showing the number, customer, issue date, due date, lines, totals, and status. jojoCRM does not file invoices with the Ghana Revenue Authority.

A Payment records an amount, a date, a method, and a status against an Invoice. The app does not take a card payment from the tenant's customer. Card payments exist only for the workspace's own jojoCRM bill and SMS wallet.

A Product or Account referenced by issued invoices, contracts, or active customer subscriptions cannot be deleted while those commercial links exist.

### Line items

A line item points at a Product. It belongs to a Deal, an Invoice, a Contract, or a Customer subscription.

### Customer subscriptions

A Customer subscription is the tenant billing their own customer. It is not the jojoCRM seat plan. It links an Account and a Product, and has an interval of week, month, or year, a GHS amount, and a status.

Each interval creates a Draft invoice linked to the subscription. Stock does not move until a person issues that invoice.

### Contracts

A Contract links an Account and a Contact. It has a status, a start date, an end date, a GHS value, and a renewal date.

### Files, tags, and relations

A File attaches to any record. Tags are a built-in label, not a relation field.

On a tenant-created table, a relation field is many-to-one: many records may point at one record. A many-to-many link is a table the tenant creates between the two objects. Campaign membership is its own list, not a many-to-many field type.

## Stock

Where the pack includes Inventory, a workspace has multiple warehouses. One warehouse is the default. Each Product has a quantity on hand and a reorder level in each warehouse.

An invoice line can choose a warehouse. Quantity drops when the invoice is issued and returns when the invoice is voided. Payment status does not move stock.

A transfer record moves quantity from one warehouse to another. Both sides of the transfer are written to the audit history.

## Campaigns, mail, and SMS

Where the pack includes Campaign, a campaign has one channel: email, SMS, or phone-call tasks. A phone-call campaign creates call activities for the campaign owner. SMS to a Lead requires the Lead object. Contacts can receive SMS in every workspace.

### Email

Each user chooses one mailbox mode:

- Send from a record through a connected Google or Microsoft account, and log an Activity.
- Two-way sync with Google or Microsoft.

Two-way sync copies a message into the CRM only when it matches a Contact's email address. Mail that matches no Contact stays in the mailbox and is not imported. Disconnecting the mailbox stops further sync.

### SMS

jojoCRM integrates Hubtel's SMS API on jojoCRM's own Hubtel account. Each workspace submits its own sender ID. Hubtel must approve that ID before a campaign can send. A sender ID is at most 11 characters. Recipients see the tenant's sender ID.

Each workspace has a prepaid GHS SMS wallet. The Owner tops it up by card or mobile money through Paystack. The wallet is separate from the seat subscription, including during the trial. The GHS rate per segment is configuration, not a value hardcoded in the product. A send that the wallet cannot cover does not go out.

SMS goes only to Leads and Contacts whose SMS consent is on. The message includes opt-out instructions. When the provider reports an opt-out, consent turns off.

## Customization

### Tables and fields

A tenant can create tables and fields. Field types are text, long text, number, date, single-select, checkbox, many-to-one relation, and script.

### Scripts

A script computes and may write values.

- It runs for at most one second.
- It can read and write records in the same workspace only.
- It has no filesystem and cannot call another script.
- An automation runs at most one script per branch.
- It cannot change billing, roles, or other scripts.
- It may call HTTPS URLs on an allowlist the Owner maintains.
- Private, loopback, and link-local addresses are refused.
- HTTP time and response size are capped.

The standard functions available inside a script are arithmetic, text, IF, empty checks, date math, lookup along a relation, and SUM, COUNT, MIN, and MAX from child records.

### Automations

An automation is a rule. The role that has the automations switch may edit it.

- Triggers: record created, record updated, field changed, a date-field offset, or a daily schedule.
- Conditions compare fields.
- Branches are if / else.
- Actions: create record, update record, send email, in-app notification, or webhook.

Automations have no loops and no custom code steps. A script action is the one script call allowed per branch, under the script rules above. In-app notifications created by automations appear in a topbar notification center where users can read and dismiss them. Each automation rule records an execution and refusal history showing trigger timestamps, matched branch, action outcomes, webhook or script errors, and stored AI agent refusals.

### Layouts

The layout builder lets a tenant rearrange a fixed set of surfaces:

- A home dashboard of widgets. Widget types are number, chart, and list. Each widget is bound to an object and filters.
- Record pages as ordered sections and fields, with a per-record audit change history section inside the record inspector drawer.
- Lists with chosen columns, filters, sort, saved views, and CSV import column-mapping preview with structured row-level error reporting.
- A deal kanban on pipeline stage, where the pack includes Deal.
- Global search across the objects the workspace has.

Navigating between workspace panes and subtabs preserves the active pane and subtab in the URL or session state so a browser refresh or history navigation returns to that view. Record lists, global search results, and the audit history drawer paginate results so large workspaces remain responsive, and the workspace audit drawer filters by actor kind, object type, action, and search query.

There is no free-form canvas and no custom HTML.

### Theme

Theme tokens cover preset themes, a logo, primary, accent, and surface colors, light or dark, and a short font list. The shell, dashboard, and record pages use those tokens. Tenants do not paste CSS.

## AI

On-demand assists honor the current user's object, field, and sharing rights. An assist tied to an object appears only when that object is on. A person confirms any on-demand assist that sends a message or edits a record, except the exact-match merge below.

The on-demand assists are:

- Summarize an Account, Contact, Deal, or Ticket
- Draft a follow-up email or note from a record
- Suggest the next step on a Deal
- Draft a Ticket reply
- Answer a plain-language question over this workspace's data
- Create or update a record from pasted text
- Win probability on a Deal
- Lead score
- Duplicate suggestions for Accounts and Contacts
- Ticket priority and sentiment
- Cancellation risk on a Customer subscription
- Campaign message draft
- Contract summary

Exact email or exact phone on two Accounts, or on two Contacts, in the same workspace merges automatically. The audit entry records both sides. Every other similarity stays a suggestion until a person confirms it. Merges never cross workspaces. The agent does not merge on its own beyond this exact-match rule.

The unattended agent runs only as an automation action, and only for a role that has the unattended-agent switch. That role sets the instruction, which objects the agent may change, and whether it may send email. The agent does not ask a person to confirm. It cannot change billing, roles, scripts, or automations. One agent step runs per automation run. The instruction, the result, and the field changes are stored on the record.

AI features call an external model provider. The privacy notice names that provider. A prompt includes only records the acting user, or the automation's role, is allowed to see.

## Billing

jojoCRM charges the workspace through Paystack, in GHS. The price is per active seat. An active seat is a user who can log in. The price and the monthly or yearly interval live in configuration, not in code. Every feature is included on every paid workspace. There is no free plan and no feature-gated plan.

A 60-day trial requires a card authorization at signup. One trial is allowed per email address. The first subscription charge is on day 60. A card renews on its own. Mobile money on MTN, Telecel, or AirtelTigo buys a prepaid month or year and does not auto-renew, because that channel cannot charge a recurring subscription. Paystack does not retry a failed card charge.

When a charge fails, or a prepaid period ends without a new payment, the workspace is unpaid. An unpaid workspace can sign in, view records, and export. It cannot create, edit, automate, send, run scripts, or run the agent.

Card numbers stay at Paystack. jojoCRM stores the subscription status only.

The SMS wallet is a separate Paystack top-up, by card or mobile money, and is not included in the seat price.

## Privacy

The application database and files may be hosted outside Ghana. The privacy notice names that country. It also names the mail, SMS, payment, and model providers.

jojoCRM registers with the Ghana Data Protection Commission under the Data Protection Act, 2012 (Act 843). For CRM records, the tenant is the data controller and jojoCRM is the data processor. Signup shows a privacy notice and processing terms. A workspace can export its data and can delete the workspace.

## Clients

The product ships one responsive web application. It does not ship native iOS or Android apps.

## Acceptance

The release is met when a person whose connection is clearly in Ghana can do all of the following on a production workspace:

1. Create a workspace and choose one of the 20 business types, which creates the core and that pack. A connection that is not clearly in Ghana cannot create one. An invited user can join without a new location check and can later sign in from outside Ghana.
2. Sign in with email and password, Google, Microsoft, and a passkey on the same account, and connect a mailbox without that connection counting as sign-in.
3. Invite a user, clone a role from Staff, hide a field from that role, and share a record with the owner only, with one role, or with the whole workspace.
4. On a General services workspace, convert a lead into an Account, a Contact, and a Deal, move the Deal across editable stages on a kanban, create a Job, and see the stage change in the audit history.
5. On a Retail and trading workspace, issue an invoice with line items and a chosen warehouse, download the PDF, record a payment, and see stock drop on issue and return on void. Transfer stock between warehouses.
6. On a Healthcare and wellness workspace, see Contact labeled Patient, book an Appointment, record a Visit with reason, notes, and follow-up, and create a Customer subscription whose next interval is a Draft invoice that does not move stock until it is issued.
7. On a Retail and trading workspace, run an email campaign from a connected mailbox, an SMS campaign from an approved sender ID against the prepaid wallet, and a call campaign that creates call activities. SMS to a Contact without consent does not send. A wallet that cannot cover the send does not send.
8. Choose two-way mail sync and see only messages that match a Contact copied onto the record.
9. Add a custom table and a many-to-one relation, run a script that writes a field and is refused for a private-network URL, and run an if/else automation that sends email.
10. Apply a logo and color tokens, rearrange dashboard widgets and record sections, and save a list view.
11. Run each on-demand AI assist within the caller's permissions. Confirm before an on-demand assist sends or edits. See an exact email or phone duplicate merge on its own, and see a fuzzy duplicate wait for a person.
12. Run the unattended agent from an automation, see its instruction and edits on the record, and see it refused for billing, roles, scripts, and automations.
13. Start a 60-day card trial, pay per seat by card or by mobile-money prepay, top up the SMS wallet, and land in the read-only unpaid state when payment lapses.
14. Export the workspace and delete it. Read a privacy notice that names the hosting country and the processors.

## Eight sprints

Each sprint is two weeks. The sequence is the build order. Sprint 8 is the public release of the full product in this document.

1. **Tenancy and auth.** Workspaces, the Ghana connection check, email and password, Google, Microsoft, passkey, invites, Owner and Staff, and the audit record.
2. **Core and the catalog.** The business-type choice, the core, the catalog, General services and Healthcare packs, lead conversion, pipelines, kanban, Jobs, Appointments, Visits, roles, and search on the objects the workspace has.
3. **Stock and invoicing.** Product, line item, Invoice, Payment, PDF, Contract, Customer subscription, warehouses, transfers, stock movement, and the packs that use them, including Retail and trading.
4. **Campaigns and files.** Ticket, Campaign, files, tags, CSV import and export, saved views, and list layouts, on workspaces whose packs include those objects.
5. **Custom platform and theme.** Custom tables and fields, many-to-one relations, script sandbox, layout builder, and theme tokens.
6. **Mail, SMS, and automations.** Mailbox send and two-way sync, Hubtel sender ID and wallet, campaign send on all three channels, and if/else automations.
7. **AI.** Every on-demand assist, exact-match auto-merge, duplicate suggestions, and the unattended agent as an automation action.
8. **Billing, privacy, and production.** Paystack seat plans, the 60-day trial, mobile-money prepay, the unpaid read-only state, the privacy notice and processing terms, DPC registration tasks, workspace export and delete, and production hardening of the API and the web app.

## Schedule risk

The product in this document and the eight-sprint date are both requirements. The sprint list is an order of work, not a set of optional releases. If a sprint slips, the slipped work remains inside this product. The release is the full acceptance list above, on the date of sprint 8.

## Out of the product

- A Quote object
- GRA electronic invoicing
- Card collection from the tenant's customers
- Custom CSS, custom HTML, and a free-form page canvas
- Native mobile apps
- A free plan or plans that turn features on and off
- Ghana Card or nationality checks
- Geoblocking of logins
- A requirement that servers sit in Ghana
- Fuzzy automatic merges
- A free-roaming chat agent that acts without an automation
- Many-to-many as a field type
- Loops or custom code steps inside automations
- One shared SMS sender name for every tenant
- Tenant-supplied SMS provider keys
- Importing mailbox messages that match no Contact
