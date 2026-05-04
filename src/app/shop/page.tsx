import { prisma } from '@/lib/prisma';
import ProductCard from '@/components/ProductCard';

export const metadata = { title: 'Shop · Fresh Tilapia & Fingerlings' };

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
            Choose your fish, pay with M-Pesa, and we'll deliver fresh.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {[
            { v: '', l: 'All' },
            { v: 'whole', l: 'Whole Fish' },
            { v: 'fillet', l: 'Fillets' },
            { v: 'fingerling', l: 'Fingerlings' }
          ].map(f => {
            const active = (sp.type || '') === f.v;
            return (
              <a key={f.v} href={f.v ? `/shop?type=${f.v}` : '/shop'}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${active ? 'bg-gradient-to-br from-[#1eb5a6] to-[#0e8c7f] text-white shadow-lg' : 'glass-soft hover:bg-[var(--surface-strong)]'}`}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p: any, i: number) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
