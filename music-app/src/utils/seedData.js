import {
  STORAGE_KEYS,
  SEED_VERSION,
  USER_ROLES,
  SUBSCRIPTION_TYPES,
  NOTIFICATION_TYPES,
  DEFAULT_AVATAR,
  DEFAULT_COVER,
} from "./constants";

// ---------------------------------------------------------------------------
// USERS (5 users covering all roles)
// ---------------------------------------------------------------------------
export const mockUsers = [
  {
    id: "user_1",
    email: "admin@musicapp.com",
    password: "admin123",
    displayName: "Admin User",
    username: "admin_user",
    role: USER_ROLES.ADMIN,
    subscription: SUBSCRIPTION_TYPES.GOLD,
    avatar: DEFAULT_AVATAR,
    birthDate: "1990-01-15",
    gender: "male",
    bio: "",
    isVerified: true,
    followers: [],
    following: [],
    playlists: [],
    dailyStreams: 0,
    totalStreams: 0,
    createdAt: "2023-01-01T09:00:00.000Z",
    notificationSettings: { email: true, push: true, inApp: true },
  },
  {
    id: "user_2",
    email: "support@musicapp.com",
    password: "support123",
    displayName: "Support Agent",
    username: "support_agent",
    role: USER_ROLES.SUPPORT,
    subscription: SUBSCRIPTION_TYPES.SILVER,
    avatar: DEFAULT_AVATAR,
    birthDate: "1995-03-22",
    gender: "female",
    bio: "",
    isVerified: true,
    followers: [],
    following: [],
    playlists: [],
    dailyStreams: 0,
    totalStreams: 0,
    createdAt: "2023-02-10T09:00:00.000Z",
    notificationSettings: { email: true, push: false, inApp: true },
  },
  {
    id: "user_3",
    email: "artist@musicapp.com",
    password: "artist123",
    displayName: "Sara Nova",
    username: "sara_nova",
    role: USER_ROLES.ARTIST,
    subscription: SUBSCRIPTION_TYPES.GOLD,
    avatar: DEFAULT_AVATAR,
    birthDate: "1993-07-08",
    gender: "female",
    bio: "Independent pop/electronic artist making music since 2015.",
    isVerified: true,
    followers: ["user_4", "user_5"],
    following: [],
    playlists: ["playlist_1"],
    dailyStreams: 4200,
    totalStreams: 1250000,
    createdAt: "2022-11-05T09:00:00.000Z",
    notificationSettings: { email: true, push: true, inApp: true },
  },
  {
    id: "user_4",
    email: "listener1@musicapp.com",
    password: "listener123",
    displayName: "Ali Karimi",
    username: "ali_karimi",
    role: USER_ROLES.LISTENER,
    subscription: SUBSCRIPTION_TYPES.FREE,
    avatar: DEFAULT_AVATAR,
    birthDate: "1999-12-01",
    gender: "male",
    bio: "",
    isVerified: false,
    followers: [],
    following: ["user_3"],
    playlists: ["playlist_2"],
    dailyStreams: 35,
    totalStreams: 4300,
    createdAt: "2023-05-18T09:00:00.000Z",
    notificationSettings: { email: false, push: true, inApp: true },
  },
  {
    id: "user_5",
    email: "listener2@musicapp.com",
    password: "listener123",
    displayName: "Mina Ahmadi",
    username: "mina_ahmadi",
    role: USER_ROLES.LISTENER,
    subscription: SUBSCRIPTION_TYPES.SILVER,
    avatar: DEFAULT_AVATAR,
    birthDate: "2001-04-27",
    gender: "female",
    bio: "",
    isVerified: false,
    followers: [],
    following: ["user_3"],
    playlists: ["playlist_3"],
    dailyStreams: 60,
    totalStreams: 9800,
    createdAt: "2023-06-30T09:00:00.000Z",
    notificationSettings: { email: true, push: true, inApp: false },
  },
];

// ---------------------------------------------------------------------------
// ARTISTS (extra artist-only profile data, linked to user ids where relevant)
// ---------------------------------------------------------------------------
export const mockArtists = [
  {
    id: "artist_1",
    userId: "user_3",
    stageName: "Sara Nova",
    genres: ["pop", "electronic"],
    cover: DEFAULT_COVER,
    monthlyListeners: 87000,
    albumIds: ["album_1", "album_2"],
    singleIds: ["song_9", "song_10"],
  },
  {
    id: "artist_2",
    userId: null,
    stageName: "The Midnight Echo",
    genres: ["rock", "alternative"],
    cover: DEFAULT_COVER,
    monthlyListeners: 42000,
    albumIds: ["album_3"],
    singleIds: [],
  },
  {
    id: "artist_3",
    userId: null,
    stageName: "Lena Voss",
    genres: ["classical"],
    cover: DEFAULT_COVER,
    monthlyListeners: 15000,
    albumIds: [],
    singleIds: ["song_8"],
  },
];

