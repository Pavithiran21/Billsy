// The Billsy mark: a cream receipt printing from a mustard roll, with an ink outline, a serrated
// tear edge, a bold capital B, dotted printed lines and a mustard total bar. SvgDefs is rendered
// once at the top of the app; every logo (and the stamps' ink filter) points at it.

export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {/* Rubber-stamp ink: knocks small holes into the stamp so it looks pressed by hand. */}
        <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 1.2" />
          <feComposite in="SourceGraphic" operator="in" />
        </filter>
        <linearGradient id="roll" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0c04e" />
          <stop offset=".55" stopColor="#e2a924" />
          <stop offset="1" stopColor="#a87a0c" />
        </linearGradient>
        <linearGradient id="slip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ddd6c0" />
          <stop offset=".2" stopColor="#f8f6ec" />
        </linearGradient>
        <symbol id="logo" viewBox="0 0 64 64">
          <rect x="7" y="5" width="50" height="13" rx="6.5" fill="url(#roll)" stroke="#17150f" strokeWidth="1.6" />
          <rect x="11" y="9.5" width="42" height="2.4" rx="1.2" fill="#8a6205" opacity=".55" />
          <path
            d="M13 14h38v40l-4.75-3.4-4.75 3.4-4.75-3.4-4.75 3.4-4.75-3.4-4.75 3.4-4.75-3.4L13 54z"
            fill="url(#slip)"
            stroke="#17150f"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <text x="24.5" y="38" textAnchor="middle" fontFamily="Public Sans, sans-serif" fontWeight="800" fontSize="19" fill="#17150f">
            B
          </text>
          <path d="M35 23.5h10M35 28.5h10M35 33.5h7" stroke="#8c8672" strokeWidth="2" strokeLinecap="round" strokeDasharray="1.2 2.4" />
          <rect x="18" y="41.5" width="28" height="5" rx="2.5" fill="#e2a924" stroke="#17150f" strokeWidth=".8" />
        </symbol>
      </defs>
    </svg>
  );
}

/** The mark alone (decorative: the wordmark or a label says "Billsy"). */
export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} aria-hidden="true" focusable="false">
      <use href="#logo" />
    </svg>
  );
}

/** Mark + "Billsy" wordmark. */
export function Wordmark({ size = 34, className = '', style }) {
  return (
    <span className={`wordmark ${className}`} style={style}>
      <Logo size={size} />
      <span>Billsy</span>
    </span>
  );
}
