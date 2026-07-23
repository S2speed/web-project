// Keys used for storing data in localStorage
export const STORAGE_KEYS = {
  USERS: "musicApp_users",
  SONGS: "musicApp_songs",
  ALBUMS: "musicApp_albums",
  ARTISTS: "musicApp_artists",
  PLAYLISTS: "musicApp_playlists",
  NOTIFICATIONS: "musicApp_notifications",
  CURRENT_USER: "musicApp_currentUser",
  SEED_VERSION: "musicApp_seedVersion",
};

// Current version of the mock data - increment this whenever the data shape changes
export const SEED_VERSION = 1;

// Possible user roles
export const USER_ROLES = {
  ADMIN: "admin",
  SUPPORT: "support",
  ARTIST: "artist",
  LISTENER: "listener",
};

// User subscription types
export const SUBSCRIPTION_TYPES = {
  FREE: "free",
  SILVER: "silver",
  GOLD: "gold",
};

export const PLAYLIST_LIMITS = {
  [SUBSCRIPTION_TYPES.FREE]: 6,
  [SUBSCRIPTION_TYPES.SILVER]: 100,
  [SUBSCRIPTION_TYPES.GOLD]: Infinity,
};

// Subscription-specific capabilities used across profile and playback features
export const SUBSCRIPTION_LIMITS = {
  [SUBSCRIPTION_TYPES.FREE]: {
    canUploadAvatar: false,
  },
  [SUBSCRIPTION_TYPES.SILVER]: {
    canUploadAvatar: true,
  },
  [SUBSCRIPTION_TYPES.GOLD]: {
    canUploadAvatar: true,
  },
};

// Notification types
export const NOTIFICATION_TYPES = {
  SUBSCRIPTION: "subscription",
  NEW_RELEASE: "new_release",
  VERIFICATION: "verification",
  FINANCIAL: "financial",
  TICKET: "ticket",
};

export const PLAYER_REPEAT_MODES = {
  NONE: "none",
  ALL: "all",
  ONE: "one",
};

export const PLAYER_REPEAT_SEQUENCE = [
  PLAYER_REPEAT_MODES.NONE,
  PLAYER_REPEAT_MODES.ALL,
  PLAYER_REPEAT_MODES.ONE,
];

export const LIBRARY_SORT_OPTIONS = {
  RELEASE_DATE: "releaseDate",
  LISTENERS: "listeners",
};

// Default images used when a user has no avatar/cover set
export const DEFAULT_AVATAR = "/images/default-avatar.svg";
export const DEFAULT_COVER = "/images/default-cover.svg";
