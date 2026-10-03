// Intelligent chatbot - reads live products, prices, and FAQ entries from DB.
// When admins update prices/products/FAQs, the bot picks them up automatically.
// Optionally calls Anthropic/OpenAI if API key is set, otherwise uses
// a sophisticated rule + retrieval engine.

import { prisma } from './prisma';

interface BotContext {
  products: Array<{
    name: string;
    type: string;
    description: string;
    badge: string | null;
    variants: Array<{ label: string; weight: string; perItem: string | null; priceKsh: number; stock: number }>;
  }>;
  faqs: Array<{ question: string; answer: string; keywords: string[]; category: string }>;
}

let cache: { data: BotContext; ts: number } | null = null;
const CACHE_MS = 30_000; // refresh every 30s so admins see updates fast

export async function getBotContext(): Promise<BotContext> {
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.data;

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { variants: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' }
  });
  const faqs = await prisma.faqEntry.findMany({ where: { active: true } });

  const data: BotContext = {
    products: products.map(p => ({
      name: p.name,
      type: p.type,
      description: p.description,
      badge: p.badge,
      variants: p.variants.map(v => ({ label: v.label, weight: v.weight, perItem: v.perItem, priceKsh: v.priceKsh, stock: v.stock }))
    })),
    faqs: faqs.map(f => ({ question: f.question, answer: f.answer, keywords: f.keywords.split(',').map(k => k.trim().toLowerCase()), category: f.category }))
  };
  cache = { data, ts: Date.now() };
  return data;
}

export function clearBotCache() { cache = null; }

// ---------- Intent detection ----------
function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
}

function scoreFaq(tokens: string[], faq: { keywords: string[] }): number {
  let score = 0;
  for (const t of tokens) for (const k of faq.keywords) {
    if (k === t) score += 3;
    else if (k.includes(t) || t.includes(k)) score += 1;
  }
  return score;
}

function detectIntent(msg: string): { intent: string; data?: any } {
  const m = msg.toLowerCase();
  if (/\b(price|cost|how much|ksh|shillings?)\b/.test(m)) {
    if (m.includes('whole')) return { intent: 'price', data: { type: 'whole' } };
    if (m.includes('fillet')) return { intent: 'price', data: { type: 'fillet' } };
    if (m.includes('finger')) return { intent: 'price', data: { type: 'fingerling' } };
    return { intent: 'price' };
  }
  if (/\b(stock|available|in stock|do you have)\b/.test(m)) return { intent: 'stock' };
  if (/\b(menu|catalog|catalogue|product|sell|offer|what.*have)\b/.test(m)) return { intent: 'catalog' };
  if (/\b(order|buy|purchase|checkout|how.*order|place.*order)\b/.test(m)) return { intent: 'order' };
  if (/\b(deliver|delivery|ship|shipping|bring)\b/.test(m)) return { intent: 'delivery' };
  if (/\b(pay|mpesa|m-pesa|payment|stk)\b/.test(m)) return { intent: 'payment' };
  if (/\b(track|status|where.*order|my order)\b/.test(m)) return { intent: 'track' };
  if (/\b(location|where|address|find|directions?)\b/.test(m)) return { intent: 'location' };
  if (/\b(hour|open|close|when)\b/.test(m)) return { intent: 'hours' };
  if (/\b(whatsapp|wa|contact|phone|call|email)\b/.test(m)) return { intent: 'contact' };
  if (/\b(hi|hello|hey|jambo|niaje|sasa|good (morning|afternoon|evening))\b/.test(m)) return { intent: 'greeting' };
  if (/\b(thank|thanks|asante)\b/.test(m)) return { intent: 'thanks' };
  if (/\b(bye|goodbye|kwaheri)\b/.test(m)) return { intent: 'bye' };
  if (/\b(nutri|health|protein|vitamin|calorie|benefit)\b/.test(m)) return { intent: 'nutrition' };
  if (/\b(farm|raise|grow|cage|pond|hormone|chemical|sustainab)\b/.test(m)) return { intent: 'farming' };
  if (/\b(hatchery|hatch|brood|incubat)\b/.test(m)) return { intent: 'services', data: { kind: 'hatchery' } };
  if (/\b(feed|pellet|crude protein|nutrition for fish)\b/.test(m)) return { intent: 'services', data: { kind: 'feeds' } };
  if (/\b(consult|advisory|advice|training|design.*pond|stocking)\b/.test(m)) return { intent: 'services', data: { kind: 'consultancy' } };
  if (/\b(service|services|what.*offer)\b/.test(m)) return { intent: 'services' };
  return { intent: 'unknown' };
}

function fmtKsh(n: number) { return `KSh ${n.toLocaleString()}`; }

function buildPriceList(ctx: BotContext, type?: string): string {
  const products = type ? ctx.products.filter(p => p.type === type) : ctx.products;
  if (products.length === 0) return 'No products match that.';
  const lines: string[] = [];
  for (const p of products) {
    lines.push(`*${p.name}*`);
    for (const v of p.variants) {
      const stockHint = v.stock <= 0 ? ' _(out of stock)_' : v.stock < 10 ? ` _(only ${v.stock} left!)_` : '';
      lines.push(`  • ${v.label} (${v.weight}) — ${fmtKsh(v.priceKsh)}${stockHint}`);
    }
  }
  lines.push('\n_Delivery: KSh 200 across Kisumu County._');
  return lines.join('\n');
}

function buildCatalog(ctx: BotContext): string {
  return ctx.products
    .map(p => `*${p.name}*${p.badge ? ` _(${p.badge})_` : ''} — from ${fmtKsh(Math.min(...p.variants.map(v => v.priceKsh)))}\n${p.description}`)
    .join('\n\n');
}

