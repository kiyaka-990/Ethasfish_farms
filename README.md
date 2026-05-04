# 🐟 Ethasfish Farms — v2

Premium Nile Tilapia from Lake Victoria — full e-commerce platform with M-Pesa payments, automatic SMS/WhatsApp receipts, hatchery & consultancy services, and a smart chatbot.

## ✨ What's new in v2

- **Light theme by default** — full theming with light/dark, font-size, contrast, and reduced-motion options
- **Accessibility menu** — floating bottom-left control with skip link, focus rings, prefers-reduced-motion support
- **Hero fade-in/fade-out carousel** — 4 dynamic slides with Ken Burns effect
- **Glassmorphism + dynamic cards** — interactive tilt, shimmer, hover lift
- **Unsplash imagery** throughout — products, hero, services, farm gallery
- **New Services page** — Hatchery, Fish Feeds, Aquaculture Consultancy
- **Automatic receipts** — sent via WhatsApp + SMS (Africa's Talking) + email after M-Pesa confirmation, in V-Farm style format
- **Beautiful receipt page** at `/receipt?order=XXXX` — printable, shareable
- **Detailed delivery tracking** — full 5-stage process visualization (pending → paid → preparing → out for delivery → delivered)
- **Dynamic contact page** — quick-action cards, animated form, business hours
- **Nutrition info** moved into Farm page
- **Favicon + PWA manifest** — custom hexagonal Ethasfish logo
- **Services-aware chatbot** — answers about hatchery, feeds, and consultancy

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local with your credentials

# Generate Prisma client + create DB + seed data
npx prisma generate
npx prisma db push
npm run db:seed

# Start dev server
npm run dev
```

Open http://localhost:3000

**Default admin login:** `admin@ethasfish.co.ke` / `changeme123` (set in `.env.local`)
**Admin panel:** http://localhost:3000/admin

## 📨 Receipt System

When a customer pays via M-Pesa, the system automatically dispatches a receipt via three channels (best-effort, in parallel):

### 1. WhatsApp (preferred)
Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` from [Meta Cloud API](https://developers.facebook.com).

### 2. SMS via Africa's Talking
Set `AT_API_KEY`, `AT_USERNAME`, and `AT_SENDER_ID` from [Africa's Talking](https://account.africastalking.com).

### 3. Email via Resend
Set `RESEND_API_KEY` and `FROM_EMAIL` from [Resend](https://resend.com).

If any of these are missing, that channel is silently skipped. Admins can manually re-send a receipt for any order from `/admin/orders` → "Resend Receipt" button.

The receipt format matches the V-Farm Kenya style:
```
Name :: Cynthia
Order :: EF-2026-280578
Date :: 24-04-2026
Time :: 13:38:08
Status :: Paid
Phone :: +254700000000
Delivery :: Othany East, Seme
M-Pesa Ref :: TGA1234XYZ

Items ::
Whole Tilapia (Medium - 4kg) × 1 - KSh 1,500

Subtotal :: KSh 1,500
Delivery :: KSh 200
Grand Total :: KSh 1,700
```

A web version is also available at `/receipt?order=ORDER_NUMBER` — printable & shareable.

## 🏗 Tech Stack

- **Framework:** Next.js 14 App Router
- **Database:** Prisma + SQLite (or Postgres in production)
- **Styling:** Tailwind CSS with CSS custom properties for theming
- **State:** Zustand for cart
- **Auth:** JWT (jose) + bcrypt
- **Payments:** M-Pesa Daraja API (STK push)
- **Receipts:** WhatsApp Cloud API + Africa's Talking SMS + Resend
- **Chatbot:** Built-in rule + retrieval engine (DB-aware), optional Claude/OpenAI integration

## 🌐 Pages

| Path | Description |
|------|-------------|
| `/` | Home — hero carousel, products, services preview |
| `/shop` | Product catalog with type filters |
| `/services` | Hatchery, Fish Feeds, Aquaculture Consultancy |
| `/farm` | Farm story, gallery, process timeline, nutrition |
| `/farm#nutrition` | Tilapia nutrition information |
| `/contact` | Quick-action cards + dynamic contact form |
| `/order` | Checkout with M-Pesa STK push |
| `/track` | Track order with detailed delivery process |
| `/receipt?order=...` | Printable receipt |
| `/admin` | Admin dashboard |
| `/admin/orders` | Manage orders, update status, resend receipts |
| `/admin/products` | Manage products + variants |
| `/admin/faqs` | Manage chatbot FAQ entries |

## ♿ Accessibility

- WCAG-friendly contrast (toggle high-contrast mode in the floating menu)
- Keyboard navigation with visible focus rings
- Skip-to-content link
- Reduced-motion support (auto-detected + manual toggle)
- Adjustable text size (base / large / extra-large)
- Theme persistence via localStorage

## 📦 Deployment

- **Database:** Switch `DATABASE_URL` to PostgreSQL (Supabase, Neon, Railway)
- **Hosting:** Vercel recommended — connects directly to GitHub
- **M-Pesa:** Set `MPESA_CALLBACK_URL` to your production domain
- **WhatsApp/SMS:** Add credentials before going live so receipts dispatch automatically

## 🤝 Support

For business questions: hello@ethasfish.co.ke
For technical issues with this codebase: contact your developer.

---

Built with care for **Ethasfish Farms** — Othany East, Seme, Kisumu County, Kenya 🇰🇪
