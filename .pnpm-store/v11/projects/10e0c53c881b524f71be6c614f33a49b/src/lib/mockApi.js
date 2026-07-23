import {
  STORAGE_KEYS,
  USER_ROLES as ROLES,
  SUBSCRIPTION_TYPES as SUBSCRIPTIONS,
  NOTIFICATION_TYPES,
  DEFAULT_AVATAR,
  DEFAULT_COVER,
  PLAYLIST_LIMITS,
  SUBSCRIPTION_LIMITS,
} from "@/utils/constants";
import { seedLocalStorage } from "@/utils/seedData";

const EXTRA_STORAGE_KEYS = {
  TICKETS: "musicApp_tickets",
  SUBSCRIPTION_PRICES: "musicApp_subscriptionPrices",
  ARTIST_PAYMENTS: "musicApp_artistPayments",
  PASSWORD_RESETS: "musicApp_passwordResets",
  PLAY_HISTORY: "musicApp_playHistory",
  STREAM_EVENTS: "musicApp_streamEvents",
  SUBSCRIPTION_PAYMENTS: "musicApp_subscriptionPayments",
};

const DEFAULT_SUBSCRIPTION_PRICES = {
  silver: 7.99,
  gold: 12.99,
};

const STREAM_VALUE = 0.004;

const isClient = typeof window !== "undefined";

const delay = (min = 300, max = 800) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const generateId = (prefix = "mock") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const successResponse = (data) => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});

const errorResponse = (message, code = 400) => ({
  success: false,
  error: {
    message,
    code,
  },
  timestamp: new Date().toISOString(),
});

const ensureSeeded = () => {
  if (!isClient) {
    return;
  }

  seedLocalStorage();
};

