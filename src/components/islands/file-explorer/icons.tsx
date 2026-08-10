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

export function LockIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="4.5" y="11" width="15" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="15.5" r="1.6" />
    </svg>
  );
}

export function UploadIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M13 15.2V4h-2v11.2l-3.1-3.1-1.4 1.4 5.5 5.5 5.5-5.5-1.4-1.4L13 15.2z" transform="rotate(180 12 12)" />
      <rect x="4" y="18" width="16" height="2" rx="1" />
    </svg>
  );
}

export function FolderPlusIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h4.379a1.5 1.5 0 0 1 1.06.44L11.5 6H19.5A1.5 1.5 0 0 1 21 7.5v11A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-13z" />
      <rect x="11" y="10" width="1.8" height="7" rx="0.9" fill="var(--color-bg-alt, #151b23)" />
      <rect x="8.5" y="12.5" width="7" height="1.8" rx="0.9" fill="var(--color-bg-alt, #151b23)" />
    </svg>
  );
}

export function TrashIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M9 3.5h6l.6 1.5H19v2H5v-2h3.4L9 3.5z" />
      <path d="M6 7.5h12l-1 13a1.5 1.5 0 0 1-1.5 1.4h-7a1.5 1.5 0 0 1-1.5-1.4l-1-13z" />
      <rect x="9.5" y="10" width="1.4" height="8.5" rx="0.7" fill="var(--color-bg-alt, #151b23)" />
      <rect x="13.1" y="10" width="1.4" height="8.5" rx="0.7" fill="var(--color-bg-alt, #151b23)" />
    </svg>
  );
}

export function EditIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M4 16.9V20h3.1L17.8 9.3l-3.1-3.1L4 16.9z" />
      <path d="M18.7 8.4a1.3 1.3 0 0 0 0-1.9l-1.2-1.2a1.3 1.3 0 0 0-1.9 0L14.3 6.6l3.1 3.1 1.3-1.3z" />
    </svg>
  );
}

export function EyeOffIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M3.5 12s3.5-6.5 8.5-6.5c1.6 0 3 .5 4.2 1.3M20.5 12s-3.5 6.5-8.5 6.5c-1.6 0-3-.5-4.2-1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M2.5 12s3.8-7 9.5-7 9.5 7 9.5 7-3.8 7-9.5 7-9.5-7-9.5-7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function LogOutIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M11 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h5v-2H6.5V6H11V4z" />
      <path d="M14.6 7.4l-1.4 1.4 2.2 2.2H9v2h6.4l-2.2 2.2 1.4 1.4L19.4 12l-4.8-4.6z" />
    </svg>
  );
}

export function SelectIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7.5 12.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CutIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="18" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 7.5L20 19M8 16.5L20 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PasteIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="5" y="4.5" width="14" height="17" rx="1.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <rect x="7.5" y="10" width="9" height="1.6" rx="0.8" />
      <rect x="7.5" y="14" width="9" height="1.6" rx="0.8" />
      <rect x="7.5" y="18" width="6" height="1.6" rx="0.8" />
    </svg>
  );
}
