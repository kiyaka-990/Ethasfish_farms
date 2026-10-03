// Seed script - run with `npm run db:seed`
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🐟 Seeding Ethasfish Farms database...');

  // Staff: pre-provision the first admin by email. Authentication itself
  // is handled by Clerk - this row links to a real Clerk user id the
  // moment someone signs in with this email (see lib/identity.ts).
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@ethasfish.co.ke').toLowerCase();
  const existingStaff = await prisma.staffProfile.findUnique({ where: { email: adminEmail } });
  if (!existingStaff) {
    await prisma.staffProfile.create({
      data: { clerkUserId: `pending:${adminEmail}:seed`, email: adminEmail, name: 'Farm Manager', role: 'admin' }
    });
  }
  console.log(`✓ Admin staff slot ready for: ${adminEmail} (sign in with this email to claim it)`);

  // Products
  const products = [
    {
      slug: 'whole-tilapia',
      name: 'Whole Tilapia',
      type: 'whole',
      description: 'Gutted and scaled, ready to cook. Sustainably raised in Lake Victoria offshore cages — hormone-free, chemical-free, and packed in zero-plastic packaging.',
      imageUrl: 'https://images.unsplash.com/photo-1738850305638-b2f1765a4a87?w=600&q=80',
      badge: 'Best Seller',
      sortOrder: 1,
      variants: [
        { label: 'Small',  pieces: 4,  weight: '2kg', perItem: '~450g per fish', priceKsh: 1200, stock: 50, sortOrder: 1 },
        { label: 'Medium', pieces: 8,  weight: '4kg', perItem: '~450g per fish', priceKsh: 2200, stock: 40, sortOrder: 2 },
        { label: 'Large',  pieces: 12, weight: '6kg', perItem: '~450g per fish', priceKsh: 3200, stock: 25, sortOrder: 3 }
      ]
    },
    {
      slug: 'filleted-tilapia',
      name: 'Filleted Tilapia',
      type: 'fillet',
      description: 'Boneless, cleaned fillets — pan, grill, or oven-ready. Approximately 150g per fillet from offshore-cage tilapia.',
      imageUrl: 'https://images.unsplash.com/photo-1633244092661-4519a1ffc67e?w=600&q=80',
      badge: 'Premium',
      sortOrder: 2,
      variants: [
        { label: 'Small',  pieces: 4,  weight: '600g',  perItem: '~150g per fillet', priceKsh: 900,  stock: 60, sortOrder: 1 },
        { label: 'Medium', pieces: 8,  weight: '1.2kg', perItem: '~150g per fillet', priceKsh: 1700, stock: 45, sortOrder: 2 },
        { label: 'Large',  pieces: 12, weight: '1.8kg', perItem: '~150g per fillet', priceKsh: 2400, stock: 30, sortOrder: 3 }
      ]
    },
    {
      slug: 'tilapia-fingerlings',
      name: 'Nile Tilapia Fingerlings',
      type: 'fingerling',
      description: 'Disease-free Nile Tilapia fingerlings, 3–5cm, from our certified hatchery — ideal for stocking ponds and cages.',
      imageUrl: 'https://images.unsplash.com/photo-1769771861175-2cdcdf5108db?w=600&q=80',
      badge: 'Aquaculture',
      sortOrder: 3,
      variants: [
        { label: '100 pcs',  pieces: 100,  weight: '100 fingerlings',  perItem: '~KSh 20 each', priceKsh: 2000,  stock: 5000, sortOrder: 1 },
        { label: '500 pcs',  pieces: 500,  weight: '500 fingerlings',  perItem: '~KSh 17 each', priceKsh: 8500,  stock: 5000, sortOrder: 2 },
        { label: '1000 pcs', pieces: 1000, weight: '1000 fingerlings', perItem: '~KSh 15 each', priceKsh: 15000, stock: 5000, sortOrder: 3 }
      ]
    },
    {
      slug: 'tilapia-fish-feed',
      name: 'Nile Tilapia Fish Feed',
      type: 'feed',
      description: 'High-protein floating pellets formulated specifically for Nile Tilapia — 25% crude protein, no hormones or antibiotics. Tested in our own ponds.',
      imageUrl: 'https://images.unsplash.com/photo-1731552466988-26d1dbeff4ee?w=600&q=80',
      badge: 'Aquaculture',
      sortOrder: 4,
      variants: [
        { label: 'Starter 25kg',  pieces: 1, weight: '25kg', perItem: 'Fry & fingerling stage', priceKsh: 2800, stock: 200, sortOrder: 1 },
        { label: 'Grower 25kg',   pieces: 1, weight: '25kg', perItem: 'Juvenile stage',          priceKsh: 2600, stock: 200, sortOrder: 2 },
        { label: 'Finisher 25kg', pieces: 1, weight: '25kg', perItem: 'Pre-harvest stage',        priceKsh: 2500, stock: 200, sortOrder: 3 },
        { label: 'Bulk 50kg',     pieces: 1, weight: '50kg', perItem: 'Any stage, bulk rate',      priceKsh: 4800, stock: 100, sortOrder: 4 }
      ]
    },
    {
      slug: 'aquaculture-consultancy',
      name: 'Aquaculture Consultancy',
      type: 'consultancy',
      description: 'End-to-end advice for your own fish farm: site assessment, pond/cage design, stocking density, feed planning, and water-quality training — backed by real Lake Victoria experience. Pricing depends on scope, so we quote after a quick chat.',
      imageUrl: 'https://images.unsplash.com/photo-1758535012952-67e5f5f133e7?w=600&q=80',
      badge: 'Service',
      sortOrder: 5,
      variants: [
        { label: 'Request a Quote', pieces: 1, weight: 'Custom scope', perItem: 'Priced after consultation', priceKsh: 0, stock: 999, sortOrder: 1 }
      ]
    }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name, type: p.type, description: p.description,
        imageUrl: p.imageUrl, badge: p.badge, sortOrder: p.sortOrder
      },
      create: {
        slug: p.slug, name: p.name, type: p.type, description: p.description,
        imageUrl: p.imageUrl, badge: p.badge, sortOrder: p.sortOrder,
        variants: { create: p.variants }
      }
    });
    console.log(`✓ Product: ${p.name}`);
  }

  // FAQ - chatbot knowledge base
  const faqs = [
    { question: 'What products do you sell?', answer: 'We offer Whole Tilapia (gutted & scaled), Filleted Tilapia (~150g per fillet), and Nile Tilapia Fingerlings — all raised sustainably in Lake Victoria offshore cages and freshwater ponds.', keywords: 'product,products,sell,offer,fish,tilapia,whole,fillet,fingerling,catalogue,catalog,what,have', category: 'products' },
    { question: 'How do I order?', answer: 'Easy! Browse our shop, add items to your cart, then proceed to checkout. Fill your delivery details and pay via M-Pesa. You can also order via WhatsApp.', keywords: 'order,buy,purchase,checkout,how to order,how do i,place order', category: 'ordering' },
    { question: 'How does payment work?', answer: 'We accept payment via M-Pesa. After placing your order, you will receive an STK push prompt on your phone. Enter your M-Pesa PIN to complete payment.', keywords: 'pay,payment,mpesa,m-pesa,stk,money,how to pay', category: 'payment' },
    { question: 'Where are you located?', answer: 'Ethasfish Farms is located at Othany East, Seme Sub-County, Kisumu County, Kenya — right on the shores of Lake Victoria.', keywords: 'location,where,address,find,farm,seme,kisumu,othany,based', category: 'location' },
    { question: 'Do you deliver?', answer: 'Yes! We deliver across Kisumu County. Standard delivery fee is KSh 200. For bulk orders or delivery outside Kisumu, contact us via WhatsApp.', keywords: 'deliver,delivery,shipping,ship,bring,send', category: 'delivery' },
    { question: 'How are your fish raised?', answer: 'Our Nile Tilapia are stocked at 3–5cm fingerlings and reared for 7–10 months. Stocking density is 4–6.67 fish per m². We feed them 25% crude protein in greened water — they grow to 100g in 3 months.', keywords: 'raise,raised,grow,grown,farm,farming,cage,pond,how,rear,reared,feed', category: 'farming' },
    { question: 'Are your fish hormone-free?', answer: 'Yes — 100% hormone-free and chemical-free. Plus, we use zero plastic in our processing and packaging.', keywords: 'hormone,chemical,natural,organic,clean,safe,healthy,plastic,packaging', category: 'quality' },
    { question: 'What are the nutrition benefits?', answer: 'Tilapia is rich in selenium, potassium, phosphorus, and vitamin B12. It is an excellent source of lean protein — only 96 calories and 26g protein per 100g.', keywords: 'nutrition,nutritional,health,healthy,protein,vitamin,selenium,calories,benefit', category: 'nutrition' },
    { question: 'What sizes are available?', answer: 'Whole fish: Small (2kg / 4 pieces), Medium (4kg / 8 pieces), Large (6kg / 12 pieces). Fillets: Small (600g), Medium (1.2kg), Large (1.8kg).', keywords: 'size,sizes,small,medium,large,kg,weight,how big,how much weight', category: 'products' },
    { question: 'Do you sell fingerlings to other farmers?', answer: 'Yes! We have a dedicated Nile Tilapia fingerling production programme. Available in batches of 100, 500, and 1,000 fingerlings — 3–5cm size, certified disease-free.', keywords: 'fingerling,fingerlings,stock,stocking,hatchery,aquaculture,farmer,wholesale', category: 'fingerlings' },
    { question: 'What are your hours?', answer: 'We are open Monday to Saturday, 7:00am to 6:00pm. Closed on Sundays.', keywords: 'hours,open,closed,time,when,schedule', category: 'general' },
    { question: 'Can I track my order?', answer: 'Yes! After placing your order you will receive an order number. Visit the Track Order page and enter your order number to see the status.', keywords: 'track,tracking,status,where is my order,follow', category: 'ordering' },
    { question: 'Do you offer hatchery services?', answer: 'Yes — we operate a dedicated Nile Tilapia hatchery producing certified disease-free fingerlings. Available in batches of 100, 500, and 1,000+ at 3–5cm size. Includes free survival guidance for the first 2 weeks.', keywords: 'hatchery,hatch,brood,fingerling,fingerlings,incubation,aquaculture', category: 'services' },
    { question: 'Do you sell fish feeds?', answer: 'Yes! We supply high-protein floating pellets formulated specifically for Nile Tilapia: 25% crude protein, available as starter, grower and finisher pellet sizes in 25kg, 50kg, or bulk. No hormones or antibiotics.', keywords: 'feed,feeds,pellet,pellets,crude protein,fish food,nutrition for fish', category: 'services' },
    { question: 'Do you offer aquaculture consultancy?', answer: 'Yes! We provide end-to-end aquaculture consultancy: site assessment, pond/cage design, stocking density, feed planning, water quality management training, and harvest planning. Backed by real Lake Victoria experience.', keywords: 'consultancy,consult,advice,advisory,training,pond design,aquaculture,help me start,how to farm', category: 'services' },
    { question: 'Do you send a receipt after I pay?', answer: 'Yes! Once your M-Pesa payment is confirmed, we automatically send you a receipt via WhatsApp and SMS — including your order number, items, totals, and M-Pesa reference. You can also view it anytime at /receipt?order=YOUR-ORDER-NUMBER.', keywords: 'receipt,confirmation,sms,whatsapp,after payment,proof', category: 'payment' },
    { question: 'What\'s the difference between cage and pond farming?', answer: 'Cage farming happens in floating net cages directly in Lake Victoria — natural water flow keeps the fish active and firm. Pond farming happens in managed freshwater ponds at our Othany East site, giving us more control over water quality. We use both depending on the product.', keywords: 'cage,pond,difference,offshore,freshwater,farming method', category: 'farming' },
    { question: 'How long does the fish stay fresh?', answer: 'Our fish is delivered the same day it\'s harvested or processed. Once delivered, keep it refrigerated and consume within 2 days, or freeze immediately for up to 3 months.', keywords: 'fresh,freshness,shelf life,how long,keep,store,storage,freeze,refrigerate', category: 'products' },
    { question: 'How much does aquaculture consultancy cost?', answer: 'Consultancy pricing depends on scope — a site visit and feasibility study, versus full ongoing advisory. Message us on WhatsApp with your location and goals and we\'ll send a tailored quote.', keywords: 'consultancy cost,consultancy price,how much.*consult,advisory fee,quote', category: 'services' },
    { question: 'What sizes do fish feed bags come in?', answer: 'Our 25% crude protein floating pellets come in 25kg and 50kg bags, or bulk sacks for larger farms and cooperatives. Starter, grower, and finisher sizes are all available.', keywords: 'feed bag,bag size,25kg,50kg,bulk feed,pellet size', category: 'services' },
    { question: 'Can I pick up my order instead of delivery?', answer: 'Yes — you\'re welcome to collect your order directly from our Othany East, Seme farm during business hours (Mon–Sat, 7am–6pm). Select pickup at checkout or mention it on WhatsApp.', keywords: 'pickup,pick up,collect,self collect,farm gate', category: 'delivery' },
    { question: 'Is there a loyalty or discount program?', answer: 'Repeat and bulk customers get preferential pricing — ask our team on WhatsApp about standing orders or cooperative rates.', keywords: 'loyalty,discount,repeat customer,standing order,regular customer', category: 'payment' }
  ];

  for (const f of faqs) {
    const existing = await prisma.faqEntry.findFirst({ where: { question: f.question } });
    if (!existing) await prisma.faqEntry.create({ data: f });
  }
  console.log(`✓ ${faqs.length} FAQ entries`);

  console.log('🎉 Done! Run `npm run dev` and visit http://localhost:3000');
  console.log(`   Admin portal: http://localhost:3000/admin — sign in with ${adminEmail} to claim the admin seat`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
