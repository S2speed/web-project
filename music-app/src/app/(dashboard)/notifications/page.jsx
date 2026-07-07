'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import {
  deleteNotification,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/mockApi';
import { NOTIFICATION_TYPES, USER_ROLES as ROLES } from '@/utils/constants';

const typeMeta = {
  [NOTIFICATION_TYPES.SUBSCRIPTION]: { label: 'اشتراک', color: 'bg-amber-300/15 text-amber-100 border-amber-300/20' },
  [NOTIFICATION_TYPES.NEW_RELEASE]: { label: 'اثر جدید', color: 'bg-cyan-300/15 text-cyan-100 border-cyan-300/20' },
  [NOTIFICATION_TYPES.VERIFICATION]: { label: 'احراز هویت', color: 'bg-emerald-300/15 text-emerald-100 border-emerald-300/20' },
  [NOTIFICATION_TYPES.FINANCIAL]: { label: 'مالی', color: 'bg-violet-300/15 text-violet-100 border-violet-300/20' },
  [NOTIFICATION_TYPES.TICKET]: { label: 'تیکت', color: 'bg-rose-300/15 text-rose-100 border-rose-300/20' },
};

function formatDate(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function roleDescription(role) {
  if (role === ROLES.ARTIST) {
    return 'نتیجه تایید یا رد حساب هنرمندی و اعلان‌های مالی ماهانه در این صفحه نمایش داده می‌شود.';
  }

  if (role === ROLES.ADMIN || role === ROLES.SUPPORT) {
    return 'تیکت‌های جدید کاربران و درخواست‌های احراز هویت هنرمندان تازه ثبت‌شده اینجا دیده می‌شوند.';
  }

  return 'هشدار پایان اشتراک و اطلاع‌رسانی انتشار آثار جدید هنرمندان دنبال‌شده اینجا دیده می‌شوند.';
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      if (!user?.id) {
        setIsDataLoading(false);
        return;
      }

      setIsDataLoading(true);
      setError('');

      const result = await getUserNotifications(user.id);

      if (!isMounted) {
        return;
      }

      if (result.success) {
        setNotifications(result.data);
      } else {
        setError(result.error?.message || 'خطا در دریافت اعلانات');
      }

      setIsDataLoading(false);
    };

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const filters = useMemo(() => {
    const availableTypes = Array.from(new Set(notifications.map((notification) => notification.type)));
    return ['all', 'unread', ...availableTypes];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((notification) => !notification.isRead);
    }

    if (activeFilter === 'all') {
      return notifications;
    }

    return notifications.filter((notification) => notification.type === activeFilter);
  }, [activeFilter, notifications]);

  const handleMarkAsRead = async (notification) => {
    if (notification.isRead) {
      return;
    }

    const result = await markNotificationAsRead(notification.id);

    if (result.success) {
      setNotifications((previous) => previous.map((item) => (item.id === notification.id ? result.data : item)));
    } else {
      setError(result.error?.message || 'خطا در علامت‌گذاری اعلان');
    }
  };

  const handleReadAll = async () => {
    if (!user?.id || unreadCount === 0) {
      return;
    }

    const result = await markAllNotificationsAsRead(user.id);

    if (result.success) {
      setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
    } else {
      setError(result.error?.message || 'خطا در خواندن همه اعلانات');
    }
  };

  const handleDelete = async (notificationId) => {
    const result = await deleteNotification(notificationId);

    if (result.success) {
      setNotifications((previous) => previous.filter((item) => item.id !== notificationId));
    } else {
      setError(result.error?.message || 'خطا در حذف اعلان');
    }
  };

  const handleOpen = async (notification) => {
    await handleMarkAsRead(notification);

    if (notification.link) {
      router.push(notification.link);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950" dir="rtl">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-slate-950 p-8 text-center text-white" dir="rtl">
        <p className="text-slate-300">برای مشاهده اعلانات ابتدا وارد حساب شوید.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-950">
          ورود
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-l from-cyan-500/20 via-slate-900 to-slate-950 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-cyan-200">اعلانات</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">مرکز پیام‌های سامانه</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{roleDescription(user.role)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-center">
              <p className="text-2xl font-black text-cyan-200">{new Intl.NumberFormat('fa-IR').format(unreadCount)}</p>
              <p className="text-sm text-slate-400">خوانده‌نشده</p>
            </div>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const label = filter === 'all' ? 'همه' : filter === 'unread' ? 'خوانده‌نشده' : typeMeta[filter]?.label || filter;
                const isActive = activeFilter === filter;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 text-slate-200 hover:bg-white/15'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleReadAll}
              disabled={unreadCount === 0}
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              خواندن همه اعلانات
            </button>
          </div>
        </section>

        <section className="space-y-3">
          {isDataLoading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">در حال دریافت اعلانات...</div>
          ) : filteredNotifications.length ? (
            filteredNotifications.map((notification) => {
              const meta = typeMeta[notification.type] || { label: 'اعلان', color: 'bg-white/10 text-white border-white/10' };

              return (
                <article
                  key={notification.id}
                  className={`rounded-3xl border p-4 transition md:p-5 ${notification.isRead ? 'border-white/10 bg-white/[0.03]' : 'border-cyan-300/30 bg-cyan-300/[0.08] shadow-lg shadow-cyan-950/20'}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <button type="button" onClick={() => handleOpen(notification)} className="min-w-0 flex-1 text-right">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${meta.color}`}>{meta.label}</span>
                        {!notification.isRead && <span className="rounded-full bg-cyan-300 px-2 py-1 text-xs font-bold text-slate-950">جدید</span>}
                        <span className="text-xs text-slate-500">{formatDate(notification.createdAt)}</span>
                      </div>
                      <h2 className="text-lg font-bold text-white">{notification.title}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{notification.message}</p>
                    </button>

                    <div className="flex shrink-0 gap-2 md:flex-col">
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notification)}
                        disabled={notification.isRead}
                        className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        علامت‌گذاری به عنوان خوانده‌شده
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(notification.id)}
                        className="rounded-xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25"
                      >
                        حذف اعلان
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
              <p className="text-xl font-bold text-white">اعلانی برای نمایش وجود ندارد</p>
              <p className="mt-2 text-sm text-slate-400">وقتی پیام تازه‌ای برسد، همین‌جا نمایش داده می‌شود.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