function buildStockReport(ctx: BotContext): string {
  const lines: string[] = [];
  for (const p of ctx.products) {
    const total = p.variants.reduce((a, v) => a + v.stock, 0);
    if (total === 0) lines.push(`✗ *${p.name}* — out of stock`);
    else lines.push(`✓ *${p.name}* — ${total} units across ${p.variants.length} sizes`);
  }
  return lines.join('\n');
}

const greetings = ['Hi! Welcome to Ethasfish Farms 🐟 How can I help — products, ordering, or farm info?', 'Hello! Looking for fresh Lake Victoria tilapia today?', 'Jambo! How can I help you today?'];
const thanksReplies = ['You\'re welcome! Anything else?', 'Karibu sana! Let me know if you need anything else.'];
const byes = ['Asante! Order anytime — we\'re here. 🐟', 'Goodbye! Talk soon.'];

// ---------- Main reply function ----------
export async function generateReply(message: string): Promise<{ text: string; intent: string }> {
  const ctx = await getBotContext();
  const tokens = tokenize(message);
  const { intent, data } = detectIntent(message);

  // FAQ retrieval (handles questions outside hard-coded intents)
  const scored = ctx.faqs.map(f => ({ f, score: scoreFaq(tokens, f) })).sort((a, b) => b.score - a.score);
  const bestFaq = scored[0];

  switch (intent) {
    case 'greeting':
      return { text: greetings[Math.floor(Math.random() * greetings.length)], intent };
    case 'thanks':
      return { text: thanksReplies[Math.floor(Math.random() * thanksReplies.length)], intent };
    case 'bye':
      return { text: byes[Math.floor(Math.random() * byes.length)], intent };
    case 'price':
      return { text: buildPriceList(ctx, data?.type), intent };
    case 'stock':
      return { text: buildStockReport(ctx), intent };
    case 'catalog':
      return { text: buildCatalog(ctx), intent };
    case 'order':
      return { text: 'Easy! On our website, browse the *Shop*, add fish to your cart, then checkout. You\'ll fill delivery details and pay via M-Pesa. Want me to send you the link?', intent };
    case 'delivery':
      return { text: 'We deliver across Kisumu County. Delivery fee is KSh 200. For other locations or bulk orders, message us on WhatsApp.', intent };
    case 'payment':
      return { text: 'We accept *M-Pesa*. After checkout, you\'ll get an STK push prompt — enter your M-Pesa PIN and you\'re done. Payment is required before delivery.', intent };
    case 'track':
      return { text: 'You can track your order on the *Track Order* page. Just enter your order number (you got it after checkout).', intent };
    case 'location':
      return { text: '📍 We\'re at *Othany East, Seme Sub-County, Kisumu County* — right on Lake Victoria\'s shoreline. Open Mon–Sat 7am–6pm.', intent };
    case 'hours':
      return { text: 'We\'re open *Monday–Saturday, 7:00am–6:00pm*. Closed on Sundays.', intent };
    case 'contact':
      return { text: `WhatsApp: +${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000'}\nEmail: ${process.env.NEXT_PUBLIC_BUSINESS_EMAIL || 'hello@ethasfish.co.ke'}`, intent };
    case 'nutrition':
      return { text: 'Tilapia is rich in *selenium, potassium, phosphorus & vitamin B12*. It\'s an excellent source of lean protein — only ~96 calories and 26g protein per 100g.', intent };
    case 'farming':
      return { text: 'Our Nile Tilapia are stocked at 3–5cm fingerlings, reared 7–10 months at 4–6.67 fish/m², fed 25% crude protein in greened water. 100% hormone & chemical-free, zero plastic packaging.', intent };
    case 'services': {
      const kind = (data && data.kind) || null;
      if (kind === 'hatchery') return { text: '🐟 *Hatchery & Fingerlings*\nWe produce certified disease-free Nile Tilapia fingerlings (3–5cm). Available in batches of 100, 500 and 1,000+. Free survival guidance for the first 2 weeks. Bulk pricing for cooperatives.', intent };
      if (kind === 'feeds') return { text: '🌾 *Quality Fish Feeds*\nHigh-protein floating pellets formulated for tilapia: starter, grower & finisher sizes at 25% crude protein. No hormones or antibiotics. Available in 25kg, 50kg or bulk. Tested in our own ponds.', intent };
      if (kind === 'consultancy') return { text: '🎓 *Aquaculture Consultancy*\nWe offer end-to-end advice: site assessment, pond/cage design, stocking density, feed planning, water-quality training, harvest planning and market linkage. Backed by real Lake Victoria experience.', intent };
      return { text: 'We offer three core services beyond fresh fish:\n\n• *Hatchery & Fingerlings* — disease-free Nile Tilapia\n• *Quality Fish Feeds* — 25% crude protein pellets\n• *Aquaculture Consultancy* — pond design to harvest\n\nVisit /services to learn more, or ask me about any of them!', intent };
    }
  }

  if (bestFaq && bestFaq.score >= 2) return { text: bestFaq.f.answer, intent: `faq:${bestFaq.f.category}` };

  // Fallback - guide them to a topic
  return { text: 'I can help with *products*, *prices*, *orders*, *delivery*, *payment*, or *farm info*. What would you like to know? You can also chat with our team on WhatsApp.', intent: 'unknown' };
}

// The real autonomous sales agent (tool-calling via the AI Gateway) lives
// in lib/agents/sales-agent.ts and is tried first by the /api/chatbot
// route. generateReply() above is the deterministic, always-available
// fallback for when the agent/model is unreachable.
