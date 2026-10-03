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
        ink: { 50:'#F3F7FC',100:'#E7EFF8',200:'#C7D9EC',500:'#2F4868',600:'#1C3253',700:'#15263F',800:'#112A4D',900:'#0B1F3A',950:'#040C1A' },
        sea: { 400:'#7FC2E8',500:'#3B93CE',600:'#1C6EA8' },
        sand:{ 200:'#D9E8F5',400:'#A9C6DE',500:'#7F9CB8' }
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
