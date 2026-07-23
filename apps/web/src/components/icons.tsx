import type { ReactElement, SVGProps } from 'react';

import {
  House,
  Bell,
  Calendar,
  Receipt,
  Persons,
  Scissors,
  Gear,
  CircleDollar,
  Funnel,
  Calculator,
  ArrowsRotateLeft,
  ArrowsRotateRight,
  Plus,
  Magnifier,
  ChartLineArrowUp,
  ArrowRightFromSquare,
  ChevronDown,
  CircleInfo,
  CircleQuestion,
  Box,
  Tag,
  ChartColumn,
  Target,
  Megaphone,
  Star,
  Gift,
  Layers,
  Percent,
  CreditCard,
  Folder,
  Link,
  LayoutSideContentLeft,
  ArrowUpRightFromSquare,
  Copy,
  Check,
  Eye,
  ArrowDownToLine,
  Pencil,
  TrashBin,
  Xmark,
  TriangleExclamation,
  Clock,
  Handset,
  Comment,
  QrCode,
  Sparkles,
  FaceRobot,
  PaperPlane,
  ArrowUp,
  ArrowDown,
  CircleCheck,
  PersonPlus,
  PersonXmark,
  GripHorizontal,
  Envelope,
  PlayFill,
  Person,
  LayoutColumns,
  Lock,
} from '@gravity-ui/icons';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

type GravityIcon = (props: SVGProps<SVGSVGElement>) => ReactElement;

/**
 * Adapts a @gravity-ui/icons component to the local icon API:
 * accepts `size` (mapped to width/height), forwards `className`/props,
 * color comes from `currentColor` (Gravity UI fills with currentColor internally).
 */
function gravity(Icon: GravityIcon) {
  return function WrappedIcon({ size = 20, ...props }: IconProps) {
    return <Icon width={size} height={size} {...props} />;
  };
}

/** Legacy custom SVG base — kept for icons without a Gravity UI equivalent. */
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

// --- Mapped to @gravity-ui/icons -------------------------------------------
export const IconHome = gravity(House);
export const IconBell = gravity(Bell);
export const IconCalendar = gravity(Calendar);
export const IconReceipt = gravity(Receipt);
export const IconUsers = gravity(Persons);
export const IconScissors = gravity(Scissors);
export const IconSettings = gravity(Gear);
export const IconDollar = gravity(CircleDollar);
export const IconFilter = gravity(Funnel);
export const IconCalculator = gravity(Calculator);
export const IconRefresh = gravity(ArrowsRotateLeft);
export const IconPlus = gravity(Plus);
export const IconSearch = gravity(Magnifier);
export const IconTrendUp = gravity(ChartLineArrowUp);
export const IconLogout = gravity(ArrowRightFromSquare);
export const IconChevron = gravity(ChevronDown);
export const IconInfo = gravity(CircleInfo);
export const IconHelpCircle = gravity(CircleQuestion);
export const IconBox = gravity(Box);
export const IconTag = gravity(Tag);
export const IconChart = gravity(ChartColumn);
export const IconTarget = gravity(Target);
export const IconMegaphone = gravity(Megaphone);
export const IconStar = gravity(Star);
export const IconGift = gravity(Gift);
export const IconLayers = gravity(Layers);
export const IconPercent = gravity(Percent);
export const IconCreditCard = gravity(CreditCard);
export const IconFolder = gravity(Folder);
export const IconLink = gravity(Link);
export const IconRepeat = gravity(ArrowsRotateRight);
export const IconPanelLeft = gravity(LayoutSideContentLeft);
export const IconExternalLink = gravity(ArrowUpRightFromSquare);
export const IconCopy = gravity(Copy);
export const IconCheck = gravity(Check);
export const IconEye = gravity(Eye);
export const IconQr = gravity(QrCode);
export const IconDownload = gravity(ArrowDownToLine);
export const IconPencil = gravity(Pencil);
export const IconTrash = gravity(TrashBin);
export const IconX = gravity(Xmark);
export const IconAlertTriangle = gravity(TriangleExclamation);
export const IconClock = gravity(Clock);
export const IconPhone = gravity(Handset);
export const IconMessage = gravity(Comment);
export const IconSparkles = gravity(Sparkles);
export const IconBot = gravity(FaceRobot);
export const IconSend = gravity(PaperPlane);
export const IconArrowUp = gravity(ArrowUp);
export const IconArrowDown = gravity(ArrowDown);
export const IconCircleCheck = gravity(CircleCheck);
export const IconUserPlus = gravity(PersonPlus);
export const IconUserMinus = gravity(PersonXmark);
export const IconGrip = gravity(GripHorizontal);
export const IconMail = gravity(Envelope);
export const IconPlay = gravity(PlayFill);
export const IconUser = gravity(Person);
export const IconColumns = gravity(LayoutColumns);
export const IconLock = gravity(Lock);

// --- Custom SVGs (no faithful @gravity-ui/icons equivalent) ----------------
export const IconCash = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </Base>
);
export const IconTruck = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6h11v9H3ZM14 9h4l3 3v3h-7Z" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17.5" cy="17.5" r="1.8" />
  </Base>
);
export const IconShare = (p: IconProps) => (
  <Base {...p}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
  </Base>
);
export const IconWhatsApp = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 20.5 5 16a8 8 0 1 1 3 3l-4.5 1.5Z" />
    <path d="M8.5 8.5c-.3 2.5 4.5 7.3 7 7 .8-.1 1.6-1 1.6-1.6 0-.3-.2-.5-.5-.7l-1.6-.8c-.3-.1-.6 0-.8.2l-.5.6c-1.2-.5-2.2-1.5-2.7-2.7l.6-.5c.2-.2.3-.5.2-.8l-.8-1.6c-.2-.3-.4-.5-.7-.5-.6 0-1.5.8-1.5 1.6Z" />
  </Base>
);
export const IconWallet = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16a1 1 0 0 1 1 1v4" />
    <path d="M16.5 11.5a1.5 1.5 0 0 0 0 3H21v-3Z" />
  </Base>
);
export const IconCalendarPlus = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4" />
  </Base>
);
