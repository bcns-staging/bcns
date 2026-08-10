// Hand-rolled SVG icons, matching the visual convention already established
// in ../../map/GlobeMap.tsx (viewBox 0 0 24 24, fill="currentColor") -- as
// real JSX components rather than raw SVG-string constants, since this is
// 100%-React (GlobeMap.tsx exports strings only because it hands them to
// MapLibre's non-React DOM-based custom controls).

interface IconProps {
  size?: number;
  className?: string;
}

const base = { viewBox: "0 0 24 24", fill: "currentColor" } as const;

export function FolderIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h4.379a1.5 1.5 0 0 1 1.06.44L11.5 6H19.5A1.5 1.5 0 0 1 21 7.5v11A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-13z" />
    </svg>
  );
}

export function FileIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M6 2.5a1 1 0 0 0-1 1v17a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5a1 1 0 0 0-.293-.707l-5.5-5.5A1 1 0 0 0 12.5 2H6z" />
      <rect x="8" y="12" width="8" height="1.3" rx="0.6" fill="var(--color-bg-alt, #151b23)" />
      <rect x="8" y="15" width="8" height="1.3" rx="0.6" fill="var(--color-bg-alt, #151b23)" />
      <rect x="8" y="18" width="5" height="1.3" rx="0.6" fill="var(--color-bg-alt, #151b23)" />
    </svg>
  );
}

export function ImageIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="M4.5 17.5l4.5-5 3 3 3.5-4.5 4.5 5.5v.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-0z" />
    </svg>
  );
}

export function PdfIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M6 2.5a1 1 0 0 0-1 1v17a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5a1 1 0 0 0-.293-.707l-5.5-5.5A1 1 0 0 0 12.5 2H6z" />
      <path d="M12.5 2v5.5a1 1 0 0 0 1 1H19" fill="var(--color-bg-alt, #151b23)" opacity="0.35" />
      <rect x="7.5" y="13" width="9" height="6" rx="1" fill="var(--color-bg-alt, #151b23)" />
      <text x="12" y="17.6" fontSize="4.6" fontWeight="700" textAnchor="middle" fill="currentColor">
        PDF
      </text>
    </svg>
  );
}

export function AudioIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M9 4.2v11.1a3.2 3.2 0 1 0 1.5 2.7V9.8l7-1.6V6l-8.5-.1z" />
    </svg>
  );
}

export function VideoIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3" y="5.5" width="14" height="13" rx="2" />
      <path d="M18.5 10l3.2-2.1a.8.8 0 0 1 1.3.6v7l-3.2-2.1-1.3-.9V10z" />
    </svg>
  );
}

export function ArchiveIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3" y="3.5" width="18" height="4" rx="1" />
      <rect x="4" y="8.5" width="16" height="11.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="10.5" y="11.5" width="3" height="2" fill="currentColor" />
    </svg>
  );
}

export function GridViewIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ListViewIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="4.5" cy="6" r="1.3" />
      <circle cx="4.5" cy="12" r="1.3" />
      <circle cx="4.5" cy="18" r="1.3" />
      <rect x="8" y="5" width="13" height="2" rx="1" />
      <rect x="8" y="11" width="13" height="2" rx="1" />
      <rect x="8" y="17" width="13" height="2" rx="1" />
    </svg>
  );
}

export function DownloadIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M11 3h2v9.2l3.1-3.1 1.4 1.4-5.5 5.5-5.5-5.5 1.4-1.4L11 12.2V3z" />
      <rect x="4" y="18" width="16" height="2" rx="1" />
    </svg>
  );
}

export function SortIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 5l6 7H6l6-7z" />
    </svg>
  );
}

export function HomeIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 3.2 3 10.5V21h6v-6.5h6V21h6V10.5L12 3.2z" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4 9 5z" />
    </svg>
  );
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15 15l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CopyIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="8" y="8" width="12" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 15.5H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
