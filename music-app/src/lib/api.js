import { DEFAULT_AVATAR, DEFAULT_COVER } from '@/utils/constants';
import {
  REFRESH_TOKEN_KEY,
  apiRequest,
  clearAuthTokens,
  resolveBackendAsset,
  storeAuthTokens,
} from '@/lib/apiClient';

const ok = (data) => ({ success: true, data });
const fail = (message, status = 400) => ({ success: false, error: { message, status } });

const mapUser = (raw = {}, settings = null) => ({
  id: raw.id,
  email: raw.email,
  displayName: raw.display_name || raw.displayName || '',
  username: raw.username || '',
  role: raw.role,
  subscription: raw.subscription || settings?.subscription?.type || 'free',
  subscriptionExpiresAt: settings?.subscription?.expires_at || null,
  avatar: resolveBackendAsset(raw.avatar, DEFAULT_AVATAR),
  bio: raw.bio || '',
  genre: raw.genre || '',
  birthDate: raw.birth_date || null,
  gender: raw.gender || '',
  isVerified: Boolean(raw.is_verified),
  followersCount: raw.followers_count ?? 0,
  followingCount: raw.following_count ?? 0,
  isFollowing: Boolean(raw.is_following),
  dailyStreams: raw.daily_streams ?? 0,
  totalStreams: raw.total_streams ?? 0,
  notificationSettings: settings?.notification_settings ? {
    inApp: settings.notification_settings.in_app,
    push: settings.notification_settings.push,
    email: settings.notification_settings.email,
    dailyLimit: settings.notification_settings.daily_limit,
  } : undefined,
  appSound: settings?.app_sound,
  language: settings?.language,
  createdAt: raw.created_at || null,
});

const mapSong = (raw = {}) => {
  const artist = typeof raw.artist === 'object'
    ? mapArtist(raw.artist)
    : { id: raw.artist, stageName: raw.artist_name || 'هنرمند' };
  const audioSources = Object.fromEntries(
    Object.entries(raw.audio_sources || { high: raw.audio_file })
      .filter(([, source]) => Boolean(source))
      .map(([quality, source]) => [quality, resolveBackendAsset(source)]),
  );
  return {
    id: raw.id,
    title: raw.title,
    artistId: artist.id,
    artist,
    albumId: raw.album || null,
    album: raw.album ? { id: raw.album, title: raw.album_title || '' } : null,
    cover: resolveBackendAsset(raw.cover, DEFAULT_COVER),
    src: audioSources.high || resolveBackendAsset(raw.audio_file, ''),
    audioSources,
    availableQualities: raw.available_qualities || Object.keys(audioSources),
    defaultQuality: raw.default_quality || 'high',
    lyrics: raw.lyrics || '',
    duration: Number(raw.duration) || 0,
    genre: raw.genre || '',
    releaseDate: raw.release_date || null,
    isSingle: Boolean(raw.is_single),
    playCount: Number(raw.play_count) || 0,
    listeners: Number(raw.listener_count) || 0,
    isFavorite: Boolean(raw.is_favorite),
    featuredArtists: raw.featured_artists || [],
    createdAt: raw.created_at || null,
    updatedAt: raw.updated_at || null,
  };
};

const mapAlbum = (raw = {}) => ({
  id: raw.id,
  title: raw.title,
  artistId: raw.artist,
  artist: { id: raw.artist, stageName: raw.artist_name || 'هنرمند' },
  cover: resolveBackendAsset(raw.cover, DEFAULT_COVER),
  releaseDate: raw.release_date || null,
  genre: raw.genre || '',
  description: raw.description || '',
  isSingle: Boolean(raw.is_single),
  trackIds: Array.isArray(raw.songs) ? raw.songs.map((song) => song.id) : [],
  songs: Array.isArray(raw.songs) ? raw.songs.map(mapSong) : undefined,
  trackCount: raw.track_count ?? raw.songs?.length ?? 0,
  totalDuration: raw.total_duration || '0:00',
  createdAt: raw.created_at || null,
  updatedAt: raw.updated_at || null,
});

