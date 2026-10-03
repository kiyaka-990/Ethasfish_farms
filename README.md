# 🐟 Ethasfish Farms — v3

Premium Nile Tilapia from Lake Victoria — modern e-commerce platform, an agentic admin/CRM portal, and an autonomous AI sales agent. M-Pesa payments, automatic SMS/WhatsApp receipts, hatchery & consultancy services.

## ✨ What's new in v3

- **Postgres on Neon** (via Vercel Marketplace) replaces SQLite — real concurrent writes, ready for production traffic
- **Clerk authentication** replaces the old custom JWT admin login — secure sign-in for both staff (admin / sales manager roles) and customers, with MFA support out of the box
- **Autonomous AI sales agent** ("Fin") — real LLM tool-calling via the Vercel AI Gateway: reads live prices/stock/FAQs, checks order status, and captures sales leads, instead of a hardcoded script. Falls back to the original deterministic rule-based bot if the model is ever unreachable
- **Admin CMS** — `/admin/content` lets staff edit the homepage hero carousel (copy, links, images **and video**) without touching code; `/admin/media` is a drag-and-drop media library backed by Vercel Blob
- **Full product CRUD** — create/edit/delete products and sizes, with image uploads, from `/admin/products`
- **Staff management** (`/admin/staff`, admin-only) — invite teammates by email with a role; they get portal access the moment they sign in with that address
- **Secure activity log** (`/admin/activity`) — every staff action and every AI agent tool-call is written to an append-only audit trail and shown live (polling today; WebSocket/SSE push is the next step — see Roadmap)
- **Customer accounts** (`/account`) — order history for signed-in customers, separate from the staff portal
- **Modernized UI** — redesigned navbar with a built-in light/dark toggle, a top scroll-progress bar, a cursor-following ambient glow effect, lazy-loaded images via `next/image`, and a hero carousel that supports video backgrounds alongside images
- **Next.js 16 + React 19** — current App Router (`proxy.ts`), Turbopack builds

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Link to your Vercel project (provisions Postgres/Clerk/Blob env vars)
vercel link
vercel env pull .env.local

# Push the schema to Postgres + seed sample data
npm run db:push
npm run db:seed

