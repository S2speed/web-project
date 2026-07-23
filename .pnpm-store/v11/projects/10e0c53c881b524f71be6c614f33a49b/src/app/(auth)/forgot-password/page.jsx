'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/lib/mockApi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetInfo, setResetInfo] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setResetInfo(null);

    if (!email.trim()) {
      setError('لطفاً ایمیل حساب خود را وارد کنید');
      return;
    }

    setIsLoading(true);

    try {
      const result = await forgotPassword(email);

      if (result.success) {
        setResetInfo(result.data);
        return;
      }

      setError(result.error?.message || 'خطا در ارسال لینک بازیابی');
    } catch (requestError) {
      setError('خطا در ارتباط با سامانه');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">بازیابی رمز عبور</h1>
          <p className="mt-2 text-center text-sm leading-6 text-gray-600">
            ایمیل حساب خود را وارد کنید تا فرم بازیابی برای شما آماده شود.
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              ایمیل
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              placeholder="example@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {resetInfo && (
            <div className="rounded-md bg-green-50 p-4 text-sm leading-6 text-green-800">
              <p className="font-semibold">درخواست بازیابی ثبت شد.</p>
              <p>در نسخه موک، توکن بازیابی ساخته شد و تا ۳۰ دقیقه معتبر است.</p>
              {resetInfo.token && <p className="mt-2 break-all text-xs text-green-700">کد نمونه: {resetInfo.token}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'در حال ارسال...' : 'ارسال درخواست بازیابی'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          رمزتان را به یاد آوردید؟{' '}
          <Link href="/login" className="font-medium text-green-600 hover:text-green-500">
            بازگشت به ورود
          </Link>
        </p>
      </div>
    </div>
  );
}
