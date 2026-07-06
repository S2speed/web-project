'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { followUser, unfollowUser, getUserById, updateUser } from '@/lib/mockApi';
import { SUBSCRIPTION_LIMITS, SUBSCRIPTION_TYPES as SUBSCRIPTIONS, USER_ROLES as ROLES } from '@/utils/constants';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useUser();
  const fileInputRef = useRef(null);
  const userId = params?.id;

  const [profileUser, setProfileUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFollowProcessing, setIsFollowProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      if (!userId) {
        setError('کاربر پیدا نشد');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      const result = await getUserById(userId);

      if (!isMounted) {
        return;
      }

      if (result.success) {
        setProfileUser(result.data);
        if (currentUser) {
          setIsFollowing(currentUser.following?.includes(userId) || false);
        } else {
          setIsFollowing(false);
        }
      } else {
        setProfileUser(null);
        setError('کاربر پیدا نشد');
      }

      setIsLoading(false);
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [userId, currentUser]);

  const isOwnProfile = currentUser?.id === userId;
  const canUploadAvatar = SUBSCRIPTION_LIMITS[profileUser?.subscription]?.canUploadAvatar;

  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    setIsFollowProcessing(true);

    const result = isFollowing
      ? await unfollowUser(currentUser.id, userId)
      : await followUser(currentUser.id, userId);

    if (result.success) {
      setIsFollowing((prev) => !prev);
      setProfileUser((prev) => {
        if (!prev) {
          return prev;
        }

        const nextFollowers = isFollowing
          ? (prev.followers || []).filter((followerId) => followerId !== currentUser.id)
          : [...(prev.followers || []), currentUser.id];

        return {
          ...prev,
          followers: nextFollowers,
        };
      });
    }

    setIsFollowProcessing(false);
  };

  const handleEdit = () => {
    if (!profileUser) {
      return;
    }

    setEditData({
      displayName: profileUser.displayName || '',
      bio: profileUser.bio || '',
      avatar: profileUser.avatar || '',
    });
    setIsEditing(true);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setIsUpdating(true);
    setError('');

    const result = await updateUser(userId, editData);

    if (result.success) {
      setProfileUser(result.data);
      setIsEditing(false);
    } else {
      setError(result.error?.message || 'خطا در به‌روزرسانی');
    }

    setIsUpdating(false);
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !canUploadAvatar || !isOwnProfile) {
      return;
    }

    const avatarUrl = URL.createObjectURL(file);
    const result = await updateUser(userId, { avatar: avatarUrl });

    if (result.success) {
      setProfileUser(result.data);
    } else {
      setError(result.error?.message || 'خطا در بارگذاری تصویر');
    }

    event.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error || 'کاربر پیدا نشد'}</p>
        <Link href="/" className="mt-4 inline-block text-green-600 hover:underline">
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-md">
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <div className="relative">
            <div className="h-32 w-32 overflow-hidden rounded-full bg-gray-200">
              {profileUser.avatar ? (
                <img src={profileUser.avatar} alt={profileUser.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-400 to-blue-500 text-4xl text-white">
                  {profileUser.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            {isOwnProfile && canUploadAvatar && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 rounded-full bg-green-600 p-2 text-white transition hover:bg-green-700"
                  title="آپلود عکس پروفایل"
                >
                  📷
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
              </>
            )}
            {isOwnProfile && !canUploadAvatar && (
              <div className="absolute bottom-0 right-0 rounded bg-gray-400 p-1 text-xs text-white" title="ارتقا اشتراک برای آپلود عکس">
                🔒
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-right">
            <h1 className="text-2xl font-bold text-gray-900">{profileUser.displayName}</h1>
            <p className="text-gray-500">@{profileUser.username}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-4 md:justify-start">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  profileUser.subscription === SUBSCRIPTIONS.GOLD
                    ? 'bg-yellow-100 text-yellow-800'
                    : profileUser.subscription === SUBSCRIPTIONS.SILVER
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-blue-100 text-blue-800'
                }`}
              >
                {profileUser.subscription === SUBSCRIPTIONS.GOLD && '⭐ طلایی'}
                {profileUser.subscription === SUBSCRIPTIONS.SILVER && '🥈 نقره‌ای'}
                {profileUser.subscription === SUBSCRIPTIONS.FREE && '📦 پایه'}
              </span>
              {profileUser.role === ROLES.ARTIST && profileUser.isVerified && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  ✅ هنرمند تایید شده
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {!isOwnProfile && currentUser && (
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={isFollowProcessing}
                className={`rounded-full px-6 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isFollowing
                    ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isFollowProcessing ? 'در حال پردازش...' : isFollowing ? 'لغو دنبال کردن' : 'دنبال کردن'}
              </button>
            )}
            {isOwnProfile && (
              <button
                type="button"
                onClick={handleEdit}
                className="rounded-full bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                ✏️ ویرایش پروفایل
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 text-center shadow-md">
          <p className="text-2xl font-bold text-green-600">{profileUser.followers?.length || 0}</p>
          <p className="text-sm text-gray-500">دنبال‌کننده</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-md">
          <p className="text-2xl font-bold text-green-600">{profileUser.following?.length || 0}</p>
          <p className="text-sm text-gray-500">دنبال‌شونده</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-md">
          <p className="text-2xl font-bold text-green-600">{profileUser.dailyStreams || 0}</p>
          <p className="text-sm text-gray-500">استریم امروز</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-md">
          <p className="text-2xl font-bold text-green-600">{profileUser.totalStreams || 0}</p>
          <p className="text-sm text-gray-500">کل استریم‌ها</p>
        </div>
      </div>

      {profileUser.bio && (
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-md">
          <h2 className="mb-2 font-semibold text-gray-900">درباره</h2>
          <p className="text-gray-700">{profileUser.bio}</p>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">ویرایش پروفایل</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">نام نمایشی</label>
                  <input
                    name="displayName"
                    value={editData.displayName}
                    onChange={handleEditChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">بیوگرافی</label>
                  <textarea
                    name="bio"
                    value={editData.bio}
                    onChange={handleEditChange}
                    rows="3"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                {canUploadAvatar && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">آدرس عکس پروفایل</label>
                    <input
                      name="avatar"
                      value={editData.avatar}
                      onChange={handleEditChange}
                      placeholder="URL عکس"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 rounded-md bg-green-600 py-2 text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUpdating ? 'در حال ذخیره...' : 'ذخیره'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-md bg-gray-200 py-2 text-gray-800 transition hover:bg-gray-300"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
