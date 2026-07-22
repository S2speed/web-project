'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import {
  closeTicket,
  getAllArtists,
  getAllTickets,
  getAllUsers,
  getArtistStats,
  getMonthlyFinancialReport,
  getPendingArtists,
  getSystemStats,
  replyToTicket,
  settleArtistPayment,
  updateSubscriptionPrices,
  verifyArtist,
} from '@/lib/mockApi';
import { SUBSCRIPTION_TYPES, USER_ROLES } from '@/utils/constants';

const control = 'mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400';
const number = (value) => Number(value || 0).toLocaleString('fa-IR');
const date = (value) => value ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(value)) : '—';

export default function AdminDashboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const [tab, setTab] = useState('verification');
  const [pending, setPending] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [artists, setArtists] = useState([]);
  const [artistStats, setArtistStats] = useState({});
  const [users, setUsers] = useState([]);
  const [financial, setFinancial] = useState(null);
  const [system, setSystem] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reply, setReply] = useState('');
  const [prices, setPrices] = useState({ silver: '', gold: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const allowed = user && [USER_ROLES.ADMIN, USER_ROLES.SUPPORT].includes(user.role);
  const admin = user?.role === USER_ROLES.ADMIN;

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [pendingResult, ticketResult, financialResult, systemResult, artistResult, userResult] = await Promise.all([
      getPendingArtists(), getAllTickets(), getMonthlyFinancialReport(), getSystemStats(), getAllArtists(),
      admin ? getAllUsers() : Promise.resolve({ success: true, data: [] }),
    ]);
    if (pendingResult.success) setPending(pendingResult.data);
    if (ticketResult.success) setTickets(ticketResult.data);
    if (financialResult.success) setFinancial(financialResult.data);
    if (userResult.success) setUsers(userResult.data);
    if (systemResult.success) {
      setSystem(systemResult.data);
      setPrices({ silver: systemResult.data.subscriptionPrices?.silver ?? '', gold: systemResult.data.subscriptionPrices?.gold ?? '' });
    }
    if (artistResult.success) {
      setArtists(artistResult.data);
      const entries = await Promise.all(artistResult.data.map(async (artist) => {
        const result = await getArtistStats(artist.id);
        return [artist.id, result.success ? result.data : {}];
      }));
      setArtistStats(Object.fromEntries(entries));
    }
    setLoading(false);
  }, [admin, allowed]);

  useEffect(() => { load(); }, [load]);

  const verify = async (artist, status) => {
    if (status === 'rejected' && !rejectReason.trim()) {
      setNotice({ error: true, text: 'برای رد درخواست، دلیل را وارد کنید.' });
      return;
    }
    setBusy(artist.id);
    const result = await verifyArtist(artist.id, status, rejectReason);
    if (result.success) {
      setNotice({ text: status === 'approved' ? 'درخواست هنرمند تأیید شد.' : 'درخواست هنرمند رد شد.' });
      setSelectedArtist(null);
      setRejectReason('');
      await load();
    } else setNotice({ error: true, text: result.error.message });
    setBusy('');
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedTicket || !reply.trim()) return;
    setBusy(selectedTicket.id);
    const result = await replyToTicket(selectedTicket.id, reply);
    if (result.success) {
      setSelectedTicket(result.data);
      setTickets((items) => items.map((item) => item.id === result.data.id ? result.data : item));
      setReply('');
      setNotice({ text: 'پاسخ ارسال شد.' });
    } else setNotice({ error: true, text: result.error.message });
    setBusy('');
  };

  const closeSelectedTicket = async () => {
    if (!selectedTicket) return;
    setBusy(selectedTicket.id);
    const result = await closeTicket(selectedTicket.id);
    if (result.success) {
      setSelectedTicket(result.data);
      setTickets((items) => items.map((item) => item.id === result.data.id ? result.data : item));
      setNotice({ text: 'تیکت بسته شد.' });
    } else setNotice({ error: true, text: result.error.message });
    setBusy('');
  };

  const settle = async (artist) => {
    if (!window.confirm(`تسویه حساب ${artist.stageName} انجام شود؟`)) return;
    setBusy(artist.id);
    const result = await settleArtistPayment(artist.id);
    if (result.success) {
      setNotice({ text: `تسویه $${result.data.amount.toFixed(2)} ثبت شد.` });
      await load();
    } else setNotice({ error: true, text: result.error.message });
    setBusy('');
  };

  const savePrices = async (event) => {
    event.preventDefault();
    setBusy('prices');
    const result = await updateSubscriptionPrices(prices.silver, prices.gold);
    if (result.success) {
      setNotice({ text: 'قیمت اشتراک‌ها به‌روزرسانی شد.' });
      await load();
    } else setNotice({ error: true, text: result.error.message });
    setBusy('');
  };

  const openTickets = useMemo(() => tickets.filter((ticket) => ticket.status !== 'closed').length, [tickets]);
  const distribution = useMemo(() => ({
    free: users.filter((item) => item.subscription === SUBSCRIPTION_TYPES.FREE).length,
    silver: users.filter((item) => item.subscription === SUBSCRIPTION_TYPES.SILVER).length,
    gold: users.filter((item) => item.subscription === SUBSCRIPTION_TYPES.GOLD).length,
  }), [users]);

  if (userLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-300">در حال بارگذاری داشبورد...</div>;
  if (!allowed) return <AccessDenied />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 sm:p-6 lg:p-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-l from-indigo-500/20 via-slate-900 to-slate-900 p-5 sm:p-8">
        <p className="text-sm font-semibold text-indigo-300">{admin ? 'مدیر سامانه' : 'پشتیبان'}</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">مرکز عملیات و پشتیبانی</h1>
        <p className="mt-2 text-sm text-slate-300">احراز هویت هنرمندان، تیکت‌ها، حسابرسی و مدیریت اشتراک‌ها</p>
      </header>

      {notice && <div role="status" className={`rounded-2xl border p-4 text-sm ${notice.error ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>{notice.text}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="درخواست احراز هویت" value={pending.length} color="text-amber-300" />
        <Stat label="تیکت باز" value={openTickets} color="text-rose-300" />
        <Stat label="کاربر سامانه" value={system?.usersCount} color="text-indigo-300" />
        <Stat label="استریم کل" value={number(system?.totalStreams)} color="text-emerald-300" />
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2">
        {[
          ['verification', `احراز هویت (${pending.length})`], ['tickets', `تیکت‌ها (${openTickets})`], ['finance', 'حسابرسی'],
          ...(admin ? [['system', 'اشتراک‌ها و آمار']] : []),
        ].map(([value, label]) => <button type="button" key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-indigo-400 text-slate-950' : 'text-slate-300 hover:bg-white/10'}`}>{label}</button>)}
      </nav>

      {tab === 'verification' && (
        <Panel title="درخواست‌های هنرمندی">
          {!pending.length ? <Empty text="درخواست جدیدی وجود ندارد." /> : <div className="divide-y divide-white/10">{pending.map((artist) => (
            <article key={artist.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <img src={artist.cover} alt="" className="h-14 w-14 rounded-full bg-slate-800 object-cover" />
              <div className="min-w-0 flex-1"><h3 className="font-bold">{artist.stageName}</h3><p className="truncate text-xs text-slate-400">{artist.user?.email || artist.id} · {artist.genres?.join('، ') || 'بدون ژانر'}</p></div>
              <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">در انتظار بررسی</span>
              <button type="button" onClick={() => setSelectedArtist(artist)} className="rounded-xl bg-white/10 px-4 py-2 text-sm">جزئیات</button>
              <button type="button" disabled={busy === artist.id} onClick={() => verify(artist, 'approved')} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">تأیید</button>
            </article>
          ))}</div>}
        </Panel>
      )}

      {tab === 'tickets' && (
        <Panel title="تیکت‌های پشتیبانی">
          {!tickets.length ? <Empty text="تیکتی ثبت نشده است." /> : <div className="divide-y divide-white/10">{tickets.map((ticket) => (
            <button type="button" key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="flex w-full flex-col gap-3 p-4 text-right hover:bg-white/5 sm:flex-row sm:items-center">
              <span className={`h-2.5 w-2.5 rounded-full ${ticket.status === 'closed' ? 'bg-slate-500' : 'bg-emerald-400'}`} />
              <div className="min-w-0 flex-1"><h3 className="truncate font-bold">{ticket.subject}</h3><p className="truncate text-xs text-slate-400">{ticket.message}</p></div>
              <span className="text-xs text-slate-500">{date(ticket.updatedAt)}</span><span className="rounded-full bg-white/5 px-3 py-1 text-xs">{ticket.status === 'closed' ? 'بسته' : 'باز'}</span>
            </button>
          ))}</div>}
        </Panel>
      )}

      {tab === 'finance' && (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Money label="درآمد اشتراک" value={financial?.subscriptionRevenue} /><Money label="درآمد استریم" value={financial?.streamRevenue} /><Money label="سهم هنرمندان" value={financial?.artistPayouts} /><Money label="درآمد پلتفرم" value={financial?.platformRevenue} /></section>
          <section className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
            <table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-white/5 text-slate-400"><tr><th className="p-4">هنرمند</th><th className="p-4">شنونده ماهانه</th><th className="p-4">استریم</th><th className="p-4">پاداش</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead>
              <tbody className="divide-y divide-white/10">{artists.map((artist) => {
                const stats = artistStats[artist.id] || {};
                const paid = financial?.settledPayments?.some((payment) => payment.artistId === artist.id && payment.status === 'settled');
                return <tr key={artist.id}><td className="p-4 font-bold">{artist.stageName}<span className="mr-2 text-xs text-slate-500">{artist.id}</span></td><td className="p-4">{number(stats.monthlyListeners)}</td><td className="p-4">{number(stats.totalStreams)}</td><td className="p-4">${Number(stats.estimatedEarnings || 0).toFixed(2)}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs ${paid ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'}`}>{paid ? 'تسویه‌شده' : 'در انتظار پرداخت'}</span></td><td className="p-4">{admin ? <button type="button" disabled={paid || busy === artist.id} onClick={() => settle(artist)} className="rounded-lg bg-indigo-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">تأیید تسویه</button> : <span className="text-xs text-slate-500">فقط مدیر</span>}</td></tr>;
              })}</tbody>
            </table>
          </section>
        </div>
      )}

      {tab === 'system' && admin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={savePrices} className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div><h2 className="text-xl font-bold">کنترل قیمت اشتراک‌ها</h2><p className="mt-1 text-sm text-slate-400">قیمت‌ها به‌صورت پویا در داده‌های ماک ذخیره می‌شوند.</p></div>
            <label className="block text-sm text-slate-300">اشتراک نقره‌ای ($)<input required type="number" min="0.01" step="0.01" value={prices.silver} onChange={(e) => setPrices({ ...prices, silver: e.target.value })} className={control} /></label>
            <label className="block text-sm text-slate-300">اشتراک طلایی ($)<input required type="number" min="0.01" step="0.01" value={prices.gold} onChange={(e) => setPrices({ ...prices, gold: e.target.value })} className={control} /></label>
            <button disabled={busy === 'prices'} className="w-full rounded-xl bg-indigo-400 py-3 font-bold text-slate-950 disabled:opacity-50">به‌روزرسانی قیمت‌ها</button>
          </form>
          <Chart distribution={distribution} />
        </div>
      )}

      {selectedArtist && <Modal title="جزئیات درخواست هنرمندی" close={() => { setSelectedArtist(null); setRejectReason(''); }}>
        <div className="space-y-5"><div className="flex items-center gap-4"><img src={selectedArtist.cover} alt="" className="h-20 w-20 rounded-2xl object-cover" /><div><h3 className="text-xl font-bold">{selectedArtist.stageName}</h3><p className="text-sm text-slate-400">{selectedArtist.user?.email || selectedArtist.id}</p></div></div>
          <div className="grid grid-cols-2 gap-3 text-sm"><Info label="ژانرها" value={selectedArtist.genres?.join('، ') || 'ثبت نشده'} /><Info label="نمونه آثار" value={`${selectedArtist.songs?.length || 0} قطعه`} /></div>
          {selectedArtist.user?.bio && <p className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">{selectedArtist.user.bio}</p>}
          {selectedArtist.songs?.length > 0 && <ul className="space-y-2 rounded-xl bg-white/5 p-3 text-sm">{selectedArtist.songs.slice(0, 4).map((song) => <li key={song.id} className="flex justify-between"><span>{song.title}</span><span className="text-slate-500">{song.genre}</span></li>)}</ul>}
          <label className="block text-sm text-slate-300">دلیل رد درخواست<textarea rows="3" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={control} /></label>
          <div className="flex gap-2"><button type="button" disabled={busy === selectedArtist.id} onClick={() => verify(selectedArtist, 'approved')} className="flex-1 rounded-xl bg-emerald-400 py-3 font-bold text-slate-950">تأیید</button><button type="button" disabled={busy === selectedArtist.id} onClick={() => verify(selectedArtist, 'rejected')} className="flex-1 rounded-xl bg-rose-500/20 py-3 font-bold text-rose-200">رد درخواست</button></div>
        </div>
      </Modal>}

      {selectedTicket && <Modal title={selectedTicket.subject} close={() => setSelectedTicket(null)}>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto"><Message text={selectedTicket.message} at={selectedTicket.createdAt} />{(selectedTicket.replies || []).map((item) => <Message key={item.id} text={item.message} at={item.createdAt} reply />)}
          {selectedTicket.status !== 'closed' ? <form onSubmit={sendReply} className="space-y-3"><textarea required rows="3" value={reply} onChange={(e) => setReply(e.target.value)} className={control} placeholder="پاسخ پشتیبان..." /><div className="flex gap-2"><button disabled={busy === selectedTicket.id} className="flex-1 rounded-xl bg-indigo-400 py-3 font-bold text-slate-950">ارسال پاسخ</button><button type="button" onClick={closeSelectedTicket} className="rounded-xl bg-white/10 px-4">بستن تیکت</button></div></form> : <p className="rounded-xl bg-slate-500/10 p-3 text-center text-sm text-slate-400">این تیکت بسته شده است.</p>}
        </div>
      </Modal>}
    </div>
  );
}

