'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, LayoutTemplate, Images, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_HERO_SLIDES, type HeroSlide } from '@/components/HeroCarousel';
import MediaPicker from '@/components/admin/MediaPicker';

// Admin editor for the public CMS sections (SiteContent keys). The hero
// ("home.hero") and the farm page gallery ("farm.gallery") both render
// per-request on their pages, so saving here goes live immediately.
// Same pattern (key/label/data JSON) extends to any other section later.
interface GalleryItem { type: 'image' | 'video'; url: string; caption: string }

export default function AdminContentPage() {
  const [slide, setSlide] = useState<HeroSlide>(DEFAULT_HERO_SLIDES[0]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/content?key=home.hero').then(r => r.json()),
      fetch('/api/admin/content?key=farm.gallery').then(r => r.json())
    ]).then(([hero, gal]) => {
      const slides = hero.content?.data ? JSON.parse(hero.content.data).slides : DEFAULT_HERO_SLIDES;
      setSlide(slides[0] ?? DEFAULT_HERO_SLIDES[0]);
      const items = gal.content?.data ? (JSON.parse(gal.content.data).items ?? []) : [];
      setGallery(items);
      setLoading(false);
    });
  }, []);

  function update(patch: Partial<HeroSlide>) {
    setSlide(s => ({ ...s, ...patch }));
  }
  function updateMedia(patch: Partial<HeroSlide['media']>) {
    setSlide(s => ({ ...s, media: { ...s.media, ...patch } }));
  }

  function updateItem(i: number, patch: Partial<GalleryItem>) {
    setGallery(g => g.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }
  function addItem(type: 'image' | 'video') {
    setGallery(g => [...g, { type, url: '', caption: '' }]);
  }
  function removeItem(i: number) {
    setGallery(g => g.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    const [heroRes, galRes] = await Promise.all([
      fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'home.hero', label: 'Homepage Hero', data: { slides: [slide] } })
      }),
      fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'farm.gallery', label: 'Farm Gallery', data: { items: gallery } })
      })
    ]);
    setSaving(false);
    if (heroRes.ok && galRes.ok) toast.success('Site content updated — live now');
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
          <p className="text-sm text-muted mt-1">Edit the homepage hero and the farm gallery — image or video, headline, captions. Changes go live immediately.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save & Publish
        </button>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted font-semibold">Homepage Hero</p>
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2">
            {slide.media.type === 'video' ? (
              <video src={slide.media.url} className="w-full h-32 object-cover rounded-xl" muted loop autoPlay playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.media.url} alt="" className="w-full h-32 object-cover rounded-xl" />
            )}
            <select className="input-glass !py-2 text-xs" value={slide.media.type} onChange={e => updateMedia({ type: e.target.value as 'image' | 'video' })}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <MediaPicker
              accept={slide.media.type === 'video' ? 'video' : 'image'}
              onPick={(url) => updateMedia({ url })}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <input className="input-glass !py-2 text-sm" placeholder="Button link (e.g. /shop)" value={slide.primaryHref} onChange={e => update({ primaryHref: e.target.value })} />
            <input className="input-glass !py-2 text-sm" placeholder="Button label" value={slide.primaryLabel} onChange={e => update({ primaryLabel: e.target.value })} />
            <input className="input-glass !py-2 text-sm" placeholder="Headline (first line)" value={slide.titlePre} onChange={e => update({ titlePre: e.target.value })} />
            <input className="input-glass !py-2 text-sm" placeholder="Headline (accent line)" value={slide.titleAccent} onChange={e => update({ titleAccent: e.target.value })} />
            <textarea className="input-glass !py-2 text-sm resize-none md:col-span-2" rows={2} placeholder="Subtitle" value={slide.subtitle} onChange={e => update({ subtitle: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center gap-1.5"><Images className="w-3.5 h-3.5" /> Farm Gallery (landing page)</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => addItem('image')} className="btn-glass !py-1.5 !px-2.5 text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Image
            </button>
            <button type="button" onClick={() => addItem('video')} className="btn-glass !py-1.5 !px-2.5 text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Video
            </button>
          </div>
        </div>

        {gallery.length === 0 && (
          <p className="text-xs text-muted">The farm gallery is showing the default stock images — add your own uploads and Save &amp; Publish to replace them.</p>
        )}

        <div className="space-y-3">
          {gallery.map((item, i) => (
            <div key={i} className="grid md:grid-cols-[120px_1fr_auto] gap-3 items-start glass-soft rounded-xl p-3">
              <div className="space-y-2">
                {item.url ? (
                  item.type === 'video' ? (
                    <video src={item.url} className="w-full h-20 object-cover rounded-lg" muted loop autoPlay playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="w-full h-20 object-cover rounded-lg" />
                  )
                ) : (
                  <div className="w-full h-20 rounded-lg bg-[var(--surface)] flex items-center justify-center text-muted">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                <select className="input-glass !py-1.5 text-xs" value={item.type} onChange={e => updateItem(i, { type: e.target.value as 'image' | 'video' })}>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <div className="space-y-2">
                <input className="input-glass !py-2 text-sm" placeholder="Caption (shown over the tile)" value={item.caption} onChange={e => updateItem(i, { caption: e.target.value })} />
                <input className="input-glass !py-2 text-sm" placeholder="Media URL (or pick/upload on the right)" value={item.url} onChange={e => updateItem(i, { url: e.target.value })} />
                <MediaPicker
                  accept={item.type}
                  onPick={(url) => updateItem(i, { url })}
                />
              </div>

              <button type="button" onClick={() => removeItem(i)} className="p-2 rounded-xl hover:bg-[var(--surface-strong)] text-muted hover:text-red-500 transition-colors" aria-label="Remove gallery item" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
