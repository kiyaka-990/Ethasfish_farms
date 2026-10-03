import { SignIn } from '@clerk/nextjs';
import { CLERK_ENABLED } from '@/lib/identity-client';

export const metadata = { title: 'Sign In' };

export default function SignInPage() {
  if (!CLERK_ENABLED) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 text-center">
        <p className="text-secondary max-w-sm">Sign-in isn&apos;t configured yet — authentication is still being connected to this site.</p>
      </div>
    );
  }
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <SignIn
        appearance={{
          variables: { colorPrimary: '#1C6EA8', borderRadius: '1rem' },
          elements: { card: 'glass-strong shadow-xl', headerTitle: 'font-display' }
        }}
      />
    </div>
  );
}
