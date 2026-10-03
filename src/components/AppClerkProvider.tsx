import { ClerkProvider } from '@clerk/nextjs';
import { CLERK_ENABLED } from '@/lib/identity-client';

// Clerk isn't provisioned until its Vercel Marketplace terms are
// accepted and keys are pulled into the environment. Rendering
// <ClerkProvider> without a publishable key throws, so we skip it
// entirely until CLERK_ENABLED flips on - the rest of the site keeps
// working (just without sign-in) in the meantime.
export default function AppClerkProvider({ children }: { children: React.ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/account"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
