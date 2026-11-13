import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AccountRole,
  AllowedAccountDoc,
  OWNER_ADMIN_EMAIL,
  registerAllowedAccount,
  removeAllowedAccount,
  subscribeAllowedAccounts,
  updateAllowedAccount,
} from '../services/auth';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';

interface AdminAccessPanelProps {
  currentUser: User;
}

export const AdminAccessPanel: React.FC<AdminAccessPanelProps> = ({
  currentUser,
}) => {
  const [accounts, setAccounts] = useState<AllowedAccountDoc[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelSuccess, setPanelSuccess] = useState<string | null>(null);

  // Add account form states
  const [emailInput, setEmailInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [roleInput, setRoleInput] = useState<AccountRole>('staff');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Row-level busy state & delete confirm state
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllowedAccounts(
      (list) => {
        setAccounts(list);
        setIsLoading(false);
        setPanelError(null);
      },
      (errMsg) => {
        setPanelError(errMsg);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setPanelError(null);
    setPanelSuccess(null);
    setIsSubmitting(true);

    try {
      await registerAllowedAccount(currentUser, {
        email: emailInput,
        displayName: nameInput,
        role: roleInput,
        notes: notesInput,
      });
      setPanelSuccess(
        `Akun "${emailInput.trim().toLowerCase()}" berhasil didaftarkan dan sekarang dapat login ke sistem.`
      );
      setEmailInput('');
      setNameInput('');
      setRoleInput('staff');
      setNotesInput('');
    } catch (err: any) {
      setPanelError(err?.message || 'Gagal mendaftarkan akun Google baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (acc: AllowedAccountDoc) => {
    if (acc.email === OWNER_ADMIN_EMAIL) return;
    setPanelError(null);
    setPanelSuccess(null);
    setBusyAccountId(acc.id);
    try {
      await updateAllowedAccount(acc.id, { active: !acc.active });
      setPanelSuccess(
        `Status akses "${acc.email}" diubah menjadi ${!acc.active ? 'Aktif' : 'Dinonaktifkan'}.`
      );
    } catch (err: any) {
      setPanelError(err?.message || 'Gagal memperbarui status akses akun.');
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleToggleRole = async (acc: AllowedAccountDoc) => {
    if (acc.email === OWNER_ADMIN_EMAIL) return;
    setPanelError(null);
    setPanelSuccess(null);
    setBusyAccountId(acc.id);
    const nextRole: AccountRole = acc.role === 'admin' ? 'staff' : 'admin';
    try {
      await updateAllowedAccount(acc.id, { role: nextRole });
      setPanelSuccess(
        `Peran "${acc.email}" diubah menjadi ${nextRole === 'admin' ? 'Admin' : 'Staf'}.`
      );
    } catch (err: any) {
      setPanelError(err?.message || 'Gagal mengubah peran akun.');
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleDeleteAccount = async (acc: AllowedAccountDoc) => {
    if (acc.email === OWNER_ADMIN_EMAIL) return;
    setPanelError(null);
    setPanelSuccess(null);
    setBusyAccountId(acc.id);
    try {
      await removeAllowedAccount(acc.id);
      setConfirmDeleteId(null);
      setPanelSuccess(`Akses untuk "${acc.email}" telah dihapus dari daftar terdaftar.`);
    } catch (err: any) {
      setPanelError(err?.message || 'Gagal menghapus akun dari daftar.');
    } finally {
      setBusyAccountId(null);
    }
  };

  const activeCount = accounts.filter((a) => a.active).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Kelola Akun Login Google (Admin)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Hanya email Google yang terdaftar dan berstatus Aktif di bawah ini yang dapat masuk ke sistem Serasa Salam.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-600 tabular-nums shrink-0">
          <strong className="text-slate-900">{activeCount}</strong> Akun Aktif dari{' '}
          <strong className="text-slate-900">{accounts.length}</strong> Terdaftar
        </div>
      </div>

      {panelError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">{panelError}</div>
        </div>
      )}

      {panelSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{panelSuccess}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left 5 Cols: Add Registered Google Account Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-[#114232] text-white flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Daftarkan Akun Google Baru
              </h2>
              <p className="text-xs text-slate-500">
                Masukkan email Gmail anggota tim yang diizinkan
              </p>
            </div>
          </div>

          <form onSubmit={handleAddAccount} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Alamat Email Google (Gmail) *
              </label>
              <input
                type="email"
                inputMode="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="contoh: admin.serasasalam@gmail.com"
                className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#114232]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Nama Pengguna / Staf *
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="contoh: Dela (Admin CS)"
                className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#114232]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Peran Akses
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRoleInput('staff')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    roleInput === 'staff'
                      ? 'bg-[#114232] text-white border-[#114232]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Staf Pembukuan
                </button>
                <button
                  type="button"
                  onClick={() => setRoleInput('admin')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    roleInput === 'admin'
                      ? 'bg-[#114232] text-white border-[#114232]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Admin Penuh
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                {roleInput === 'admin'
                  ? 'Admin dapat mengelola data penjualan serta menambah/menghapus akun login.'
                  : 'Staf dapat menginput penjualan, edit status, follow up WA, dan unduh PDF Invoice.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Catatan / Divisi (Opsional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="contoh: Desain & Finishing Lembang"
                className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#114232]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#114232] hover:bg-[#0c3124] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mendaftarkan...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Daftarkan Akun Google</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right 7 Cols: Registered Accounts List */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-[#114232] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Daftar Akun Google Terdaftar
                </h2>
                <p className="text-xs text-slate-500">
                  Klik tombol status atau peran untuk mengatur izin akun seketika
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#114232]" />
              <span>Memuat daftar akun...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Belum ada akun terdaftar selain Owner utama.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {accounts.map((acc) => {
                const isOwner = acc.email === OWNER_ADMIN_EMAIL;
                const isBusy = busyAccountId === acc.id;
                const isConfirmingDelete = confirmDeleteId === acc.id;

                return (
                  <div
                    key={acc.id}
                    className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 ${
                          acc.active
                            ? 'bg-[#114232] text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {(acc.displayName || acc.email).charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-slate-900">
                          <span className="truncate">{acc.displayName}</span>
                          {isOwner && (
                            <span className="text-[11px] font-bold text-[#114232]">
                              · Owner Utama
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-600 truncate">
                          {acc.email}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                          <span className="font-semibold text-slate-700">
                            {acc.role === 'admin' ? 'Peran: Admin' : 'Peran: Staf'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-bold ${
                              acc.active ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {acc.active ? 'Akses Aktif' : 'Dinonaktifkan'}
                          </span>
                          {acc.notes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-[200px]">{acc.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    {isOwner ? (
                      <div className="text-[11px] font-semibold text-slate-400 shrink-0 sm:text-right">
                        Dilindungi Sistem
                      </div>
                    ) : isConfirmingDelete ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteAccount(acc)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? 'Menghapus...' : 'Ya, Hapus'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleRole(acc)}
                          className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          title="Ubah peran Admin / Staf"
                        >
                          {acc.role === 'admin' ? 'Jadikan Staf' : 'Jadikan Admin'}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleActive(acc)}
                          className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                            acc.active
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {acc.active ? (
                            <>
                              <UserX className="w-3.5 h-3.5 shrink-0" />
                              <span>Nonaktifkan</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteId(acc.id)}
                          aria-label={`Hapus akun ${acc.email}`}
                          className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="sm:hidden">Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
