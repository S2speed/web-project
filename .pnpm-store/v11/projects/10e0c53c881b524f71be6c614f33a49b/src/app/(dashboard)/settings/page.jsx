'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { createTicket, deleteAccount, getSubscriptionPricing, getUserTickets, updateUser } from '@/lib/mockApi';
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

const subscriptionFeatures = {
  [SUBSCRIPTIONS.FREE]: ['۶۰ استریم روزانه', 'حداکثر ۶ پلی‌لیست', 'بدون دانلود آهنگ'],
  [SUBSCRIPTIONS.SILVER]: ['استریم نامحدود', 'حداکثر ۱۰۰ پلی‌لیست', 'دانلود و تصویر نمایه'],
  [SUBSCRIPTIONS.GOLD]: ['تمام امکانات نقره‌ای', 'پلی‌لیست نامحدود', 'دسترسی زودهنگام و آمار کامل'],
};

const subscriptionStyle = {
  [SUBSCRIPTIONS.FREE]: 'border-slate-500/30 bg-slate-500/[0.06]',
  [SUBSCRIPTIONS.SILVER]: 'border-slate-200/30 bg-slate-200/[0.06]',
  [SUBSCRIPTIONS.GOLD]: 'border-amber-300/30 bg-amber-300/[0.07]',
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
  const { user, isLoading, logout, refreshUser } = useUser();
  const [settings, setSettings] = useState(defaultSettings);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState(SUBSCRIPTIONS.FREE);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
  const [tickets, setTickets] = useState([]);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [subscriptionPrices, setSubscriptionPrices] = useState({ silver: null, gold: null });

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
    setActiveSubscription(user.subscription || SUBSCRIPTIONS.FREE);
    getUserTickets(user.id).then((result) => {
      if (result.success) setTickets(result.data);
    });
    getSubscriptionPricing().then((result) => {
      if (result.success) setSubscriptionPrices(result.data);
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
      await refreshUser();
      setNotice('تنظیمات برنامه با موفقیت ذخیره شد.');
    } else {
      setError(result.error?.message || 'خطا در ذخیره تنظیمات');
    }

    setIsSaving(false);
  };

  const handleSubscriptionChange = (nextSubscription) => {
    if (!user || nextSubscription === activeSubscription) {
      return;
    }

    router.push(`/payment?plan=${encodeURIComponent(nextSubscription)}`);
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      return;
    }

    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    if (deletePhrase !== 'حذف حساب') {
      setError('برای تایید، عبارت «حذف حساب» را دقیق وارد کنید.');
      return;
    }

    setIsSaving(true);
    setError('');

    const result = await deleteAccount(user.id);

    if (result.success) {
      await logout();
      router.push('/login');
      return;
    }

    setError(result.error?.message || 'خطا در حذف حساب');
    setIsSaving(false);
  };

  const handleCreateTicket = async (event) => {
    event.preventDefault();
    setTicketSaving(true);
    setNotice('');
    setError('');
    const result = await createTicket(user.id, ticketForm.subject, ticketForm.message);
    if (result.success) {
      setTickets((items) => [result.data, ...items]);
      setTicketForm({ subject: '', message: '' });
      setNotice('تیکت شما ثبت شد و برای تیم پشتیبانی ارسال گردید.');
    } else {
      setError(result.error?.message || 'خطا در ثبت تیکت');
    }
    setTicketSaving(false);
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

  const subscription = activeSubscription;

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

            <section id="subscription" className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
              <h2 className="text-xl font-bold">اشتراک</h2>
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-sm text-emerald-100">اشتراک فعلی</p>
                <p className="mt-1 text-2xl font-black text-emerald-200">{subscriptionLabels[subscription]}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{subscriptionDescriptions[subscription]}</p>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">برای ارتقا یا تغییر طرح، به صفحه پرداخت هدایت می‌شوید. اتصال واقعی به درگاه در فاز دوم انجام می‌شود.</p>
            </section>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div>
            <p className="text-sm text-emerald-200">مدیریت اشتراک</p>
            <h2 className="mt-1 text-2xl font-black">انتخاب طرح مناسب</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {Object.values(SUBSCRIPTIONS).map((plan) => {
              const isCurrent = subscription === plan;

              return (
                <article key={plan} className={`relative rounded-2xl border p-5 ${subscriptionStyle[plan]} ${isCurrent ? 'ring-2 ring-emerald-400/60' : ''}`}>
                  {isCurrent && <span className="absolute left-4 top-4 rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">طرح فعلی</span>}
                  <h3 className="text-xl font-black">{subscriptionLabels[plan]}</h3>
                  <p className="mt-2 text-lg font-black text-emerald-200">{plan === SUBSCRIPTIONS.FREE ? 'رایگان' : subscriptionPrices[plan] == null ? 'در حال دریافت قیمت...' : `$${Number(subscriptionPrices[plan]).toFixed(2)} / ماه`}</p>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-slate-400">{subscriptionDescriptions[plan]}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    {subscriptionFeatures[plan].map((feature) => <li key={feature}>✓ {feature}</li>)}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleSubscriptionChange(plan)}
                    disabled={isCurrent}
                    className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${isCurrent ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white hover:bg-white/15 disabled:opacity-50'}`}
                  >
                    {isCurrent ? 'فعال' : `ادامه برای ${subscriptionLabels[plan]}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-indigo-400/20 bg-indigo-500/[0.06] p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div><p className="text-sm text-indigo-200">مرکز پشتیبانی</p><h2 className="mt-1 text-2xl font-black">ثبت تیکت جدید</h2><p className="mt-2 text-sm text-slate-400">پرسش یا مشکل خود را ارسال کنید؛ پاسخ تیم پشتیبانی از طریق اعلان‌ها اطلاع‌رسانی می‌شود.</p></div>
            <label className="block text-sm text-slate-300">موضوع<input required value={ticketForm.subject} onChange={(event) => setTicketForm({ ...ticketForm, subject: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-300" /></label>
            <label className="block text-sm text-slate-300">متن پیام<textarea required rows="4" value={ticketForm.message} onChange={(event) => setTicketForm({ ...ticketForm, message: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-300" /></label>
            <button disabled={ticketSaving} className="rounded-xl bg-indigo-400 px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{ticketSaving ? 'در حال ارسال...' : 'ارسال تیکت'}</button>
          </form>
          <div>
            <h3 className="font-bold">تیکت‌های اخیر من</h3>
            <div className="mt-4 space-y-3">
              {!tickets.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">هنوز تیکتی ثبت نکرده‌اید.</p>}
              {tickets.slice(0, 5).map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3"><strong className="text-sm">{ticket.subject}</strong><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${ticket.status === 'closed' ? 'bg-slate-500/10 text-slate-400' : ticket.status === 'answered' ? 'bg-indigo-500/10 text-indigo-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{ticket.status === 'closed' ? 'بسته' : ticket.status === 'answered' ? 'پاسخ داده‌شده' : 'باز'}</span></div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{ticket.message}</p>
                  <p className="mt-2 text-[11px] text-slate-600">{ticket.id} · {new Intl.DateTimeFormat('fa-IR').format(new Date(ticket.createdAt))}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 md:p-6">
          <h2 className="text-xl font-bold text-red-100">حذف حساب کاربری</h2>
          <p className="mt-2 text-sm leading-6 text-red-100/80">
            پس از تایید، حساب و داده‌های شخصی وابسته از داده‌های موک حذف می‌شوند و کاربر از سامانه خارج خواهد شد.
          </p>
          {deleteConfirm && (
            <div className="mt-4 max-w-md rounded-2xl border border-red-300/20 bg-slate-950/40 p-4">
              <label htmlFor="deletePhrase" className="block text-sm text-red-100">
                برای تایید، عبارت «حذف حساب» را وارد کنید.
              </label>
              <input
                id="deletePhrase"
                value={deletePhrase}
                onChange={(event) => setDeletePhrase(event.target.value)}
                className="mt-3 w-full rounded-xl border border-red-300/20 bg-slate-950 px-3 py-2 text-white outline-none focus:border-red-300"
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isSaving}
            className="mt-4 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteConfirm ? 'تایید نهایی حذف حساب' : 'حذف حساب'}
          </button>
          {deleteConfirm && (
            <button
              type="button"
              onClick={() => { setDeleteConfirm(false); setDeletePhrase(''); setError(''); }}
              className="mr-2 mt-4 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"
            >
              انصراف
            </button>
          )}
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
