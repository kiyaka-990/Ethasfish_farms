// Identity layer bridging Clerk (authentication) with our own
// business-role data (StaffProfile / CustomerProfile).
//
// Clerk answers "who is this?" — this file answers "what are they
// allowed to do here?" Staff rows are provisioned ahead of time by an
// admin (Admin > Staff); the first sign-in from that email links the
// Clerk user id to the pre-created row. Anyone else who signs in is
// treated as a customer and gets a CustomerProfile automatically.

import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './prisma';

export const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export type StaffRole = 'admin' | 'sales_manager';

export interface StaffSession {
  id: string;
  clerkUserId: string;
  email: string;
  name: string;
  role: StaffRole;
}

/**
 * Resolves the signed-in Clerk user to a StaffProfile, linking it on
 * first sign-in if a row was pre-provisioned for their email. Returns
 * null if Clerk isn't configured yet, nobody is signed in, or the
 * signed-in person isn't staff.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  if (!CLERK_ENABLED) return null;
  const { userId } = await auth();
  if (!userId) return null;

  let staff = await prisma.staffProfile.findUnique({ where: { clerkUserId: userId } });
  if (!staff) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    if (!email) return null;
    // Link to a pre-provisioned-by-email row (invited via Admin > Staff).
    const invited = await prisma.staffProfile.findFirst({ where: { email, clerkUserId: { startsWith: 'pending:' } } });
    if (!invited) return null;
    staff = await prisma.staffProfile.update({
      where: { id: invited.id },
      data: { clerkUserId: userId, lastSeenAt: new Date() }
    });
  } else {
    await prisma.staffProfile.update({ where: { id: staff.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  if (!staff.active) return null;
  return { id: staff.id, clerkUserId: staff.clerkUserId, email: staff.email, name: staff.name, role: staff.role as StaffRole };
}

export async function requireStaff(): Promise<StaffSession> {
  const staff = await getStaffSession();
  if (!staff) throw new Unauthorized();
  return staff;
}

export async function requireAdmin(): Promise<StaffSession> {
  const staff = await requireStaff();
  if (staff.role !== 'admin') throw new Forbidden();
  return staff;
}

/** Ensures a CustomerProfile exists for the signed-in Clerk user (for /account + checkout linking). */
export async function ensureCustomerProfile() {
  if (!CLERK_ENABLED) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const existing = await prisma.customerProfile.findUnique({ where: { clerkUserId: userId } });
  if (existing) return existing;
  const user = await currentUser();
  return prisma.customerProfile.create({
    data: {
      clerkUserId: userId,
      email: user?.emailAddresses?.[0]?.emailAddress ?? null,
      phone: user?.phoneNumbers?.[0]?.phoneNumber ?? null,
      name: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || null : null
    }
  });
}

export class Unauthorized extends Error { constructor() { super('Unauthorized'); } }
export class Forbidden extends Error { constructor() { super('Forbidden'); } }

export function identityErrorStatus(e: unknown): number {
  if (e instanceof Unauthorized) return 401;
  if (e instanceof Forbidden) return 403;
  return 500;
}