const parseJson = (value, fallback) => {
  if (value == null) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readValue = (key, fallback = null) => {
  if (!isClient) {
    return fallback;
  }

  ensureSeeded();
  return parseJson(window.localStorage.getItem(key), fallback);
};

const writeValue = (key, value) => {
  if (!isClient) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const readArray = (key) => {
  const value = readValue(key, []);
  return Array.isArray(value) ? value : [];
};

const writeArray = (key, value) => {
  writeValue(key, Array.isArray(value) ? value : []);
};

const removeValue = (key) => {
  if (!isClient) {
    return;
  }

  window.localStorage.removeItem(key);
};

const stripPassword = (user) => {
  if (!user) {
    return null;
  }

  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const getUsers = () => readArray(STORAGE_KEYS.USERS);
const saveUsers = (users) => writeArray(STORAGE_KEYS.USERS, users);
const getArtists = () => readArray(STORAGE_KEYS.ARTISTS);
const saveArtists = (artists) => writeArray(STORAGE_KEYS.ARTISTS, artists);
const getSongs = () => readArray(STORAGE_KEYS.SONGS);
const saveSongs = (songs) => writeArray(STORAGE_KEYS.SONGS, songs);
const getAlbums = () => readArray(STORAGE_KEYS.ALBUMS);
const saveAlbums = (albums) => writeArray(STORAGE_KEYS.ALBUMS, albums);
const getPlaylists = () => readArray(STORAGE_KEYS.PLAYLISTS);
const savePlaylists = (playlists) => writeArray(STORAGE_KEYS.PLAYLISTS, playlists);
const getNotifications = () => readArray(STORAGE_KEYS.NOTIFICATIONS);
const saveNotifications = (notifications) => writeArray(STORAGE_KEYS.NOTIFICATIONS, notifications);
const getTickets = () => readArray(EXTRA_STORAGE_KEYS.TICKETS);
const saveTickets = (tickets) => writeArray(EXTRA_STORAGE_KEYS.TICKETS, tickets);
const getArtistPayments = () => readArray(EXTRA_STORAGE_KEYS.ARTIST_PAYMENTS);
const saveArtistPayments = (payments) => writeArray(EXTRA_STORAGE_KEYS.ARTIST_PAYMENTS, payments);
const getPasswordResets = () => readArray(EXTRA_STORAGE_KEYS.PASSWORD_RESETS);
const savePasswordResets = (items) => writeArray(EXTRA_STORAGE_KEYS.PASSWORD_RESETS, items);
const getPlayHistory = () => readArray(EXTRA_STORAGE_KEYS.PLAY_HISTORY);
const savePlayHistory = (items) => writeArray(EXTRA_STORAGE_KEYS.PLAY_HISTORY, items);
const getStreamEvents = () => readArray(EXTRA_STORAGE_KEYS.STREAM_EVENTS);
const saveStreamEvents = (items) => writeArray(EXTRA_STORAGE_KEYS.STREAM_EVENTS, items);
const getSubscriptionPayments = () => readArray(EXTRA_STORAGE_KEYS.SUBSCRIPTION_PAYMENTS);
const saveSubscriptionPayments = (items) => writeArray(EXTRA_STORAGE_KEYS.SUBSCRIPTION_PAYMENTS, items);

const getSubscriptionPrices = () => ({
  ...DEFAULT_SUBSCRIPTION_PRICES,
  ...readValue(EXTRA_STORAGE_KEYS.SUBSCRIPTION_PRICES, {}),
});

const saveSubscriptionPrices = (prices) => writeValue(EXTRA_STORAGE_KEYS.SUBSCRIPTION_PRICES, prices);

const getCurrentUserRecord = () => {
  const currentUser = readValue(STORAGE_KEYS.CURRENT_USER, null);

  if (!currentUser) {
    return null;
  }

  const users = getUsers();
  const freshUser = users.find((user) => user.id === currentUser.id);
  return freshUser || currentUser;
};

const getUserByIdRecord = (userId) => getUsers().find((user) => user.id === userId) || null;

const getArtistProfileById = (artistId) => {
  const artists = getArtists();
  const users = getUsers();

  const directMatch = artists.find((artist) => artist.id === artistId || artist.userId === artistId);
  if (directMatch) {
    return directMatch;
  }

  const artistUser = users.find((user) => user.id === artistId && user.role === ROLES.ARTIST);
  if (!artistUser) {
    return null;
  }

  return {
    id: artistUser.id,
    userId: artistUser.id,
    stageName: artistUser.displayName || artistUser.username || "",
    genres: [],
    cover: artistUser.avatar || DEFAULT_COVER,
    monthlyListeners: artistUser.totalStreams || 0,
    albumIds: [],
    singleIds: [],
    verificationStatus: artistUser.isVerified ? "approved" : "pending",
    verifiedAt: artistUser.isVerified ? artistUser.createdAt || new Date().toISOString() : null,
    rejectionReason: null,
  };
};

const getArtistUserFromProfile = (artistProfile) => {
  if (!artistProfile) {
    return null;
  }

  if (artistProfile.userId) {
    return getUserByIdRecord(artistProfile.userId);
  }

  const users = getUsers();
  return users.find((user) => user.id === artistProfile.id && user.role === ROLES.ARTIST) || null;
};

const upsertArtistProfile = (artistProfile) => {
  const artists = getArtists();
  const index = artists.findIndex((artist) => artist.id === artistProfile.id);

  if (index === -1) {
    artists.push(artistProfile);
  } else {
    artists[index] = artistProfile;
  }

  saveArtists(artists);
};

const removeFromArray = (items, value) => items.filter((item) => item !== value);
const pushUnique = (items, value) => (items.includes(value) ? items : [...items, value]);

const isAdminOrSupport = (user) => Boolean(user && [ROLES.ADMIN, ROLES.SUPPORT].includes(user.role));
const isAdmin = (user) => Boolean(user && user.role === ROLES.ADMIN);
const getSubscriptionLimit = (subscription) => PLAYLIST_LIMITS[subscription] ?? PLAYLIST_LIMITS[SUBSCRIPTIONS.FREE];

const resolveFileUrl = (file, fallback = null) => {
  if (file && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }

  return fallback;
};

const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac"];
const isSupportedAudioFile = (file) =>
  Boolean(file?.name && SUPPORTED_AUDIO_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension)));
const canManageArtist = (user, artistProfile) =>
  Boolean(
    user
    && user.role === ROLES.ARTIST
    && artistProfile
    && (artistProfile.userId === user.id || artistProfile.id === user.id),
  );
const isVerifiedArtist = (user, artistProfile) =>
  Boolean(artistProfile?.verificationStatus === "approved" || user?.isVerified === true);

const getSongByIdSync = (songId) => getSongs().find((song) => song.id === songId) || null;
const getAlbumByIdSync = (albumId) => getAlbums().find((album) => album.id === albumId) || null;
const getPlaylistByIdSync = (playlistId) => getPlaylists().find((playlist) => playlist.id === playlistId) || null;
const getNotificationByIdSync = (notificationId) => getNotifications().find((notification) => notification.id === notificationId) || null;
const getTicketByIdSync = (ticketId) => getTickets().find((ticket) => ticket.id === ticketId) || null;

const buildTicketPayload = (ticket) => {
  const owner = getUserByIdRecord(ticket.userId);
  return {
    ...ticket,
    user: owner ? stripPassword(owner) : null,
  };
};

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const createNotificationSync = (userId, notificationData) => {
  const user = getUserByIdRecord(userId);
  const settings = user?.notificationSettings || {};
  const notifications = getNotifications();

  if (
    notificationData.dedupeKey
    && notifications.some((item) => item.dedupeKey === notificationData.dedupeKey)
  ) {
    return null;
  }

  if (settings.inApp === false) {
    return null;
  }

  const configuredLimit = Number(settings.dailyLimit);
  if (Number.isFinite(configuredLimit)) {
    const dailyLimit = Math.max(0, configuredLimit);
    const today = new Date().toISOString().slice(0, 10);
    const createdToday = notifications.filter(
      (item) => item.userId === userId && String(item.createdAt || "").startsWith(today),
    ).length;

    if (createdToday >= dailyLimit) {
      return null;
    }
  }

  const notification = {
    id: generateId("notification"),
    userId,
    type: notificationData.type || NOTIFICATION_TYPES.NEW_RELEASE,
    title: normalizeText(notificationData.title) || "اعلان جدید",
    message: normalizeText(notificationData.message),
    link: notificationData.link || null,
    dedupeKey: notificationData.dedupeKey || null,
    isRead: false,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  notifications.unshift(notification);
  saveNotifications(notifications);
  return notification;
};

const ensureSubscriptionExpiryNotification = (user) => {
  if (!user?.subscriptionExpiresAt || user.subscription === SUBSCRIPTIONS.FREE) {
    return;
  }

  const remainingMs = new Date(user.subscriptionExpiresAt).getTime() - Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (remainingMs > sevenDays) {
    return;
  }

  const dedupeKey = `subscription-expiry:${user.id}:${user.subscriptionExpiresAt}`;
  if (getNotifications().some((item) => item.dedupeKey === dedupeKey)) {
    return;
  }

  const expired = remainingMs <= 0;
  createNotificationSync(user.id, {
    type: NOTIFICATION_TYPES.SUBSCRIPTION,
    title: expired ? "اشتراک شما پایان یافته است" : "اشتراک شما رو به پایان است",
    message: expired
      ? "برای ادامه استفاده از امکانات اشتراکی، طرح خود را تمدید کنید."
      : `اشتراک شما تا ${new Intl.DateTimeFormat("fa-IR").format(new Date(user.subscriptionExpiresAt))} معتبر است.`,
    link: "/settings#subscription",
    dedupeKey,
  });
};

const recalcArtistMonthlyListeners = (artistId) => {
  const artistProfile = getArtistProfileById(artistId);
  if (!artistProfile) {
    return 0;
  }

  const songs = getSongs().filter((song) => song.artistId === artistProfile.id);
  const listeners = songs.reduce((total, song) => total + (Number(song.listeners) || 0), 0);
  return Math.max(listeners, Number(artistProfile.monthlyListeners) || 0);
};

const buildSongPayload = (song) => ({
  ...song,
  artist: getArtistProfileById(song.artistId),
  album: song.albumId ? getAlbumByIdSync(song.albumId) : null,
});

const getArtistEntries = () => {
  const artists = getArtists();
  const users = getUsers();
  const seen = new Set();
  const entries = [];

  artists.forEach((artistProfile) => {
    const linkedUser = artistProfile.userId
      ? users.find((user) => user.id === artistProfile.userId)
      : users.find((user) => user.id === artistProfile.id && user.role === ROLES.ARTIST);

    seen.add(artistProfile.id);
    entries.push({
      ...artistProfile,
      user: linkedUser ? stripPassword(linkedUser) : null,
      songs: getSongs().filter((song) => song.artistId === artistProfile.id).map(buildSongPayload),
      albums: getAlbums().filter((album) => album.artistId === artistProfile.id),
    });
  });

  users
    .filter((user) => user.role === ROLES.ARTIST)
    .filter((user) => !seen.has(user.id) && !artists.some((artist) => artist.userId === user.id))
    .forEach((user) => {
      entries.push({
        id: user.id,
        userId: user.id,
        stageName: user.displayName || user.username,
        genres: [],
        cover: user.avatar || DEFAULT_COVER,
        monthlyListeners: user.totalStreams || 0,
        albumIds: [],
        singleIds: [],
        verificationStatus: user.isVerified ? "approved" : "pending",
        verifiedAt: user.isVerified ? user.createdAt || new Date().toISOString() : null,
        rejectionReason: null,
        user: stripPassword(user),
        songs: [],
        albums: [],
      });
    });

  return entries;
};

const getPrimaryArtistProfileForUser = (userId) => {
  const artistProfile = getArtists().find((artist) => artist.userId === userId || artist.id === userId);
  if (artistProfile) {
    return artistProfile;
  }

  const user = getUserByIdRecord(userId);
  if (user && user.role === ROLES.ARTIST) {
    return getArtistProfileById(user.id);
  }

  return null;
};

const getArtistStatsPayload = (artistId) => {
  const artistProfile = getArtistProfileById(artistId);
  if (!artistProfile) {
    return null;
  }

  const artistSongs = getSongs().filter((song) => song.artistId === artistProfile.id);
  const artistAlbums = getAlbums().filter((album) => album.artistId === artistProfile.id);
  const linkedUser = getArtistUserFromProfile(artistProfile);
  const totalStreams = artistSongs.reduce((total, song) => total + (Number(song.playCount) || 0), 0);
  const monthlyListeners = recalcArtistMonthlyListeners(artistProfile.id);
  const monthlyEvents = getStreamEvents().filter(
    (event) => event.artistId === artistProfile.id && event.month === currentMonthKey(),
  );
  const monthlyStreams =
    monthlyEvents.length || artistSongs.reduce((total, song) => total + (Number(song.monthlyPlayCount) || 0), 0);
  const monthlyUniqueListeners = new Set(monthlyEvents.map((event) => event.userId).filter(Boolean)).size;

  return {
    artistId: artistProfile.id,
    userId: artistProfile.userId || linkedUser?.id || null,
    followersCount: linkedUser?.followers?.length || 0,
    monthlyListeners,
    monthlyUniqueListeners: monthlyUniqueListeners || monthlyListeners,
    monthlyStreams,
    totalStreams,
    songsCount: artistSongs.length,
    albumsCount: artistAlbums.length,
    estimatedEarnings: Number((totalStreams * STREAM_VALUE * 0.7).toFixed(2)),
    estimatedMonthlyEarnings: Number((monthlyStreams * STREAM_VALUE * 0.7).toFixed(2)),
    verified: artistProfile.verificationStatus === "approved" || linkedUser?.isVerified === true,
    updatedAt: new Date().toISOString(),
  };
};

const removeSongFromAlbumsAndArtist = (song) => {
  if (!song) {
    return;
  }

  if (song.albumId) {
    const albums = getAlbums();
    const albumIndex = albums.findIndex((album) => album.id === song.albumId);
    if (albumIndex !== -1) {
      albums[albumIndex] = {
        ...albums[albumIndex],
        trackIds: removeFromArray(albums[albumIndex].trackIds || [], song.id),
        updatedAt: new Date().toISOString(),
      };
      saveAlbums(albums);
    }
  }

  const artistProfile = getArtistProfileById(song.artistId);
  if (artistProfile) {
    upsertArtistProfile({
      ...artistProfile,
      singleIds: removeFromArray(artistProfile.singleIds || [], song.id),
      updatedAt: new Date().toISOString(),
    });
  }

  const playlists = getPlaylists().map((playlist) => ({
    ...playlist,
    songIds: removeFromArray(playlist.songIds || [], song.id),
    updatedAt: playlist.songIds?.includes(song.id) ? new Date().toISOString() : playlist.updatedAt,
  }));
  savePlaylists(playlists);
};

const ensureArtistProfileForUser = (user, artistData = {}) => {
  const profile = getArtistProfileById(user.id) || {
    id: generateId("artist"),
    userId: user.id,
    stageName: user.displayName || user.username,
    genres: [],
    cover: user.avatar || DEFAULT_COVER,
    monthlyListeners: 0,
    albumIds: [],
    singleIds: [],
    verificationStatus: "pending",
    verifiedAt: null,
    rejectionReason: null,
  };

  const nextProfile = {
    ...profile,
    ...artistData,
    userId: user.id,
    cover: artistData.cover || profile.cover || user.avatar || DEFAULT_COVER,
    verificationStatus: artistData.verificationStatus || profile.verificationStatus || "pending",
    updatedAt: new Date().toISOString(),
  };

  upsertArtistProfile(nextProfile);
  return nextProfile;
};

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function login(email, password) {
  await delay();

  try {
    const users = getUsers();
    const normalizedEmail = normalizeEmail(email);
    const user = users.find((item) => normalizeEmail(item.email) === normalizedEmail && item.password === password);

    if (!user) {
      return errorResponse("ایمیل یا رمز عبور اشتباه است", 401);
    }

    const safeUser = stripPassword({
      ...user,
      lastLoginAt: new Date().toISOString(),
    });

    writeValue(STORAGE_KEYS.CURRENT_USER, safeUser);

    return successResponse({
      user: safeUser,
      token: `mock_token_${user.id}_${Date.now()}`,
    });
  } catch (error) {
    return errorResponse("خطا در ورود به سامانه", 500);
  }
}

export async function registerUser(userData) {
  await delay();

  try {
    const users = getUsers();
    const normalizedEmail = normalizeEmail(userData?.email);

    if (!normalizedEmail || !normalizeText(userData?.password)) {
      return errorResponse("ایمیل و رمز عبور الزامی است", 400);
    }

    if (users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
      return errorResponse("این ایمیل قبلاً ثبت شده است", 409);
    }

    const newUser = {
      id: generateId("user"),
      email: normalizedEmail,
      password: userData.password,
      displayName: normalizeText(userData.displayName) || normalizeText(userData.fullName) || "کاربر جدید",
      username: normalizeText(userData.username) || `user_${Date.now().toString(36)}`,
      role: ROLES.LISTENER,
      subscription: SUBSCRIPTIONS.FREE,
      avatar: userData.avatar || DEFAULT_AVATAR,
      birthDate: userData.birthDate || null,
      gender: userData.gender || null,
      bio: userData.bio || "",
      isVerified: false,
      followers: [],
      following: [],
      playlists: [],
      dailyStreams: 0,
      totalStreams: 0,
      notificationSettings: {
        email: true,
        push: true,
        inApp: true,
        dailyLimit: 10,
        ...(userData.notificationSettings || {}),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    return successResponse(stripPassword(newUser));
  } catch (error) {
    return errorResponse("خطا در ثبت‌نام کاربر", 500);
  }
}

export async function registerArtist(artistData) {
  await delay();

  try {
    const users = getUsers();
    const normalizedEmail = normalizeEmail(artistData?.email);

    if (!normalizedEmail || !normalizeText(artistData?.password)) {
      return errorResponse("ایمیل و رمز عبور الزامی است", 400);
    }

    if (users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
      return errorResponse("این ایمیل قبلاً ثبت شده است", 409);
    }

    const newUser = {
      id: generateId("user"),
      email: normalizedEmail,
      password: artistData.password,
      displayName: normalizeText(artistData.displayName) || normalizeText(artistData.stageName) || "هنرمند جدید",
      username: normalizeText(artistData.username) || `artist_${Date.now().toString(36)}`,
      role: ROLES.ARTIST,
      subscription: SUBSCRIPTIONS.GOLD,
      avatar: artistData.avatar || DEFAULT_AVATAR,
      birthDate: artistData.birthDate || null,
      gender: artistData.gender || null,
      bio: artistData.bio || "",
      isVerified: false,
      followers: [],
      following: [],
      playlists: [],
      dailyStreams: 0,
      totalStreams: 0,
      notificationSettings: {
        email: true,
        push: true,
        inApp: true,
        dailyLimit: 10,
        ...(artistData.notificationSettings || {}),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    const artistProfile = ensureArtistProfileForUser(newUser, {
      stageName: normalizeText(artistData.stageName) || newUser.displayName,
      genres: Array.isArray(artistData.genres) ? artistData.genres : [],
      cover: artistData.cover || newUser.avatar || DEFAULT_COVER,
      portfolio: artistData.portfolioFile
        ? {
            name: artistData.portfolioFile.name || "نمونه کار",
            type: artistData.portfolioFile.type || "",
            size: Number(artistData.portfolioFile.size) || 0,
            url: resolveFileUrl(artistData.portfolioFile),
          }
        : null,
      verificationStatus: "pending",
    });

    const supportUsers = users.filter((item) => item.role === ROLES.SUPPORT || item.role === ROLES.ADMIN);
    await Promise.all(
      supportUsers.map((supportUser) =>
        createNotification(supportUser.id, {
          type: NOTIFICATION_TYPES.VERIFICATION,
          title: "درخواست احراز هویت هنرمند",
          message: `${artistProfile.stageName} یک درخواست هنرمندی جدید ثبت کرده است.`,
          link: "/admin/dashboard",
        }),
      ),
    );

    return successResponse({
      ...stripPassword(newUser),
      message: "درخواست ثبت‌نام هنرمند با موفقیت ثبت شد و در انتظار تأیید است",
    });
  } catch (error) {
    return errorResponse("خطا در ثبت‌نام هنرمند", 500);
  }
}

export async function logout() {
  await delay(100, 250);

  try {
    removeValue(STORAGE_KEYS.CURRENT_USER);
    return successResponse({ message: "با موفقیت خارج شدید" });
  } catch (error) {
    return errorResponse("خطا در خروج از حساب", 500);
  }
}

export async function getCurrentUser() {
  await delay(100, 250);

  try {
    const currentUser = getCurrentUserRecord();

    if (!currentUser) {
      return errorResponse("کاربر وارد نشده است", 401);
    }

    return successResponse(stripPassword(currentUser));
  } catch (error) {
    return errorResponse("خطا در دریافت اطلاعات کاربر", 500);
  }
}

export async function forgotPassword(email) {
  await delay();

  try {
    const users = getUsers();
    const normalizedEmail = normalizeEmail(email);
    const user = users.find((item) => normalizeEmail(item.email) === normalizedEmail);

    if (!user) {
      return errorResponse("کاربری با این ایمیل پیدا نشد", 404);
    }

    const resetToken = generateId("reset");
    const resets = getPasswordResets().filter((item) => item.email !== normalizedEmail);
    resets.push({
      id: resetToken,
      email: normalizedEmail,
      token: resetToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    savePasswordResets(resets);

    return successResponse({
      message: "لینک بازیابی رمز عبور ارسال شد",
      email: normalizedEmail,
    });
  } catch (error) {
    return errorResponse("خطا در بازیابی رمز عبور", 500);
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUserById(userId) {
  await delay();

  try {
    const user = getUserByIdRecord(userId);

    if (!user) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    return successResponse(stripPassword(user));
  } catch (error) {
    return errorResponse("خطا در دریافت اطلاعات کاربر", 500);
  }
}

export async function getAllUsers() {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();

    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    return successResponse(getUsers().map(stripPassword));
  } catch (error) {
    return errorResponse("خطا در دریافت لیست کاربران", 500);
  }
}

export async function updateUser(userId, updates) {
  await delay();

  try {
    const users = getUsers();
    const userIndex = users.findIndex((user) => user.id === userId);

    if (userIndex === -1) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    const nextUpdates = { ...updates };
    delete nextUpdates.id;
    delete nextUpdates.password;
    delete nextUpdates.createdAt;
    delete nextUpdates.role;

    if (
      Object.prototype.hasOwnProperty.call(nextUpdates, "avatar")
      && !SUBSCRIPTION_LIMITS[users[userIndex].subscription]?.canUploadAvatar
    ) {
      return errorResponse("کاربران اشتراک پایه امکان تغییر عکس پروفایل را ندارند", 403);
    }

    if (nextUpdates.email) {
      const normalizedEmail = normalizeEmail(nextUpdates.email);
      if (users.some((user, index) => index !== userIndex && normalizeEmail(user.email) === normalizedEmail)) {
        return errorResponse("این ایمیل قبلاً ثبت شده است", 409);
      }
      nextUpdates.email = normalizedEmail;
    }

    users[userIndex] = {
      ...users[userIndex],
      ...nextUpdates,
      updatedAt: new Date().toISOString(),
    };

    saveUsers(users);

    const currentUser = getCurrentUserRecord();
    if (currentUser && currentUser.id === userId) {
      writeValue(STORAGE_KEYS.CURRENT_USER, stripPassword(users[userIndex]));
    }

    return successResponse(stripPassword(users[userIndex]));
  } catch (error) {
    return errorResponse("خطا در به‌روزرسانی اطلاعات کاربر", 500);
  }
}

export async function deleteAccount(userId) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();

    if (!currentUser || currentUser.id !== userId) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    const users = getUsers();
    const user = users.find((item) => item.id === userId);

    if (!user) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    saveUsers(
      users
        .filter((item) => item.id !== userId)
        .map((item) => ({
          ...item,
          followers: removeFromArray(item.followers || [], userId),
          following: removeFromArray(item.following || [], userId),
        })),
    );

    saveArtists(
      getArtists().map((artist) => ({
        ...artist,
        userId: artist.userId === userId ? null : artist.userId,
        followers: removeFromArray(artist.followers || [], userId),
      })),
    );
    savePlaylists(getPlaylists().filter((playlist) => playlist.userId !== userId));
    saveNotifications(getNotifications().filter((notification) => notification.userId !== userId));
    saveTickets(getTickets().filter((ticket) => ticket.userId !== userId));
    savePasswordResets(getPasswordResets().filter((reset) => reset.email !== normalizeEmail(user.email)));
    savePlayHistory(getPlayHistory().filter((entry) => entry.userId !== userId));
    saveStreamEvents(getStreamEvents().filter((entry) => entry.userId !== userId));
    saveSubscriptionPayments(getSubscriptionPayments().filter((payment) => payment.userId !== userId));
    removeValue(STORAGE_KEYS.CURRENT_USER);

    return successResponse({ message: "حساب کاربری با موفقیت حذف شد" });
  } catch (error) {
    return errorResponse("خطا در حذف حساب کاربری", 500);
  }
}

export async function followUser(currentUserId, targetUserId) {
  await delay();

  try {
    if (currentUserId === targetUserId) {
      return errorResponse("نمی‌توانید خودتان را دنبال کنید", 400);
    }

    const users = getUsers();
    const artists = getArtists();
    const currentUserIndex = users.findIndex((user) => user.id === currentUserId);
    const targetUserIndex = users.findIndex((user) => user.id === targetUserId);
    const targetArtistIndex = targetUserIndex === -1
      ? artists.findIndex((artist) => artist.id === targetUserId)
      : -1;

    if (currentUserIndex === -1 || (targetUserIndex === -1 && targetArtistIndex === -1)) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    const currentUser = users[currentUserIndex];

    if ((currentUser.following || []).includes(targetUserId)) {
      return errorResponse("از قبل این کاربر را دنبال می‌کنید", 400);
    }

    currentUser.following = pushUnique(currentUser.following || [], targetUserId);
    currentUser.updatedAt = new Date().toISOString();

    if (targetUserIndex !== -1) {
      users[targetUserIndex].followers = pushUnique(users[targetUserIndex].followers || [], currentUserId);
      users[targetUserIndex].updatedAt = new Date().toISOString();
    } else {
      artists[targetArtistIndex].followers = pushUnique(artists[targetArtistIndex].followers || [], currentUserId);
      artists[targetArtistIndex].updatedAt = new Date().toISOString();
      saveArtists(artists);
    }

    saveUsers(users);

    if (getCurrentUserRecord()?.id === currentUserId) {
      writeValue(STORAGE_KEYS.CURRENT_USER, stripPassword(currentUser));
    }

    return successResponse({
      message: "با موفقیت دنبال شد",
      following: currentUser.following,
    });
  } catch (error) {
    return errorResponse("خطا در دنبال کردن کاربر", 500);
  }
}

export async function unfollowUser(currentUserId, targetUserId) {
  await delay();

  try {
    const users = getUsers();
    const artists = getArtists();
    const currentUserIndex = users.findIndex((user) => user.id === currentUserId);
    const targetUserIndex = users.findIndex((user) => user.id === targetUserId);
    const targetArtistIndex = targetUserIndex === -1
      ? artists.findIndex((artist) => artist.id === targetUserId)
      : -1;

    if (currentUserIndex === -1 || (targetUserIndex === -1 && targetArtistIndex === -1)) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    const currentUser = users[currentUserIndex];

    currentUser.following = removeFromArray(currentUser.following || [], targetUserId);
    currentUser.updatedAt = new Date().toISOString();

    if (targetUserIndex !== -1) {
      users[targetUserIndex].followers = removeFromArray(users[targetUserIndex].followers || [], currentUserId);
      users[targetUserIndex].updatedAt = new Date().toISOString();
    } else {
      artists[targetArtistIndex].followers = removeFromArray(artists[targetArtistIndex].followers || [], currentUserId);
      artists[targetArtistIndex].updatedAt = new Date().toISOString();
      saveArtists(artists);
    }

    saveUsers(users);

    if (getCurrentUserRecord()?.id === currentUserId) {
      writeValue(STORAGE_KEYS.CURRENT_USER, stripPassword(currentUser));
    }

    return successResponse({
      message: "با موفقیت لغو دنبال شد",
      following: currentUser.following,
    });
  } catch (error) {
    return errorResponse("خطا در لغو دنبال کردن", 500);
  }
}

export async function uploadAvatar(userId, file) {
  await delay();

  try {
    const user = getUserByIdRecord(userId);

    if (!user) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    if (!SUBSCRIPTION_LIMITS[user.subscription]?.canUploadAvatar) {
      return errorResponse("کاربران اشتراک پایه امکان تغییر عکس پروفایل را ندارند", 403);
    }

    const avatarUrl = resolveFileUrl(file, `mock-avatar-${generateId("avatar")}`);
    return updateUser(userId, {
      avatar: avatarUrl || DEFAULT_AVATAR,
    });
  } catch (error) {
    return errorResponse("خطا در بارگذاری تصویر پروفایل", 500);
  }
}

// ---------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------

export async function getArtistById(artistId) {
  await delay();

  try {
    const artistProfile = getArtistProfileById(artistId);

    if (!artistProfile) {
      return errorResponse("هنرمند پیدا نشد", 404);
    }

    const linkedUser = getArtistUserFromProfile(artistProfile);

    return successResponse({
      ...artistProfile,
      user: linkedUser ? stripPassword(linkedUser) : null,
      songs: getSongs().filter((song) => song.artistId === artistProfile.id).map(buildSongPayload),
      albums: getAlbums().filter((album) => album.artistId === artistProfile.id),
      stats: getArtistStatsPayload(artistProfile.id),
    });
  } catch (error) {
    return errorResponse("خطا در دریافت اطلاعات هنرمند", 500);
  }
}

export async function getAllArtists() {
  await delay();

  try {
    return successResponse(getArtistEntries());
  } catch (error) {
    return errorResponse("خطا در دریافت لیست هنرمندان", 500);
  }
}

export async function getPendingArtists() {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();

    if (!isAdminOrSupport(currentUser)) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    const pendingArtists = getArtistEntries().filter((artist) => artist.verificationStatus === "pending");
    return successResponse(pendingArtists);
  } catch (error) {
    return errorResponse("خطا در دریافت هنرمندان در انتظار تأیید", 500);
  }
}

export async function verifyArtist(artistId, status, reason = "") {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();

    if (!isAdminOrSupport(currentUser)) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }
    if (!["approved", "rejected"].includes(status)) {
      return errorResponse("وضعیت درخواست معتبر نیست", 400);
    }
    if (status === "rejected" && !normalizeText(reason)) {
      return errorResponse("ذکر دلیل رد درخواست الزامی است", 400);
    }

    const users = getUsers();
    const artistUserIndex = users.findIndex((user) => user.id === artistId && user.role === ROLES.ARTIST);
    const artistProfile = getArtistProfileById(artistId);

    if (artistUserIndex === -1 && !artistProfile) {
      return errorResponse("هنرمند پیدا نشد", 404);
    }

    const nextStatus = status === "approved" ? "approved" : "rejected";
    const resolvedArtistProfile = artistProfile || getPrimaryArtistProfileForUser(artistId);

    if (resolvedArtistProfile) {
      upsertArtistProfile({
        ...resolvedArtistProfile,
        verificationStatus: nextStatus,
        verifiedAt: nextStatus === "approved" ? new Date().toISOString() : resolvedArtistProfile.verifiedAt || null,
        verifiedBy: currentUser.id,
        rejectionReason: nextStatus === "rejected" ? reason : null,
        rejectedAt: nextStatus === "rejected" ? new Date().toISOString() : null,
        rejectedBy: nextStatus === "rejected" ? currentUser.id : null,
        updatedAt: new Date().toISOString(),
      });
    }

    if (artistUserIndex !== -1) {
      users[artistUserIndex] = {
        ...users[artistUserIndex],
        isVerified: nextStatus === "approved",
        updatedAt: new Date().toISOString(),
      };
    }

    if (resolvedArtistProfile?.userId) {
      const linkedUserIndex = users.findIndex((user) => user.id === resolvedArtistProfile.userId);
      if (linkedUserIndex !== -1) {
        users[linkedUserIndex] = {
          ...users[linkedUserIndex],
          isVerified: nextStatus === "approved",
          updatedAt: new Date().toISOString(),
        };
      }
    }

    saveUsers(users);

    if (resolvedArtistProfile?.userId) {
      await createNotification(resolvedArtistProfile.userId, {
        type: NOTIFICATION_TYPES.VERIFICATION,
        title: nextStatus === "approved" ? "تأیید هنرمند" : "رد هنرمند",
        message:
          nextStatus === "approved"
            ? "پروفایل هنرمند شما با موفقیت تأیید شد."
            : reason || "درخواست هنرمندی شما رد شد.",
        link: "/artist/dashboard",
      });
    }

    return successResponse({
      message: nextStatus === "approved" ? "هنرمند با موفقیت تأیید شد" : "هنرمند رد شد",
      artist: resolvedArtistProfile || null,
    });
  } catch (error) {
    return errorResponse("خطا در تأیید هنرمند", 500);
  }
}

export async function getArtistStats(artistId) {
  await delay();

  try {
    const stats = getArtistStatsPayload(artistId);

    if (!stats) {
      return errorResponse("هنرمند پیدا نشد", 404);
    }

    return successResponse(stats);
  } catch (error) {
    return errorResponse("خطا در دریافت آمار هنرمند", 500);
  }
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

export async function getAllSongs(options = {}) {
  await delay();

  try {
    let songs = getSongs();

    if (options.genre) {
      songs = songs.filter((song) => song.genre === options.genre);
    }

    if (options.artistId) {
      songs = songs.filter((song) => song.artistId === options.artistId);
    }

    if (options.albumId) {
      songs = songs.filter((song) => song.albumId === options.albumId);
    }

    if (options.query) {
      const query = normalizeText(options.query).toLowerCase();
      songs = songs.filter((song) => song.title.toLowerCase().includes(query));
    }

    if (options.sortBy === "playCount") {
      songs = [...songs].sort((left, right) => (Number(right.playCount) || 0) - (Number(left.playCount) || 0));
    } else if (options.sortBy === "releaseDate") {
      songs = [...songs].sort((left, right) => new Date(right.releaseDate || 0) - new Date(left.releaseDate || 0));
    } else if (options.sortBy === "title") {
      songs = [...songs].sort((left, right) => left.title.localeCompare(right.title, "fa"));
    }

    if (typeof options.offset === "number") {
      songs = songs.slice(options.offset);
    }

    if (options.limit) {
      songs = songs.slice(0, options.limit);
    }

    return successResponse(songs.map(buildSongPayload));
  } catch (error) {
    return errorResponse("خطا در دریافت آهنگ‌ها", 500);
  }
}

export async function getSongById(songId) {
  await delay();

  try {
    const song = getSongByIdSync(songId);

    if (!song) {
      return errorResponse("آهنگ پیدا نشد", 404);
    }

    return successResponse(buildSongPayload(song));
  } catch (error) {
    return errorResponse("خطا در دریافت آهنگ", 500);
  }
}

export async function getSongsByArtist(artistId) {
  await delay();

  try {
    return successResponse(getSongs().filter((song) => song.artistId === artistId).map(buildSongPayload));
  } catch (error) {
    return errorResponse("خطا در دریافت آهنگ‌های هنرمند", 500);
  }
}

export async function getSongsByAlbum(albumId) {
  await delay();

  try {
    return successResponse(getSongs().filter((song) => song.albumId === albumId).map(buildSongPayload));
  } catch (error) {
    return errorResponse("خطا در دریافت آهنگ‌های آلبوم", 500);
  }
}

export async function searchSongs(query) {
  await delay();

  try {
    const normalizedQuery = normalizeText(query).toLowerCase();
    const songs = getSongs().filter((song) => {
      const artist = getArtistProfileById(song.artistId);
      const artistName = artist?.stageName || artist?.user?.displayName || "";

      return [song.title, song.genre, artistName].join(" ").toLowerCase().includes(normalizedQuery);
    });

    return successResponse(songs.map(buildSongPayload));
  } catch (error) {
    return errorResponse("خطا در جستجوی آهنگ‌ها", 500);
  }
}

export async function incrementPlayCount(songId) {
  await delay(100, 220);

  try {
    const songs = getSongs();
    const songIndex = songs.findIndex((song) => song.id === songId);

    if (songIndex === -1) {
      return errorResponse("آهنگ پیدا نشد", 404);
    }

    songs[songIndex] = {
      ...songs[songIndex],
      playCount: (Number(songs[songIndex].playCount) || 0) + 1,
      monthlyPlayCount: (Number(songs[songIndex].monthlyPlayCount) || 0) + 1,
      listeners: Math.max(Number(songs[songIndex].listeners) || 0, 1),
      updatedAt: new Date().toISOString(),
    };

    saveSongs(songs);

    const currentUser = getCurrentUserRecord();
    const playedAt = new Date().toISOString();
    const history = getPlayHistory();
    history.unshift({ id: generateId("play"), userId: currentUser?.id || null, songId, playedAt });
    savePlayHistory(history.slice(0, 500));

    const streamEvents = getStreamEvents();
    streamEvents.push({
      id: generateId("stream"),
      userId: currentUser?.id || null,
      artistId: songs[songIndex].artistId,
      songId,
      playedAt,
      month: playedAt.slice(0, 7),
    });
    saveStreamEvents(streamEvents.slice(-5000));

    const artistProfile = getArtistProfileById(songs[songIndex].artistId);
    if (artistProfile) {
      upsertArtistProfile({
        ...artistProfile,
        monthlyListeners: recalcArtistMonthlyListeners(artistProfile.id),
        updatedAt: new Date().toISOString(),
      });

      const linkedUser = getArtistUserFromProfile(artistProfile);
      if (linkedUser) {
        const users = getUsers();
        const userIndex = users.findIndex((user) => user.id === linkedUser.id);
        if (userIndex !== -1) {
          users[userIndex] = {
            ...users[userIndex],
            totalStreams: (Number(users[userIndex].totalStreams) || 0) + 1,
            dailyStreams: (Number(users[userIndex].dailyStreams) || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          saveUsers(users);
        }
      }
    }

    return successResponse(buildSongPayload(songs[songIndex]));
  } catch (error) {
    return errorResponse("خطا در افزایش تعداد پخش", 500);
  }
}

export async function getTrendingSongs(limit = 10) {
  return getAllSongs({ sortBy: "playCount", limit });
}

export async function getRecentlyListenedPlaylists(userId, limit = 4) {
  await delay(100, 220);

  try {
    const history = getPlayHistory().filter((item) => item.userId === userId);
    const rank = new Map(history.map((item, index) => [item.songId, index]));
    const playlists = getPlaylists()
      .filter((playlist) => playlist.userId === userId)
      .map((playlist) => {
        const ranks = (playlist.songIds || []).filter((id) => rank.has(id)).map((id) => rank.get(id));
        return { playlist, rank: ranks.length ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER };
      })
      .sort((left, right) => left.rank - right.rank)
      .map(({ playlist }) => playlist)
      .slice(0, limit);

    return successResponse(playlists);
  } catch (error) {
    return errorResponse("خطا در دریافت پلی‌لیست‌های اخیر", 500);
  }
}

export async function getNewReleases(limit = 10) {
  await delay();

  try {
    const songs = [...getSongs()]
      .sort((left, right) => new Date(right.releaseDate || 0) - new Date(left.releaseDate || 0))
      .slice(0, limit);

    return successResponse(songs.map(buildSongPayload));
  } catch (error) {
    return errorResponse("خطا در دریافت آهنگ‌های جدید", 500);
  }
}

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------

export async function getAllAlbums() {
  await delay();

  try {
    return successResponse(getAlbums());
  } catch (error) {
    return errorResponse("خطا در دریافت آلبوم‌ها", 500);
  }
}

export async function getAlbumById(albumId) {
  await delay();

  try {
    const album = getAlbumByIdSync(albumId);

    if (!album) {
      return errorResponse("آلبوم پیدا نشد", 404);
    }

    return successResponse({
      ...album,
      songs: getSongs().filter((song) => song.albumId === album.id).map(buildSongPayload),
    });
  } catch (error) {
    return errorResponse("خطا در دریافت آلبوم", 500);
  }
}

export async function getAlbumsByArtist(artistId) {
  await delay();

  try {
    return successResponse(getAlbums().filter((album) => album.artistId === artistId));
  } catch (error) {
    return errorResponse("خطا در دریافت آلبوم‌های هنرمند", 500);
  }
}

export async function getLatestAlbums(limit = 10) {
  await delay();

  try {
    const albums = [...getAlbums()]
      .sort((left, right) => new Date(right.releaseDate || 0) - new Date(left.releaseDate || 0))
      .slice(0, limit);

    return successResponse(albums);
  } catch (error) {
    return errorResponse("خطا در دریافت آخرین آلبوم‌ها", 500);
  }
}

export async function createAlbum(albumData, coverFile) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    const artistId = normalizeText(albumData?.artistId) || getPrimaryArtistProfileForUser(currentUser?.id || "")?.id;

    if (!artistId) {
      return errorResponse("شناسه هنرمند معتبر نیست", 400);
    }

    const artistProfile = getArtistProfileById(artistId);
    if (!artistProfile) {
      return errorResponse("هنرمند پیدا نشد", 404);
    }
    if (!canManageArtist(currentUser, artistProfile)) {
      return errorResponse("شما اجازه مدیریت آثار این هنرمند را ندارید", 403);
    }
    if (!isVerifiedArtist(currentUser, artistProfile)) {
      return errorResponse("انتشار اثر فقط پس از تأیید حساب هنرمند امکان‌پذیر است", 403);
    }

    const albums = getAlbums();
    const nextAlbum = {
      id: generateId("album"),
      title: normalizeText(albumData?.title) || "آلبوم جدید",
      artistId,
      cover: resolveFileUrl(coverFile, albumData?.cover || DEFAULT_COVER),
      releaseDate: albumData?.releaseDate || new Date().toISOString().slice(0, 10),
      trackIds: Array.isArray(albumData?.trackIds) ? albumData.trackIds : [],
      genre: albumData?.genre || "",
      description: albumData?.description || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    albums.push(nextAlbum);
    saveAlbums(albums);

    upsertArtistProfile({
      ...artistProfile,
      albumIds: pushUnique(artistProfile.albumIds || [], nextAlbum.id),
      updatedAt: new Date().toISOString(),
    });

    return successResponse(nextAlbum);
  } catch (error) {
    return errorResponse("خطا در ایجاد آلبوم", 500);
  }
}

export async function updateAlbum(albumId, updates, coverFile = null) {
  await delay();

  try {
    const albums = getAlbums();
    const albumIndex = albums.findIndex((album) => album.id === albumId);

    if (albumIndex === -1) {
      return errorResponse("آلبوم پیدا نشد", 404);
    }

    const currentUser = getCurrentUserRecord();
    const artistProfile = getArtistProfileById(albums[albumIndex].artistId);
    if (!canManageArtist(currentUser, artistProfile) || !isVerifiedArtist(currentUser, artistProfile)) {
      return errorResponse("شما اجازه ویرایش این آلبوم را ندارید", 403);
    }

    const nextUpdates = { ...updates };
    delete nextUpdates.id;
    delete nextUpdates.artistId;
    if (coverFile) {
      nextUpdates.cover = resolveFileUrl(coverFile, albums[albumIndex].cover || DEFAULT_COVER);
    }

    albums[albumIndex] = {
      ...albums[albumIndex],
      ...nextUpdates,
      updatedAt: new Date().toISOString(),
    };

    saveAlbums(albums);
    return successResponse(albums[albumIndex]);
  } catch (error) {
    return errorResponse("خطا در ویرایش آلبوم", 500);
  }
}

export async function deleteAlbum(albumId) {
  await delay();

  try {
    const albums = getAlbums();
    const album = albums.find((item) => item.id === albumId);

    if (!album) {
      return errorResponse("آلبوم پیدا نشد", 404);
    }

    const currentUser = getCurrentUserRecord();
    const artistProfile = getArtistProfileById(album.artistId);
    if (!canManageArtist(currentUser, artistProfile) || !isVerifiedArtist(currentUser, artistProfile)) {
      return errorResponse("شما اجازه حذف این آلبوم را ندارید", 403);
    }

    saveAlbums(albums.filter((item) => item.id !== albumId));

    const convertedSongIds = getSongs()
      .filter((song) => song.albumId === albumId)
      .map((song) => song.id);
    const songs = getSongs().map((song) =>
      song.albumId === albumId
        ? {
            ...song,
            albumId: null,
            isSingle: true,
            updatedAt: new Date().toISOString(),
          }
        : song,
    );
    saveSongs(songs);

    if (artistProfile) {
      upsertArtistProfile({
        ...artistProfile,
        albumIds: removeFromArray(artistProfile.albumIds || [], albumId),
        singleIds: convertedSongIds.reduce(
          (singleIds, songId) => pushUnique(singleIds, songId),
          artistProfile.singleIds || [],
        ),
        updatedAt: new Date().toISOString(),
      });
    }

    return successResponse({ message: "آلبوم حذف شد" });
  } catch (error) {
    return errorResponse("خطا در حذف آلبوم", 500);
  }
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export async function getUserPlaylists(userId) {
  await delay();

  try {
    return successResponse(getPlaylists().filter((playlist) => playlist.userId === userId));
  } catch (error) {
    return errorResponse("خطا در دریافت پلی‌لیست‌ها", 500);
  }
}

export async function getPlaylistById(playlistId) {
  await delay();

  try {
    const playlist = getPlaylistByIdSync(playlistId);

    if (!playlist) {
      return errorResponse("پلی‌لیست پیدا نشد", 404);
    }

    return successResponse({
      ...playlist,
      songs: (playlist.songIds || []).map((songId) => getSongByIdSync(songId)).filter(Boolean).map(buildSongPayload),
    });
  } catch (error) {
    return errorResponse("خطا در دریافت پلی‌لیست", 500);
  }
}

export async function canCreatePlaylist(userId) {
  await delay(100, 220);

  try {
    const user = getUserByIdRecord(userId);

    if (!user) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    const limit = getSubscriptionLimit(user.subscription);
    const currentCount = getPlaylists().filter((playlist) => playlist.userId === userId).length;

    return successResponse({
      allowed: currentCount < limit,
      limit,
      currentCount,
      remaining: Math.max(limit - currentCount, 0),
      subscription: user.subscription,
    });
  } catch (error) {
    return errorResponse("خطا در بررسی محدودیت پلی‌لیست", 500);
  }
}

export async function createPlaylist(userId, name) {
  await delay();

  try {
    const user = getUserByIdRecord(userId);
    if (!user) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    const limitCheck = await canCreatePlaylist(userId);
    if (!limitCheck.success || !limitCheck.data.allowed) {
      return errorResponse("به سقف تعداد پلی‌لیست‌های مجاز رسیده‌اید", 403);
    }

    const playlists = getPlaylists();
    const playlist = {
      id: generateId("playlist"),
      name: normalizeText(name) || "پلی‌لیست جدید",
      userId,
      songIds: [],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    playlists.push(playlist);
    savePlaylists(playlists);

    const users = getUsers();
    const userIndex = users.findIndex((item) => item.id === userId);
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        playlists: pushUnique(users[userIndex].playlists || [], playlist.id),
        updatedAt: new Date().toISOString(),
      };
      saveUsers(users);
    }

    return successResponse(playlist);
  } catch (error) {
    return errorResponse("خطا در ایجاد پلی‌لیست", 500);
  }
}

export async function renamePlaylist(playlistId, newName) {
  await delay();

  try {
    const playlists = getPlaylists();
    const playlistIndex = playlists.findIndex((playlist) => playlist.id === playlistId);

    if (playlistIndex === -1) {
      return errorResponse("پلی‌لیست پیدا نشد", 404);
    }

    playlists[playlistIndex] = {
      ...playlists[playlistIndex],
      name: normalizeText(newName) || playlists[playlistIndex].name,
      updatedAt: new Date().toISOString(),
    };

    savePlaylists(playlists);
    return successResponse(playlists[playlistIndex]);
  } catch (error) {
    return errorResponse("خطا در تغییر نام پلی‌لیست", 500);
  }
}

export async function deletePlaylist(playlistId) {
  await delay();

  try {
    const playlist = getPlaylistByIdSync(playlistId);
    if (!playlist) {
      return errorResponse("پلی‌لیست پیدا نشد", 404);
    }

    savePlaylists(getPlaylists().filter((item) => item.id !== playlistId));

    const users = getUsers();
    const userIndex = users.findIndex((user) => user.id === playlist.userId);
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        playlists: removeFromArray(users[userIndex].playlists || [], playlistId),
        updatedAt: new Date().toISOString(),
      };
      saveUsers(users);
    }

    return successResponse({ message: "پلی‌لیست حذف شد" });
  } catch (error) {
    return errorResponse("خطا در حذف پلی‌لیست", 500);
  }
}

export async function addSongToPlaylist(playlistId, songId) {
  await delay();

  try {
    const playlists = getPlaylists();
    const playlistIndex = playlists.findIndex((playlist) => playlist.id === playlistId);

    if (playlistIndex === -1) {
      return errorResponse("پلی‌لیست پیدا نشد", 404);
    }

    if (!getSongByIdSync(songId)) {
      return errorResponse("آهنگ پیدا نشد", 404);
    }

    const songIds = playlists[playlistIndex].songIds || [];
    if (songIds.includes(songId)) {
      return errorResponse("این آهنگ قبلاً به پلی‌لیست اضافه شده است", 400);
    }

    playlists[playlistIndex] = {
      ...playlists[playlistIndex],
      songIds: [...songIds, songId],
      updatedAt: new Date().toISOString(),
    };
    savePlaylists(playlists);

    return successResponse(playlists[playlistIndex]);
  } catch (error) {
    return errorResponse("خطا در افزودن آهنگ به پلی‌لیست", 500);
  }
}

export async function removeSongFromPlaylist(playlistId, songId) {
  await delay();

  try {
    const playlists = getPlaylists();
    const playlistIndex = playlists.findIndex((playlist) => playlist.id === playlistId);

    if (playlistIndex === -1) {
      return errorResponse("پلی‌لیست پیدا نشد", 404);
    }

    playlists[playlistIndex] = {
      ...playlists[playlistIndex],
      songIds: removeFromArray(playlists[playlistIndex].songIds || [], songId),
      updatedAt: new Date().toISOString(),
    };
    savePlaylists(playlists);

    return successResponse(playlists[playlistIndex]);
  } catch (error) {
    return errorResponse("خطا در حذف آهنگ از پلی‌لیست", 500);
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getUserNotifications(userId) {
  await delay();

  try {
    const user = getUserByIdRecord(userId);

    if (!user) {
      return errorResponse("کاربر پیدا نشد", 404);
    }

    if (user.notificationSettings?.inApp === false) {
      return successResponse([]);
    }

    ensureSubscriptionExpiryNotification(user);
    const notifications = getNotifications()
      .filter((notification) => notification.userId === userId)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    return successResponse(notifications);
  } catch (error) {
    return errorResponse("خطا در دریافت اعلانات", 500);
  }
}

export async function markNotificationAsRead(notificationId) {
  await delay(100, 220);

  try {
    const notifications = getNotifications();
    const index = notifications.findIndex((notification) => notification.id === notificationId);

    if (index === -1) {
      return errorResponse("اعلان پیدا نشد", 404);
    }

    notifications[index] = {
      ...notifications[index],
      isRead: true,
      readAt: new Date().toISOString(),
    };
    saveNotifications(notifications);

    return successResponse(notifications[index]);
  } catch (error) {
    return errorResponse("خطا در خواندن اعلان", 500);
  }
}

export async function markAllNotificationsAsRead(userId) {
  await delay();

  try {
    const notifications = getNotifications();
    const nextNotifications = notifications.map((notification) =>
      notification.userId === userId
        ? {
            ...notification,
            isRead: true,
            readAt: new Date().toISOString(),
          }
        : notification,
    );
    saveNotifications(nextNotifications);

    return successResponse({
      message: "تمام اعلانات خوانده شدند",
      updatedCount: nextNotifications.filter((notification) => notification.userId === userId).length,
    });
  } catch (error) {
    return errorResponse("خطا در خوانده‌سازی همه اعلانات", 500);
  }
}

export async function deleteNotification(notificationId) {
  await delay();

  try {
    const notification = getNotificationByIdSync(notificationId);

    if (!notification) {
      return errorResponse("اعلان پیدا نشد", 404);
    }

    saveNotifications(getNotifications().filter((item) => item.id !== notificationId));
    return successResponse({ message: "اعلان حذف شد" });
  } catch (error) {
    return errorResponse("خطا در حذف اعلان", 500);
  }
}

export async function createNotification(userId, notificationData) {
  await delay(100, 220);

  try {
    return successResponse(createNotificationSync(userId, notificationData || {}));
  } catch (error) {
    return errorResponse("خطا در ایجاد اعلان", 500);
  }
}

// ---------------------------------------------------------------------------
// Tickets and Finances
// ---------------------------------------------------------------------------

export async function getAllTickets() {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();

    if (!isAdminOrSupport(currentUser)) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    return successResponse(getTickets().map(buildTicketPayload));
  } catch (error) {
    return errorResponse("خطا در دریافت تیکت‌ها", 500);
  }
}

export async function getTicketById(ticketId) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();

    const ticket = getTicketByIdSync(ticketId);

    if (!ticket) {
      return errorResponse("تیکت پیدا نشد", 404);
    }
    if (!currentUser || (ticket.userId !== currentUser.id && !isAdminOrSupport(currentUser))) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    return successResponse(buildTicketPayload(ticket));
  } catch (error) {
    return errorResponse("خطا در دریافت تیکت", 500);
  }
}

export async function getUserTickets(userId) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!currentUser || (currentUser.id !== userId && !isAdminOrSupport(currentUser))) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    return successResponse(
      getTickets()
        .filter((ticket) => ticket.userId === userId)
        .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
        .map(buildTicketPayload),
    );
  } catch (error) {
    return errorResponse("خطا در دریافت تیکت‌های کاربر", 500);
  }
}

