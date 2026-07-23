'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSubscriptionPricing } from '@/lib/mockApi';
import { SUBSCRIPTION_TYPES as SUBSCRIPTIONS } from '@/utils/constants';

const planLabels = {
  [SUBSCRIPTIONS.FREE]: 'پایه',
  [SUBSCRIPTIONS.SILVER]: 'نقره‌ای',
  [SUBSCRIPTIONS.GOLD]: 'طلایی',
};

export default function PaymentPage() {
  const [plan, setPlan] = useState(SUBSCRIPTIONS.SILVER);
  const [prices, setPrices] = useState({ silver: null, gold: null });

  useEffect(() => {
    const requestedPlan = new URLSearchParams(window.location.search).get('plan');
    if (Object.values(SUBSCRIPTIONS).includes(requestedPlan)) setPlan(requestedPlan);
    getSubscriptionPricing().then((result) => {
      if (result.success) setPrices(result.data);
    });
  }, []);

  const price = plan === SUBSCRIPTIONS.FREE ? 0 : prices[plan];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-300/20 bg-gradient-to-l from-amber-300/10 via-slate-900 to-slate-950 p-6 text-center shadow-2xl md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-300/15 text-3xl" aria-hidden="true">💳</div>
        <p className="mt-6 text-sm font-semibold text-amber-200">مرحله پرداخت اشتراک</p>
        <h1 className="mt-2 text-3xl font-black">طرح {planLabels[plan]}</h1>
        <p className="mt-4 text-2xl font-black text-amber-200">{price == null ? 'در حال دریافت قیمت...' : price === 0 ? 'رایگان' : `$${Number(price).toFixed(2)} / ماه`}</p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          قیمت نمایش‌داده‌شده مستقیماً از تنظیمات مدیر سامانه دریافت می‌شود. اتصال واقعی به درگاه و فعال‌سازی نهایی اشتراک مطابق صورت پروژه در فاز دوم پیاده‌سازی خواهد شد.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/settings#subscription" className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-200">بازگشت به انتخاب اشتراک</Link>
          <Link href="/" className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">صفحه خانه</Link>
        </div>
      </div>
    </div>
  );
}
