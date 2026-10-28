# 🐟 Ethasfish Farms — v3

Premium Nile Tilapia from Lake Victoria — modern e-commerce platform, an agentic admin/CRM portal, and an autonomous AI sales agent. M-Pesa payments, automatic SMS/WhatsApp receipts, hatchery & consultancy services.

## ✨ What's new in v3

- **Postgres on Neon** (via Vercel Marketplace) replaces SQLite — real concurrent writes, ready for production traffic
- **Clerk authentication** replaces the old custom JWT admin login — secure sign-in for both staff (admin / sales manager roles) and customers, with MFA support out of the box
- **Autonomous AI sales agent** ("Fin") — real LLM tool-calling via the Vercel AI Gateway: reads live prices/stock/FAQs, checks order status, and captures sales leads, instead of a hardcoded script. Falls back to the original deterministic rule-based bot if the model is ever unreachable
- **Admin CMS** — `/admin/content` lets staff edit the homepage hero (copy, links, images **and video**) and the `/farm` gallery (images *and* videos with captions) without touching code; `/admin/media` is a drag-and-drop media library backed by Vercel Blob (local uploads fall back to `public/uploads` when no Blob token is configured). The landing page and farm gallery render per request, so saved changes go live immediately — no rebuild or redeploy
- **Full product CRUD** — create/edit/delete products and sizes, with image uploads, from `/admin/products`
- **Fish stock management** (`/admin/stock`) — fresh-fish stock tracked separately from shop stock: harvests from **numbered cages, numbered ponds and the hatchery**, each counted in pieces *and* weighed in kg; distributions to outlets (Kisumu, Nairobi); and outlet sales in pieces and/or kg. Balances (farm = harvests − distributions, outlet = distributions − sales) are always derived from the event tables, with overdraw protection and full audit logging
- **Low-stock alerts** — every outlet has a tunable alert threshold (pieces and kg, admin-editable from the Stock tab; 0 turns a dimension off). Outlets that have been stocked and run down trigger a banner on `/admin/stock`, a LOW badge on the outlet card, and a proactive warning from the stockist agent even when nobody asked
- **Stockist agent** — the Stock tab has its own AI chat that answers live stock questions, warns about low outlets, *and* records harvests, distributions and sales through the same validated `src/lib/stock.ts` code paths as the forms, so it can never record something the forms would reject
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

## 📹 Farm cameras (Admin → Cameras)

The portal has a live CCTV wall at **`/admin/cameras`** (admin-only): a grid of named tiles — Cage 1, Gate, Pump house — each playing its feed live, with add/edit/delete managed from the same page and every change written to the activity log.

**The one constraint:** cameras speak RTSP, browsers don't, and the portal runs on HTTPS. So each camera must be relayed to an HTTPS URL by a machine that is always on (the NVR or an office PC — `rtsp://` links are rejected by the API with that explanation). The recommended, free setup:

