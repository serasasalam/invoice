import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-amber-950 text-amber-50 border border-amber-700/60 shadow-lg text-xs font-semibold print:hidden"
    >
      <WifiOff className="w-4 h-4 text-amber-300 shrink-0" />
      <span>
        Mode Offline — Menampilkan data tersimpan (PDF Invoice tetap bisa diunduh)
      </span>
    </div>
  );
};
