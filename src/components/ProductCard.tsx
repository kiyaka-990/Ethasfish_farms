'use client';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { Plus, Sparkles, MessageCircle } from 'lucide-react';
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
  whole: 'https://images.unsplash.com/photo-1738850305638-b2f1765a4a87?w=600&q=80',
  fillet: 'https://images.unsplash.com/photo-1633244092661-4519a1ffc67e?w=600&q=80',
  fingerling: 'https://images.unsplash.com/photo-1769771861175-2cdcdf5108db?w=600&q=80',
  feed: 'https://images.unsplash.com/photo-1731552466988-26d1dbeff4ee?w=600&q=80',
  consultancy: 'https://images.unsplash.com/photo-1758535012952-67e5f5f133e7?w=600&q=80'
};

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const { add, open } = useCart();
  const variant = product.variants[selectedIdx];
  const isQuoteBased = product.type === 'consultancy';

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000';
  const quoteHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hi! I'd like a quote for ${product.name}.`)}`;

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

  const img = product.imageUrl || productImages[product.type] || productImages.whole;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative glass-card-interactive rounded-3xl overflow-hidden animate-fade-up"
      style={{ animationDelay: `${index * 100}ms`, transformStyle: 'preserve-3d', willChange: 'transform' }}
    >
      <div className="relative h-56 overflow-hidden">
        <Image
          src={img}
          alt={product.name}
          fill
          loading="lazy"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
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

        {!isQuoteBased && (
          <div className="flex gap-2 flex-wrap">
            {product.variants.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setSelectedIdx(i)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  i === selectedIdx
                    ? 'bg-gradient-to-br from-[#3B93CE] to-[#1C6EA8] text-white shadow-lg'
                    : 'glass-soft hover:bg-[var(--surface-strong)]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {isQuoteBased ? (
          <p className="text-sm text-secondary leading-relaxed">Pricing depends on scope — site visit, pond/cage design, ongoing advisory. We'll quote after a quick chat.</p>
        ) : variant && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-2xl font-bold gradient-text">{fmtKsh(variant.priceKsh)}</span>
              <span className="text-xs text-muted">{variant.weight}</span>
            </div>
            {variant.perItem && <p className="text-[11px] text-muted">{variant.perItem}</p>}
          </div>
        )}

        {isQuoteBased ? (
          <a href={quoteHref} target="_blank" rel="noopener noreferrer" className="btn-primary w-full !py-2.5 text-sm">
            <MessageCircle className="w-4 h-4" /> Request a Quote
          </a>
        ) : (
          <button onClick={handleAdd} disabled={!variant || variant.stock <= 0} className="btn-primary w-full !py-2.5 text-sm">
            <Plus className="w-4 h-4" />
            {variant && variant.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  );
}
