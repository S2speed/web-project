'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/lib/mockApi';
import { useUser } from '@/contexts/UserContext';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useUser();
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    birthDate: '',
    gender: 'male',
  });
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'نام نمایشی الزامی است';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'ایمیل الزامی است';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'فرمت ایمیل نامعتبر است';
    }

    if (formData.password.length < 6) {
      newErrors.password = 'رمز عبور باید حداقل ۶ کاراکتر باشد';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'رمز عبور و تایید آن مطابقت ندارند';
    }

    if (!formData.birthDate) {
      newErrors.birthDate = 'تاریخ تولد الزامی است';
    }

    if (!acceptedPrivacy) {
      newErrors.privacy = 'برای ثبت‌نام باید حریم خصوصی را بپذیرید';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerUser({
        displayName: formData.displayName,
        email: formData.email,
        password: formData.password,
        birthDate: formData.birthDate,
        gender: formData.gender,
      });

      if (result.success) {
        const loginResult = await login(formData.email, formData.password);

        if (loginResult.success) {
          router.replace('/');
          return;
        }

        setServerError(loginResult.error?.message || 'حساب ساخته شد، اما ورود خودکار انجام نشد');
        return;
      }

      setServerError(result.error?.message || 'خطا در ثبت‌نام');
    } catch (error) {
      setServerError('خطا در ارتباط با سرور');
    } finally {
      setIsLoading(false);
    }
  };

  const PrivacyModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
        <h3 className="mb-4 text-xl font-bold text-white">سیاست حریم خصوصی</h3>
        <div className="space-y-4 text-sm text-slate-300">
          <p>ما به حریم خصوصی شما احترام می‌گذاریم و متعهد به محافظت از اطلاعات شخصی شما هستیم.</p>
          <p>اطلاعات شما فقط برای بهبود تجربه کاربری استفاده می‌شود و هرگز به اشخاص ثالث فروخته نمی‌شود.</p>
          <p>شما می‌توانید در هر زمان حساب خود را حذف کنید و تمام داده‌های شما پاک خواهد شد.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowPrivacyModal(false)}
          className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
        >
          متوجه شدم
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur sm:p-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-white">ثبت‌نام</h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            قبلاً ثبت‌نام کرده‌اید؟{' '}
            <Link href="/login" className="font-medium text-emerald-300 transition hover:text-emerald-200">
              وارد شوید
            </Link>
          </p>
          <p className="mt-1 text-center text-xs text-slate-500">
            یا{' '}
            <Link href="/register/artist" className="font-medium text-emerald-300 transition hover:text-emerald-200">
              ثبت‌نام به عنوان هنرمند
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-300">
              نام نمایشی
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm placeholder-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              placeholder="نامی که دیگران می‌بینند"
              value={formData.displayName}
              onChange={handleChange}
            />
            {errors.displayName && <p className="mt-1 text-sm text-red-300">{errors.displayName}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
              ایمیل
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm placeholder-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              placeholder="example@email.com"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <p className="mt-1 text-sm text-red-300">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              رمز عبور
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm placeholder-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              placeholder="حداقل ۶ کاراکتر"
              value={formData.password}
              onChange={handleChange}
            />
            {errors.password && <p className="mt-1 text-sm text-red-300">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
              تایید رمز عبور
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm placeholder-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              placeholder="دوباره رمز عبور را وارد کنید"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-300">{errors.confirmPassword}</p>}
          </div>

          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium text-slate-300">
              تاریخ تولد
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm [color-scheme:dark] transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              value={formData.birthDate}
              onChange={handleChange}
            />
            {errors.birthDate && <p className="mt-1 text-sm text-red-300">{errors.birthDate}</p>}
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-slate-300">
              جنسیت
            </label>
            <select
              id="gender"
              name="gender"
              className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
              value={formData.gender}
              onChange={handleChange}
            >
              <option value="male">مرد</option>
              <option value="female">زن</option>
              <option value="other">سایر</option>
            </select>
          </div>

          <div className="flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="privacy"
                name="privacy"
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-slate-950"
                checked={acceptedPrivacy}
                onChange={(event) => setAcceptedPrivacy(event.target.checked)}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="privacy" className="text-slate-300">
                سیاست{' '}
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-emerald-300 underline transition hover:text-emerald-200"
                >
                  حریم خصوصی
                </button>{' '}
                را می‌پذیرم
              </label>
              {errors.privacy && <p className="mt-1 text-sm text-red-300">{errors.privacy}</p>}
            </div>
          </div>

          {serverError && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4">
              <p className="text-sm text-red-300">{serverError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
          </button>
        </form>

        {showPrivacyModal && <PrivacyModal />}
      </div>
    </div>
  );
}