export async function createTicket(userId, subject, message) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!currentUser) {
      return errorResponse("برای ثبت تیکت ابتدا وارد حساب شوید", 401);
    }
    if (currentUser.id !== userId && !isAdminOrSupport(currentUser)) {
      return errorResponse("امکان ثبت تیکت برای کاربر دیگر وجود ندارد", 403);
    }

    const user = getUserByIdRecord(userId);
    if (!user) {
      return errorResponse("کاربر پیدا نشد", 404);
    }
    if (!normalizeText(subject) || !normalizeText(message)) {
      return errorResponse("موضوع و متن تیکت الزامی است", 400);
    }

    const ticket = {
      id: generateId("ticket"),
      userId,
      subject: normalizeText(subject) || "بدون عنوان",
      message: normalizeText(message) || "",
      status: "open",
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tickets = getTickets();
    tickets.push(ticket);
    saveTickets(tickets);

    const supportUsers = getUsers().filter((item) => item.role === ROLES.SUPPORT || item.role === ROLES.ADMIN);
    await Promise.all(
      supportUsers.map((supportUser) =>
        createNotification(supportUser.id, {
          type: NOTIFICATION_TYPES.TICKET,
          title: "تیکت جدید",
          message: `${user.displayName || user.username || "یک کاربر"} یک تیکت جدید ثبت کرده است.`,
          link: "/admin/dashboard",
        }),
      ),
    );

    return successResponse(ticket);
  } catch (error) {
    return errorResponse("خطا در ایجاد تیکت", 500);
  }
}

