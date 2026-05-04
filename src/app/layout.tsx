import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import ChatWidget from '@/components/ChatWidget';
import WhatsAppButton from '@/components/WhatsAppButton';
import AccessibilityProvider from '@/components/AccessibilityProvider';
import AccessibilityMenu from '@/components/AccessibilityMenu';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['400','500','600','700'] });

export const metadata: Metadata = {
  title: { default: 'Ethasfish Farms — Premium Nile Tilapia from Lake Victoria', template: '%s · Ethasfish Farms' },
  description: 'Sustainably-farmed Nile Tilapia from Othany East, Seme, Kisumu County. Hormone-free, chemical-free. Order online with M-Pesa. Hatchery, fish feeds, aquaculture consultancy.',
  keywords: ['tilapia kenya', 'fish farming kisumu', 'lake victoria fish', 'nile tilapia', 'fingerlings kenya', 'aquaculture consultancy', 'fish feeds kenya', 'ethasfish farms'],
  authors: [{ name: 'Ethasfish Farms' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: '/apple-touch-icon.png'
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Ethasfish Farms — Premium Nile Tilapia from Lake Victoria',
    description: 'Sustainably-farmed Nile Tilapia. Order online with M-Pesa.',
    locale: 'en_KE',
    type: 'website'
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6fbf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a2a20' }
  ],
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="skip-link">Skip to main content</a>
        <AccessibilityProvider>
          <Navbar />
          <main id="main" className="flex-1 pt-16">{children}</main>
          <Footer />
          <CartDrawer />
          <ChatWidget />
          <WhatsAppButton />
          <AccessibilityMenu />
          <Toaster position="bottom-center" toastOptions={{
            style: { background: 'var(--surface-strong)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', backdropFilter: 'blur(20px)', borderRadius: '12px', fontSize: '14px' }
          }} />
        </AccessibilityProvider>
      </body>
    </html>
  );
}
