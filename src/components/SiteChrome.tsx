'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import ChatWidget from './ChatWidget';
import WhatsAppButton from './WhatsAppButton';
import ScrollToTop from './ScrollToTop';
import AnnouncementBar from './AnnouncementBar';
import CookieConsent from './CookieConsent';

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
      {/* Everything outside <main> is wrapped in `no-print` so a receipt or
          order printed from a storefront page is just the document - no
          fixed navbar, footer or floating chat/WhatsApp buttons. */}
      <div className="no-print">
        <AnnouncementBar />
        <Navbar />
      </div>
      <main id="main" className="flex-1 pt-[calc(4rem+var(--promo-bar-h,0px))]">{children}</main>
      <div className="no-print">
        <Footer />
        <CartDrawer />
        <ChatWidget />
        <WhatsAppButton />
        <ScrollToTop />
        <CookieConsent />
      </div>
    </>
  );
}
