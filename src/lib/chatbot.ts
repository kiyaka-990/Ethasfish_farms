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

// Cheap edit distance for typo tolerance (e.g. "tilpia", "deliver" vs "delivery").
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99; // short-circuit, not worth computing
  const dp: number[] = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function scoreFaq(tokens: string[], faq: { keywords: string[] }): number {
  let score = 0;
  for (const t of tokens) for (const k of faq.keywords) {
    if (k === t) score += 3;
    else if (k.includes(t) || t.includes(k)) score += 1;
    else if (t.length >= 4 && k.length >= 4 && levenshtein(t, k) <= 1) score += 2; // typo tolerance
  }
  return score;
}

function detectIntent(msg: string): { intent: string; data?: any } {
  const m = msg.toLowerCase();

  // High-priority explicit triggers (menu button, capability questions)
  if (/^\s*(menu|show menu|main menu)\s*$/.test(m)) return { intent: 'menu' };
  if (/\b(what can you do|help me|how can you help|what do you know|your capabilities|options)\b/.test(m)) return { intent: 'menu' };
  if (/\b(talk to (a )?(human|person|agent|someone)|real person|speak to (someone|staff|manager))\b/.test(m)) return { intent: 'human' };
  if (/\b(complain|complaint|unhappy|disappointed|bad experience|issue with my order|problem with my order|wrong order|rotten|spoiled|smell)\b/.test(m)) return { intent: 'complaint' };

  if (/\b(price|cost|how much|ksh|shillings?|rate)\b/.test(m)) {
    if (m.includes('whole')) return { intent: 'price', data: { type: 'whole' } };
    if (m.includes('fillet')) return { intent: 'price', data: { type: 'fillet' } };
    if (m.includes('finger')) return { intent: 'price', data: { type: 'fingerling' } };
    return { intent: 'price' };
  }
  if (/\b(stock|available|in stock|do you have)\b/.test(m)) return { intent: 'stock' };
  if (/\b(menu|catalog|catalogue|product|products|sell|offer|what.*have|range)\b/.test(m)) return { intent: 'catalog' };
  if (/\b(bulk|wholesale|cooperative|co-?op|restaurant|hotel|reseller|supply.*regularly|large quantity)\b/.test(m)) return { intent: 'bulk' };
  if (/\b(minimum|min order|smallest order|least.*order)\b/.test(m)) return { intent: 'minimum_order' };
  if (/\b(refund|cancel|return policy|money back|wrong item|exchange)\b/.test(m)) return { intent: 'refund' };
  if (/\b(guarantee|survival rate|warranty|die|died|mortality)\b/.test(m)) return { intent: 'guarantee' };
  if (/\b(export|international|outside kenya|ship.*abroad|other countr)\b/.test(m)) return { intent: 'international' };
  if (/\b(job|career|hiring|vacanc|work (for|at) you|employ)\b/.test(m)) return { intent: 'careers' };
  if (/\b(order|buy|purchase|checkout|how.*order|place.*order)\b/.test(m)) return { intent: 'order' };
  if (/\b(deliver|delivery|ship|shipping|bring|areas? you cover|region)\b/.test(m)) return { intent: 'delivery' };
  if (/\b(stk|push not (coming|received)|payment failed|didn.?t receive|pin error|mpesa (not working|failed|issue))\b/.test(m)) return { intent: 'payment_issue' };
  if (/\b(pay|mpesa|m-pesa|payment|cash on delivery|card)\b/.test(m)) return { intent: 'payment' };
  if (/\b(track|status|where.*order|my order)\b/.test(m)) return { intent: 'track' };
  if (/\b(location|where|address|find|directions?|map)\b/.test(m)) return { intent: 'location' };
  if (/\b(hour|open|close|when.*(open|close))\b/.test(m)) return { intent: 'hours' };
  if (/\b(whatsapp|wa number|contact|phone number|call you|email address)\b/.test(m)) return { intent: 'contact' };
  if (/\b(who (are|r) you|about (you|ethasfish)|your story|company background)\b/.test(m)) return { intent: 'about' };
  if (/\b(how are you|how.?s it going|what.?s up)\b/.test(m)) return { intent: 'smalltalk' };
  if (/\b(joke|funny|make me laugh)\b/.test(m)) return { intent: 'joke' };
  if (/\b(who (made|built|created) you|are you (ai|a bot|human|real))\b/.test(m)) return { intent: 'bot_identity' };
  if (/\b(hi|hello|hey|jambo|niaje|sasa|good (morning|afternoon|evening))\b/.test(m)) return { intent: 'greeting' };
  if (/\b(thank|thanks|asante)\b/.test(m)) return { intent: 'thanks' };
  if (/\b(bye|goodbye|kwaheri|see you)\b/.test(m)) return { intent: 'bye' };
  if (/\b(nutri|health|protein|vitamin|calorie|benefit|diet)\b/.test(m)) return { intent: 'nutrition' };
  if (/\b(certif|organic|eco.?friendly|sustainab|environment)\b/.test(m)) return { intent: 'sustainability' };
  if (/\b(farm|raise|grow|cage|pond|hormone|chemical)\b/.test(m)) return { intent: 'farming' };
  if (/\b(hatchery|hatch|brood|incubat|fingerling)\b/.test(m)) return { intent: 'services', data: { kind: 'hatchery' } };
  if (/\b(feed|pellet|crude protein|nutrition for fish)\b/.test(m)) return { intent: 'services', data: { kind: 'feeds' } };
  if (/\b(consult|advisory|advice|training|design.*pond|stocking density)\b/.test(m)) return { intent: 'services', data: { kind: 'consultancy' } };
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
const jokes = [
  'Why don\'t fish do well in school? Because they\'re always below "sea" level! 🐟 Anyway — want to see our prices?',
  'What do you call a fish with no eyes? A fsh! 😄 Now, how can I help with your order?'
];

function buildMenu(): string {
  return [
    '🐟 *Here\'s everything I can help with:*',
    '',
    '*Shop*',
    '  • Products & prices — "show me your products"',
    '  • Stock availability — "is fillet in stock?"',
    '  • How to order — "how do I order?"',
    '  • Track an order — "track my order"',
    '',
    '*Payments & Delivery*',
    '  • M-Pesa payment — "how do I pay?"',
    '  • Delivery areas & fees — "do you deliver?"',
    '  • Cancellations/refunds — "can I cancel?"',
    '',
    '*Beyond Fish*',
    '  • Hatchery & fingerlings',
    '  • Fish feeds',
    '  • Aquaculture consultancy',
    '  • Bulk/wholesale orders',
    '',
    '*About Us*',
    '  • Our farm & location',
    '  • Nutrition facts',
    '  • Hours & contact',
    '',
    'Just type your question naturally, or tap a suggestion below. You can also reach our team directly on WhatsApp anytime.'
  ].join('\n');
}

// ---------- Main reply function ----------
// Kenyan mobile numbers: 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX
const KENYA_PHONE_RE = /(?:\+?254|0)(7|1)\d{8}\b/;
const NAME_RE = /\b(?:i'?m|i am|my name is|this is|name's)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i;

// The rule-based bot has no LLM, so it can't *decide* to ask for contact
// info the way the AI sales agent does - instead it deterministically
// captures a lead the moment a phone number appears in the conversation
// (this is the path that actually runs whenever AI Gateway credits
// aren't loaded, so it needs to carry this on its own).
async function captureLeadIfPhoneShared(message: string): Promise<string | null> {
  const phoneMatch = message.match(KENYA_PHONE_RE);
  if (!phoneMatch) return null;
  const phone = phoneMatch[0];

  const recent = await prisma.lead.findFirst({
    where: { phone, source: 'chatbot', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
  });
  if (recent) return null; // already captured this phone recently, don't spam duplicate leads

  const nameMatch = message.match(NAME_RE);
  const name = nameMatch ? nameMatch[1] : 'Website visitor';

  await prisma.lead.create({ data: { name, phone, source: 'chatbot', notes: message.slice(0, 500) } });
  return phone;
}

export async function generateReply(message: string): Promise<{ text: string; intent: string }> {
  const ctx = await getBotContext();
  const tokens = tokenize(message);
  const { intent, data } = detectIntent(message);
  const capturedPhone = await captureLeadIfPhoneShared(message).catch(() => null);
  const leadNote = capturedPhone ? `Got it — I've noted ${capturedPhone} and our team will reach out shortly. ` : '';

  // FAQ retrieval (handles questions outside hard-coded intents)
  const scored = ctx.faqs.map(f => ({ f, score: scoreFaq(tokens, f) })).sort((a, b) => b.score - a.score);
  const bestFaq = scored[0];

  if (leadNote) {
    const base = await replyFor(intent, data, ctx, bestFaq);
    return { text: leadNote + base.text, intent: base.intent };
  }
  return replyFor(intent, data, ctx, bestFaq);
}

async function replyFor(intent: string, data: any, ctx: BotContext, bestFaq: { f: { answer: string; category: string }; score: number } | undefined): Promise<{ text: string; intent: string }> {
  switch (intent) {
    case 'menu':
      return { text: buildMenu(), intent };
    case 'human':
      return { text: `I can keep helping, or you can reach our team directly on WhatsApp: +${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000'} — they usually reply within minutes during business hours (Mon–Sat, 7am–6pm).`, intent };
    case 'complaint':
      return { text: 'I\'m really sorry to hear that — that\'s not the experience we want for you. Please message us on WhatsApp with your order number so our team can fix it right away: ' + `+${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000'}`, intent };
    case 'greeting':
      return { text: greetings[Math.floor(Math.random() * greetings.length)], intent };
    case 'thanks':
      return { text: thanksReplies[Math.floor(Math.random() * thanksReplies.length)], intent };
    case 'bye':
      return { text: byes[Math.floor(Math.random() * byes.length)], intent };
    case 'joke':
      return { text: jokes[Math.floor(Math.random() * jokes.length)], intent };
    case 'smalltalk':
      return { text: 'Swimming along nicely, thanks for asking! 🐟 What can I help you with today?', intent };
    case 'bot_identity':
      return { text: 'I\'m the Ethasfish Farms AI assistant — I can help with products, orders, delivery, and farm info. For anything I can\'t answer, our real team is on WhatsApp.', intent };
    case 'about':
      return { text: 'Ethasfish Farms raises premium Nile Tilapia in offshore cages and freshwater ponds at Othany East, Seme, Kisumu County — right on Lake Victoria. We\'re hormone-free, chemical-free, and zero-plastic, and we also run a certified hatchery, supply fish feeds, and offer aquaculture consultancy across the region.', intent };
    case 'price':
      return { text: buildPriceList(ctx, data?.type), intent };
    case 'stock':
      return { text: buildStockReport(ctx), intent };
    case 'catalog':
      return { text: buildCatalog(ctx), intent };
    case 'bulk':
      return { text: 'Yes! We supply cooperatives, restaurants, hotels, and resellers with bulk orders — fish, fingerlings, and feed. Pricing is volume-based. Message us on WhatsApp with what you need and quantities, and our team will send a quote.', intent };
    case 'minimum_order':
      return { text: 'There\'s no strict minimum for retail orders — our smallest sizes start from KSh 900. For wholesale/bulk, ask about our cooperative pricing.', intent };
    case 'refund':
      return { text: 'If something\'s wrong with your order (wrong item, quality issue), contact us within 24 hours via WhatsApp with your order number and we\'ll make it right — replacement or refund.', intent };
    case 'guarantee':
      return { text: 'Our fingerlings are disease-free and graded before delivery, and we provide free survival guidance for the first 2 weeks after stocking. Normal survival rates with proper pond prep are 80%+.', intent };
    case 'international':
      return { text: 'Right now we deliver within Kisumu County and supply fingerlings/consultancy across Western Kenya. We don\'t currently export internationally, but message us on WhatsApp if you have a specific request.', intent };
    case 'careers':
      return { text: 'We occasionally hire for farm operations and sales. Send your CV and interest via WhatsApp or email and we\'ll keep it on file for openings.', intent };
    case 'order':
      return { text: 'Easy! On our website, browse the *Shop*, add fish to your cart, then checkout. You\'ll fill delivery details and pay via M-Pesa. Or share your name and phone number here and our team will call you to take the order directly.', intent };
    case 'delivery':
      return { text: 'We deliver across Kisumu County. Delivery fee is KSh 200. For other locations or bulk orders, message us on WhatsApp.', intent };
    case 'payment':
      return { text: 'We accept *M-Pesa*. After checkout, you\'ll get an STK push prompt — enter your M-Pesa PIN and you\'re done. Payment is required before delivery.', intent };
    case 'payment_issue':
      return { text: 'Sorry about that! If the STK push didn\'t arrive: check you have no pending M-Pesa prompts, that your phone has signal, and try again from the checkout page. Still stuck? Message us on WhatsApp with your order number and we\'ll sort it out manually.', intent };
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
    case 'sustainability':
      return { text: 'We\'re 100% hormone-free and chemical-free, use zero plastic in packaging, and farm at sustainable stocking densities (4–6.67 fish/m²) that keep the lake healthy. No antibiotics in feed either.', intent };
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

  // Fallback - guide them to a topic instead of a dead end
  if (bestFaq && bestFaq.score > 0) return { text: bestFaq.f.answer, intent: `faq:${bestFaq.f.category}` };
  return { text: 'I didn\'t quite catch that. Type *menu* to see everything I can help with, or ask about *products*, *prices*, *orders*, *delivery*, *payment*, or *farm info*. You can also chat with our team on WhatsApp.', intent: 'unknown' };
}

// The real autonomous sales agent (tool-calling via the AI Gateway) lives
// in lib/agents/sales-agent.ts and is tried first by the /api/chatbot
// route. generateReply() above is the deterministic, always-available
// fallback for when the agent/model is unreachable.
