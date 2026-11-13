import React from 'react';
import { SERASA_SALAM_LOGO_DATA_URL } from '../assets/serasaLogoDataUrl';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

export type AuthPhase = 'checking' | 'unauthenticated' | 'denied' | 'authorized';

interface LoginGateScreenProps {
  phase: AuthPhase;
  isLoggingIn: boolean;
  attemptedEmail?: string | null;
  deniedReason?: string | null;
  loginError?: string | null;
  onGoogleLogin: () => void;
  onLogout: () => void;
}

export const LoginGateScreen: React.FC<LoginGateScreenProps> = ({
  phase,
  isLoggingIn,
  attemptedEmail,
  deniedReason,
  loginError,
  onGoogleLogin,
  onLogout,
}) => {
  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const isUnauthorizedDomainError = Boolean(
    loginError &&
      (loginError.includes('unauthorized-domain') ||
        loginError.includes('domain ini belum terdaftar'))
  );

  return (
    <div className="min-h-[100dvh] bg-[#F4F7F5] text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-10">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-4xl bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Panel: Brand & Access Policy (Desktop Left / Mobile Top) */}
          <div className="lg:col-span-5 bg-[#114232] text-white p-6 sm:p-8 flex flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="inline-flex items-center bg-white px-3.5 py-2 rounded-2xl shadow-xs">
                <img
                  src={SERASA_SALAM_LOGO_DATA_URL}
                  alt="Serasa Salam Undangan"
                  className="h-8 w-auto object-contain"
                />
              </div>

              <div className="space-y-2.5">
                <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight leading-tight text-balance">
                  Portal Pembukuan &amp; Invoice Internal
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100/85 leading-relaxed">
                  Kelola pesanan Tracker Closing, cetak PDF Invoice resmi, dan pantau follow up pelanggan dalam satu workspace terpadu.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/15">
              <div className="flex items-start gap-2.5 text-xs text-emerald-100/90">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <span>
                  Hanya akun Google yang telah didaftarkan Admin yang dapat masuk ke sistem.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-emerald-100/80">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <span>
                  Riwayat pesanan, nomor WhatsApp klien, dan data keuangan tetap aman.
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel: Interactive Login / Checking / Denied Gate */}
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
            {phase === 'checking' && (
              <div className="py-10 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#114232]">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Memverifikasi Akses Akun...
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
                    Sedang memeriksa apakah akun Google Anda terdaftar pada daftar akses resmi Serasa Salam.
                  </p>
                </div>
              </div>
            )}

            {phase === 'unauthenticated' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#114232]">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Akses Terproteksi</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    Masuk dengan Akun Google Terdaftar
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Gunakan akun Google (Gmail) yang sudah didaftarkan oleh Admin Serasa Salam untuk membuka dasbor pembukuan.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2 leading-relaxed">
                    <div className="flex items-start gap-2 font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>Gagal Masuk dengan Google</span>
                    </div>
                    <p className="text-rose-800">{loginError}</p>
                    {isUnauthorizedDomainError && currentHost && (
                      <div className="pt-1.5 border-t border-rose-200/80 text-[11px] text-rose-900">
                        Untuk mengaktifkan login di domain <code className="font-mono font-bold">{currentHost}</code>, tambahkan domain tersebut di{' '}
                        <strong>Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</strong>.
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    disabled={isLoggingIn}
                    className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-sm flex items-center justify-center gap-3 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#114232]" />
                        <span>Menghubungkan ke Google...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          className="w-5 h-5 shrink-0"
                          aria-hidden="true"
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </svg>
                        <span>Masuk dengan Akun Google</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    Belum bisa masuk? Pastikan email Google Anda sudah didaftarkan oleh Owner/Admin di menu <strong>Kelola Akun Login</strong>.
                  </p>
                </div>
              </div>
            )}

            {phase === 'denied' && (
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Akses Ditolak — Akun Belum Terdaftar
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {deniedReason ||
                      'Akun Google Anda belum terdaftar oleh Admin Serasa Salam sehingga tidak dapat membuka sistem ini.'}
                  </p>
                </div>

                {attemptedEmail && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Akun Google yang digunakan:
                      </div>
                      <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 truncate mt-0.5">
                        {attemptedEmail}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-rose-700 shrink-0">
                      Tidak Terdaftar
                    </span>
                  </div>
                )}

                {loginError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    {loginError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    disabled={isLoggingIn}
                    className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#114232] hover:bg-[#0c3124] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isLoggingIn ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="w-4 h-4" />
                    )}
                    <span>Ganti Akun Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="pt-6 text-center text-[11px] text-slate-400">
        Serasa Salam Undangan Lembang · Sistem Pembukuan &amp; Invoice Terproteksi
      </footer>
    </div>
  );
};
