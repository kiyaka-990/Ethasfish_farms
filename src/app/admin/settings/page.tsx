'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [vatRate, setVatRate] = useState(0);
  const [kraPin, setKraPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings) { setVatRate(d.settings.vatRate); setKraPin(d.settings.kraPin || ''); }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vatRate, kraPin })
    });
    setSaving(false);
    if (res.ok) toast.success('Settings saved');
    else toast.error('Failed to save');
  }

  if (loading) return <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-[var(--accent)]" /> Settings
        </h1>
        <p className="text-sm text-muted mt-1">Business-wide tax configuration. Applies to every new order and POS sale going forward.</p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-5">
        <h2 className="font-semibold text-primary">VAT</h2>

        <div>
          <label className="text-xs text-muted uppercase tracking-wider">VAT rate (%)</label>
          <input
            type="number" min={0} max={100}
            value={vatRate}
            onChange={e => setVatRate(Number(e.target.value))}
            className="input-glass mt-1 w-32"
          />
          <p className="text-xs text-muted mt-2">
            {vatRate === 0
              ? "Set to 0 while you're not VAT-registered - current totals stay exactly as they are."
              : `Prices stay as displayed (VAT-inclusive, as required for retail). Receipts will show "Includes VAT (${vatRate}%)" as a breakdown - customers pay the same total either way.`}
          </p>
        </div>

        <div>
          <label className="text-xs text-muted uppercase tracking-wider">KRA PIN</label>
          <input
            value={kraPin}
            onChange={e => setKraPin(e.target.value.toUpperCase())}
            placeholder="P0XXXXXXXXX"
            className="input-glass mt-1 w-full"
          />
          <p className="text-xs text-muted mt-2">Shown on receipts once set. Required once VAT-registered.</p>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </button>
      </div>

      <div className="glass rounded-2xl p-5 text-sm text-secondary space-y-2">
        <p className="font-semibold text-primary">About eTIMS</p>
        <p>
          KRA&apos;s Electronic Tax Invoice Management System requires registering a Control Unit (OSCU/VSCU) with
          KRA once you&apos;re VAT-registered, which issues real-time KRA invoice numbers and QR codes. That can&apos;t
          be switched on until you have those credentials - the VAT fields above are the groundwork so that
          integration is a small follow-up job, not a rebuild, once you register.
        </p>
      </div>
    </div>
  );
}