export async function replyToTicket(ticketId, reply) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!isAdminOrSupport(currentUser)) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    const tickets = getTickets();
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === ticketId);

    if (ticketIndex === -1) {
      return errorResponse("تیکت پیدا نشد", 404);
    }
    if (!normalizeText(reply)) {
      return errorResponse("متن پاسخ نمی‌تواند خالی باشد", 400);
    }

    const replyItem = {
      id: generateId("reply"),
      message: normalizeText(reply) || "",
      senderId: currentUser.id,
      senderRole: currentUser.role,
      createdAt: new Date().toISOString(),
    };

    tickets[ticketIndex] = {
      ...tickets[ticketIndex],
      replies: [...(tickets[ticketIndex].replies || []), replyItem],
      status: "answered",
      updatedAt: new Date().toISOString(),
    };
    saveTickets(tickets);

    await createNotification(tickets[ticketIndex].userId, {
      type: NOTIFICATION_TYPES.TICKET,
      title: "پاسخ به تیکت",
      message: replyItem.message || "یک پاسخ جدید برای تیکت شما ثبت شد.",
      link: "/notifications",
    });

    return successResponse(tickets[ticketIndex]);
  } catch (error) {
    return errorResponse("خطا در پاسخ به تیکت", 500);
  }
}

export async function closeTicket(ticketId) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!isAdminOrSupport(currentUser)) {
      return errorResponse("دسترسی غیرمجاز", 403);
    }

    const tickets = getTickets();
    const ticketIndex = tickets.findIndex((ticket) => ticket.id === ticketId);

    if (ticketIndex === -1) {
      return errorResponse("تیکت پیدا نشد", 404);
    }

    tickets[ticketIndex] = {
      ...tickets[ticketIndex],
      status: "closed",
      closedAt: new Date().toISOString(),
      closedBy: currentUser.id,
      updatedAt: new Date().toISOString(),
    };
    saveTickets(tickets);

    return successResponse(tickets[ticketIndex]);
  } catch (error) {
    return errorResponse("خطا در بستن تیکت", 500);
  }
}

