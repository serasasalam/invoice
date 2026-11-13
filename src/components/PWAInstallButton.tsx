import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Laptop,
  MoreVertical,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Never show install prompt when already running in installed standalone PWA window
  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 space-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#114232]">
            <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Pasang di Desktop / HP</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Install sebagai aplikasi mandiri agar bisa dibuka langsung dari Home Screen atau Desktop.
          </p>
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install Aplikasi</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Install aplikasi Serasa Salam ke Desktop atau Handphone"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#114232] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Install Aplikasi</span>
        </button>
      )}

      {/* Install Instructions Modal (iOS Safari + Desktop/Android Fallback) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[#114232] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="text-sm font-extrabold">
                    Install Aplikasi Serasa Salam
                  </h3>
                  <p className="text-[11px] text-emerald-100/80">
                    Bisa dipasang di Windows, Mac, Android, & iPhone
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              {isIOS ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold">
                    Panduan Install di iPhone / iPad (Safari):
                  </div>
                  <ol className="space-y-2.5 list-decimal list-inside leading-relaxed">
                    <li>
                      Pastikan aplikasi dibuka lewat browser <strong>Safari</strong> (bukan di dalam WhatsApp/Instagram).
                    </li>
                    <li>
                      Ketuk tombol <Share className="w-3.5 h-3.5 inline text-[#114232] mx-0.5" />{' '}
                      <strong>Bagikan (Share)</strong> di bar bagian bawah atau atas layar.
                    </li>
                    <li>
                      Gulir ke bawah lalu pilih{' '}
                      <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                    </li>
                    <li>
                      Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Ikon Serasa Salam langsung muncul di layar HP Anda!
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-slate-900">
                      <Laptop className="w-4 h-4 text-[#114232]" />
                      <span>Di Komputer / Laptop (Chrome / Edge):</span>
                    </div>
                    <p className="leading-relaxed text-slate-600">
                      Buka aplikasi di tab browser penuh (HTTPS), lalu klik ikon{' '}
                      <strong>Install / Layar dengan panah ke bawah</strong> di ujung kanan kolom alamat URL, atau klik titik tiga{' '}
                      <MoreVertical className="w-3 h-3 inline" /> &rarr;{' '}
                      <strong>Cast, save, and share</strong> &rarr;{' '}
                      <strong>Install Serasa Salam</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-slate-900">
                      <Smartphone className="w-4 h-4 text-[#114232]" />
                      <span>Di HP Android (Chrome):</span>
                    </div>
                    <p className="leading-relaxed text-slate-600">
                      Ketuk menu titik tiga <MoreVertical className="w-3 h-3 inline" /> di kanan atas Chrome &rarr; pilih{' '}
                      <strong>Tambahkan ke layar utama (Add to Home screen)</strong> &rarr; pilih{' '}
                      <strong>Install</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      Catatan: Jika Anda sedang membuka pratinjau di dalam AI Studio, tombol install otomatis aktif saat aplikasi dibuka lewat tab browser penuh atau link GitHub Pages Anda.
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-full transition-colors cursor-pointer"
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
