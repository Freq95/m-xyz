/**
 * Post categories with Romanian labels and colors
 */
export const POST_CATEGORIES = {
  ALERT: {
    value: 'ALERT',
    label: 'Alertă',
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: 'AlertTriangle',
  },
  SELL: {
    value: 'SELL',
    label: 'Vând',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: 'Tag',
  },
  BUY: {
    value: 'BUY',
    label: 'Cumpăr',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    icon: 'ShoppingCart',
  },
  SERVICE: {
    value: 'SERVICE',
    label: 'Servicii',
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: 'Wrench',
  },
  QUESTION: {
    value: 'QUESTION',
    label: 'Întrebare',
    color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    icon: 'HelpCircle',
  },
  EVENT: {
    value: 'EVENT',
    label: 'Eveniment',
    color: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    icon: 'Calendar',
  },
  LOST_FOUND: {
    value: 'LOST_FOUND',
    label: 'Pierdut/Găsit',
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    icon: 'Search',
  },
} as const;

export type PostCategory = keyof typeof POST_CATEGORIES;

/**
 * Report reasons with Romanian labels
 */
export const REPORT_REASONS = {
  spam: 'Spam',
  harassment: 'Hărțuire',
  scam: 'Înșelătorie',
  inappropriate: 'Conținut inadecvat',
  dangerous: 'Conținut periculos',
  other: 'Altele',
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

/**
 * User roles
 */
export const USER_ROLES = {
  user: 'Utilizator',
  moderator: 'Moderator',
  admin: 'Administrator',
  business: 'Business',
} as const;

export type UserRole = keyof typeof USER_ROLES;

/**
 * Notification digest options
 */
export const DIGEST_OPTIONS = {
  daily: 'Zilnic',
  weekly: 'Săptămânal',
  never: 'Niciodată',
} as const;

/**
 * API rate limits
 */
export const RATE_LIMITS = {
  posts: { requests: 10, window: '1h' },
  comments: { requests: 30, window: '1h' },
  auth: { requests: 5, window: '15m' },
  api: { requests: 100, window: '1m' },
} as const;

/**
 * Image upload limits
 */
export const IMAGE_LIMITS = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxImagesPerPost: 4,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 50,
} as const;