export async function getMonthlyFinancialReport() {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!isAdmin(currentUser)) {
      return errorResponse("دسترسی گزارش مالی فقط برای مدیر سامانه مجاز است", 403);
    }

    const songs = getSongs();
    const month = currentMonthKey();
    const events = getStreamEvents().filter((event) => event.month === month);
    const totalStreams = events.length || songs.reduce((total, song) => total + (Number(song.monthlyPlayCount) || 0), 0);
    const streamRevenue = Number((totalStreams * STREAM_VALUE).toFixed(2));
    const subscriptionPayments = getSubscriptionPayments().filter(
      (payment) => payment.month === month && payment.status === "paid",
    );
    const subscriptionRevenue = Number(
      subscriptionPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0).toFixed(2),
    );
    const subscriptionRevenueByPlan = {
      silver: Number(
        subscriptionPayments
          .filter((payment) => payment.plan === SUBSCRIPTIONS.SILVER)
          .reduce((total, payment) => total + Number(payment.amount || 0), 0)
          .toFixed(2),
      ),
      gold: Number(
        subscriptionPayments
          .filter((payment) => payment.plan === SUBSCRIPTIONS.GOLD)
          .reduce((total, payment) => total + Number(payment.amount || 0), 0)
          .toFixed(2),
      ),
    };
    const artistPayouts = Number((streamRevenue * 0.7).toFixed(2));
    const platformRevenue = Number((streamRevenue + subscriptionRevenue - artistPayouts).toFixed(2));

    getArtists()
      .filter((artist) => artist.userId)
      .forEach((artist) => {
        const stats = getArtistStatsPayload(artist.id);
        const amount = Number(stats?.estimatedMonthlyEarnings || 0);

        createNotificationSync(artist.userId, {
          type: NOTIFICATION_TYPES.FINANCIAL,
          title: "محاسبات مالی ماهانه آماده شد",
          message: `گزارش ماه ${month} آماده است. درآمد تخمینی شما ${amount.toLocaleString("fa-IR")} است.`,
          link: "/artist/dashboard",
          dedupeKey: `financial-report:${month}:${artist.id}`,
        });
      });

    return successResponse({
      month,
      totalStreams,
      streamRevenue,
      subscriptionRevenue,
      subscriptionSalesCount: subscriptionPayments.length,
      subscriptionRevenueByPlan,
      artistPayouts,
      platformRevenue,
      settledPayments: getArtistPayments().filter((payment) => payment.month === month),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse("خطا در تولید گزارش مالی", 500);
  }
}

