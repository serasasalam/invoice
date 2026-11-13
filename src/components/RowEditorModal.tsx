import React, { useEffect, useMemo, useState } from 'react';
import { ColumnSchema, parseNumericCell, SERASA_TAB_RULES } from '../services/sheetsApi';
import { JOB_STATUS_OPTIONS } from '../services/serasaData';
import { formatRupiah } from './BookkeepingSummary';
import { Calendar, CreditCard, Package, Save, User, X } from 'lucide-react';

interface RowEditorModalProps {
  isOpen: boolean;
  sheetTitle: string;
  rowNumber1Based: number;
  columns: ColumnSchema[];
  initialValues: string[];
  onClose: () => void;
  onSaveRow: (rowNumber1Based: number, updatedValues: string[]) => void;
}

const TRACKER_CLOSING_PRESETS = SERASA_TAB_RULES['Tracker Closing']?.presetOptions || {};

export const RowEditorModal: React.FC<RowEditorModalProps> = ({
  isOpen,
  sheetTitle,
  rowNumber1Based,
  columns,
  initialValues,
  onClose,
  onSaveRow,
}) => {
  const [values, setValues] = useState<string[]>(initialValues);

  const isTrackerClosing = sheetTitle === 'Tracker Closing' && columns.length >= 18;

  useEffect(() => {
    const numericIndices = new Set([8, 9, 11, 12, 14]);
    const len = Math.max(columns.length, initialValues.length, 21);
    const padded = Array.from({ length: len }, (_, idx) => {
      const raw = initialValues[idx] !== undefined ? initialValues[idx] : '';
      if (isTrackerClosing && numericIndices.has(idx) && raw.trim() !== '') {
        const parsed = parseNumericCell(raw);
        if (parsed !== null) return String(parsed);
      }
      return raw;
    });
    setValues(padded);
  }, [initialValues, columns, rowNumber1Based, isTrackerClosing]);

  const setField = (index: number, nextVal: string) => {
    setValues((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push('');
      next[index] = nextVal;
      return next;
    });
  };

  // Live billing preview for Tracker Closing (matches Sheet formulas without overwriting formula cells)
  const billing = useMemo(() => {
    const qty = parseNumericCell(values[8] || '') || 0;
    const harga = parseNumericCell(values[9] || '') || 0;
    const diskon = parseNumericCell(values[11] || '') || 0;
    const ongkir = parseNumericCell(values[12] || '') || 0;
    const bayar = parseNumericCell(values[14] || '') || 0;

    const subtotal = qty * harga;
    const totalTagihan = Math.max(0, subtotal - diskon + ongkir);
    const sisa = Math.max(0, totalTagihan - bayar);
    const isPaid = totalTagihan > 0 ? sisa <= 0 : bayar >= 0 && sisa <= 0;

    return { qty, harga, diskon, ongkir, bayar, subtotal, totalTagihan, sisa, isPaid };
  }, [values]);

  const statusChoices = useMemo(() => {
    const uniqueFromSheet = columns[17]?.uniqueValues?.filter(Boolean) || [];
    const current = (values[17] || '').trim();
    return Array.from(
      new Set([...JOB_STATUS_OPTIONS, ...uniqueFromSheet, ...(current ? [current] : [])])
    );
  }, [columns, values]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRow(rowNumber1Based, values.slice(0, columns.length));
  };

  const buildSelectOptions = (colIndex: number, presetKey: string, defaults: string[]) => {
    const presets = TRACKER_CLOSING_PRESETS[presetKey] || defaults;
    const colUnique = columns[colIndex]?.uniqueValues?.filter(Boolean) || [];
    const current = (values[colIndex] || '').trim();
    return Array.from(
      new Set([...presets, ...colUnique, ...(current ? [current] : [])])
    ).filter(Boolean);
  };

  const clientName = (values[2] || '').trim() || 'Pesanan Tanpa Nama';
  const invoiceNo = (values[0] || '').trim();
  const currentStatus = (values[17] || '').trim() || 'Menunggu DP';

  const inputClass =
    'w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#114232] focus:ring-2 focus:ring-[#114232]/10 transition-colors';
  const monoInputClass = `${inputClass} font-mono tabular-nums`;
  const selectClass = `${inputClass} cursor-pointer`;
  const labelClass = 'block text-xs font-semibold text-slate-600 mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="row-editor-title"
    >
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 mx-auto mt-2.5 mb-0.5 shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="row-editor-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 truncate"
              >
                {isTrackerClosing ? `Edit Order — ${clientName}` : `Edit Data — Baris #${rowNumber1Based}`}
              </h3>
              {isTrackerClosing && (
                <span
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                    billing.isPaid
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {billing.isPaid ? 'Lunas' : `Sisa ${formatRupiah(billing.sisa)}`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {isTrackerClosing
                ? `${invoiceNo || 'Belum ada no. invoice'} · Baris #${rowNumber1Based}`
                : `Tab: ${sheetTitle}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Tutup modal edit"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 bg-[#F8FAF9]">
            {isTrackerClosing ? (
              <>
                {/* 1. Status Pekerjaan Stepper */}
                <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Tahap / Status Pekerjaan
                    </span>
                    <span className="text-xs font-semibold text-[#114232]">
                      Aktif: {currentStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-1.5">
                    {statusChoices.map((stage) => {
                      const isActive =
                        currentStatus.toLowerCase() === stage.toLowerCase();
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => setField(17, stage)}
                          className={`min-h-[42px] px-2.5 py-2 text-xs font-semibold rounded-xl border text-center transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#114232] text-white border-[#114232] shadow-2xs'
                              : 'bg-slate-50/70 text-slate-700 border-slate-200 hover:border-emerald-700 hover:bg-white'
                          }`}
                        >
                          {stage}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 2. Data Klien & Acara */}
                <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <User className="w-4 h-4 text-[#114232]" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Data Klien &amp; Acara
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Nama Klien</label>
                      <input
                        type="text"
                        value={values[2] || ''}
                        onChange={(e) => setField(2, e.target.value)}
                        placeholder="Nama pemesan / mempelai"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>No. WhatsApp</label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={values[3] || ''}
                        onChange={(e) => setField(3, e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className={monoInputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>No. Invoice</label>
                      <input
                        type="text"
                        value={values[0] || ''}
                        onChange={(e) => setField(0, e.target.value)}
                        className={monoInputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Tanggal Order / Lead</label>
                      <input
                        type="text"
                        value={values[1] || ''}
                        onChange={(e) => setField(1, e.target.value)}
                        placeholder="Contoh: 6 Nov 2026"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Jenis Acara</label>
                      <select
                        value={values[4] || 'Wedding'}
                        onChange={(e) => setField(4, e.target.value)}
                        className={selectClass}
                      >
                        {buildSelectOptions(4, 'Jenis Acara', [
                          'Wedding',
                          'Khitanan',
                          'Aqiqah',
                          'Tunangan',
                          'Lainnya',
                        ]).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Tanggal Acara</label>
                      <input
                        type="text"
                        value={values[5] || ''}
                        onChange={(e) => setField(5, e.target.value)}
                        placeholder="Contoh: 05/12/2026"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Channel Pemesanan</label>
                      <select
                        value={values[6] || 'WhatsApp'}
                        onChange={(e) => setField(6, e.target.value)}
                        className={selectClass}
                      >
                        {buildSelectOptions(6, 'Channel', [
                          'WhatsApp',
                          'Instagram',
                          'TikTok',
                          'Mitra',
                          'Lainnya',
                        ]).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Kode Mitra (Opsional)</label>
                      <input
                        type="text"
                        value={values[20] || ''}
                        onChange={(e) => setField(20, e.target.value)}
                        placeholder="Kosongkan jika langsung"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </section>

                {/* 3. Paket & Detail Pesanan */}
                <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Package className="w-4 h-4 text-[#114232]" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Paket &amp; Biaya Pesanan
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-6">
                      <label className={labelClass}>Paket Undangan</label>
                      <select
                        value={values[7] || ''}
                        onChange={(e) => setField(7, e.target.value)}
                        className={selectClass}
                      >
                        {buildSelectOptions(7, 'Paket', [
                          'Undangan Cetak Basic',
                          'Undangan Cetak Premium',
                          'Undangan Digital',
                          'Kartu Souvenir',
                          'Eksklusif',
                        ]).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className={labelClass}>Qty (Pcs)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={values[8] || ''}
                        onChange={(e) => setField(8, e.target.value)}
                        className={monoInputClass}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className={labelClass}>Harga / Pcs (Rp)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={values[9] || ''}
                        onChange={(e) => setField(9, e.target.value)}
                        className={monoInputClass}
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className={labelClass}>Diskon (Rp)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={values[11] || ''}
                        onChange={(e) => setField(11, e.target.value)}
                        placeholder="0"
                        className={monoInputClass}
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className={labelClass}>Ongkir / Tambahan (Rp)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={values[12] || ''}
                        onChange={(e) => setField(12, e.target.value)}
                        placeholder="0"
                        className={monoInputClass}
                      />
                    </div>
                  </div>
                </section>

                {/* 4. Pembayaran, Deadline & Catatan */}
                <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <CreditCard className="w-4 h-4 text-[#114232]" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Pembayaran, Deadline &amp; Catatan
                    </h4>
                  </div>

                  {/* Live Calculated Summary Strip */}
                  <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <div>
                      <div className="text-slate-500">Subtotal</div>
                      <div className="mt-0.5 font-mono font-bold text-slate-800 tabular-nums">
                        {formatRupiah(billing.subtotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Total Tagihan</div>
                      <div className="mt-0.5 font-mono font-extrabold text-slate-900 tabular-nums">
                        {formatRupiah(billing.totalTagihan)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500">Sisa Pelunasan</div>
                      <div
                        className={`mt-0.5 font-mono font-extrabold tabular-nums ${
                          billing.sisa > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {billing.sisa > 0 ? formatRupiah(billing.sisa) : 'Rp 0 (Lunas)'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-600">
                          Sudah Dibayar (Rp)
                        </label>
                        {billing.sisa > 0 && (
                          <button
                            type="button"
                            onClick={() => setField(14, String(billing.totalTagihan))}
                            className="text-[11px] font-bold text-[#114232] hover:underline cursor-pointer"
                          >
                            Lunasi Penuh
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={values[14] || ''}
                        onChange={(e) => setField(14, e.target.value)}
                        className={monoInputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Metode Bayar</label>
                      <select
                        value={values[16] || 'Transfer'}
                        onChange={(e) => setField(16, e.target.value)}
                        className={selectClass}
                      >
                        {buildSelectOptions(16, 'Metode Bayar', [
                          'Transfer',
                          'Cash',
                          'QRIS',
                        ]).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Target Deadline</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={values[18] || ''}
                        onChange={(e) => setField(18, e.target.value)}
                        placeholder="Contoh: 15 Nov 2026"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Catatan Order / Produksi</label>
                    <textarea
                      rows={2}
                      value={values[19] || ''}
                      onChange={(e) => setField(19, e.target.value)}
                      placeholder="Contoh: Desain Custom, Kertas Jasmine, Lipat, Bonus Stiker Segel"
                      className={inputClass}
                    />
                  </div>
                </section>
              </>
            ) : (
              /* Fallback generic grid for non-Tracker Closing tabs */
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {columns.map((col, idx) => {
                  const val = values[idx] ?? '';
                  if (col.isFormulaColumn) {
                    return (
                      <div
                        key={col.index}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <div className="text-xs font-semibold text-slate-500">{col.name}</div>
                        <div className="mt-1 text-sm font-mono font-bold text-slate-800 tabular-nums">
                          {val || 'Otomatis'}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={col.index}>
                      <label className={labelClass}>{col.name}</label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setField(idx, e.target.value)}
                        className={
                          col.inferredType === 'currency' || col.inferredType === 'number'
                            ? monoInputClass
                            : inputClass
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clean Sticky Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 sm:py-4 pb-safe border-t border-slate-100 bg-white shrink-0">
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Kolom rumus otomatis Google Sheet tetap terjaga.
            </span>
            <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:ml-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[46px] px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
