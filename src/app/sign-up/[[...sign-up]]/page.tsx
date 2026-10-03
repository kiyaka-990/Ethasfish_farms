import { SignUp } from '@clerk/nextjs';
import { CLERK_ENABLED } from '@/lib/identity-client';

export const metadata = { title: 'Create Account' };

export default function SignUpPage() {
  if (!CLERK_ENABLED) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 text-center">
        <p className="text-secondary max-w-sm">Account creation isn&apos;t configured yet — authentication is still being connected to this site.</p>
      </div>
    );
  }
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <SignUp
        appearance={{
          variables: { colorPrimary: '#1C6EA8', borderRadius: '1rem' },
          elements: { card: 'glass-strong shadow-xl', headerTitle: 'font-display' }
        }}
      />
    </div>
  );
}
