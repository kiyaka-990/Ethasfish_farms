import { prisma } from '@/lib/prisma';
import ShopGrid from '@/components/ShopGrid';

export const metadata = { title: 'Shop · Fish, Feed & Consultancy' };

async function getProducts(type?: string) {
  return prisma.product.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    include: { variants: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' }
  });
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const products = await getProducts(sp.type).catch(() => []);

  return (
    <div className="px-4 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="section-label">Our Shop</span>
          <h1 className="section-title">Fresh from the <span className="gradient-text">lake</span></h1>
          <p className="text-secondary mt-4 max-w-md mx-auto">
            Fish, fingerlings, feed, and consultancy — pay with M-Pesa, or request a quote.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {[
            { v: '', l: 'All' },
            { v: 'whole', l: 'Whole Fish' },
            { v: 'fillet', l: 'Fillets' },
            { v: 'fingerling', l: 'Fingerlings' },
            { v: 'feed', l: 'Fish Feed' },
            { v: 'consultancy', l: 'Consultancy' }
          ].map(f => {
            const active = (sp.type || '') === f.v;
            return (
              <a key={f.v} href={f.v ? `/shop?type=${f.v}` : '/shop'}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${active ? 'bg-gradient-to-br from-[#3B93CE] to-[#1C6EA8] text-white shadow-lg' : 'glass-soft hover:bg-[var(--surface-strong)]'}`}>
                {f.l}
              </a>
            );
          })}
        </div>

        {products.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center text-muted">
            No products in this category. <a href="/shop" className="text-[var(--accent)] hover:underline">View all</a>
          </div>
        ) : (
          <ShopGrid products={products as any} />
        )}
      </div>
    </div>
  );
}