function mapArtist(raw = {}) {
  return {
    id: raw.id,
    userId: raw.user,
    user: raw.user ? {
      id: raw.user,
      displayName: raw.user_display_name || raw.stage_name,
      email: raw.user_email || '',
    } : null,
    stageName: raw.stage_name || raw.user_display_name || '',
    bio: raw.bio || '',
    genre: raw.genre || '',
    genres: raw.genre ? [raw.genre] : [],
    cover: DEFAULT_COVER,
    portfolio: raw.portfolio ? { url: resolveBackendAsset(raw.portfolio) } : null,
    isVerified: Boolean(raw.is_verified),
    verificationStatus: raw.verification_status || (raw.is_verified ? 'approved' : 'pending'),
    rejectionReason: raw.verification_reason || '',
    followersCount: Number(raw.followers_count) || 0,
    isFollowing: Boolean(raw.is_following),
    totalListeners: Number(raw.total_listeners) || 0,
    totalStreams: Number(raw.total_streams) || 0,
    albums: (raw.albums || []).map(mapAlbum),
    songs: (raw.singles || []).map((song) => mapSong({ ...song, artist: raw.id, artist_name: raw.stage_name })),
    createdAt: raw.created_at || null,
    updatedAt: raw.updated_at || null,
  };
}

const mapPlaylist = (raw = {}) => ({
  id: raw.id,
  name: raw.name,
  userId: raw.user,
  cover: resolveBackendAsset(raw.cover, DEFAULT_COVER),
  description: raw.description || '',
  isPublic: Boolean(raw.is_public),
  songIds: raw.song_ids || [],
  songs: Array.isArray(raw.songs) ? raw.songs.map(mapSong) : undefined,
  trackCount: raw.track_count ?? raw.song_ids?.length ?? 0,
  createdAt: raw.created_at || null,
  updatedAt: raw.updated_at || null,
});

const mapNotification = (raw = {}) => ({
  id: raw.id,
  type: raw.type,
  title: raw.title,
  message: raw.message,
  isRead: Boolean(raw.is_read),
  readAt: raw.read_at || null,
  link: raw.link || '',
  createdAt: raw.created_at || null,
  updatedAt: raw.updated_at || null,
});

const mapTicketUser = (raw) => raw ? {
  id: raw.id, displayName: raw.display_name, email: raw.email, role: raw.role,
} : null;

const mapTicket = (raw = {}) => ({
  id: raw.id,
  userId: raw.user?.id,
  user: mapTicketUser(raw.user),
  subject: raw.subject,
  message: raw.message,
  status: raw.status,
  assignedTo: mapTicketUser(raw.assigned_to),
  replies: (raw.replies || []).map((reply) => ({
    id: reply.id,
    user: mapTicketUser(reply.user),
    senderId: reply.user?.id,
    senderRole: reply.user?.role,
    message: reply.message,
    isFromSupport: Boolean(reply.is_from_support),
    createdAt: reply.created_at,
  })),
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
  resolvedAt: raw.resolved_at,
});

function append(form, key, value) {
  if (value !== undefined && value !== null && value !== '') form.append(key, value);
}

export async function login(email, password) {
  const result = await apiRequest('/users/login/', {
    method: 'POST', auth: false, body: { email: String(email).trim().toLowerCase(), password },
  });
  if (!result.success) return result;
  storeAuthTokens(result.data);
  const settings = await apiRequest('/users/settings/');
  return ok({
    user: mapUser(result.data.user, settings.success ? settings.data : null),
    token: result.data.access,
  });
}

export async function registerUser(data) {
  const result = await apiRequest('/users/register/', {
    method: 'POST',
    auth: false,
    body: {
      email: data.email,
      display_name: data.displayName || data.fullName,
      password: data.password,
      confirm_password: data.password,
      birth_date: data.birthDate || null,
      gender: data.gender || '',
      privacy_accepted: true,
    },
  });
  return result.success ? ok(mapUser(result.data.user)) : result;
}

export async function registerArtist(data) {
  const form = new FormData();
  append(form, 'email', data.email);
  append(form, 'display_name', data.displayName || data.stageName);
  append(form, 'password', data.password);
  append(form, 'confirm_password', data.password);
  append(form, 'artist_name', data.stageName || data.displayName);
  append(form, 'bio', data.bio || '');
  append(form, 'genre', data.genre || '');
  append(form, 'portfolio', data.portfolioFile);
  const result = await apiRequest('/users/register/artist/', { method: 'POST', auth: false, body: form });
  return result.success ? ok({ ...mapUser(result.data.user), message: result.data.message }) : result;
}

