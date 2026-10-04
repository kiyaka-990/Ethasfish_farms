import type { Metadata } from 'next';
import PosClient from './PosClient';

// Overrides the root manifest just for this route so installing from
// here offers a standalone "Ethasfish POS" app (scoped to /admin/pos),
// not the public marketing site.
export const metadata: Metadata = {
  title: 'Point of Sale',
  manifest: '/pos.webmanifest'
};

export default function PosPage() {
  return <PosClient />;
}
