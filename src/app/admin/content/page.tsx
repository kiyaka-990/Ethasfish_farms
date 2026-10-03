'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, LayoutTemplate } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_HERO_SLIDES, type HeroSlide } from '@/components/HeroCarousel';
import MediaPicker from '@/components/admin/MediaPicker';

// Admin editor for the homepage hero banner. This is the first CMS
// section wired up end-to-end (SiteContent key "home.hero") - the same
// pattern (key/label/data JSON) extends to any other section later.
// The hero itself is a single full-bleed statement (no carousel), so
// this edits one slide object - stored as { slides: [slide] } to keep
// the stored shape stable if a carousel ever comes back.
export default function AdminContentPage() {
  const [slide, setSlide] = useState<HeroSlide>(DEFAULT_HERO_SLIDES[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/content?key=home.hero').then(r => r.json()).then(d => {
      const slides = d.content?.data ? JSON.parse(d.content.data).slides : DEFAULT_HERO_SLIDES;
      setSlide(slides[0] ?? DEFAULT_HERO_SLIDES[0]);
      setLoading(false);
    });
  }, []);

  function update(patch: Partial<HeroSlide>) {
    setSlide(s => ({ ...s, ...patch }));
  }
  function updateMedia(patch: Partial<HeroSlide['media']>) {
    setSlide(s => ({ ...s, media: { ...s.media, ...patch } }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'home.hero', label: 'Homepage Hero', data: { slides: [slide] } })
    });
    setSaving(false);
    if (res.ok) toast.success('Homepage hero updated — live now');
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
          <p className="text-sm text-muted mt-1">Edit the homepage hero — image or video, headline, and button. Changes go live immediately.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save & Publish
        </button>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
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
    </div>
  );
}
