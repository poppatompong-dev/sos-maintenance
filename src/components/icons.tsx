import type { SVGProps } from 'react';

/**
 * Line icon set (consistent 1.75 stroke, currentColor). No emoji, no filled
 * pictograms — a single coherent icon vocabulary across the app.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckCircleIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Base>
);
export const ClockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);
export const AlertTriangleIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M10.3 3.6 2.5 17a1.9 1.9 0 0 0 1.7 2.9h15.6a1.9 1.9 0 0 0 1.7-2.9L13.7 3.6a1.9 1.9 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);
export const HelpCircleIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.7-2.5 2-2.5 3.5M12 17h.01" />
  </Base>
);
export const MapPinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Base>
);
export const GridIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Base>
);
export const ClipboardIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1H9V4ZM9.5 11h5M9.5 15h5" />
  </Base>
);
export const CalendarIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </Base>
);
export const ChartIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Base>
);
export const BellIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
  </Base>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const ScanIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
  </Base>
);
export const RefreshIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 8a8 8 0 0 0-13.7-2.3L3 9M3 5v4h4M4 16a8 8 0 0 0 13.7 2.3L21 15M21 19v-4h-4" />
  </Base>
);
export const ListIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Base>
);