export async function logout() {
  const refresh = typeof window === 'undefined' ? null : window.localStorage.getItem(REFRESH_TOKEN_KEY);
  const result = refresh
    ? await apiRequest('/users/logout/', { method: 'POST', body: { refresh } })
    : ok(null);
  clearAuthTokens();
  return result.success ? ok({ message: 'با موفقیت خارج شدید' }) : result;
}

export async function getCurrentUser() {
  if (typeof window === 'undefined' || !window.localStorage.getItem(REFRESH_TOKEN_KEY)) {
    return fail('کاربر وارد نشده است', 401);
  }
  const [user, settings] = await Promise.all([
    apiRequest('/users/me/'), apiRequest('/users/settings/'),
  ]);
  return user.success ? ok(mapUser(user.data, settings.success ? settings.data : null)) : user;
}

export async function forgotPassword(email) {
  return apiRequest('/users/forgot-password/', { method: 'POST', auth: false, body: { email } });
}

export async function getUserById(userId) {
  const result = await apiRequest(`/users/profile/${userId}/`);
  return result.success ? ok(mapUser(result.data)) : result;
}

export async function getAllUsers() {
  const result = await apiRequest('/users/');
  return result.success ? ok((result.data.results || []).map(mapUser)) : result;
}

export async function updateUser(userId, updates) {
  if (updates.notificationSettings || updates.appSound !== undefined || updates.language) {
    const settings = await apiRequest('/users/settings/', {
      method: 'PATCH',
      body: {
        notification_settings: updates.notificationSettings ? {
          in_app: updates.notificationSettings.inApp,
          push: updates.notificationSettings.push,
          email: updates.notificationSettings.email,
          daily_limit: updates.notificationSettings.dailyLimit,
        } : undefined,
        app_sound: updates.appSound,
        language: updates.language,
      },
    });
    if (!settings.success) return settings;
  }

  if (['displayName', 'bio', 'birthDate', 'gender'].some((key) => updates[key] !== undefined)) {
    const profile = await apiRequest('/users/profile/update/', {
      method: 'PUT',
      body: {
        display_name: updates.displayName,
        bio: updates.bio,
        birth_date: updates.birthDate,
        gender: updates.gender,
      },
    });
    if (!profile.success) return profile;
  }
  return getUserById(userId);
}

export function deleteAccount(userId, credentials = {}) {
  return apiRequest('/users/settings/account/', {
    method: 'DELETE',
    body: { password: credentials.password || '', confirmation: credentials.confirmation || 'حذف حساب' },
  });
}

export const followUser = (currentUserId, targetUserId) => apiRequest('/users/follow/', {
  method: 'POST', body: { target_user_id: targetUserId },
});
export const unfollowUser = (currentUserId, targetUserId) => apiRequest('/users/unfollow/', {
  method: 'POST', body: { target_user_id: targetUserId },
});

export async function uploadAvatar(userId, file) {
  const form = new FormData();
  append(form, 'avatar', file);
  const result = await apiRequest('/users/profile/update/', { method: 'PUT', body: form });
  return result.success ? getUserById(userId) : result;
}

async function resolveArtist(id) {
  const direct = await apiRequest(`/music/artists/${id}/`);
  if (direct.success && String(direct.data.user) === String(id)) return direct.data;
  const list = await apiRequest('/music/artists/');
  const match = list.success ? list.data.results.find((artist) => String(artist.user) === String(id)) : null;
  if (match) {
    const detail = await apiRequest(`/music/artists/${match.id}/`);
    return detail.success ? detail.data : null;
  }
  return direct.success ? direct.data : null;
}

export async function getArtistById(id) {
  const raw = await resolveArtist(id);
  if (!raw) return fail('هنرمند پیدا نشد', 404);
  const songsResult = await apiRequest(`/music/songs/?artist_id=${raw.id}&limit=100`);
  const artist = mapArtist(raw);
  const songs = songsResult.success ? songsResult.data.results.map(mapSong) : artist.songs;
  return ok({
    ...artist,
    songs,
    stats: {
      verified: artist.isVerified,
      totalStreams: artist.totalStreams,
      monthlyListeners: artist.totalListeners,
      followersCount: artist.followersCount,
      songsCount: songs.length,
      estimatedEarnings: 0,
    },
  });
}

