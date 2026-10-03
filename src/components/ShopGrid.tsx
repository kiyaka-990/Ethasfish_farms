'use client';
import { useMemo, useState } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import ProductCard from './ProductCard';

interface Variant { id: string; priceKsh: number; }
interface Product { id: string; name: string; description: string; variants: Variant[]; [key: string]: any; }

const sorts = [
  { v: 'default', l: 'Featured' },
  { v: 'price-asc', l: 'Price: Low to High' },
  { v: 'price-desc', l: 'Price: High to Low' },
  { v: 'name', l: 'Name A–Z' }
];

export default function ShopGrid({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');

  const filtered = useMemo(() => {
    let list = products;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));

    const minPrice = (p: Product) => Math.min(...p.variants.map(v => v.priceKsh).filter(n => n > 0), Infinity);
    if (sort === 'price-asc') list = [...list].sort((a, b) => minPrice(a) - minPrice(b));
    else if (sort === 'price-desc') list = [...list].sort((a, b) => minPrice(b) - minPrice(a));
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [products, query, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-8 max-w-2xl mx-auto">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products, feed, consultancy..."
            className="input-glass !pl-10 !py-2.5 text-sm w-full"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <select value={sort} onChange={e => setSort(e.target.value)} className="input-glass !pl-8 !py-2.5 text-sm !w-auto appearance-none pr-8">
            {sorts.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center text-muted">No products match "{query}".</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p, i) => <ProductCard key={p.id} product={p as any} index={i} />)}
        </div>
      )}
    </div>
  );
}
