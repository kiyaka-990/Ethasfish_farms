// Client-safe flag only - do not import server-only identity.ts (pulls in
// @clerk/nextjs/server + Prisma) from client components.
export const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
