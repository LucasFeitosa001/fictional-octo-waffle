import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </Base>
);
export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </Base>
);
export const IconReceipt = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21Z" />
    <path d="M9 8h6M9 12h6" />
  </Base>
);
export const IconUsers = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8M17 20a5.5 5.5 0 0 0-2-4.2" />
  </Base>
);
export const IconScissors = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <path d="M8 8l12 8M8 16 20 8" />
  </Base>
);
export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Base>
);
export const IconBell = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2.2 6.5 2.5 7H3.5C3.8 15.5 6 14 6 9Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);
export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);
export const IconDollar = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 2v20M16 6.5C16 4.6 14.2 3.5 12 3.5S8 4.7 8 6.7c0 4.6 8 2.8 8 7.3 0 2-1.8 3.5-4 3.5s-4-1.2-4-3" />
  </Base>
);
export const IconFilter = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 5h18l-7 8v6l-4-2v-4Z" />
  </Base>
);
export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.3" />
    <path d="M21 4v5h-5" />
  </Base>
);
export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);
export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </Base>
);
export const IconChevron = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);
export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Base>
);
export const IconLink = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 13a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
    <path d="M14 11a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </Base>
);
export const IconCash = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </Base>
);
export const IconTrendUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 17 9 11l4 4 8-8" />
    <path d="M21 7v5h-5" />
  </Base>
);
export const IconBox = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 7.5 12 3 3 7.5v9L12 21l9-4.5Z" />
    <path d="M3 7.5 12 12l9-4.5M12 12v9" />
  </Base>
);
export const IconTag = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </Base>
);
export const IconChart = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4v16h16" />
    <path d="M8 16v-5M12 16V8M16 16v-3" />
  </Base>
);
export const IconTarget = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </Base>
);
export const IconMegaphone = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
    <path d="M16 8a4 4 0 0 1 0 8M19 5a8 8 0 0 1 0 14" />
  </Base>
);
export const IconStar = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.6l5.9-.8Z" />
  </Base>
);
export const IconGift = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="8" width="17" height="13" rx="1.5" />
    <path d="M3.5 12.5h17M12 8v13" />
    <path d="M12 8C12 5 10.5 3.5 8.5 3.5S6 6 8 7.2C9.3 8 12 8 12 8ZM12 8c0-3 1.5-4.5 3.5-4.5S18 6 16 7.2C14.7 8 12 8 12 8Z" />
  </Base>
);
export const IconTruck = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6h11v9H3ZM14 9h4l3 3v3h-7Z" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17.5" cy="17.5" r="1.8" />
  </Base>
);
export const IconLayers = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3 9 5-9 5-9-5Z" />
    <path d="m3 13 9 5 9-5M3 17l9 5 9-5" />
  </Base>
);
export const IconPercent = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 5 5 19" />
    <circle cx="7.5" cy="7.5" r="2.5" />
    <circle cx="16.5" cy="16.5" r="2.5" />
  </Base>
);
export const IconCreditCard = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 9.5h19M6 15h4" />
  </Base>
);
export const IconFolder = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h7A1.5 1.5 0 0 1 19 9v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17Z" />
  </Base>
);
export const IconRepeat = (p: IconProps) => (
  <Base {...p}>
    <path d="M17 2.5 21 6l-4 3.5" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
    <path d="m7 21.5-4-3.5 4-3.5" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </Base>
);
export const IconSparkles = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z" />
    <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7Z" />
  </Base>
);