export async function getAllArtists() {
  const result = await apiRequest('/music/artists/');
  return result.success ? ok((result.data.results || []).map(mapArtist)) : result;
}

export async function getPendingArtists() {
  const result = await apiRequest('/music/artists/pending/');
  if (!result.success) return result;
  const artists = await Promise.all((result.data.results || []).map(async (raw) => {
    const detail = await getArtistById(raw.id);
    return detail.success ? detail.data : mapArtist(raw);
  }));
  return ok(artists);
}

export async function verifyArtist(artistId, status, reason = '') {
  const result = await apiRequest(`/music/artists/${artistId}/verify/`, {
    method: 'POST', body: { status, reason },
  });
  return result.success ? ok(mapArtist(result.data.artist)) : result;
}

export async function getArtistStats(artistId) {
  const result = await apiRequest(`/music/artists/${artistId}/stats/`);
  if (!result.success) return result;
  const accounting = await apiRequest('/payments/accounting/');
  const row = accounting.success
    ? accounting.data.results.find((item) => String(item.artist_id) === String(artistId))
    : null;
  return ok({
    totalListeners: result.data.total_listeners,
    totalStreams: result.data.total_streams,
    averageStreams: result.data.average_streams_per_song,
    monthlyGrowth: result.data.monthly_growth,
    monthlyUniqueListeners: row?.unique_listeners ?? result.data.total_listeners,
    monthlyStreams: row?.stream_count ?? result.data.total_streams,
    estimatedMonthlyEarnings: Number(row?.reward_amount || 0),
    topSongs: (result.data.top_songs || []).map(mapSong),
  });
}

export async function getAllSongs(options = {}) {
  const params = new URLSearchParams();
  if (options.genre) params.set('genre', options.genre);
  if (options.artistId) params.set('artist_id', options.artistId);
  if (options.albumId) params.set('album_id', options.albumId);
  if (options.query) params.set('search', options.query);
  if (options.sortBy === 'playCount') params.set('ordering', '-play_count');
  if (options.sortBy === 'releaseDate') params.set('ordering', '-release_date');
  if (options.limit) params.set('limit', options.limit);
  if (options.offset) params.set('offset', options.offset);
  const result = await apiRequest(`/music/songs/?${params}`);
  if (!result.success) return result;
  const songs = (result.data.results || []).map(mapSong);
  if (options.sortBy === 'title') songs.sort((a, b) => a.title.localeCompare(b.title, 'fa'));
  return ok(songs);
}

export async function getSongById(songId) {
  const result = await apiRequest(`/music/songs/${songId}/`);
  return result.success ? ok(mapSong(result.data)) : result;
}

export const getSongsByArtist = (artistId) => getAllSongs({ artistId, limit: 100 });
export const getSongsByAlbum = (albumId) => getAllSongs({ albumId, limit: 100 });
export const searchSongs = (query) => getAllSongs({ query, limit: 100 });
export const getTrendingSongs = (limit = 10) => getAllSongs({ sortBy: 'playCount', limit });
export const getNewReleases = (limit = 10) => getAllSongs({ sortBy: 'releaseDate', limit });

