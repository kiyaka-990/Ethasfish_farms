/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: { 50:'#f3faf7',100:'#dcf2e7',200:'#bbe5d2',500:'#1d9e75',600:'#0f8a5f',700:'#0a7c5c',800:'#0d4d3a',900:'#0a2a20',950:'#051a13' },
        sea: { 400:'#4dd1c4',500:'#1eb5a6',600:'#0e8c7f' },
        sand:{ 200:'#fae3b8',400:'#e0a843',500:'#ba7517' }
      },
      backdropBlur: { xs:'2px' },
      animation: {
        'float': 'float 8s ease-in-out infinite',
        'float-delay': 'float 10s ease-in-out infinite 2s',
        'shimmer': 'shimmer 3s linear infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out',
        'gradient': 'gradient 12s ease infinite'
      },
      keyframes: {
        float: { '0%,100%':{transform:'translateY(0) rotate(0)'}, '50%':{transform:'translateY(-30px) rotate(3deg)'} },
        shimmer: { '0%':{backgroundPosition:'-1000px 0'}, '100%':{backgroundPosition:'1000px 0'} },
        'pulse-soft': { '0%,100%':{opacity:1}, '50%':{opacity:.6} },
        fadeUp: { '0%':{opacity:0,transform:'translateY(20px)'}, '100%':{opacity:1,transform:'translateY(0)'} },
        gradient: { '0%,100%':{backgroundPosition:'0% 50%'}, '50%':{backgroundPosition:'100% 50%'} }
      }
    }
  },
  plugins: []
};
