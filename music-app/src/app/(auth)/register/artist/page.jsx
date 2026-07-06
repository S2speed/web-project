'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerArtist } from '@/lib/mockApi';

const genreOptions = [
  { value: '', label: 'انتخاب ژانر...' },
  { value: 'pop', label: 'پاپ' },
  { value: 'rock', label: 'راک' },
  { value: 'classical', label: 'کلاسیک' },
  { value: 'jazz', label: 'جاز' },
  { value: 'hip-hop', label: 'هیپ هاپ' },
  { value: 'electronic', label: 'الکترونیک' },
  { value: 'traditional', label: 'سنتی' },
  { value: 'folk', label: 'فولک' },
  { value: 'metal', label: 'متال' },
  { value: 'reggae', label: 'رگی' },
];

export default function ArtistRegisterPage() {
  const router = useRouter();
  const redirectTimerRef = useRef(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    artistName: '',
    bio: '',
    genre: '',
    portfolio: null,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      setFormData((prev) => ({ ...prev, portfolio: file }));
      setErrors((prev) => ({ ...prev, portfolio: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

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

    if (!formData.artistName.trim()) {
      newErrors.artistName = 'نام هنری الزامی است';
    }

    if (!formData.bio.trim()) {
      newErrors.bio = 'بیوگرافی الزامی است';
    }

    if (!formData.genre) {
      newErrors.genre = 'انتخاب ژانر الزامی است';
    }

    if (!formData.portfolio) {
      newErrors.portfolio = 'آپلود نمونه کار الزامی است';
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
      const result = await registerArtist({
        email: formData.email,
        password: formData.password,
        displayName: formData.artistName,
        stageName: formData.artistName,
        bio: formData.bio,
        genre: formData.genre,
        genres: [formData.genre],
        portfolioFile: formData.portfolio?.name || null,
      });

      if (result.success) {
        setIsSuccess(true);
        redirectTimerRef.current = setTimeout(() => {
          router.push('/login?registered=artist');
        }, 3000);
        return;
      }

      setServerError(result.error?.message || 'خطا در ثبت‌نام هنرمند');
    } catch (error) {
      setServerError('خطا در ارتباط با سرور');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">درخواست شما ثبت شد!</h1>
          <p className="mb-4 text-gray-600">حساب کاربری شما در انتظار تایید پشتیبانان است.</p>
          <p className="text-sm text-gray-500">به زودی به شما اطلاع داده می‌شود.</p>
          <div className="mt-4 flex justify-center">
            <div className="h-2 w-32 animate-pulse rounded bg-green-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">ثبت‌نام هنرمند</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            قبلاً ثبت‌نام کرده‌اید؟{' '}
            <Link href="/login" className="font-medium text-green-600 hover:text-green-500">
              وارد شوید
            </Link>
          </p>
          <p className="mt-1 text-center text-xs text-gray-500">
            یا{' '}
            <Link href="/register" className="font-medium text-green-600 hover:text-green-500">
              ثبت‌نام کاربر عادی
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              ایمیل
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              placeholder="example@email.com"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              رمز عبور
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              placeholder="حداقل ۶ کاراکتر"
              value={formData.password}
              onChange={handleChange}
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              تایید رمز عبور
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              placeholder="دوباره رمز عبور را وارد کنید"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>

          <div>
            <label htmlFor="artistName" className="block text-sm font-medium text-gray-700">
              نام هنری
            </label>
            <input
              id="artistName"
              name="artistName"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              placeholder="نامی که به عنوان هنرمند شناخته می‌شوید"
              value={formData.artistName}
              onChange={handleChange}
            />
            {errors.artistName && <p className="mt-1 text-sm text-red-600">{errors.artistName}</p>}
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
              بیوگرافی
            </label>
            <textarea
              id="bio"
              name="bio"
              rows="3"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              placeholder="درباره خودتان و فعالیت هنری‌تان بنویسید..."
              value={formData.bio}
              onChange={handleChange}
            />
            {errors.bio && <p className="mt-1 text-sm text-red-600">{errors.bio}</p>}
          </div>

          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-gray-700">
              ژانر اصلی
            </label>
            <select
              id="genre"
              name="genre"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              value={formData.genre}
              onChange={handleChange}
            >
              {genreOptions.map((option) => (
                <option key={option.value || 'placeholder'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.genre && <p className="mt-1 text-sm text-red-600">{errors.genre}</p>}
          </div>

          <div>
            <label htmlFor="portfolio" className="block text-sm font-medium text-gray-700">
              نمونه کارها
            </label>
            <div className="mt-1 flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pb-6 pt-5 transition hover:border-green-500">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="portfolio"
                    className="relative cursor-pointer rounded-md bg-white font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2"
                  >
                    <span>آپلود نمونه کار</span>
                    <input
                      id="portfolio"
                      name="portfolio"
                      type="file"
                      className="sr-only"
                      accept=".mp3,.wav,.flac,.pdf,.zip"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">یا فایل را اینجا بکشید</p>
                </div>
                <p className="text-xs text-gray-500">MP3, WAV, FLAC, PDF, ZIP (حداکثر ۲۰MB)</p>
                {formData.portfolio && <p className="text-sm text-green-600">✅ {formData.portfolio.name}</p>}
              </div>
            </div>
            {errors.portfolio && <p className="mt-1 text-sm text-red-600">{errors.portfolio}</p>}
          </div>

          {serverError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'در حال ثبت‌نام...' : 'ثبت‌نام و ارسال درخواست'}
          </button>
        </form>
      </div>
    </div>
  );
}