function Stat({ label, value, color }) { return <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className={`text-2xl font-black ${color}`}>{value ?? 0}</p><p className="mt-1 text-xs text-slate-400">{label}</p></article>; }
function Money({ label, value }) { return <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xl font-black text-emerald-300">${Number(value || 0).toFixed(2)}</p><p className="mt-1 text-xs text-slate-400">{label}</p></article>; }
function Panel({ title, children }) { return <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"><h2 className="border-b border-white/10 p-5 text-xl font-bold">{title}</h2>{children}</section>; }
function Empty({ text }) { return <div className="p-12 text-center text-slate-400"><div className="text-4xl">✓</div><p className="mt-3">{text}</p></div>; }
function Info({ label, value }) { return <div className="rounded-xl bg-white/5 p-3"><span className="text-slate-500">{label}</span><strong className="mt-1 block">{value}</strong></div>; }
function Message({ text, at, reply: isReply }) { return <div className={`rounded-2xl p-4 ${isReply ? 'mr-6 bg-indigo-500/10' : 'bg-white/5'}`}><p className="text-sm leading-7">{text}</p><time className="mt-2 block text-xs text-slate-500">{date(at)}</time></div>; }
function AccessDenied() { return <div className="mx-auto max-w-xl p-6 text-center"><div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-8"><h1 className="text-2xl font-bold">دسترسی غیرمجاز</h1><p className="mt-2 text-slate-300">این داشبورد ویژه پشتیبانان و مدیر سامانه است.</p><Link href="/" className="mt-5 inline-block rounded-xl bg-emerald-500 px-5 py-2 font-semibold text-slate-950">بازگشت</Link></div></div>; }

function Modal({ title, close, children }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}><section role="dialog" aria-modal="true" className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:p-6"><header className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button type="button" onClick={close} aria-label="بستن" className="rounded-full bg-white/10 px-3 py-1 text-xl">×</button></header>{children}</section></div>;
}

function Chart({ distribution }) {
  const total = Math.max(distribution.free + distribution.silver + distribution.gold, 1);
  const freeEnd = distribution.free / total * 360;
  const silverEnd = freeEnd + distribution.silver / total * 360;
  const style = { background: `conic-gradient(#64748b 0deg ${freeEnd}deg, #cbd5e1 ${freeEnd}deg ${silverEnd}deg, #fbbf24 ${silverEnd}deg 360deg)` };
  return <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-bold">توزیع سطح اشتراک</h2><div className="mt-6 flex flex-col items-center gap-7 sm:flex-row"><div role="img" aria-label="نمودار توزیع اشتراک‌ها" style={style} className="aspect-square w-44 rounded-full p-6"><div className="flex h-full items-center justify-center rounded-full bg-slate-900 text-center"><div><strong className="text-2xl">{total}</strong><span className="block text-xs text-slate-400">کاربر</span></div></div></div><ul className="w-full space-y-3 text-sm"><Legend color="bg-slate-500" label="پایه" value={distribution.free} /><Legend color="bg-slate-200" label="نقره‌ای" value={distribution.silver} /><Legend color="bg-amber-400" label="طلایی" value={distribution.gold} /></ul></div></section>;
}
function Legend({ color, label, value }) { return <li className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${color}`} /><span className="flex-1 text-slate-300">{label}</span><strong>{value}</strong></li>; }
