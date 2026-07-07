'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { followUser, getUserById, unfollowUser, updateUser, uploadAvatar } from '@/lib/mockApi';
import { SUBSCRIPTION_LIMITS, SUBSCRIPTION_TYPES as SUBSCRIPTIONS, USER_ROLES as ROLES } from '@/utils/constants';

const subscriptionLabels = {
  [SUBSCRIPTIONS.FREE]: 'پایه',
  [SUBSCRIPTIONS.SILVER]: 'نقره‌ای',
  [SUBSCRIPTIONS.GOLD]: 'طلایی',
};

const genderLabels = {
  male: 'مرد',
  female: 'زن',
  other: 'سایر',
};

const roleLabels = {
  [ROLES.ADMIN]: 'مدیر سامانه',
  [ROLES.SUPPORT]: 'پشتیبان',
  [ROLES.ARTIST]: 'هنرمند',
  [ROLES.LISTENER]: 'شنونده',
};

function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) {
    return 'ثبت نشده';
  }

  return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value || 'ثبت نشده'}</p>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center">
      <p className="text-2xl font-black text-emerald-300">{formatNumber(value)}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useUser();
  const fileInputRef = useRef(null);
  const userId = params?.id;

  const [profileUser, setProfileUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFollowProcessing, setIsFollowProcessing] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

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
      setNotice('');

      const result = await getUserById(userId);

      if (!isMounted) {
        return;
      }

      if (result.success) {
        setProfileUser(result.data);
        setIsFollowing(currentUser?.following?.includes(userId) || false);
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
    setError('');

    const result = isFollowing ? await unfollowUser(currentUser.id, userId) : await followUser(currentUser.id, userId);

    if (result.success) {
      setIsFollowing((previous) => !previous);
      setProfileUser((previous) => {
        if (!previous) {
          return previous;
        }

        const followers = isFollowing
          ? (previous.followers || []).filter((followerId) => followerId !== currentUser.id)
          : [...(previous.followers || []), currentUser.id];

        return { ...previous, followers };
      });
    } else {
      setError(result.error?.message || 'خطا در تغییر وضعیت دنبال کردن');
    }

    setIsFollowProcessing(false);
  };

  const handleEdit = () => {
    if (!profileUser) {
      return;
    }

    setEditData({
      displayName: profileUser.displayName || '',
      email: profileUser.email || '',
      birthDate: profileUser.birthDate || '',
      gender: profileUser.gender || 'other',
      bio: profileUser.bio || '',
      avatar: profileUser.avatar || '',
    });
    setError('');
    setNotice('');
    setIsEditing(true);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditData((previous) => ({ ...previous, [name]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setIsUpdating(true);
    setError('');
    setNotice('');

    const updates = {
      displayName: editData.displayName,
      email: editData.email,
      birthDate: editData.birthDate,
      gender: editData.gender,
      bio: editData.bio,
    };

    if (canUploadAvatar) {
      updates.avatar = editData.avatar;
    }

    const result = await updateUser(userId, updates);

    if (result.success) {
      setProfileUser(result.data);
      setNotice('اطلاعات پروفایل ذخیره شد');
      setIsEditing(false);
    } else {
      setError(result.error?.message || 'خطا در به‌روزرسانی');
    }

    setIsUpdating(false);
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !isOwnProfile) {
      return;
    }

    if (!canUploadAvatar) {
      setNotice('کاربران اشتراک پایه امکان تغییر عکس پروفایل را ندارند');
      event.target.value = '';
      return;
    }

    setIsAvatarUploading(true);
    setError('');
    setNotice('');

    const result = await uploadAvatar(userId, file);

    if (result.success) {
      setProfileUser(result.data);
      setNotice('عکس پروفایل به‌روزرسانی شد');
    } else {
      setError(result.error?.message || 'خطا در بارگذاری تصویر');
    }

    setIsAvatarUploading(false);
    event.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950" dir="rtl">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (error && !profileUser) {
    return (
      <div className="min-h-[70vh] bg-slate-950 p-8 text-center text-white" dir="rtl">
        <p className="text-red-300">{error}</p>
        <Link href="/" className="mt-4 inline-block text-emerald-300 hover:underline">
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        {(error || notice) && (
          <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
            {error || notice}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-emerald-500/20 via-slate-900 to-slate-950 p-5 shadow-2xl shadow-black/30 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-right">
              <div className="relative shrink-0">
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-emerald-300/50 bg-slate-800">
                  {profileUser.avatar ? (
                    <img src={profileUser.avatar} alt={profileUser.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-400 to-cyan-500 text-4xl font-black text-slate-950">
                      {profileUser.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>

                {isOwnProfile && (
                  <>
                    <button
                      type="button"
                      onClick={() => (canUploadAvatar ? fileInputRef.current?.click() : setNotice('کاربران اشتراک پایه امکان تغییر عکس پروفایل را ندارند'))}
                      disabled={isAvatarUploading}
                      className={`absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full text-sm shadow-lg transition ${canUploadAvatar ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300' : 'bg-slate-600 text-slate-200'}`}
                      title={canUploadAvatar ? 'آپلود عکس پروفایل' : 'برای آپلود عکس باید اشتراک نقره‌ای یا طلایی داشته باشید'}
                    >
                      {isAvatarUploading ? '...' : canUploadAvatar ? '📷' : '🔒'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                  </>
                )}
              </div>

              <div>
                <div className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">
                    اشتراک {subscriptionLabels[profileUser.subscription] || 'پایه'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
                    {roleLabels[profileUser.role] || 'کاربر'}
                  </span>
                  {profileUser.role === ROLES.ARTIST && profileUser.isVerified && (
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                      هنرمند تایید شده
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-black md:text-4xl">{profileUser.displayName}</h1>
                <p className="mt-2 text-sm text-slate-300">@{profileUser.username}</p>
                {profileUser.bio && <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{profileUser.bio}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              {!isOwnProfile && currentUser && (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={isFollowProcessing}
                  className={`rounded-full px-6 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${isFollowing ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'}`}
                >
                  {isFollowProcessing ? 'در حال پردازش...' : isFollowing ? 'لغو دنبال کردن' : 'دنبال کردن'}
                </button>
              )}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                >
                  ویرایش پروفایل
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="دنبال‌کننده" value={profileUser.followers?.length} />
          <StatCard label="دنبال‌شونده" value={profileUser.following?.length} />
          <StatCard label="استریم روزانه" value={profileUser.dailyStreams} />
          <StatCard label="کل استریم‌ها" value={profileUser.totalStreams} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">اطلاعات شخصی</h2>
            {isOwnProfile && !canUploadAvatar && (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                تغییر عکس برای اشتراک پایه غیرفعال است
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <InfoItem label="نام نمایشی" value={profileUser.displayName} />
            <InfoItem label="نام کاربری اختصاصی" value={`@${profileUser.username}`} />
            <InfoItem label="ایمیل" value={isOwnProfile ? profileUser.email : 'خصوصی'} />
            <InfoItem label="تاریخ تولد" value={isOwnProfile ? formatDate(profileUser.birthDate) : 'خصوصی'} />
            <InfoItem label="جنسیت" value={isOwnProfile ? genderLabels[profileUser.gender] : 'خصوصی'} />
            <InfoItem label="نوع اشتراک" value={subscriptionLabels[profileUser.subscription] || 'پایه'} />
          </div>
        </section>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold">ویرایش پروفایل</h3>
              <button type="button" onClick={() => setIsEditing(false)} className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/15">
                بستن
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-300">نام نمایشی</label>
                  <input name="displayName" value={editData.displayName} onChange={handleEditChange} className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-emerald-300" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">ایمیل</label>
                  <input name="email" type="email" value={editData.email} onChange={handleEditChange} className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-emerald-300" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">تاریخ تولد</label>
                  <input name="birthDate" type="date" value={editData.birthDate} onChange={handleEditChange} className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-emerald-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">جنسیت</label>
                  <select name="gender" value={editData.gender} onChange={handleEditChange} className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-emerald-300">
                    <option className="text-slate-950" value="male">مرد</option>
                    <option className="text-slate-950" value="female">زن</option>
                    <option className="text-slate-950" value="other">سایر</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">بیوگرافی</label>
                <textarea name="bio" value={editData.bio} onChange={handleEditChange} rows="4" className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-emerald-300" />
              </div>

              {canUploadAvatar ? (
                <div>
                  <label className="block text-sm font-medium text-slate-300">آدرس عکس پروفایل</label>
                  <input name="avatar" value={editData.avatar} onChange={handleEditChange} placeholder="URL عکس" className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-emerald-300" />
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                  طبق محدودیت اشتراک پایه، امکان تغییر عکس پروفایل در این صفحه غیرفعال است.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isUpdating} className="flex-1 rounded-xl bg-emerald-400 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
                  {isUpdating ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/15">
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
