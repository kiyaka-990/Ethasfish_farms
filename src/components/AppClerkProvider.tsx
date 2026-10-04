'use client';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { CLERK_ENABLED } from '@/lib/identity-client';
import { useAccessibility } from './AccessibilityProvider';

// Clerk isn't provisioned until its Vercel Marketplace terms are
// accepted and keys are pulled into the environment. Rendering
// <ClerkProvider> without a publishable key throws, so we skip it
// entirely until CLERK_ENABLED flips on - the rest of the site keeps
// working (just without sign-in) in the meantime.
//
// Clerk's hosted components have their own theme system, separate from
// our CSS variables - without this, they stay light-themed regardless
// of our dark mode toggle, producing light text on a dark page (or vice
// versa). baseTheme + matching variables keeps it in sync and on-brand.
export default function AppClerkProvider({ children }: { children: React.ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  return <ClerkThemedProvider>{children}</ClerkThemedProvider>;
}

function ClerkThemedProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAccessibility();
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/account"
      afterSignOutUrl="/"
      localization={{
        signIn: { start: { title: 'Sign in to Ethasfish Farms', titleCombined: 'Sign in to Ethasfish Farms' } },
        signUp: { start: { title: 'Create your Ethasfish Farms account', titleCombined: 'Create your Ethasfish Farms account' } }
      }}
      appearance={{
        theme: theme === 'dark' ? dark : undefined,
        variables: {
          colorPrimary: '#1C6EA8',
          colorBackground: theme === 'dark' ? '#112A4D' : '#ffffff',
          colorForeground: theme === 'dark' ? '#EAF2FB' : '#0B1F3A',
          colorInput: theme === 'dark' ? '#0B1F3A' : '#ffffff',
          colorInputForeground: theme === 'dark' ? '#EAF2FB' : '#0B1F3A',
          borderRadius: '0.75rem'
        }
      }}
    >
      {children}
    </ClerkProvider>
  );
}
