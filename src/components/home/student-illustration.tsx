/**
 * Original illustration drawn for ExamReady (no photograph, no likeness of a real person):
 * a student holding an open book and a pen, smiling.
 */
export function StudentIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 420" className={className} role="img" aria-label="Illustration of a smiling student holding an open book and a pen">
      <defs>
        <linearGradient id="st-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8ebfd" />
          <stop offset="1" stopColor="#dff6fb" />
        </linearGradient>
        <linearGradient id="st-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a38d1" />
          <stop offset="1" stopColor="#1b25a0" />
        </linearGradient>
      </defs>
      <circle cx="180" cy="210" r="170" fill="url(#st-bg)" />
      {/* orbit of small symbols */}
      <g fill="none" stroke="#2a38d1" strokeOpacity="0.35" strokeWidth="2">
        <circle cx="180" cy="210" r="150" strokeDasharray="2 10" />
      </g>
      <text x="48" y="118" fontFamily="Newsreader, Georgia, serif" fontSize="26" fill="#2a38d1" opacity="0.55">
        π
      </text>
      <text x="292" y="150" fontFamily="Newsreader, Georgia, serif" fontSize="22" fill="#d12b3c" opacity="0.6">
        H₂O
      </text>
      <text x="300" y="300" fontFamily="Newsreader, Georgia, serif" fontSize="24" fill="#0a6c80" opacity="0.55">
        √x
      </text>

      {/* body */}
      <path d="M92 420c4-78 40-122 88-122s84 44 88 122Z" fill="url(#st-shirt)" />
      <path d="M160 300l20 34 20-34" fill="#fff" />
      <path d="M176 318h8l6 40-10 12-10-12Z" fill="#d12b3c" />
      {/* neck */}
      <path d="M166 262h28v40c-8 8-20 8-28 0Z" fill="#c98a63" />
      {/* hair back */}
      <path d="M118 170c0-52 28-82 64-82s66 30 64 84c-2 40-12 66-20 80h-88c-10-18-20-44-20-82Z" fill="#231a3a" />
      {/* face */}
      <ellipse cx="182" cy="192" rx="50" ry="60" fill="#dca07b" />
      {/* fringe */}
      <path d="M130 172c10-40 38-58 70-56 26 2 42 20 46 44-22-4-44-16-58-30-8 20-30 36-58 42Z" fill="#231a3a" />
      {/* ponytail */}
      <path d="M238 150c26 8 38 40 26 74-6 16-18 24-26 26 8-28 10-62 0-100Z" fill="#231a3a" />
      {/* eyes */}
      <path d="M156 196c4-5 12-5 16 0M194 196c4-5 12-5 16 0" fill="none" stroke="#231a3a" strokeWidth="3.4" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="152" cy="214" r="7" fill="#ff5a6a" opacity="0.22" />
      <circle cx="214" cy="214" r="7" fill="#ff5a6a" opacity="0.22" />
      {/* smile */}
      <path d="M166 224c10 12 26 12 34 0" fill="none" stroke="#7a2a2f" strokeWidth="3.4" strokeLinecap="round" />

      {/* open book held in front */}
      <g>
        <path d="M96 318c30-12 58-12 84 4v84c-26-14-54-14-84-4Z" fill="#fff" stroke="#161a2e" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M264 318c-30-12-58-12-84 4v84c26-14 54-14 84-4Z" fill="#fff" stroke="#161a2e" strokeWidth="2.5" strokeLinejoin="round" />
        <g stroke="#a9b0c7" strokeWidth="2" strokeLinecap="round">
          <path d="M110 336c18-5 36-4 56 4M110 352c18-5 36-4 56 4M110 368c18-5 36-4 56 4" />
          <path d="M194 340c20-8 38-9 56-4M194 356c20-8 38-9 56-4" />
        </g>
        <path d="M200 372l10 10 20-24" fill="none" stroke="#0f7a4d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* hands */}
      <ellipse cx="98" cy="360" rx="14" ry="18" fill="#dca07b" />
      <ellipse cx="262" cy="352" rx="14" ry="18" fill="#dca07b" />
      {/* pen */}
      <g transform="rotate(-38 270 330)">
        <rect x="262" y="286" width="10" height="64" rx="4" fill="#161a2e" />
        <rect x="262" y="286" width="10" height="14" rx="4" fill="#d12b3c" />
        <path d="M262 350h10l-5 12Z" fill="#a9b0c7" />
      </g>
    </svg>
  );
}