export async function settleArtistPayment(artistId) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!isAdmin(currentUser)) {
      return errorResponse("تسویه حساب فقط توسط مدیر سامانه انجام می‌شود", 403);
    }

    const artistProfile = getArtistProfileById(artistId);
    if (!artistProfile) {
      return errorResponse("هنرمند پیدا نشد", 404);
    }

    const month = currentMonthKey();
    const payments = getArtistPayments();
    const existingPayment = payments.find(
      (payment) => payment.artistId === artistProfile.id && payment.month === month && payment.status === "settled",
    );
    if (existingPayment) {
      return errorResponse("تسویه این هنرمند برای ماه جاری قبلاً ثبت شده است", 409);
    }

    const stats = getArtistStatsPayload(artistProfile.id);
    const amount = Number((stats.estimatedMonthlyEarnings || 0).toFixed(2));

    const payment = {
      id: generateId("payment"),
      artistId: artistProfile.id,
      userId: artistProfile.userId || null,
      amount,
      status: "settled",
      month,
      settledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    payments.push(payment);
    saveArtistPayments(payments);

    if (artistProfile.userId) {
      await createNotification(artistProfile.userId, {
        type: NOTIFICATION_TYPES.FINANCIAL,
        title: "تسویه حساب انجام شد",
        message: `مبلغ ${amount.toLocaleString("fa-IR")} برای شما تسویه شد.`,
        link: "/artist/dashboard",
      });
    }

    return successResponse(payment);
  } catch (error) {
    return errorResponse("خطا در تسویه حساب هنرمند", 500);
  }
}

