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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">ورود به سامانه</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            یا{' '}
            <Link href="/register" className="font-medium text-green-600 hover:text-green-500">
              ثبت‌نام کنید
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                ایمیل
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                placeholder="ایمیل"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                رمز عبور
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                placeholder="رمز عبور"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-green-600 hover:text-green-500">
                رمز عبور خود را فراموش کرده‌اید؟
              </Link>
            </div>
          </div>

          {(localError || error) && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{localError || error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="group relative flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>
      </div>
    </div>
  );
}
