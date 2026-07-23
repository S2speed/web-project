'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { USER_ROLES as ROLES } from '@/utils/constants';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useUser();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [localError, setLocalError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setLocalError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');

    if (!formData.email || !formData.password) {
      setLocalError('لطفاً تمام فیلدها را پر کنید');
      return;
    }

    const result = await login(formData.email, formData.password);

    if (result.success) {
      const user = result.data.user;

      if (user.role === ROLES.ADMIN || user.role === ROLES.SUPPORT) {
        router.push('/admin/dashboard');
      } else if (user.role === ROLES.ARTIST) {
        router.push('/artist/dashboard');
      } else {
        router.push('/');
      }
      return;
    }

    setLocalError(result.error?.message || 'خطا در ورود');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur sm:p-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-white">ورود به سامانه</h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            یا{' '}
            <Link href="/register" className="font-medium text-emerald-300 transition hover:text-emerald-200">
              ثبت‌نام کنید
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
              ایمیل
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm placeholder-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              placeholder="example@email.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              رمز عبور
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm placeholder-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              placeholder="رمز عبور"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-emerald-300 transition hover:text-emerald-200">
                رمز عبور خود را فراموش کرده‌اید؟
              </Link>
            </div>
          </div>

          {(localError || error) && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4">
              <p className="text-sm text-red-300">{localError || error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="group relative flex w-full justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>
      </div>
    </div>
  );
}