export async function updateSubscriptionPrices(silverPrice, goldPrice) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!isAdmin(currentUser)) {
      return errorResponse("تغییر قیمت فقط برای مدیر سامانه مجاز است", 403);
    }

    const silver = Number(silverPrice);
    const gold = Number(goldPrice);
    if (!Number.isFinite(silver) || !Number.isFinite(gold) || silver <= 0 || gold <= 0) {
      return errorResponse("قیمت اشتراک‌ها باید عددی مثبت باشد", 400);
    }

    const nextPrices = {
      silver,
      gold,
      updatedAt: new Date().toISOString(),
    };

    saveSubscriptionPrices(nextPrices);
    return successResponse(nextPrices);
  } catch (error) {
    return errorResponse("خطا در به‌روزرسانی قیمت اشتراک‌ها", 500);
  }
}

export async function getSystemStats() {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!isAdmin(currentUser)) {
      return errorResponse("دسترسی آمار سامانه فقط برای مدیر مجاز است", 403);
    }

    const users = getUsers();
    const songs = getSongs();
    const albums = getAlbums();
    const playlists = getPlaylists();
    const notifications = getNotifications();
    const tickets = getTickets();
    const prices = getSubscriptionPrices();
    const totalStreams = songs.reduce((total, song) => total + (Number(song.playCount) || 0), 0);

    return successResponse({
      usersCount: users.length,
      listenersCount: users.filter((user) => user.role === ROLES.LISTENER).length,
      artistsCount: users.filter((user) => user.role === ROLES.ARTIST).length,
      adminsCount: users.filter((user) => user.role === ROLES.ADMIN).length,
      supportCount: users.filter((user) => user.role === ROLES.SUPPORT).length,
      songsCount: songs.length,
      albumsCount: albums.length,
      playlistsCount: playlists.length,
      unreadNotificationsCount: notifications.filter((notification) => !notification.isRead).length,
      openTicketsCount: tickets.filter((ticket) => ticket.status !== "closed").length,
      pendingArtistsCount: getArtistEntries().filter((artist) => artist.verificationStatus !== "approved").length,
      totalStreams,
      estimatedRevenue: Number((totalStreams * STREAM_VALUE).toFixed(2)),
      subscriptionPrices: prices,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse("خطا در دریافت آمار سیستم", 500);
  }
}

export async function getSubscriptionPricing() {
  await delay(100, 220);
  return successResponse(getSubscriptionPrices());
}