1. **Install [go2rtc](https://github.com/AlexxIT/go2rtc)** on the always-on machine (Windows/Linux binary — no dependencies).
2. **Add the cameras** to its `go2rtc.yml` — either each camera directly, or once from the NVR's RTSP sub-stream:
   ```yaml
   streams:
     cage1: rtsp://admin:PASSWORD@192.168.1.20:554/Streaming/Channels/101
     gate:  rtsp://admin:PASSWORD@192.168.1.21:554/Streaming/Channels/101
   ```
3. **Expose it over HTTPS** with a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (`cloudflared`) pointed at go2rtc's port — free, no port-forwarding, and the URL stays stable. Any other HTTPS tunnel or reverse proxy works too.
4. **Paste the URL into Admin → Cameras.** Three feed types are supported (auto-detected from the URL if you leave the type on *Auto-detect*):

| Type | URL shape | Player |
|---|---|---|
| **HLS** | `https://…/api/stream.m3u8` | hls.js (Safari uses native HLS) — best for grids |
| **Embed** | `https://…/embed.html?src=cage1` | iframe — go2rtc's built-in viewer |
| **Image** | `https://…/snapshot.jpg` | snapshot refreshed every 5 s — lowest bandwidth |

Tiles show a LIVE badge while the stream loads, an error state with a Retry button when the relay is unreachable, and disabled cameras are stored but never loaded. Latency depends on the feed type: HLS ~2–5 s, go2rtc's WebRTC embed is near real-time.

## 🌱 Farm Intelligence (Admin → Farm Intelligence)

Ground telemetry and automation: sensors report **water temperature, water level, pH, dissolved oxygen** (any metric name works — these are formatted nicely), threshold **rules** turn readings into alerts and pump/aerator commands, and the **AI advisor** interprets trends and can queue actions on your say-so.

**No hardware yet?** Two ways in:

- **Key figures in by hand** — *Log Reading* (top of the dashboard): pick the metric, type what the pond gauge/thermometer shows, save. It joins the same table, charts, alert rules and WhatsApp notifications as sensor data, so your starting figures drive real alerts from day one.
- **Simulate a whole day** in a minute:

```bash
node scripts/simulate-farm.mjs seed   # 3 demo devices + 4 rules (prints tokens)
npm run start                          # server on :3001
node scripts/simulate-farm.mjs run     # posts a drifting scenario -> alert fires -> pump_on queued
node scripts/simulate-farm.mjs clean   # removes the demo data
```

### Connecting real devices (ESP32 / Arduino / Raspberry Pi)

1. **Add the device** in Admin → Farm Intelligence → *Add Device* (name, zone, type). The API token is copied to your clipboard — paste it into the firmware.
2. **Report readings** every 30–60 s:

   ```http
   POST /api/farm/ingest
   X-Device-Token: efdev_...
   { "readings": [ {"metric": "temperature_c", "value": 27.4}, {"metric": "water_level_pct", "value": 41} ] }
   ```

3. **Run commands** returned by the call (or poll `GET /api/farm/ingest?token=…`):

   ```json
   { "ok": true, "stored": 2, "alerts": [], "commands": [{ "id": "…", "command": "pump_on" }] }
   ```

   `pump_on / pump_off / aerator_on / aerator_off` map to your relays. After acting, report the resulting state (e.g. `pump_state` or just keep sending level readings) so the dashboard shows it.

Suggested sensors: DS18B20 or an I2S submersible for temperature, an ultrasonic sensor (JSN-SR04T) for water level, a pH probe + ADC, and a luminescent DO sensor — any board that can POST JSON works; the portal doesn't care which.

### Rules and safety

Rules run **server-side on every ingest**: threshold + hysteresis (no flapping) + cooldown (no spam), with an optional action that *queues* a command for an actuator. Alerts auto-resolve when readings clearly return to normal, and everything lands in the Activity Log.

⚠️ **Rules are not a safety system.** Firmware must keep its own cutoffs — never run a pump dry, cap continuous runtime, and fail safe when the network is down. The portal decides *when*; the device decides *how long it may physically run*.

### AI advisor

The advisor panel runs a ToolLoopAgent (same fleet as the sales/stockist agents) over live readings, alerts, rules and devices. It quotes real numbers, explains combinations (hot + low oxygen is the danger pair), and can `queueCommand` — audited like every agent write. Staff must ask it to act; it advises otherwise.

### Daily WhatsApp digest

Every morning at **07:00 (Nairobi)** Vercel's cron calls `/api/cron/farm-digest` (guarded by the `CRON_SECRET` env var, fail-closed) and sends the previous day's digest to the same alert recipients: one line per metric (last/avg/min/max + trend), alerts that fired, commands executed, and any device that went silent. The *Send digest* button on the dashboard builds the identical message on demand — it always returns the text for preview even when nothing is configured to send.

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
| `/admin/stock` | Fish stock: harvests (numbered cages/ponds/hatchery), outlet distributions & sales, stockist AI agent |
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