export async function incrementPlayCount(songId) {
  const result = await apiRequest(`/music/songs/${songId}/play/`, {
    method: 'POST',
    body: {
      source: 'direct',
      idempotency_key: `${songId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });
  return result.success ? getSongById(songId) : result;
}

export async function getRecentlyListenedPlaylists(userId, limit = 4) {
  const result = await getUserPlaylists(userId);
  return result.success ? ok(result.data.slice(0, limit)) : result;
}

export async function getAllAlbums() {
  const result = await apiRequest('/music/albums/?limit=100');
  return result.success ? ok((result.data.results || []).map(mapAlbum)) : result;
}

export async function getAlbumById(albumId) {
  const result = await apiRequest(`/music/albums/${albumId}/`);
  return result.success ? ok(mapAlbum(result.data)) : result;
}

export async function getAlbumsByArtist(artistId) {
  const result = await apiRequest(`/music/albums/?artist_id=${artistId}&limit=100`);
  return result.success ? ok((result.data.results || []).map(mapAlbum)) : result;
}

export async function getLatestAlbums(limit = 10) {
  const result = await apiRequest(`/music/albums/?ordering=-release_date&limit=${limit}`);
  return result.success ? ok((result.data.results || []).map(mapAlbum)) : result;
}

function albumForm(data, cover) {
  const form = new FormData();
  append(form, 'title', data.title);
  append(form, 'genre', data.genre || '');
  append(form, 'release_date', data.releaseDate);
  append(form, 'description', data.description || '');
  append(form, 'is_single', Boolean(data.isSingle));
  append(form, 'cover', cover);
  return form;
}

export async function createAlbum(data, cover) {
  const result = await apiRequest('/music/albums/create/', { method: 'POST', body: albumForm(data, cover) });
  return result.success ? ok(mapAlbum(result.data)) : result;
}

export async function updateAlbum(albumId, data, cover = null) {
  const result = await apiRequest(`/music/albums/${albumId}/update/`, {
    method: 'PUT', body: albumForm(data, cover),
  });
  return result.success ? ok(mapAlbum(result.data)) : result;
}

export const deleteAlbum = (albumId) => apiRequest(`/music/albums/${albumId}/delete/`, { method: 'DELETE' });

export async function getUserPlaylists() {
  const result = await apiRequest('/music/playlists/?limit=100');
  return result.success ? ok((result.data.results || []).map(mapPlaylist)) : result;
}

export async function getPlaylistById(playlistId) {
  const result = await apiRequest(`/music/playlists/${playlistId}/`);
  return result.success ? ok(mapPlaylist(result.data)) : result;
}

export async function canCreatePlaylist() {
  const result = await apiRequest('/music/playlists/check-limit/');
  return result.success ? ok({
    allowed: result.data.allowed,
    limit: result.data.limit ?? Infinity,
    currentCount: result.data.current_count,
    remaining: result.data.remaining ?? Infinity,
    subscription: result.data.subscription,
  }) : result;
}

export async function createPlaylist(userId, name) {
  const result = await apiRequest('/music/playlists/create/', {
    method: 'POST', body: { name: String(name).trim(), is_public: false },
  });
  return result.success ? ok(mapPlaylist(result.data)) : result;
}

export async function renamePlaylist(playlistId, name) {
  const result = await apiRequest(`/music/playlists/${playlistId}/update/`, {
    method: 'PATCH', body: { name: String(name).trim() },
  });
  return result.success ? ok(mapPlaylist(result.data)) : result;
}

export const deletePlaylist = (playlistId) => apiRequest(`/music/playlists/${playlistId}/delete/`, { method: 'DELETE' });

export async function addSongToPlaylist(playlistId, songId) {
  const result = await apiRequest(`/music/playlists/${playlistId}/add-song/`, {
    method: 'POST', body: { song_id: songId },
  });
  return result.success ? ok(mapPlaylist(result.data.playlist)) : result;
}

export async function removeSongFromPlaylist(playlistId, songId) {
  const result = await apiRequest(`/music/playlists/${playlistId}/remove-song/${songId}/`, { method: 'DELETE' });
  return result.success ? ok(mapPlaylist(result.data.playlist)) : result;
}

export async function getUserNotifications() {
  const result = await apiRequest('/support/notifications/?page_size=100');
  return result.success ? ok((result.data.results || []).map(mapNotification)) : result;
}

export async function markNotificationAsRead(notificationId) {
  const result = await apiRequest(`/support/notifications/${notificationId}/read/`, { method: 'PATCH' });
  return result.success ? ok(mapNotification(result.data)) : result;
}

export const markAllNotificationsAsRead = () => apiRequest('/support/notifications/read-all/', { method: 'POST' });
export const deleteNotification = (notificationId) => apiRequest(`/support/notifications/${notificationId}/`, { method: 'DELETE' });
export const createNotification = () => fail('اعلان‌ها فقط توسط رویدادهای بک‌اند ایجاد می‌شوند', 405);

export async function getAllTickets() {
  const result = await apiRequest('/support/tickets/');
  return result.success ? ok((result.data.results || []).map(mapTicket)) : result;
}

export async function getTicketById(ticketId) {
  const result = await apiRequest(`/support/tickets/${ticketId}/`);
  return result.success ? ok(mapTicket(result.data)) : result;
}

export const getUserTickets = () => getAllTickets();

export async function createTicket(userId, subject, message) {
  const result = await apiRequest('/support/tickets/', {
    method: 'POST', body: { subject, message },
  });
  return result.success ? ok(mapTicket(result.data)) : result;
}

export async function replyToTicket(ticketId, reply) {
  const result = await apiRequest(`/support/tickets/${ticketId}/replies/`, {
    method: 'POST', body: { message: reply },
  });
  return result.success ? ok(mapTicket(result.data)) : result;
}

export async function closeTicket(ticketId) {
  const result = await apiRequest(`/support/tickets/${ticketId}/close/`, { method: 'POST' });
  return result.success ? ok(mapTicket(result.data)) : result;
}

export async function getMonthlyFinancialReport() {
  const [accounting, overview, report] = await Promise.all([
    apiRequest('/payments/accounting/'),
    apiRequest('/payments/admin/overview/'),
    apiRequest('/payments/admin/reports/'),
  ]);
  if (!accounting.success) return accounting;
  if (!overview.success) return overview;
  if (!report.success) return report;

  const rows = accounting.data.results || [];
  const subscriptionRevenue = Number(overview.data.total_subscription_revenue || 0);
  const artistPayouts = rows.reduce((sum, row) => sum + Number(row.reward_amount || 0), 0);
  return ok({
    month: accounting.data.month,
    totalStreams: rows.reduce((sum, row) => sum + Number(row.stream_count || 0), 0),
    streamRevenue: artistPayouts,
    subscriptionRevenue,
    subscriptionSalesCount: overview.data.total_subscription_sales,
    subscriptionRevenueByPlan: {
      silver: Number(overview.data.subscription_sales?.silver?.revenue || 0),
      gold: Number(overview.data.subscription_sales?.gold?.revenue || 0),
    },
    artistPayouts,
    platformRevenue: subscriptionRevenue - artistPayouts,
    settledPayments: rows.filter((row) => row.status === 'settled').map((row) => ({
      artistId: row.artist_id,
      month: accounting.data.month,
      status: 'settled',
      amount: Number(row.reward_amount || 0),
    })),
    paymentReport: report.data,
  });
}

export async function settleArtistPayment(artistId) {
  const result = await apiRequest(`/payments/accounting/artists/${artistId}/settle/`, { method: 'POST' });
  if (!result.success) return result;
  const statement = result.data.statement;
  return ok({
    ...statement,
    artistId: statement.artist_id,
    amount: Number(statement.reward_amount || 0),
    month: String(statement.period || '').slice(0, 7),
  });
}

export async function updateSubscriptionPrices(silver, gold) {
  const result = await apiRequest('/payments/prices/', { method: 'PUT', body: { silver, gold } });
  return result.success
    ? ok(Object.fromEntries(result.data.results.map((price) => [price.subscription_type, Number(price.price)])))
    : result;
}

export async function getSubscriptionPricing() {
  const result = await apiRequest('/payments/prices/', { auth: false });
  return result.success
    ? ok(Object.fromEntries(result.data.results.map((price) => [price.subscription_type, Number(price.price)])))
    : result;
}

export async function getSystemStats() {
  const [users, songs, albums, playlists, tickets, overview, prices] = await Promise.all([
    getAllUsers(),
    getAllSongs({ limit: 100 }),
    getAllAlbums(),
    getUserPlaylists(),
    getAllTickets(),
    apiRequest('/payments/admin/overview/'),
    getSubscriptionPricing(),
  ]);
  if (!overview.success) return overview;
  return ok({
    usersCount: users.success
      ? users.data.length
      : Object.values(overview.data.subscription_distribution || {}).reduce((sum, count) => sum + count, 0),
    songsCount: songs.success ? songs.data.length : 0,
    albumsCount: albums.success ? albums.data.length : 0,
    playlistsCount: playlists.success ? playlists.data.length : 0,
    openTicketsCount: tickets.success ? tickets.data.filter((ticket) => ticket.status !== 'closed').length : 0,
    totalStreams: songs.success ? songs.data.reduce((sum, song) => sum + song.playCount, 0) : 0,
    subscriptionPrices: prices.success ? prices.data : {},
    subscriptionDistribution: overview.data.subscription_distribution,
  });
}

export async function purchaseSubscription(userId, plan, paymentData = {}) {
  if (plan === 'free') return fail('طرح رایگان نیازی به پرداخت ندارد');
  const result = await apiRequest('/payments/checkout/', {
    method: 'POST',
    body: {
      subscription_type: plan,
      duration_months: paymentData.durationMonths || 1,
      idempotency_key: paymentData.idempotencyKey || `web-${userId}-${plan}-${Date.now()}`,
    },
  });
  return result.success ? ok({
    transaction: result.data.transaction,
    paymentUrl: result.data.transaction.payment_url,
  }) : result;
}

export async function completeSandboxPayment(paymentUrl, status = 'success') {
  try {
    const path = new URL(paymentUrl).pathname.replace(/^\/api/, '');
    return apiRequest(path, { method: 'POST', auth: false, body: { status } });
  } catch {
    return fail('آدرس درگاه آزمایشی معتبر نیست');
  }
}

function songForm(data, audioHigh, audioLow, cover, includeAudio) {
  const form = new FormData();
  append(form, 'title', data.title);
  if (includeAudio) append(form, 'album', data.albumId || '');
  else form.append('album', data.albumId || '');
  append(form, 'lyrics', data.lyrics || '');
  append(form, 'duration', Number(data.duration) || 0);
  append(form, 'genre', data.genre || '');
  append(form, 'release_date', data.releaseDate);
  append(form, 'is_single', !data.albumId);
  (data.featuredArtists || []).forEach((artistId) => {
    if (/^\d+$/.test(String(artistId))) form.append('featured_artists', artistId);
  });
  if (includeAudio) {
    append(form, 'audio_file', audioHigh);
    append(form, 'audio_file_low', audioLow);
  }
  append(form, 'cover', cover);
  return form;
}

async function resolveFeaturedArtists(data) {
  const entries = data.featuredArtists || [];
  if (!entries.some((entry) => !/^\d+$/.test(String(entry)))) return data;
  const artists = await getAllArtists();
  if (!artists.success) return data;
  const byName = new Map(artists.data.map((artist) => [artist.stageName.trim().toLowerCase(), artist.id]));
  return {
    ...data,
    featuredArtists: entries
      .map((entry) => /^\d+$/.test(String(entry))
        ? Number(entry)
        : byName.get(String(entry).trim().toLowerCase()))
      .filter(Boolean),
  };
}

export async function uploadSong(data, audioHigh, audioLow, cover) {
  const normalized = await resolveFeaturedArtists(data);
  const result = await apiRequest('/music/songs/create/', {
    method: 'POST', body: songForm(normalized, audioHigh, audioLow, cover, true),
  });
  return result.success ? ok(mapSong(result.data)) : result;
}

export async function updateSong(songId, data, cover = null) {
  const normalized = await resolveFeaturedArtists(data);
  const result = await apiRequest(`/music/songs/${songId}/update/`, {
    method: 'PUT', body: songForm(normalized, null, null, cover, false),
  });
  return result.success ? ok(mapSong(result.data)) : result;
}

export const deleteSong = (songId) => apiRequest(`/music/songs/${songId}/delete/`, { method: 'DELETE' });

export async function getPlaybackQueue() {
  const result = await apiRequest('/music/queue/');
  return result.success ? ok({
    currentIndex: result.data.current_index,
    repeatMode: result.data.repeat_mode,
    isShuffle: result.data.shuffle,
    queue: (result.data.items || []).map((item) => mapSong(item.song)),
  }) : result;
}

export function updatePlaybackQueue(queue, currentIndex, repeatMode, isShuffle) {
  return apiRequest('/music/queue/', {
    method: 'PUT',
    body: {
      song_ids: queue.map((song) => song.id),
      current_index: currentIndex,
      repeat_mode: repeatMode,
      shuffle: isShuffle,
    },
  });
}
