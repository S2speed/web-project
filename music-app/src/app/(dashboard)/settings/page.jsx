'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { logout as apiLogout, updateUser } from '@/lib/mockApi';
import { SUBSCRIPTION_TYPES as SUBSCRIPTIONS } from '@/utils/constants';

const subscriptionLabels = {
  [SUBSCRIPTIONS.FREE]: 'پایه',
  [SUBSCRIPTIONS.SILVER]: 'نقره‌ای',
  [SUBSCRIPTIONS.GOLD]: 'طلایی',
};

const subscriptionDescriptions = {
  [SUBSCRIPTIONS.FREE]: 'مناسب شروع کار با محدودیت پلی‌لیست و بدون آپلود عکس پروفایل.',
  [SUBSCRIPTIONS.SILVER]: 'امکانات بیشتر برای پلی‌لیست‌ها، دانلود و عکس پروفایل.',
  [SUBSCRIPTIONS.GOLD]: 'دسترسی کامل، آمارهای ویژه و مشاهده زودهنگام آثار جدید.',
};

const defaultSettings = {
  notificationSettings: {
    email: true,
    push: true,
    inApp: true,
    dailyLimit: 10,
  },
  appSound: true,
  language: 'fa',
};

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]">
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {description && <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-400' : 'bg-slate-700'}`}>
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'right-6' : 'right-1'}`} />
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useUser();
  const [settings, setSettings] = useState(defaultSettings);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setSettings({
      notificationSettings: {
        ...defaultSettings.notificationSettings,
        ...(user.notificationSettings || {}),
      },
      appSound: user.appSound ?? defaultSettings.appSound,
      language: user.language || defaultSettings.language,
    });
  }, [user]);

  const handleNotificationChange = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      notificationSettings: {
        ...previous.notificationSettings,
        [key]: value,
      },
    }));
    setNotice('');
    setError('');
  };

  const handleSave = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setIsSaving(true);
    setNotice('');
    setError('');

    const result = await updateUser(user.id, settings);

    if (result.success) {
      setNotice('تنظیمات برنامه ذخیره شد. برای اعمال کامل روی نوار کناری، یک بار صفحه را تازه‌سازی کنید.');
    } else {
      setError(result.error?.message || 'خطا در ذخیره تنظیمات');
    }

    setIsSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      return;
    }

    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setNotice('برای حذف حساب، دوباره روی دکمه حذف حساب کلیک کنید.');
      return;
    }

    setIsSaving(true);
    setError('');

    const result = await updateUser(user.id, {
      displayName: 'حساب حذف‌شده',
      email: `deleted-${user.id}@music.local`,
      isDeleted: true,
      notificationSettings: { email: false, push: false, inApp: false, dailyLimit: 0 },
    });

    if (result.success) {
      await apiLogout();
      await logout();
      router.push('/login');
      return;
    }

    setError(result.error?.message || 'خطا در حذف حساب');
    setIsSaving(false);
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
        <p className="text-slate-300">برای مشاهده تنظیمات ابتدا وارد حساب شوید.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-950">
          ورود
        </Link>
      </div>
    );
  }

  const subscription = user.subscription || SUBSCRIPTIONS.FREE;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-l from-emerald-500/20 via-slate-900 to-slate-950 p-6 md:p-8">
          <p className="text-sm text-emerald-200">تنظیمات برنامه</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">مدیریت تجربه کاربری</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            اعلان‌ها، صدای سامانه، زبان برنامه، وضعیت اشتراک و گزینه حذف حساب از این بخش مدیریت می‌شوند.
          </p>
        </header>

        {(notice || error) && (
          <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
            {error || notice}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <h2 className="text-xl font-bold">اعلان‌ها</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">کانال‌های دریافت اعلان و محدودیت تعداد اعلان روزانه را تنظیم کنید.</p>

            <div className="mt-5 space-y-3">
              <Toggle
                checked={Boolean(settings.notificationSettings.inApp)}
                onChange={(event) => handleNotificationChange('inApp', event.target.checked)}
                label="اعلان داخل برنامه"
                description="اعلان‌ها در صفحه اعلان‌ها و داخل برنامه نمایش داده شوند."
              />
              <Toggle
                checked={Boolean(settings.notificationSettings.push)}
                onChange={(event) => handleNotificationChange('push', event.target.checked)}
                label="اعلان فوری"
                description="برای رویدادهای مهم مثل انتشار اثر جدید یا پاسخ پشتیبانی."
              />
              <Toggle
                checked={Boolean(settings.notificationSettings.email)}
                onChange={(event) => handleNotificationChange('email', event.target.checked)}
                label="اعلان ایمیلی"
                description="ارسال خلاصه و هشدارهای مهم به ایمیل حساب."
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <label htmlFor="dailyLimit" className="block text-sm font-semibold text-white">
                محدودیت اعلان روزانه
              </label>
              <div className="mt-3 flex items-center gap-4">
                <input
                  id="dailyLimit"
                  type="range"
                  min="0"
                  max="50"
                  value={settings.notificationSettings.dailyLimit}
                  onChange={(event) => handleNotificationChange('dailyLimit', Number(event.target.value))}
                  className="w-full accent-emerald-400"
                />
                <span className="w-16 rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-bold text-emerald-200">
                  {settings.notificationSettings.dailyLimit}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
              <h2 className="text-xl font-bold">ظاهر و رفتار برنامه</h2>
              <div className="mt-5 space-y-3">
                <Toggle
                  checked={Boolean(settings.appSound)}
                  onChange={(event) => setSettings((previous) => ({ ...previous, appSound: event.target.checked }))}
                  label="صدای سامانه"
                  description="صداهای کوتاه برای کلیک‌ها، پخش و اعلان‌ها فعال باشد."
                />
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <label htmlFor="language" className="block text-sm font-semibold text-white">
                    زبان برنامه
                  </label>
                  <select
                    id="language"
                    value={settings.language}
                    onChange={(event) => setSettings((previous) => ({ ...previous, language: event.target.value }))}
                    className="mt-3 block w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
                  >
                    <option value="fa">فارسی</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
              <h2 className="text-xl font-bold">اشتراک</h2>
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-sm text-emerald-100">اشتراک فعلی</p>
                <p className="mt-1 text-2xl font-black text-emerald-200">{subscriptionLabels[subscription]}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{subscriptionDescriptions[subscription]}</p>
              </div>
              <Link href="/settings#subscription" className="mt-4 inline-flex w-full justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300">
                رفتن به پرداخت / تغییر اشتراک
              </Link>
              <p className="mt-2 text-xs leading-5 text-slate-500">در فاز اول، این گزینه فقط مسیر رابط کاربری پرداخت فاز دوم را نشان می‌دهد.</p>
            </section>
          </div>
        </section>

        <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 md:p-6">
          <h2 className="text-xl font-bold text-red-100">حذف حساب کاربری</h2>
          <p className="mt-2 text-sm leading-6 text-red-100/80">
            این گزینه برای نمایش جریان حذف حساب در فاز اول پیاده‌سازی شده است. پس از تایید، حساب در داده‌های موک غیرفعال و کاربر خارج می‌شود.
          </p>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isSaving}
            className="mt-4 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteConfirm ? 'تایید حذف حساب' : 'حذف حساب'}
          </button>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
          </button>
        </div>
      </div>
    </div>
  );
}
