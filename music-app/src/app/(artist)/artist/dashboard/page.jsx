'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import {
  createAlbum,
  deleteAlbum,
  deleteSong,
  getArtistById,
  updateAlbum,
  updateSong,
  uploadSong,
} from '@/lib/mockApi';
import { USER_ROLES } from '@/utils/constants';

const control = 'mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400';
const fileControl = 'mt-2 w-full rounded-xl border border-dashed border-white/15 bg-slate-950/60 p-2 text-xs text-slate-400 file:ml-3 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:font-bold file:text-slate-950';
const today = () => new Date().toISOString().slice(0, 10);
const blankSong = () => ({ title: '', genre: '', releaseDate: today(), albumId: '', lyrics: '' });
const blankAlbum = () => ({ title: '', genre: '', releaseDate: today(), description: '' });
const number = (value) => Number(value || 0).toLocaleString('fa-IR');

export default function ArtistDashboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const [artist, setArtist] = useState(null);
  const [tab, setTab] = useState('works');
  const [songForm, setSongForm] = useState(blankSong);
  const [albumForm, setAlbumForm] = useState(blankAlbum);
  const [editingSong, setEditingSong] = useState(null);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [songCover, setSongCover] = useState(null);
  const [albumCover, setAlbumCover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    if (!user || user.role !== USER_ROLES.ARTIST) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getArtistById(user.id);
    if (result.success) setArtist(result.data);
    else setNotice({ error: true, text: result.error.message });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const saveSong = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    const payload = { ...songForm, artistId: artist.id, albumId: songForm.albumId || null };
    const result = editingSong
      ? await updateSong(editingSong.id, payload)
      : await uploadSong(payload, audioFile, songCover);
    if (result.success) {
      setNotice({ text: editingSong ? 'اثر ویرایش شد.' : 'اثر جدید منتشر شد.' });
      setSongForm(blankSong());
      setEditingSong(null);
      setAudioFile(null);
      setSongCover(null);
      setTab('works');
      await load();
    } else setNotice({ error: true, text: result.error.message });
    setSaving(false);
  };

  const saveAlbum = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    const payload = { ...albumForm, artistId: artist.id };
    const result = editingAlbum
      ? await updateAlbum(editingAlbum.id, payload)
      : await createAlbum(payload, albumCover);
    if (result.success) {
      setNotice({ text: editingAlbum ? 'آلبوم ویرایش شد.' : 'آلبوم ایجاد شد.' });
      setAlbumForm(blankAlbum());
      setEditingAlbum(null);
      setAlbumCover(null);
      await load();
    } else setNotice({ error: true, text: result.error.message });
    setSaving(false);
  };

  const editSong = (song) => {
    setEditingSong(song);
    setSongForm({
      title: song.title || '', genre: song.genre || '', releaseDate: song.releaseDate || today(),
      albumId: song.albumId || '', lyrics: song.lyrics || '',
    });
    setTab('upload');
  };

  const editAlbum = (album) => {
    setEditingAlbum(album);
    setAlbumForm({
      title: album.title || '', genre: album.genre || '', releaseDate: album.releaseDate || today(),
      description: album.description || '',
    });
  };

  const removeSong = async (song) => {
    if (!window.confirm(`آیا «${song.title}» حذف شود؟`)) return;
    const result = await deleteSong(song.id);
    setNotice(result.success ? { text: 'اثر حذف شد.' } : { error: true, text: result.error.message });
    if (result.success) await load();
  };

  const removeAlbum = async (album) => {
    if (!window.confirm(`آیا آلبوم «${album.title}» حذف شود؟`)) return;
    const result = await deleteAlbum(album.id);
    setNotice(result.success ? { text: 'آلبوم حذف شد؛ قطعه‌های آن به تک‌آهنگ تبدیل شدند.' } : { error: true, text: result.error.message });
    if (result.success) await load();
  };

  if (userLoading || loading) return <Loading text="در حال بارگذاری پنل هنرمند..." />;
  if (!user || user.role !== USER_ROLES.ARTIST) return <AccessDenied text="این بخش فقط برای حساب هنرمند در دسترس است." />;

  const stats = artist?.stats || {};
  const songs = artist?.songs || [];
  const albums = artist?.albums || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 sm:p-6 lg:p-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-l from-emerald-500/20 via-slate-900 to-slate-900 p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black sm:text-3xl">مدیریت آثار {artist?.stageName || user.displayName}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${stats.verified ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-200'}`}>
                {stats.verified ? '✓ هنرمند تأییدشده' : 'در انتظار تأیید'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">انتشار تک‌آهنگ و آلبوم، مدیریت آثار و مشاهده آمار</p>
          </div>
          <button type="button" onClick={() => setTab('upload')} className="rounded-2xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300">＋ انتشار اثر</button>
        </div>
      </header>

      {notice && <div role="status" className={`rounded-2xl border p-4 text-sm ${notice.error ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>{notice.text}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="استریم کل" value={number(stats.totalStreams)} />
        <Metric label="شنونده ماهانه" value={number(stats.monthlyListeners)} />
        <Metric label="دنبال‌کننده" value={number(stats.followersCount)} />
        <Metric label="تعداد آثار" value={number(stats.songsCount)} />
        <Metric label="درآمد تخمینی" value={`$${Number(stats.estimatedEarnings || 0).toFixed(2)}`} />
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2">
        {[
          ['works', 'آثار منتشرشده'], ['albums', 'آلبوم‌ها'], ['upload', editingSong ? 'ویرایش اثر' : 'بارگذاری اثر'],
        ].map(([value, label]) => <button type="button" key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:bg-white/10'}`}>{label}</button>)}
      </nav>

      {tab === 'works' && (
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <h2 className="border-b border-white/10 p-5 text-xl font-bold">فهرست آثار</h2>
          {!songs.length ? <Empty text="هنوز اثری منتشر نشده است." /> : <div className="divide-y divide-white/10">
            {songs.map((song) => <article key={song.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <img src={song.cover} alt="" className="h-16 w-16 rounded-xl bg-slate-800 object-cover" />
              <div className="min-w-0 flex-1"><h3 className="truncate font-bold">{song.title}</h3><p className="text-xs text-slate-400">{song.genre || 'بدون ژانر'} · {song.albumId ? 'عضو آلبوم' : 'تک‌آهنگ'} · {song.releaseDate}</p></div>
              <div className="flex gap-5 text-sm text-slate-300"><span>{number(song.playCount)} پخش</span><span>{number(song.listeners)} شنونده</span></div>
              <div className="flex gap-2"><button type="button" onClick={() => editSong(song)} className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20">ویرایش</button><button type="button" onClick={() => removeSong(song)} className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">حذف</button></div>
            </article>)}
          </div>}
        </section>
      )}

      {tab === 'albums' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {albums.map((album) => <article key={album.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <img src={album.cover} alt="" className="aspect-square w-full rounded-2xl bg-slate-800 object-cover" />
              <h3 className="mt-4 truncate font-bold">{album.title}</h3><p className="mt-1 text-xs text-slate-400">{album.trackIds?.length || 0} قطعه · {album.genre || 'بدون ژانر'}</p>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => editAlbum(album)} className="flex-1 rounded-xl bg-white/10 py-2 text-sm">ویرایش</button><button type="button" onClick={() => removeAlbum(album)} className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">حذف</button></div>
            </article>)}
            {!albums.length && <Empty text="هنوز آلبومی ساخته نشده است." />}
          </section>

          <form onSubmit={saveAlbum} className="h-fit space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-bold">{editingAlbum ? 'ویرایش آلبوم' : 'آلبوم جدید'}</h2>
            <Field label="نام آلبوم"><input required value={albumForm.title} onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })} className={control} /></Field>
            <Field label="ژانر"><input value={albumForm.genre} onChange={(e) => setAlbumForm({ ...albumForm, genre: e.target.value })} className={control} /></Field>
            <Field label="تاریخ انتشار"><input type="date" value={albumForm.releaseDate} onChange={(e) => setAlbumForm({ ...albumForm, releaseDate: e.target.value })} className={control} /></Field>
            <Field label="توضیحات"><textarea rows="3" value={albumForm.description} onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })} className={control} /></Field>
            {!editingAlbum && <Field label="تصویر کاور"><input type="file" accept="image/*" onChange={(e) => setAlbumCover(e.target.files?.[0] || null)} className={fileControl} /></Field>}
            <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-xl bg-emerald-400 py-3 font-bold text-slate-950 disabled:opacity-50">{saving ? 'در حال ذخیره...' : 'ذخیره آلبوم'}</button>{editingAlbum && <button type="button" onClick={() => { setEditingAlbum(null); setAlbumForm(blankAlbum()); }} className="rounded-xl bg-white/10 px-4">انصراف</button>}</div>
          </form>
        </div>
      )}

      {tab === 'upload' && (
        <form onSubmit={saveSong} className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7">
          <div><h2 className="text-xl font-bold">{editingSong ? `ویرایش ${editingSong.title}` : 'بارگذاری اثر جدید'}</h2><p className="mt-1 text-sm text-slate-400">فرمت‌های صوتی مجاز: MP3، WAV و FLAC</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام اثر"><input required value={songForm.title} onChange={(e) => setSongForm({ ...songForm, title: e.target.value })} className={control} /></Field>
            <Field label="ژانر"><input required value={songForm.genre} onChange={(e) => setSongForm({ ...songForm, genre: e.target.value })} className={control} /></Field>
            <Field label="تاریخ انتشار"><input type="date" value={songForm.releaseDate} onChange={(e) => setSongForm({ ...songForm, releaseDate: e.target.value })} className={control} /></Field>
            <Field label="نوع انتشار"><select value={songForm.albumId} onChange={(e) => setSongForm({ ...songForm, albumId: e.target.value })} className={control}><option value="">تک‌آهنگ</option>{albums.map((album) => <option key={album.id} value={album.id}>آلبوم {album.title}</option>)}</select></Field>
          </div>
          <Field label="متن آهنگ"><textarea rows="5" value={songForm.lyrics} onChange={(e) => setSongForm({ ...songForm, lyrics: e.target.value })} className={control} placeholder="اختیاری" /></Field>
          {!editingSong && <div className="grid gap-4 sm:grid-cols-2"><Field label="فایل صوتی"><input required type="file" accept="audio/mpeg,audio/wav,audio/flac,.mp3,.wav,.flac" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className={fileControl} /></Field><Field label="تصویر کاور"><input type="file" accept="image/*" onChange={(e) => setSongCover(e.target.files?.[0] || null)} className={fileControl} /></Field></div>}
          <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-xl bg-emerald-400 py-3 font-bold text-slate-950 disabled:opacity-50">{saving ? 'در حال ذخیره...' : editingSong ? 'ذخیره تغییرات' : 'انتشار اثر'}</button>{editingSong && <button type="button" onClick={() => { setEditingSong(null); setSongForm(blankSong()); }} className="rounded-xl bg-white/10 px-5">انصراف</button>}</div>
        </form>
      )}
    </div>
  );
}

function Metric({ label, value }) { return <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xl font-black text-emerald-300 sm:text-2xl">{value}</p><p className="mt-1 text-xs text-slate-400">{label}</p></article>; }
function Field({ label, children }) { return <label className="block text-sm font-medium text-slate-300">{label}{children}</label>; }
function Empty({ text }) { return <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-slate-400">{text}</div>; }
function Loading({ text }) { return <div className="flex min-h-[60vh] items-center justify-center text-slate-300">{text}</div>; }
function AccessDenied({ text }) { return <div className="mx-auto max-w-xl p-6 text-center"><div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-8"><h1 className="text-2xl font-bold">دسترسی محدود</h1><p className="mt-2 text-slate-300">{text}</p><Link href="/" className="mt-5 inline-block rounded-xl bg-emerald-500 px-5 py-2 font-semibold text-slate-950">بازگشت</Link></div></div>; }