// ---------------------------------------------------------------------------
// ALBUMS (3 albums)
// ---------------------------------------------------------------------------
export const mockAlbums = [
  {
    id: "album_1",
    title: "Neon Skyline",
    artistId: "artist_1",
    cover: DEFAULT_COVER,
    releaseDate: "2023-03-10",
    trackIds: ["song_1", "song_2", "song_3"],
    genre: "pop",
    description: "Sara Nova's debut studio album, blending synth-pop with dreamy vocals.",
  },
  {
    id: "album_2",
    title: "Afterglow",
    artistId: "artist_1",
    cover: DEFAULT_COVER,
    releaseDate: "2024-06-21",
    trackIds: ["song_4", "song_5"],
    genre: "electronic",
    description: "A shorter, more experimental follow-up EP-turned-album.",
  },
  {
    id: "album_3",
    title: "Static Hearts",
    artistId: "artist_2",
    cover: DEFAULT_COVER,
    releaseDate: "2022-09-02",
    trackIds: ["song_6", "song_7"],
    genre: "rock",
    description: "The Midnight Echo's breakout rock album about heartbreak and resilience.",
  },
];

// ---------------------------------------------------------------------------
// SONGS (10 songs)
// ---------------------------------------------------------------------------
export const mockSongs = [
  {
    id: "song_1",
    title: "Neon Skyline",
    artistId: "artist_1",
    albumId: "album_1",
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_1.mp3",
    lyrics: null,
    duration: 214,
    genre: "pop",
    releaseDate: "2023-03-10",
    playCount: 320000,
    listeners: 98000,
    isSingle: false,
    featuredArtists: [],
  },
  {
    id: "song_2",
    title: "City Lights",
    artistId: "artist_1",
    albumId: "album_1",
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_2.mp3",
    lyrics: null,
    duration: 198,
    genre: "pop",
    releaseDate: "2023-03-10",
    playCount: 275000,
    listeners: 84000,
    isSingle: false,
    featuredArtists: [],
  },
  {
    id: "song_3",
    title: "Fading Fast",
    artistId: "artist_1",
    albumId: "album_1",
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_3.mp3",
    lyrics: null,
    duration: 231,
    genre: "pop",
    releaseDate: "2023-03-10",
    playCount: 190000,
    listeners: 61000,
    isSingle: false,
    featuredArtists: [],
  },
  {
    id: "song_4",
    title: "Afterglow",
    artistId: "artist_1",
    albumId: "album_2",
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_4.mp3",
    lyrics: null,
    duration: 205,
    genre: "electronic",
    releaseDate: "2024-06-21",
    playCount: 145000,
    listeners: 52000,
    isSingle: false,
    featuredArtists: ["artist_3"],
  },
  {
    id: "song_5",
    title: "Waves",
    artistId: "artist_1",
    albumId: "album_2",
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_5.mp3",
    lyrics: null,
    duration: 187,
    genre: "electronic",
    releaseDate: "2024-06-21",
    playCount: 98000,
    listeners: 39000,
    isSingle: false,
    featuredArtists: [],
  },
  {
    id: "song_6",
    title: "Static Hearts",
    artistId: "artist_2",
    albumId: "album_3",
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_6.mp3",
    lyrics: null,
    duration: 242,
    genre: "rock",
    releaseDate: "2022-09-02",
    playCount: 410000,
    listeners: 120000,
    isSingle: false,
    featuredArtists: [],
  },
  {
    id: "song_7",
    title: "Broken Frequencies",
    artistId: "artist_2",
    albumId: "album_3",
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_7.mp3",
    lyrics: null,
    duration: 256,
    genre: "rock",
    releaseDate: "2022-09-02",
    playCount: 356000,
    listeners: 103000,
    isSingle: false,
    featuredArtists: [],
  },
  {
    id: "song_8",
    title: "Moonlight Sonata (Reimagined)",
    artistId: "artist_3",
    albumId: null,
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_8.mp3",
    lyrics: null,
    duration: 312,
    genre: "classical",
    releaseDate: "2021-12-01",
    playCount: 87000,
    listeners: 34000,
    isSingle: true,
    featuredArtists: [],
  },
  {
    id: "song_9",
    title: "Runaway",
    artistId: "artist_1",
    albumId: null,
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_9.mp3",
    lyrics: null,
    duration: 201,
    genre: "pop",
    releaseDate: "2024-11-14",
    playCount: 62000,
    listeners: 25000,
    isSingle: true,
    featuredArtists: [],
  },
  {
    id: "song_10",
    title: "Gravity",
    artistId: "artist_1",
    albumId: null,
    cover: DEFAULT_COVER,
    src: "https://mock-cdn.musicapp.com/audio/song_10.mp3",
    lyrics: null,
    duration: 223,
    genre: "electronic",
    releaseDate: "2025-02-20",
    playCount: 41000,
    listeners: 18000,
    isSingle: true,
    featuredArtists: ["artist_2"],
  },
];