# Start dev server
npm run dev
```

Open http://localhost:3000

**Claiming the admin seat:** `npm run db:seed` pre-provisions an admin slot for the email in `ADMIN_EMAIL` (`.env.local`). Sign in at `/sign-in` with that exact email once Clerk is connected (see below) to claim full `/admin` access.

## 🔌 Required integrations (provisioned via Vercel Marketplace)

| Integration | Purpose | Status |
|---|---|---|
| **Neon Postgres** | Primary database | ✅ Provisioned — `DATABASE_URL` / `DATABASE_URL_UNPOOLED` |
| **Vercel Blob** | Media library storage (`/admin/media`) | ✅ Provisioned — `BLOB_STORE_ID` |
| **Vercel AI Gateway** | Powers the autonomous sales agent | ✅ Working via OIDC (`VERCEL_OIDC_TOKEN`) — premium models (Claude/GPT) need AI Gateway credits added in the dashboard; the agent auto-falls-back to a free-tier model otherwise |
| **Clerk** | Staff + customer authentication | ⏳ **Action required** — accept the Marketplace terms, then run `vercel integration add clerk --non-interactive --no-claim` and `vercel env pull .env.local` |

Until Clerk is connected, `/admin` and `/account` show a "not yet configured" message and the rest of the site works normally.

## 🤖 The AI Sales Agent

`/api/chatbot` first tries **Fin**, the autonomous sales agent (`src/lib/agents/sales-agent.ts`), built with the AI SDK's `ToolLoopAgent` and routed through the Vercel AI Gateway. It has three tools:

- `getCatalog` — live products, variants, prices, stock, and FAQs (never a hardcoded price list)
- `checkOrderStatus` — looks up an order by order number
- `createLead` — records a sales lead (name/contact/notes) into the CRM the moment a customer shows buying interest

Every run is logged to `AgentRun` (model, tokens, tool calls) and every tool call is mirrored into the `AuditLog` that powers `/admin/activity`. If the agent or model is unreachable, `/api/chatbot` transparently falls back to the original deterministic rule+FAQ engine (`src/lib/chatbot.ts`) so the chat widget never goes silent.

## 📨 Receipt System

When a customer pays via M-Pesa, the system automatically dispatches a receipt via three channels (best-effort, in parallel):

### 1. WhatsApp (preferred)
Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` from [Meta Cloud API](https://developers.facebook.com).

### 2. SMS via Africa's Talking
Set `AT_API_KEY`, `AT_USERNAME`, and `AT_SENDER_ID` from [Africa's Talking](https://account.africastalking.com).

### 3. Email via Resend
Set `RESEND_API_KEY` and `FROM_EMAIL` from [Resend](https://resend.com).

If any of these are missing, that channel is silently skipped. Staff can manually re-send a receipt for any order from `/admin/orders` → "Resend Receipt" button.

A web version is also available at `/receipt?order=ORDER_NUMBER` — printable & shareable.

## 🏗 Tech Stack

- **Framework:** Next.js 16 App Router (Turbopack) + React 19
- **Database:** Prisma + Postgres (Neon, via Vercel Marketplace)
- **Styling:** Tailwind CSS v3 with CSS custom properties for theming
- **State:** Zustand for cart
- **Auth:** Clerk (staff roles + customer accounts)
- **AI:** Vercel AI SDK `ToolLoopAgent` + AI Gateway (model-agnostic, automatic failover)
- **Media:** Vercel Blob
- **Payments:** M-Pesa Daraja API (STK push)
- **Receipts:** WhatsApp Cloud API + Africa's Talking SMS + Resend

## 🌐 Pages

| Path | Description |
|------|-------------|
| `/` | Home — hero carousel (admin-editable), products, services preview |
| `/shop` | Product catalog with type filters |
| `/services` | Hatchery, Fish Feeds, Aquaculture Consultancy |
| `/farm` | Farm story, gallery, process timeline, nutrition |
| `/contact` | Quick-action cards + dynamic contact form |
| `/order` | Checkout with M-Pesa STK push |
| `/track` | Track order with detailed delivery process |
| `/receipt?order=...` | Printable receipt |
| `/sign-in`, `/sign-up` | Clerk authentication |
| `/account` | Customer order history |
| `/admin` | Staff dashboard + live activity feed |
| `/admin/orders` | Manage orders, update status, resend receipts |
| `/admin/products` | Full product + variant CRUD, image uploads |
| `/admin/content` | Edit homepage hero carousel (CMS) |
| `/admin/media` | Media library (Vercel Blob) |
| `/admin/faqs` | Manage chatbot FAQ entries |
| `/admin/staff` | Invite/manage staff and roles (admin-only) |
| `/admin/activity` | Live audit log of staff + AI agent actions |

## ♿ Accessibility

- WCAG-friendly contrast (toggle high-contrast mode in the floating menu)
- Keyboard navigation with visible focus rings
- Skip-to-content link
- Reduced-motion support (auto-detected + manual toggle, also disables the cursor-glow effect)
- Adjustable text size (base / large / extra-large)
- Light/dark toggle in the navbar, theme persisted via localStorage

## 🗺 Roadmap (Phase 2)

- Push-based realtime activity feed (WebSocket/SSE) replacing the current polling implementation
- Additional autonomous agents (inventory/reorder agent, order-ops agent, insights/reporting agent)
- Fuller CRM views (lead pipeline board, customer 360)
- Clerk-based MFA enforcement for staff roles

## 🤝 Support

For business questions: hello@ethasfish.co.ke
For technical issues with this codebase: contact your developer.

---

Built with care for **Ethasfish Farms** — Othany East, Seme, Kisumu County, Kenya 🇰🇪
