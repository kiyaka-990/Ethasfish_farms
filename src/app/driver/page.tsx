import { redirect } from 'next/navigation';
import { getStaffSession, CLERK_ENABLED } from '@/lib/identity';
import DriverApp from './DriverApp';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Deliveries' };

// Driver phone page. Same Clerk resolution as /admin but with its own
// gate: drivers (and admins, for testing) get in; anyone else bounces.
export default async function DriverPage() {
  if (!CLERK_ENABLED) {
    redirect('/sign-in?redirect_url=/driver');
  }
  const staff = await getStaffSession();
  if (!staff) redirect('/sign-in?redirect_url=/driver');
  if (staff.role !== 'driver' && staff.role !== 'admin') redirect('/admin');

  return <DriverApp role={staff.role} />;
}
