'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, Trash2, Image as ImageIcon, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface MediaItem { id: string; url: string; pathname: string; kind: string; alt: string | null; uploadedBy: string | null; createdAt: string }

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/media');
    const data = await res.json();
    setMedia(data.media || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleFiles(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/media', { method: 'POST', body: form });
      if (!res.ok) toast.error(`Failed: ${file.name}`);
    }
    setUploading(false);
    toast.success('Upload complete');
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/media?id=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); setMedia(m => m.filter(i => i.id !== id)); }
    else toast.error('Failed to delete');
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url);
    toast.success('URL copied');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-[var(--accent)]" /> Media Library
          </h1>
          <p className="text-sm text-muted mt-1">Images and videos for the shop, hero carousel, and site content.</p>
        </div>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        >
          <button onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-primary">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload Files
          </button>
          <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : media.length === 0 ? (
        <div
          className="glass rounded-3xl p-16 text-center text-muted border-2 border-dashed border-[var(--border-color)]"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        >
          Drag & drop images or videos here, or click Upload Files above.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map(m => (
            <div key={m.id} className="glass rounded-2xl overflow-hidden group relative">
              <div className="aspect-square bg-[var(--surface-soft)]">
                {m.kind === 'video' ? (
                  <video src={m.url} className="w-full h-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt || ''} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => copy(m.url)} className="p-2 rounded-xl bg-white/90 hover:bg-white" aria-label="Copy URL"><Copy className="w-4 h-4 text-black" /></button>
                <button onClick={() => remove(m.id)} className="p-2 rounded-xl bg-white/90 hover:bg-white" aria-label="Delete"><Trash2 className="w-4 h-4 text-red-600" /></button>
              </div>
              <div className="p-2 text-[10px] text-muted truncate">{m.pathname.split('/').pop()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
