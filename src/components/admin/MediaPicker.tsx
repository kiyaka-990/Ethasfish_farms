'use client';
import { useRef, useState } from 'react';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface MediaItem { id: string; url: string; kind: string; pathname: string }

// Small reusable "upload or pick from library" control used anywhere an
// admin needs to attach an image/video (hero slides, products, ...).
export default function MediaPicker({ accept, onPick }: { accept: 'image' | 'video'; onPick: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [library, setLibrary] = useState<MediaItem[] | null>(null);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/media', { method: 'POST', body: form });
    setUploading(false);
    if (!res.ok) return toast.error('Upload failed');
    const { media } = await res.json();
    onPick(media.url);
    toast.success('Uploaded');
  }

  async function openLibrary() {
    if (!library) {
      const res = await fetch('/api/admin/media');
      const data = await res.json();
      setLibrary((data.media || []).filter((m: MediaItem) => m.kind === accept));
    } else {
      setLibrary(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-glass !py-1.5 !px-2.5 text-xs flex-1">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
        </button>
        <button type="button" onClick={openLibrary} className="btn-glass !py-1.5 !px-2.5 text-xs flex-1">
          <ImageIcon className="w-3.5 h-3.5" /> Library
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept === 'video' ? 'video/*' : 'image/*'}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
      />
      {library && (
        <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1.5 glass-soft rounded-xl">
          {library.length === 0 && <p className="col-span-3 text-[11px] text-muted text-center py-2">No {accept}s uploaded yet</p>}
          {library.map(m => (
            <button key={m.id} type="button" onClick={() => { onPick(m.url); setLibrary(null); }} className="aspect-square rounded-lg overflow-hidden border border-[var(--border-color)] hover:border-[var(--accent)]">
              {m.kind === 'video' ? (
                <video src={m.url} className="w-full h-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
