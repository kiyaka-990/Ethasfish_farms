'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import ChatWidget from './ChatWidget';
import WhatsAppButton from './WhatsAppButton';

// The admin portal (/admin/*) has its own complete, self-contained layout
// (sidebar or mobile drawer with logo, nav, and profile) - wrapping it in
// the public storefront's chrome too caused the floating chat/WhatsApp
// buttons to sit on top of admin tables, a duplicated logo/nav bar on
// mobile, and an irrelevant marketing footer under every admin page.
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return <main id="main" className="flex-1">{children}</main>;
  }

  return (
    <>
      <Navbar />
      <main id="main" className="flex-1 pt-16">{children}</main>
      <Footer />
      <CartDrawer />
      <ChatWidget />
      <WhatsAppButton />
    </>
  );
}
