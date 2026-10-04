/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }
    ]
  },
  // The real auth pages are /sign-in and /sign-up (Clerk's catch-all routes).
  // /login and /admin/login are the intuitive URLs people actually type or
  // bookmark - /admin/login especially used to be a real page before Clerk
  // replaced the hand-rolled admin auth, so old links/bookmarks to it still
  // need to land somewhere instead of a 404.
  async redirects() {
    return [
      { source: '/login', destination: '/sign-in', permanent: true },
      { source: '/signin', destination: '/sign-in', permanent: true },
      { source: '/admin/login', destination: '/sign-in', permanent: true },
      { source: '/register', destination: '/sign-up', permanent: true },
      { source: '/signup', destination: '/sign-up', permanent: true }
    ];
  }
};

export default nextConfig;
