'use client';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 40, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ef-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7FC2E8" />
            <stop offset="50%" stopColor="#3B93CE" />
            <stop offset="100%" stopColor="#1C6EA8" />
          </linearGradient>
          <linearGradient id="ef-water" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7FC2E8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3B93CE" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path d="M32 2L58 16V48L32 62L6 48V16L32 2Z" fill="url(#ef-grad)" opacity="0.18"/>
        <path d="M32 2L58 16V48L32 62L6 48V16L32 2Z" stroke="url(#ef-grad)" strokeWidth="1.8" fill="none"/>
        <path d="M10 46 Q16 43 22 46 T34 46 T46 46 T58 46 L58 50 L10 50 Z" fill="url(#ef-water)" opacity="0.6"/>
        <path d="M10 50 Q16 47 22 50 T34 50 T46 50 T58 50" stroke="#3B93CE" strokeWidth="1" fill="none" opacity="0.5"/>
        <g transform="translate(32, 28)">
          <path d="M -16 0 Q -10 -10 4 -8 Q 14 -6 16 0 Q 14 6 4 8 Q -10 10 -16 0 Z" fill="url(#ef-grad)"/>
          <path d="M -16 0 L -22 -6 L -20 0 L -22 6 Z" fill="url(#ef-grad)"/>
          <circle cx="9" cy="-2" r="1.8" fill="#0B1F3A"/>
          <circle cx="9.5" cy="-2.5" r="0.6" fill="#fff"/>
          <path d="M 2 -4 Q 4 0 2 4" stroke="#0B1F3A" strokeWidth="0.8" fill="none" opacity="0.5"/>
          <path d="M -6 -7 L -4 -11 L -2 -8 L 0 -10 L 2 -8 Z" fill="#1C6EA8"/>
        </g>
        <circle cx="44" cy="16" r="2" fill="#D9E8F5"/>
        <circle cx="44" cy="16" r="3.5" fill="#D9E8F5" opacity="0.3"/>
      </svg>

      {showText && (
        <div className="leading-tight">
          <div className="font-display text-lg font-bold tracking-tight text-primary">
            Ethas<span className="bg-gradient-to-r from-[#3B93CE] to-[#1C6EA8] bg-clip-text text-transparent">fish</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted -mt-0.5">Farms · Kisumu</div>
        </div>
      )}
    </div>
  );
}