export async function purchaseSubscription(userId, plan, paymentData = {}) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    if (!currentUser || currentUser.id !== userId) {
      return errorResponse("برای تغییر اشتراک وارد حساب خود شوید", 403);
    }
    if (![SUBSCRIPTIONS.FREE, SUBSCRIPTIONS.SILVER, SUBSCRIPTIONS.GOLD].includes(plan)) {
      return errorResponse("طرح اشتراک معتبر نیست", 400);
    }

    const prices = getSubscriptionPrices();
    const amount = plan === SUBSCRIPTIONS.FREE ? 0 : Number(prices[plan] || 0);
    const paidAt = new Date().toISOString();
    const expiresAt =
      plan === SUBSCRIPTIONS.FREE
        ? null
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const payment = {
      id: generateId("subscription_payment"),
      userId,
      plan,
      amount,
      status: "paid",
      cardLast4: normalizeText(paymentData.cardNumber).replace(/\D/g, "").slice(-4) || "0000",
      paidAt,
      month: paidAt.slice(0, 7),
    };
    const payments = getSubscriptionPayments();
    payments.push(payment);
    saveSubscriptionPayments(payments);

    const result = await updateUser(userId, {
      subscription: plan,
      subscriptionStartedAt: paidAt,
      subscriptionExpiresAt: expiresAt,
    });
    if (!result.success) {
      return result;
    }

    createNotificationSync(userId, {
      type: NOTIFICATION_TYPES.SUBSCRIPTION,
      title: "اشتراک با موفقیت تغییر کرد",
      message: `طرح ${plan === SUBSCRIPTIONS.GOLD ? "طلایی" : plan === SUBSCRIPTIONS.SILVER ? "نقره‌ای" : "پایه"} فعال شد.`,
      link: "/settings#subscription",
    });

    return successResponse({ payment, user: result.data });
  } catch (error) {
    return errorResponse("خطا در ثبت پرداخت اشتراک", 500);
  }
}

// ---------------------------------------------------------------------------
// Artists Content
// ---------------------------------------------------------------------------

export async function uploadSong(songData, audioFile, coverFile) {
  await delay();

  try {
    const currentUser = getCurrentUserRecord();
    const artistId = normalizeText(songData?.artistId) || getPrimaryArtistProfileForUser(currentUser?.id || "")?.id;

    if (!artistId) {
      return errorResponse("شناسه هنرمند معتبر نیست", 400);
    }

    const artistProfile = getArtistProfileById(artistId);
    if (!artistProfile) {
      return errorResponse("هنرمند پیدا نشد", 404);
    }
    if (!canManageArtist(currentUser, artistProfile)) {
      return errorResponse("شما اجازه مدیریت آثار این هنرمند را ندارید", 403);
    }
    if (!isVerifiedArtist(currentUser, artistProfile)) {
      return errorResponse("انتشار اثر فقط پس از تأیید حساب هنرمند امکان‌پذیر است", 403);
    }
    if (!audioFile) {
      return errorResponse("انتخاب فایل صوتی الزامی است", 400);
    }
    if (!isSupportedAudioFile(audioFile)) {
      return errorResponse("فرمت فایل صوتی باید MP3، WAV یا FLAC باشد", 400);
    }

    if (songData?.albumId) {
      const targetAlbum = getAlbumByIdSync(songData.albumId);
      if (!targetAlbum || targetAlbum.artistId !== artistId) {
        return errorResponse("آلبوم انتخاب‌شده معتبر نیست", 400);
      }
    }

    const songs = getSongs();
    const song = {
      id: generateId("song"),
      title: normalizeText(songData?.title) || "آهنگ جدید",
      artistId,
      albumId: songData?.albumId || null,
      cover: resolveFileUrl(coverFile, songData?.cover || DEFAULT_COVER),
      src: resolveFileUrl(audioFile, songData?.src || ""),
      lyrics: songData?.lyrics || null,
      duration: Number(songData?.duration) || 0,
      genre: songData?.genre || "",
      releaseDate: songData?.releaseDate || new Date().toISOString().slice(0, 10),
      playCount: 0,
      monthlyPlayCount: 0,
      listeners: 0,
      isSingle: songData?.albumId ? false : true,
      featuredArtists: Array.isArray(songData?.featuredArtists)
        ? songData.featuredArtists
        : normalizeText(songData?.featuredArtists)
          .split("،")
          .map((item) => item.trim())
          .filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    songs.push(song);
    saveSongs(songs);

    if (song.albumId) {
      const albums = getAlbums();
      const albumIndex = albums.findIndex((album) => album.id === song.albumId);
      if (albumIndex !== -1) {
        albums[albumIndex] = {
          ...albums[albumIndex],
          trackIds: pushUnique(albums[albumIndex].trackIds || [], song.id),
          updatedAt: new Date().toISOString(),
        };
        saveAlbums(albums);
      }
    } else {
      upsertArtistProfile({
        ...artistProfile,
        singleIds: pushUnique(artistProfile.singleIds || [], song.id),
        updatedAt: new Date().toISOString(),
      });
    }

    const artistUser = getArtistUserFromProfile(artistProfile);
    const followers = artistUser?.followers || artistProfile.followers || [];
    await Promise.all(
      followers.map((userId) =>
        createNotification(userId, {
          type: NOTIFICATION_TYPES.NEW_RELEASE,
          title: `اثر جدید از ${artistProfile.stageName}`,
          message: `${artistProfile.stageName} اثر «${song.title}» را منتشر کرد.`,
          link: song.albumId
            ? `/album/${song.albumId}`
            : `/artist/${artistProfile.id}#song-${song.id}`,
        }),
      ),
    );

    return successResponse(buildSongPayload(song));
  } catch (error) {
    return errorResponse("خطا در بارگذاری آهنگ", 500);
  }
}

export async function updateSong(songId, updates, coverFile = null) {
  await delay();

  try {
    const songs = getSongs();
    const songIndex = songs.findIndex((song) => song.id === songId);

    if (songIndex === -1) {
      return errorResponse("آهنگ پیدا نشد", 404);
    }

    const previousSong = songs[songIndex];
    const currentUser = getCurrentUserRecord();
    const artistProfile = getArtistProfileById(previousSong.artistId);
    if (!canManageArtist(currentUser, artistProfile) || !isVerifiedArtist(currentUser, artistProfile)) {
      return errorResponse("شما اجازه ویرایش این آهنگ را ندارید", 403);
    }

    const nextUpdates = { ...updates };
    delete nextUpdates.id;
    delete nextUpdates.artistId;
    const updatesAlbum = Object.prototype.hasOwnProperty.call(nextUpdates, "albumId");
    if (updatesAlbum && nextUpdates.albumId) {
      const targetAlbum = getAlbumByIdSync(nextUpdates.albumId);
      if (!targetAlbum || targetAlbum.artistId !== previousSong.artistId) {
        return errorResponse("آلبوم انتخاب‌شده معتبر نیست", 400);
      }
    }
    if (updatesAlbum) {
      nextUpdates.isSingle = !nextUpdates.albumId;
    }
    if (coverFile) {
      nextUpdates.cover = resolveFileUrl(coverFile, previousSong.cover || DEFAULT_COVER);
    }

    songs[songIndex] = {
      ...previousSong,
      ...nextUpdates,
      updatedAt: new Date().toISOString(),
    };
    saveSongs(songs);

    if (previousSong.albumId !== songs[songIndex].albumId) {
      if (previousSong.albumId) {
        const albums = getAlbums();
        const albumIndex = albums.findIndex((album) => album.id === previousSong.albumId);
        if (albumIndex !== -1) {
          albums[albumIndex] = {
            ...albums[albumIndex],
            trackIds: removeFromArray(albums[albumIndex].trackIds || [], songId),
            updatedAt: new Date().toISOString(),
          };
          saveAlbums(albums);
        }
      }

      if (songs[songIndex].albumId) {
        const albums = getAlbums();
        const albumIndex = albums.findIndex((album) => album.id === songs[songIndex].albumId);
        if (albumIndex !== -1) {
          albums[albumIndex] = {
            ...albums[albumIndex],
            trackIds: pushUnique(albums[albumIndex].trackIds || [], songId),
            updatedAt: new Date().toISOString(),
          };
          saveAlbums(albums);
        }
      }
    }

    if (artistProfile) {
      upsertArtistProfile({
        ...artistProfile,
        singleIds: songs[songIndex].albumId
          ? removeFromArray(artistProfile.singleIds || [], songId)
          : pushUnique(artistProfile.singleIds || [], songId),
        updatedAt: new Date().toISOString(),
      });
    }

    return successResponse(buildSongPayload(songs[songIndex]));
  } catch (error) {
    return errorResponse("خطا در ویرایش آهنگ", 500);
  }
}

export async function deleteSong(songId) {
  await delay();

  try {
    const song = getSongByIdSync(songId);

    if (!song) {
      return errorResponse("آهنگ پیدا نشد", 404);
    }

    const currentUser = getCurrentUserRecord();
    const artistProfile = getArtistProfileById(song.artistId);
    if (!canManageArtist(currentUser, artistProfile) || !isVerifiedArtist(currentUser, artistProfile)) {
      return errorResponse("شما اجازه حذف این آهنگ را ندارید", 403);
    }

    saveSongs(getSongs().filter((item) => item.id !== songId));
    removeSongFromAlbumsAndArtist(song);

    return successResponse({ message: "آهنگ حذف شد" });
  } catch (error) {
    return errorResponse("خطا در حذف آهنگ", 500);
  }
}
