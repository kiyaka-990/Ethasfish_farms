'use client';
import { useState, useRef } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '@/lib/cart-store';
import { fmtKsh } from '@/lib/utils';

interface Variant {
  id: string;
  label: string;
  pieces: number;
  weight: string;
  perItem: string | null;
  priceKsh: number;
  stock: number;
}

interface Product {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string;
  imageUrl: string | null;
  badge: string | null;
  variants: Variant[];
}

const productImages: Record<string, string> = {
  whole: 'https://images.unsplash.com/photo-1535399831218-d4ed3eaa61b1?w=600&q=80',
  fillet: 'https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?w=600&q=80',
  fingerling: 'https://images.unsplash.com/photo-1536431311719-398b6704d4cc?w=600&q=80'
};

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const { add, open } = useCart();
  const variant = product.variants[selectedIdx];

  function handleAdd() {
    if (!variant) return;
    if (variant.stock <= 0) { toast.error('Out of stock'); return; }
    add({
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      variantLabel: variant.label,
      weight: variant.weight,
      priceKsh: variant.priceKsh,
      imageUrl: product.imageUrl || undefined
    });
    toast.success(`${product.name} added!`);
    setTimeout(open, 400);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    cardRef.current.style.transform = `translateY(-6px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
  }
  function handleMouseLeave() {
    if (cardRef.current) cardRef.current.style.transform = '';
  }

  const img = productImages[product.type] || productImages.whole;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative glass-card-interactive rounded-3xl overflow-hidden animate-fade-up"
      style={{ animationDelay: `${index * 100}ms`, transformStyle: 'preserve-3d', willChange: 'transform' }}
    >
      <div className="relative h-56 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url('${img}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/40 via-transparent to-transparent" />
        {product.badge && (
          <span className="absolute top-3 right-3 badge !bg-[var(--surface-strong)]">
            <Sparkles className="w-3 h-3" />
            {product.badge}
          </span>
        )}
      </div>

      <div className="p-6 space-y-4 relative">
        <div>
          <h3 className="font-display text-xl font-semibold text-primary mb-1">{product.name}</h3>
          <p className="text-sm text-secondary leading-relaxed line-clamp-2">{product.description}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {product.variants.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setSelectedIdx(i)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                i === selectedIdx
                  ? 'bg-gradient-to-br from-[#1eb5a6] to-[#0e8c7f] text-white shadow-lg'
                  : 'glass-soft hover:bg-[var(--surface-strong)]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {variant && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-2xl font-bold gradient-text">{fmtKsh(variant.priceKsh)}</span>
              <span className="text-xs text-muted">{variant.weight}</span>
            </div>
            {variant.perItem && <p className="text-[11px] text-muted">{variant.perItem}</p>}
          </div>
        )}

        <button onClick={handleAdd} disabled={!variant || variant.stock <= 0} className="btn-primary w-full !py-2.5 text-sm">
          <Plus className="w-4 h-4" />
          {variant && variant.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
