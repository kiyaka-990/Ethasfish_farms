'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, Plus, Trash2, LayoutTemplate } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_HERO_SLIDES, type HeroSlide } from '@/components/HeroCarousel';
import MediaPicker from '@/components/admin/MediaPicker';

// Admin editor for the homepage hero carousel. This is the first CMS
// section wired up end-to-end (SiteContent key "home.hero") - the same
// pattern (key/label/data JSON) extends to any other section later.
export default function AdminContentPage() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/content?key=home.hero').then(r => r.json()).then(d => {
      setSlides(d.content?.data ? JSON.parse(d.content.data).slides : DEFAULT_HERO_SLIDES);
      setLoading(false);
    });
  }, []);

  function update(i: number, patch: Partial<HeroSlide>) {
    setSlides(s => s.map((sl, idx) => idx === i ? { ...sl, ...patch } : sl));
  }
  function updateMedia(i: number, patch: Partial<HeroSlide['media']>) {
    setSlides(s => s.map((sl, idx) => idx === i ? { ...sl, media: { ...sl.media, ...patch } } : sl));
  }
  function addSlide() {
    setSlides(s => [...s, {
      id: `slide-${Date.now()}`,
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1600&q=80' },
      badge: 'New',
      titlePre: 'Your headline',
      titleAccent: 'goes here.',
      subtitle: 'Describe the offer or highlight for this slide.',
      primaryHref: '/shop',
      primaryLabel: 'Shop Now'
    }]);
  }
  function removeSlide(i: number) {
    if (!confirm('Remove this slide?')) return;
    setSlides(s => s.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'home.hero', label: 'Homepage Hero Carousel', data: { slides } })
    });
    setSaving(false);
    if (res.ok) toast.success('Hero carousel updated — live on the homepage');
    else toast.error('Failed to save');
  }

  if (loading) return <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-[var(--accent)]" /> Site Content
          </h1>
          <p className="text-sm text-muted mt-1">Edit the homepage hero carousel — images, video, copy, and links. Changes go live immediately.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save & Publish
        </button>
      </div>

      <div className="space-y-4">
        {slides.map((s, i) => (
          <div key={s.id} className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="badge !text-[10px]">Slide {i + 1}</span>
              <button onClick={() => removeSlide(i)} className="text-red-500/80 hover:text-red-500 text-xs inline-flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>

            <div className="grid md:grid-cols-[180px_1fr] gap-4">
              <div className="space-y-2">
                {s.media.type === 'video' ? (
                  <video src={s.media.url} className="w-full h-28 object-cover rounded-xl" muted loop autoPlay playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.media.url} alt="" className="w-full h-28 object-cover rounded-xl" />
                )}
                <select className="input-glass !py-2 text-xs" value={s.media.type} onChange={e => updateMedia(i, { type: e.target.value as 'image' | 'video' })}>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
                <MediaPicker
                  accept={s.media.type === 'video' ? 'video' : 'image'}
                  onPick={(url) => updateMedia(i, { url })}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <input className="input-glass !py-2 text-sm" placeholder="Badge (e.g. 'Fresh from Lake Victoria')" value={s.badge} onChange={e => update(i, { badge: e.target.value })} />
                <input className="input-glass !py-2 text-sm" placeholder="Button link (e.g. /shop)" value={s.primaryHref} onChange={e => update(i, { primaryHref: e.target.value })} />
                <input className="input-glass !py-2 text-sm" placeholder="Headline (first line)" value={s.titlePre} onChange={e => update(i, { titlePre: e.target.value })} />
                <input className="input-glass !py-2 text-sm" placeholder="Headline (accent line)" value={s.titleAccent} onChange={e => update(i, { titleAccent: e.target.value })} />
                <input className="input-glass !py-2 text-sm md:col-span-2" placeholder="Button label" value={s.primaryLabel} onChange={e => update(i, { primaryLabel: e.target.value })} />
                <textarea className="input-glass !py-2 text-sm resize-none md:col-span-2" rows={2} placeholder="Subtitle" value={s.subtitle} onChange={e => update(i, { subtitle: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addSlide} className="btn-glass">
        <Plus className="w-4 h-4" /> Add Slide
      </button>
    </div>
  );
}
