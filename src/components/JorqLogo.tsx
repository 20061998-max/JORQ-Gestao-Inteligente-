interface JorqLogoProps {
  compact?: boolean;
  dark?: boolean;
  showFullTitle?: boolean;
  showSignature?: boolean;
}

export function JorqSignatureSvg({ dark = false }: { dark?: boolean }) {
  const sigColor = dark ? '#93C5FD' : '#1E40AF';

  return (
    <svg
      width="108"
      height="26"
      viewBox="0 0 140 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="Rubrica Josuel Roque"
    >
      <text
        x="2"
        y="20"
        fill={dark ? '#FFFFFF' : '#0F172A'}
        style={{
          fontFamily: "'Great Vibes', 'Brush Script MT', 'Segoe Script', cursive",
          fontSize: '21px',
          fontWeight: 400,
          letterSpacing: '0.01em',
        }}
      >
        Josuel Roque
      </text>
      <path
        d="M4 26.5C34 23.5 76 23 118 25.5C126 26 132 23.5 136 21"
        stroke={sigColor}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M92 28.5C105 27.5 117 27 125 27.8"
        stroke={sigColor}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export function OwnerSignatureStamp() {
  return (
    <div
      className="fixed bottom-3 right-3 sm:bottom-4 sm:right-5 z-30 pointer-events-none select-none"
      aria-label="Rubrica Josuel Roque"
      title="Assinatura: Josuel Roque"
    >
      <div className="inline-flex items-center px-3 py-1 rounded-lg bg-slate-950/75 backdrop-blur-md border border-white/15 shadow-lg">
        <JorqSignatureSvg dark />
      </div>
    </div>
  );
}

export function JorqLogo({
  compact = false,
  dark = false,
  showFullTitle = false,
  showSignature = false,
}: JorqLogoProps) {
  const primaryFill = dark ? '#FFFFFF' : '#0F172A';
  const accentFill = dark ? '#60A5FA' : '#3B82F6';
  const titleClass = dark ? 'text-white' : 'text-[#0F172A]';

  return (
    <span className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      <svg
        width="30"
        height="30"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="2" y="2" width="32" height="32" rx="8" fill={primaryFill} />
        <path
          d="M11 23.5V20.5M16.5 23.5V16M22 23.5V12.5"
          stroke={dark ? '#0F172A' : '#FFFFFF'}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M10.5 16.5L16.5 12.2L22 14.5L26.5 9.5"
          stroke={dark ? '#1E40AF' : '#93C5FD'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="26.5" cy="9.5" r="2.2" fill={accentFill} />
      </svg>

      {!compact && (
        <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <span
            className={`font-display text-[17px] font-bold tracking-tight whitespace-nowrap shrink-0 ${titleClass}`}
          >
            {showFullTitle ? 'JORQ Gestão Inteligente' : 'JORQ'}
          </span>

          {showSignature && (
            <span
              className="inline-flex items-center pl-2.5 border-l border-slate-200 whitespace-nowrap shrink-0"
              aria-label="Rubrica Josuel Roque"
              title="Assinatura: Josuel Roque"
            >
              <JorqSignatureSvg dark={dark} />
            </span>
          )}
        </span>
      )}
    </span>
  );
}
