'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { completeSandboxPayment, getSubscriptionPricing, purchaseSubscription } from '@/lib/api';
import { SUBSCRIPTION_TYPES as SUBSCRIPTIONS } from '@/utils/constants';

const planLabels = {
  [SUBSCRIPTIONS.FREE]: 'پایه',
  [SUBSCRIPTIONS.SILVER]: 'نقره‌ای',
  [SUBSCRIPTIONS.GOLD]: 'طلایی',
};

export default function PaymentPage() {
  const { user, refreshUser } = useUser();
  const [plan, setPlan] = useState(SUBSCRIPTIONS.SILVER);
  const [prices, setPrices] = useState({ silver: null, gold: null });
  const [durationMonths, setDurationMonths] = useState(1);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const requestedPlan = new URLSearchParams(window.location.search).get('plan');
    if (Object.values(SUBSCRIPTIONS).includes(requestedPlan)) setPlan(requestedPlan);
    getSubscriptionPricing().then((result) => {
      if (result.success) setPrices(result.data);
    });
  }, []);

  const price = plan === SUBSCRIPTIONS.FREE ? 0 : prices[plan];

  const startPayment = async () => {
    if (!user) {
      setError('برای خرید اشتراک ابتدا وارد حساب شوید.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await purchaseSubscription(user.id, plan, { durationMonths });
    if (result.success) {
      if (result.data.paymentUrl?.includes('/api/payments/sandbox/')) {
        setPaymentUrl(result.data.paymentUrl);
        setNotice('سفارش ایجاد شد. برای تکمیل خرید، پرداخت آزمایشی را تأیید کنید.');
      } else if (result.data.paymentUrl) {
        window.location.assign(result.data.paymentUrl);
      } else {
        setError('آدرس درگاه از سرور دریافت نشد.');
      }
    } else {
      setError(result.error?.message || 'ایجاد پرداخت ممکن نشد.');
    }
    setBusy(false);
  };

  const finishSandbox = async (status) => {
    setBusy(true);
    setError('');
    const result = await completeSandboxPayment(paymentUrl, status);
    if (result.success) {
      await refreshUser();
      setNotice('پرداخت با موفقیت ثبت و اشتراک فعال شد.');
      setPaymentUrl('');
    } else {
      setError(result.error?.message || 'پرداخت تکمیل نشد.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-300/20 bg-gradient-to-l from-amber-300/10 via-slate-900 to-slate-950 p-6 text-center shadow-2xl md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-300/15 text-3xl" aria-hidden="true">💳</div>
        <p className="mt-6 text-sm font-semibold text-amber-200">مرحله پرداخت اشتراک</p>
        <h1 className="mt-2 text-3xl font-black">طرح {planLabels[plan]}</h1>
        <p className="mt-4 text-2xl font-black text-amber-200">{price == null ? 'در حال دریافت قیمت...' : price === 0 ? 'رایگان' : `$${Number(price).toFixed(2)} / ماه`}</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          قیمت و سفارش مستقیماً از بک‌اند دریافت می‌شوند. در محیط توسعه، پرداخت از درگاه آزمایشی پروژه انجام می‌شود.
        </p>
        {(notice || error) && (
          <p className={`mt-5 rounded-xl border p-3 text-sm ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
            {error || notice}
          </p>
        )}
        {plan !== SUBSCRIPTIONS.FREE && (
          <label className="mx-auto mt-6 block max-w-xs text-right text-sm text-slate-300">
            مدت اشتراک
            <select
              value={durationMonths}
              onChange={(event) => setDurationMonths(Number(event.target.value))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white"
            >
              {[1, 3, 6, 12].map((months) => (
                <option key={months} value={months}>{months.toLocaleString('fa-IR')} ماه</option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {!paymentUrl && plan !== SUBSCRIPTIONS.FREE && (
            <button type="button" disabled={busy || price == null} onClick={startPayment} className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-200 disabled:opacity-50">
              {busy ? 'در حال ایجاد سفارش...' : `پرداخت $${(Number(price || 0) * durationMonths).toFixed(2)}`}
            </button>
          )}
          {paymentUrl && <button type="button" disabled={busy} onClick={() => finishSandbox('success')} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">تأیید پرداخت آزمایشی</button>}
          {paymentUrl && <button type="button" disabled={busy} onClick={() => finishSandbox('failed')} className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">رد پرداخت آزمایشی</button>}
          <Link href="/settings#subscription" className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">بازگشت به انتخاب اشتراک</Link>
          <Link href="/" className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">صفحه خانه</Link>
        </div>
      </div>
    </div>
  );
}
