// Canonical contract for the public booking API (apps/api PublicBooking module).
//
// This is the single source of truth for the customer-facing booking endpoints
// and their payload/response shapes. Every client that talks to the booking API
// — the dedicated club app (apps/web-club) and the in-admin public portal
// (apps/web /agendar/:slug) — imports these types and the `bookingPaths` builder
// instead of redefining them, so the apps can never drift from the API.

/** Salon portal header (GET /public/booking/:slug). */
export interface BookingPortal {
  slug: string;
  name: string;
  logoUrl: string | null;
  timezone: string;
  /**
   * Whether the salon is open right now, derived from its professionals'
   * working hours in the salon timezone. `null` when no schedules exist
   * (hours unknown) → the client should omit the status pill.
   */
  open: boolean | null;
  /** Today's open span ("HH:mm"–"HH:mm") in the salon timezone, when known. */
  todayHours: { start: string; end: string } | null;
  /**
   * Average review score and count. `null` when the salon has no reviews yet
   * → the client omits the ⭐ rating entirely (never renders "0.0").
   */
  rating: { average: number; count: number } | null;
  /** Human-readable location ("Bairro, Cidade · UF"). `null` when unknown. */
  location: string | null;
  /** Plan/subscription badge label ("Profissional"…). `null` when none. */
  plan: string | null;
  /**
   * WhatsApp contact number as digits only, normalized with the Brazilian
   * country code (e.g. "5511999998888"). `null` when the salon hasn't provided
   * a phone → the client hides the "Falar no WhatsApp" button.
   */
  whatsapp: string | null;
  /**
   * Whether "Continuar com Google" is available (server has Google OAuth
   * credentials configured) → the client shows the Google sign-in button.
   */
  googleEnabled: boolean;
  /**
   * Salon brand accent color for the booking flow, as a "#RRGGBB" hex. `null`
   * when the salon hasn't customized it → the client falls back to the house
   * default (pink). Applied as a CSS variable so buttons, active steps and
   * time chips take on the salon's color.
   */
  accentColor: string | null;
}

/** Online-bookable service. `price` is a Prisma Decimal serialized as a string. */
export interface BookingService {
  id: string;
  name: string;
  price: string | null;
  durationMin: number;
  description: string | null;
  /** Service photo URL (uploaded to the S3 bucket). `null` when none. This is
   *  the cover (first of `imageUrls`), kept for backwards compatibility. */
  imageUrl: string | null;
  /** Full gallery of service photos. Rendered as a carousel when length > 1. */
  imageUrls: string[];
  categoryId: string | null;
  categoryName: string | null;
  /** Salon-flagged favorite → rendered as a "Mais pedido" badge. */
  favorite: boolean;
  /** Created within the last 30 days → rendered as a "Novidade" badge. */
  isNew: boolean;
}

/** Professional that performs a given service and accepts online bookings. */
export interface BookingProfessional {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  profession: string | null;
}

/** A single free time slot. */
export interface BookingSlot {
  start: string;
  end: string;
}

/** Availability response (GET /public/booking/:slug/availability). */
export interface BookingAvailability {
  date: string;
  serviceId: string | null;
  professionalId: string | null;
  slots: BookingSlot[];
}

/**
 * A busy block on a professional's agenda (GET /public/booking/:slug/agenda).
 * Carries NO customer data — only the occupied time window — so the public
 * availability view can never leak who is booked or for what.
 */
export interface BookingBusyBlock {
  professionalId: string;
  start: string;
  end: string;
}

/**
 * A professional's recurring working window for a weekday (0=Sun..6=Sat),
 * times as "HH:mm" in the salon timezone. Used to shade the available hours
 * in the public agenda so customers can see when the salon is open.
 */
export interface BookingAgendaSchedule {
  professionalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

/**
 * Public availability view (GET /public/booking/:slug/agenda). Returns the
 * online-bookable professionals, their occupied blocks (free/busy, no names)
 * and their working windows, for the requested [from, to) range.
 */
export interface BookingAgenda {
  professionals: BookingProfessional[];
  busy: BookingBusyBlock[];
  schedules: BookingAgendaSchedule[];
}

/** Guest identification when booking without an account. */
export interface BookingGuest {
  name: string;
  phone?: string;
  email?: string;
}

/** Body for POST /public/booking/:slug/appointments. */
export interface CreateBookingBody {
  serviceId: string;
  /** When booking multiple services at once, send all IDs here. */
  serviceIds?: string[];
  professionalId: string;
  start: string;
  notes?: string;
  // WhatsApp/phone for a logged-in customer who has none on file yet (e.g. Google
  // sign-ups). Persisted to the customer so confirmations/reminders can reach
  // them. Guests pass their phone in `guest` instead.
  phone?: string;
  guest?: BookingGuest;
}

/** Result of creating a booking. */
export interface BookingResult {
  id: string;
  status: string;
  payment: string;
}

/** A customer's own appointment (GET /public/booking/:slug/my-appointments). */
export interface MyAppointment {
  id: string;
  start: string;
  end: string;
  status: string;
  professionalName: string | null;
  serviceNames: string[];
  canCancel: boolean;
  // True once the appointment is finished/done and not yet reviewed → the client
  // can leave a rating. `reviewed` flips to true after they submit; `rating` then
  // carries the score they gave (1–5) so the UI can show it back.
  canReview: boolean;
  reviewed: boolean;
  rating: number | null;
}

/** Body for POST /public/booking/:slug/my-appointments/:id/review. */
export interface CreateReviewBody {
  rating: number; // 1–5
  comment?: string;
}

/** A customer-targeted notification (GET /public/booking/:slug/my-notifications). */
export interface BookingNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Response of the notifications feed, including the unread tally for badges. */
export interface BookingNotificationsResponse {
  data: BookingNotification[];
  unreadCount: number;
}

/** The logged-in customer's editable profile (GET /public/booking/:slug/my-profile). */
export interface MyProfile {
  name: string;
  phone: string | null;
  email: string | null;
}

/** Body for PATCH /public/booking/:slug/my-profile. */
export interface UpdateMyProfileBody {
  name?: string;
  phone?: string;
}

/**
 * Endpoint builder — the single source of truth for the public booking routes,
 * all relative to the shared ApiClient base URL (which already includes the
 * `/api/v1` prefix). The slug is URL-encoded once here.
 */
export function bookingPaths(slug: string) {
  const base = `/public/booking/${encodeURIComponent(slug)}`;
  return {
    base,
    portal: base,
    services: `${base}/services`,
    professionals: `${base}/professionals`,
    availability: `${base}/availability`,
    agenda: `${base}/agenda`,
    appointments: `${base}/appointments`,
    myProfile: `${base}/my-profile`,
    myAppointments: `${base}/my-appointments`,
    cancelAppointment: (id: string) => `${base}/my-appointments/${id}/cancel`,
    reviewAppointment: (id: string) => `${base}/my-appointments/${id}/review`,
    myNotifications: `${base}/my-notifications`,
    readNotification: (id: string) => `${base}/my-notifications/${id}/read`,
    readAllNotifications: `${base}/my-notifications/read-all`,
  } as const;
}