// ---------------------------------------------------------------------------
// PLAYLISTS (3 default playlists)
// ---------------------------------------------------------------------------
export const mockPlaylists = [
  {
    id: "playlist_1",
    name: "My Favorites",
    userId: "user_3",
    songIds: ["song_1", "song_6", "song_8"],
    isPublic: true,
    createdAt: "2023-04-01T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "playlist_2",
    name: "Workout Mix",
    userId: "user_4",
    songIds: ["song_2", "song_6", "song_9", "song_10"],
    isPublic: false,
    createdAt: "2023-07-01T10:00:00.000Z",
    updatedAt: "2023-09-20T10:00:00.000Z",
  },
  {
    id: "playlist_3",
    name: "Chill Evenings",
    userId: "user_5",
    songIds: ["song_4", "song_5", "song_8"],
    isPublic: true,
    createdAt: "2023-08-10T10:00:00.000Z",
    updatedAt: "2024-02-02T10:00:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// NOTIFICATIONS (5 sample notifications)
// ---------------------------------------------------------------------------
export const mockNotifications = [
  {
    id: "notif_1",
    userId: "user_4",
    type: NOTIFICATION_TYPES.NEW_RELEASE,
    title: "New release from Sara Nova",
    message: "Sara Nova just released a new single: 'Gravity'.",
    isRead: false,
    link: "/library",
    createdAt: "2025-02-20T08:00:00.000Z",
  },
  {
    id: "notif_2",
    userId: "user_5",
    type: NOTIFICATION_TYPES.SUBSCRIPTION,
    title: "Subscription renewed",
    message: "Your Silver subscription has been renewed successfully.",
    isRead: true,
    link: "/settings",
    createdAt: "2025-01-05T12:00:00.000Z",
  },
  {
    id: "notif_3",
    userId: "user_3",
    type: NOTIFICATION_TYPES.VERIFICATION,
    title: "Verification approved",
    message: "Congratulations! Your artist profile has been verified.",
    isRead: true,
    link: "/artist/dashboard",
    createdAt: "2023-11-06T09:30:00.000Z",
  },
  {
    id: "notif_4",
    userId: "user_3",
    type: NOTIFICATION_TYPES.FINANCIAL,
    title: "Monthly payout processed",
    message: "Your monthly royalty payout of $1,245.30 has been processed.",
    isRead: false,
    link: "/artist/dashboard",
    createdAt: "2025-06-01T09:00:00.000Z",
  },
  {
    id: "notif_5",
    userId: "user_2",
    type: NOTIFICATION_TYPES.TICKET,
    title: "New support ticket",
    message: "A new support ticket has been opened by Ali Karimi.",
    isRead: false,
    link: "/admin/dashboard",
    createdAt: "2025-06-15T14:20:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Seeding logic
// ---------------------------------------------------------------------------

// Populates localStorage with the mock dataset, but only if it hasn't
// been seeded yet or the seed version has changed.
export function seedLocalStorage() {
  // Guard against server-side execution (localStorage only exists in the browser)
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const existingVersion = window.localStorage.getItem(STORAGE_KEYS.SEED_VERSION);

  if (existingVersion === String(SEED_VERSION)) {
    // Data is already seeded with the current version, nothing to do
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(mockUsers));
  window.localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(mockSongs));
  window.localStorage.setItem(STORAGE_KEYS.ALBUMS, JSON.stringify(mockAlbums));
  window.localStorage.setItem(STORAGE_KEYS.ARTISTS, JSON.stringify(mockArtists));
  window.localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(mockPlaylists));
  window.localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(mockNotifications));
  window.localStorage.setItem(STORAGE_KEYS.SEED_VERSION, String(SEED_VERSION));
}

// Clears all app-related keys from localStorage (useful for resetting/testing)
export function clearLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  Object.values(STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
