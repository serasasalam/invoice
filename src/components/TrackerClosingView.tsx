import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Edit3,
  FileDown,
  LayoutList,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ClosingOrderItem,
  getJobStatusTone,
  JOB_STATUS_OPTIONS,
  parseClosingOrders,
} from '../services/serasaData';
import { SheetDataResult } from '../services/sheetsApi';
import { BookkeepingSummary, formatRupiah } from './BookkeepingSummary';
import { PosOrderModal } from './PosOrderModal';

interface TrackerClosingViewProps {
  title: string;
  subtitle: string;
  sheetData: SheetDataResult;
  allOrders: ClosingOrderItem[];
  defaultPaymentFilter?: 'all' | 'unpaid' | 'paid';
  globalSearch?: string;
  onOpenPosModal: () => void;
  onSavePosRowsToTrackerClosing: (
    rowsToInsert: { rowNumber1Based: number; values: string[] }[],
    invoiceNo: string
  ) => void;
  onOpenInvoice: (invoiceNo: string) => void;
  onEditRow: (rowNumber1Based: number, values: string[]) => void;
  onDeleteRow: (rowNumber1Based: number, values: string[]) => void;
  onQuickMarkPaidAndDone: (order: ClosingOrderItem) => void;
  onUpdateStatus?: (
    target: ClosingOrderItem | ClosingOrderItem[],
    newStatus: string
  ) => Promise<void> | void;
  updatingRowNumbers?: number[];
}

type ViewTab = 'list' | 'entry' | 'summary';
type PaymentFilter = 'all' | 'unpaid' | 'paid';

function formatDisplayPhone(raw: string): { display: string; waUrl: string | null } {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits || digits === '0' || digits.length < 7) {
    return { display: '', waUrl: null };
  }
  let localDisplay = digits;
  let waIntl = digits;
  if (digits.startsWith('8')) {
    localDisplay = `0${digits}`;
    waIntl = `62${digits}`;
  } else if (digits.startsWith('0')) {
    waIntl = `62${digits.slice(1)}`;
  } else if (digits.startsWith('62')) {
    localDisplay = `0${digits.slice(2)}`;
  }
  return {
    display: localDisplay,
    waUrl: `https://wa.me/${waIntl}`,
  };
}

export const TrackerClosingView: React.FC<TrackerClosingViewProps> = ({
  title,
  subtitle,
  sheetData,
  allOrders,
  defaultPaymentFilter = 'all',
  globalSearch = '',
  onOpenPosModal,
  onSavePosRowsToTrackerClosing,
  onOpenInvoice,
  onEditRow,
  onDeleteRow,
  onQuickMarkPaidAndDone,
  onUpdateStatus,
  updatingRowNumbers = [],
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(defaultPaymentFilter);
  const [paketFilter, setPaketFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [tableDensity, setTableDensity] = useState<'clean' | 'spreadsheet'>('clean');
  const [expandedRowNum, setExpandedRowNum] = useState<number | null>(null);

  const parsedOrders = useMemo(() => parseClosingOrders(sheetData), [sheetData]);

  const statusChoices = useMemo(() => {
    const set = new Set<string>(JOB_STATUS_OPTIONS);
    for (const o of parsedOrders) {
      if (o.status) set.add(o.status);
    }
    return Array.from(set);
  }, [parsedOrders]);

  const uniquePackages = useMemo(() => {
    const set = new Set<string>();
    for (const o of parsedOrders) {
      if (o.paket) set.add(o.paket);
    }
    return Array.from(set).sort();
  }, [parsedOrders]);

  const counts = useMemo(() => {
    let unpaid = 0;
    let paid = 0;
    for (const o of parsedOrders) {
      if (o.sisa > 0) unpaid++;
      else paid++;
    }
    return { all: parsedOrders.length, unpaid, paid };
  }, [parsedOrders]);

  const filteredOrders = useMemo(() => {
    const q = (searchQuery || globalSearch).toLowerCase().trim();
    const list = parsedOrders.filter((order) => {
      if (paymentFilter === 'unpaid' && order.sisa <= 0) return false;
      if (paymentFilter === 'paid' && order.sisa > 0) return false;
      if (paketFilter !== 'all' && order.paket !== paketFilter) return false;
      if (
        statusFilter !== 'all' &&
        (order.status || '').toLowerCase() !== statusFilter.toLowerCase()
      ) {
        return false;
      }

      if (!q) return true;
      return (
        order.namaKlien.toLowerCase().includes(q) ||
        order.invoiceNo.toLowerCase().includes(q) ||
        order.paket.toLowerCase().includes(q) ||
        order.noWa.toLowerCase().includes(q) ||
        order.status.toLowerCase().includes(q) ||
        order.tanggalLead.toLowerCase().includes(q) ||
        order.catatan.toLowerCase().includes(q) ||
        String(order.rowNumber1Based).includes(q)
      );
    });

    if (sortOrder === 'newest') {
      return [...list].reverse();
    }
    return list;
  }, [
    parsedOrders,
    searchQuery,
    globalSearch,
    paymentFilter,
    paketFilter,
    statusFilter,
    sortOrder,
  ]);

  const summaryMetrics = useMemo(() => {
    let totalOmzet = 0;
    let totalBayar = 0;
    let totalSisa = 0;
    let unpaidCount = 0;
    const invoiceSet = new Set<string>();

    for (const o of filteredOrders) {
      totalOmzet += o.totalTagihan;
      totalBayar += o.bayar;
      totalSisa += o.sisa;
      if (o.sisa > 0) unpaidCount++;
      if (o.invoiceNo) invoiceSet.add(o.invoiceNo);
    }

    return {
      orderCount: filteredOrders.length,
      invoiceCount: invoiceSet.size,
      totalOmzet,
      totalBayar,
      totalSisa,
      unpaidCount,
    };
  }, [filteredOrders]);

  const handleDownloadCsv = () => {
    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [
      sheetData.headers.map(escapeCsv).join(','),
      ...filteredOrders.map((o) => o.rawValues.map(escapeCsv).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Serasa_Salam_Tracker_Closing.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Page Header & Single-Line Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight text-balance">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div
          className="grid grid-cols-3 md:inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shrink-0 w-full md:w-auto"
          role="tablist"
          aria-label="Mode tampilan Tracker Closing"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'list'}
            onClick={() => setActiveTab('list')}
            className={`min-h-[42px] px-2 sm:px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
              activeTab === 'list'
                ? 'bg-[#114232] text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Order ({parsedOrders.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'entry'}
            onClick={() => setActiveTab('entry')}
            className={`min-h-[42px] px-2 sm:px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
              activeTab === 'entry'
                ? 'bg-[#114232] text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            + Input Baru
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            onClick={() => setActiveTab('summary')}
            className={`min-h-[42px] px-2 sm:px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-[#114232] text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Omzet
          </button>
        </div>
      </div>

      {/* Mode 2: Inline POS Input Penjualan */}
      {activeTab === 'entry' && (
        <PosOrderModal
          isOpen={true}
          isInline={true}
          existingOrders={allOrders}
          nextInsertRow1Based={sheetData.nextInsertRow1Based}
          onSaveRowsToTrackerClosing={onSavePosRowsToTrackerClosing}
        />
      )}

      {/* Mode 3: Rekapitulasi Omzet */}
      {activeTab === 'summary' && (
        <BookkeepingSummary
          sheetTitle="Tracker Closing"
          columns={sheetData.columns}
          rows={sheetData.rows}
        />
      )}

      {/* Mode 1: Clean, Scannable Sales Ledger */}
      {activeTab === 'list' && (
        <>
          {/* Compact 3-Metric Summary Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Order Ditampilkan</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                  {summaryMetrics.orderCount}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  baris · {summaryMetrics.invoiceCount} faktur
                </span>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Total Omzet Tagihan</div>
              <div className="mt-1 text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                {formatRupiah(summaryMetrics.totalOmzet)}
              </div>
              <div className="mt-0.5 text-xs text-emerald-700 font-mono tabular-nums">
                Sudah masuk: {formatRupiah(summaryMetrics.totalBayar)}
              </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-500">Sisa Tagihan (DP)</div>
                <div
                  className={`mt-1 text-xl font-extrabold font-mono tabular-nums ${
                    summaryMetrics.totalSisa > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {formatRupiah(summaryMetrics.totalSisa)}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                  {summaryMetrics.unpaidCount > 0
                    ? `${summaryMetrics.unpaidCount} order menunggu pelunasan`
                    : 'Semua order pada daftar ini lunas'}
                </div>
              </div>
              {summaryMetrics.unpaidCount > 0 && paymentFilter !== 'unpaid' && (
                <button
                  type="button"
                  onClick={() => setPaymentFilter('unpaid')}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Filter DP
                </button>
              )}
            </div>
          </div>

          {/* Main Table Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
            {/* Unified Filter & Search Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              {/* Left: Search + Payment Status Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama klien, no. invoice, paket..."
                    className="w-full min-h-[44px] sm:min-h-0 pl-9 pr-3.5 py-2 text-sm sm:text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-700"
                  />
                </div>

                {/* Payment Segmented Filter */}
                <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setPaymentFilter('all')}
                    className={`min-h-[40px] sm:min-h-0 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                      paymentFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({counts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentFilter('unpaid')}
                    className={`min-h-[40px] sm:min-h-0 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                      paymentFilter === 'unpaid'
                        ? 'bg-white text-amber-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    DP ({counts.unpaid})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentFilter('paid')}
                    className={`min-h-[40px] sm:min-h-0 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                      paymentFilter === 'paid'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lunas ({counts.paid})
                  </button>
                </div>
              </div>

              {/* Right: Status Filter + Paket Filter + Sort + View Density + Export */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter status pekerjaan"
                  className="min-h-[44px] sm:min-h-0 w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-700 cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  {statusChoices.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <select
                  value={paketFilter}
                  onChange={(e) => setPaketFilter(e.target.value)}
                  aria-label="Filter paket undangan"
                  className="min-h-[44px] sm:min-h-0 w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-700 cursor-pointer"
                >
                  <option value="all">Semua Paket</option>
                  {uniquePackages.map((pkt) => (
                    <option key={pkt} value={pkt}>
                      {pkt}
                    </option>
                  ))}
                </select>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  aria-label="Urutan baris"
                  className="min-h-[44px] sm:min-h-0 w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-700 cursor-pointer"
                >
                  <option value="newest">Terbaru di Atas</option>
                  <option value="oldest">Urutan Sheet (#1 &rarr; Akhir)</option>
                </select>

                <div className="hidden lg:inline-flex items-center gap-0.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTableDensity('clean')}
                    title="Tampilan Ringkas & Rapi"
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      tableDensity === 'clean'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>Ringkas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableDensity('spreadsheet')}
                    title="Tampilan Semua 21 Kolom Sheet"
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      tableDensity === 'spreadsheet'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    <span>21 Kolom</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="min-h-[44px] sm:min-h-0 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh CSV</span>
                </button>
              </div>
            </div>

            {/* Empty State */}
            {filteredOrders.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-3">
                <p className="text-sm font-bold text-slate-800">
                  Tidak ada data penjualan yang cocok dengan filter saat ini.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Coba hapus kata kunci pencarian, ubah filter status pekerjaan/pembayaran, atau tambahkan pesanan baru.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2.5">
                  {(searchQuery ||
                    paymentFilter !== 'all' ||
                    paketFilter !== 'all' ||
                    statusFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPaymentFilter('all');
                        setPaketFilter('all');
                        setStatusFilter('all');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenPosModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Input Penjualan Baru</span>
                  </button>
                </div>
              </div>
            ) : tableDensity === 'spreadsheet' ? (
              /* Optional Raw 21-Column Sheet View */
              <div className="overflow-x-auto max-h-[65vh]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5 font-mono">Baris</th>
                      {sheetData.columns.map((col) => (
                        <th
                          key={col.index}
                          className={`py-3 px-3.5 whitespace-nowrap ${
                            col.inferredType === 'currency' || col.inferredType === 'number'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {col.name}
                        </th>
                      ))}
                      <th className="py-3 px-4 text-right whitespace-nowrap sticky right-0 bg-slate-50 border-l border-slate-200">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredOrders.map((order) => (
                      <tr key={order.rowNumber1Based} className="hover:bg-slate-50/90">
                        <td className="py-3 px-3.5 font-mono tabular-nums text-slate-400">
                          #{order.rowNumber1Based}
                        </td>
                        {sheetData.columns.map((col) => {
                          const cell = order.rawValues[col.index] || '';
                          const isNumeric =
                            col.inferredType === 'currency' || col.inferredType === 'number';
                          const isUpdating = updatingRowNumbers.includes(order.rowNumber1Based);
                          if (col.index === 17 && onUpdateStatus) {
                            const currentSt = cell.trim() || order.status || 'Menunggu DP';
                            const options = Array.from(new Set([...statusChoices, currentSt]));
                            return (
                              <td key={col.index} className="py-2 px-3 whitespace-nowrap">
                                <select
                                  value={currentSt}
                                  disabled={isUpdating}
                                  onChange={(e) => onUpdateStatus(order, e.target.value)}
                                  aria-label={`Ubah status ${order.namaKlien}`}
                                  className="px-2 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-700 disabled:opacity-50 cursor-pointer"
                                >
                                  {options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.index}
                              className={`py-3 px-3.5 max-w-[240px] truncate ${
                                isNumeric
                                  ? 'text-right font-mono tabular-nums font-semibold text-slate-900'
                                  : 'text-slate-700'
                              }`}
                              title={cell}
                            >
                              {cell || '—'}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-right whitespace-nowrap sticky right-0 bg-white border-l border-slate-100">
                          <div className="inline-flex items-center gap-1">
                            {order.invoiceNo && (
                              <button
                                type="button"
                                onClick={() => onOpenInvoice(order.invoiceNo)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-lg cursor-pointer"
                              >
                                <FileDown className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditRow(order.rowNumber1Based, order.rawValues)}
                              className="p-1.5 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer"
                              title="Edit baris"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRow(order.rowNumber1Based, order.rawValues)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Clean, Scannable View (Desktop Table + Mobile Cards) */
              <>
                {/* Desktop & Tablet Table */}
                <div className="hidden md:block overflow-x-auto max-h-[65vh]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 pl-5 pr-3">Klien &amp; Faktur</th>
                        <th className="py-3 px-3">Paket &amp; Acara</th>
                        <th className="py-3 px-3 text-right">Tagihan &amp; Pembayaran</th>
                        <th className="py-3 px-3">Status &amp; Deadline</th>
                        <th className="py-3 pl-3 pr-5 text-right">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredOrders.map((order) => {
                        const phone = formatDisplayPhone(order.noWa);
                        const isPaid = order.sisa <= 0;
                        const statusTone = getJobStatusTone(order.status, isPaid);
                        const isExpanded = expandedRowNum === order.rowNumber1Based;
                        const isUpdatingStatus = updatingRowNumbers.includes(
                          order.rowNumber1Based
                        );
                        const rowStatusOptions = Array.from(
                          new Set([...statusChoices, statusTone.label])
                        );

                        return (
                          <React.Fragment key={order.rowNumber1Based}>
                            <tr
                              className={`transition-colors ${
                                isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/70'
                              }`}
                            >
                              {/* 1. Klien & Faktur */}
                              <td className="py-3.5 pl-5 pr-3 align-top">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">
                                    {order.namaKlien || 'Tanpa Nama Klien'}
                                  </span>
                                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                                    #{order.rowNumber1Based}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
                                  <span>{order.invoiceNo || 'Tanpa No. Invoice'}</span>
                                  {order.tanggalLead && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-sans">{order.tanggalLead}</span>
                                    </>
                                  )}
                                  {phone.display && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <a
                                        href={phone.waUrl || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-sans text-emerald-700 hover:underline inline-flex items-center gap-1"
                                        title="Chat WhatsApp klien"
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                        <span>{phone.display}</span>
                                      </a>
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* 2. Paket & Acara */}
                              <td className="py-3.5 px-3 align-top">
                                <div className="text-xs sm:text-sm font-semibold text-slate-800">
                                  {order.paket || '—'}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                  {order.qty > 0 && (
                                    <span className="font-mono tabular-nums text-slate-600">
                                      {order.qty} pcs &times; {formatRupiah(order.hargaPcs)}
                                    </span>
                                  )}
                                  {order.qty > 0 && (order.jenisAcara || order.tanggalAcara) && (
                                    <span aria-hidden="true">·</span>
                                  )}
                                  {(order.jenisAcara || order.tanggalAcara) && (
                                    <span>
                                      {order.jenisAcara || 'Acara'}
                                      {order.tanggalAcara ? ` (${order.tanggalAcara})` : ''}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Tagihan & Pembayaran */}
                              <td className="py-3.5 px-3 text-right align-top">
                                <div className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                                  {formatRupiah(order.totalTagihan)}
                                </div>
                                <div className="mt-1 text-xs font-mono tabular-nums">
                                  {isPaid ? (
                                    <span className="font-semibold text-emerald-700">
                                      Lunas · Bayar {formatRupiah(order.bayar)}
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-amber-700">
                                      Bayar {formatRupiah(order.bayar)} · Sisa{' '}
                                      {formatRupiah(order.sisa)}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 4. Status Pekerjaan (Inline Quick Select) & Deadline */}
                              <td className="py-3 px-3 align-top">
                                {onUpdateStatus ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    {isUpdatingStatus ? (
                                      <Loader2 className="w-3.5 h-3.5 text-emerald-700 animate-spin shrink-0" />
                                    ) : (
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${statusTone.dotClass}`}
                                        aria-hidden="true"
                                      />
                                    )}
                                    <select
                                      value={statusTone.label}
                                      disabled={isUpdatingStatus}
                                      onChange={(e) => onUpdateStatus(order, e.target.value)}
                                      aria-label={`Ubah status pekerjaan ${order.namaKlien}`}
                                      title="Klik untuk langsung memperbarui status pekerjaan ke Google Sheet"
                                      className={`px-2 py-1 text-xs font-bold rounded-lg border transition-colors focus:outline-none focus:border-emerald-700 disabled:opacity-60 cursor-pointer ${statusTone.bgClass} ${statusTone.borderClass} ${statusTone.textClass}`}
                                    >
                                      {rowStatusOptions.map((st) => (
                                        <option key={st} value={st} className="text-slate-900 bg-white">
                                          {st}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${statusTone.dotClass}`}
                                      aria-hidden="true"
                                    />
                                    <span className={`font-bold text-xs ${statusTone.textClass}`}>
                                      {statusTone.label}
                                    </span>
                                  </div>
                                )}
                                <div className="mt-1.5 text-xs text-slate-500">
                                  {order.deadline ? `Deadline: ${order.deadline}` : 'Tanpa deadline'}
                                  {order.metodeBayar ? ` · ${order.metodeBayar}` : ''}
                                </div>
                              </td>

                              {/* 5. Aksi Cepat */}
                              <td className="py-3.5 pl-3 pr-5 text-right align-middle whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  {!isPaid && (
                                    <button
                                      type="button"
                                      onClick={() => onQuickMarkPaidAndDone(order)}
                                      title="Tandai lunas & selesai di Google Sheet"
                                      className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Lunasi</span>
                                    </button>
                                  )}

                                  {order.invoiceNo && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenInvoice(order.invoiceNo)}
                                      title="Buat & Unduh PDF Invoice"
                                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                                    >
                                      <FileDown className="w-3.5 h-3.5" />
                                      <span>PDF Invoice</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedRowNum(isExpanded ? null : order.rowNumber1Based)
                                    }
                                    title={isExpanded ? 'Tutup detail' : 'Lihat detail lengkap'}
                                    aria-expanded={isExpanded}
                                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onEditRow(order.rowNumber1Based, order.rawValues)}
                                    title="Edit order ini"
                                    className="p-2 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDeleteRow(order.rowNumber1Based, order.rawValues)
                                    }
                                    title="Hapus order ini"
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Full Detail Panel (Clean Grid + Interactive Progress Bar) */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70">
                                <td colSpan={5} className="px-5 py-4 border-t border-slate-100 space-y-4">
                                  {onUpdateStatus && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                                      <span className="text-xs font-bold text-slate-700">
                                        Update Cepat Tahap Pekerjaan:
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {JOB_STATUS_OPTIONS.map((stage) => {
                                          const isCurrent =
                                            statusTone.label.toLowerCase() ===
                                            stage.toLowerCase();
                                          return (
                                            <button
                                              key={stage}
                                              type="button"
                                              disabled={isUpdatingStatus || isCurrent}
                                              onClick={() => onUpdateStatus(order, stage)}
                                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:cursor-default ${
                                                isCurrent
                                                  ? 'bg-[#114232] text-white border-[#114232]'
                                                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-600 hover:text-emerald-800'
                                              }`}
                                            >
                                              {stage}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div>
                                      <div className="text-slate-400 font-medium">Rincian Biaya</div>
                                      <div className="mt-1 space-y-0.5 font-mono tabular-nums text-slate-700">
                                        <div>Subtotal: {formatRupiah(order.subtotal)}</div>
                                        <div>Diskon: {formatRupiah(order.diskon)}</div>
                                        <div>Ongkir: {formatRupiah(order.ongkir)}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-slate-400 font-medium">
                                        Sumber &amp; Acara
                                      </div>
                                      <div className="mt-1 space-y-0.5 text-slate-700">
                                        <div>Channel: {order.channel || '—'}</div>
                                        <div>Acara: {order.jenisAcara || '—'}</div>
                                        <div>Tgl Acara: {order.tanggalAcara || '—'}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-slate-400 font-medium">
                                        Mitra &amp; Metode Bayar
                                      </div>
                                      <div className="mt-1 space-y-0.5 text-slate-700">
                                        <div>Metode: {order.metodeBayar || '—'}</div>
                                        <div>Kode Mitra: {order.kodeMitra || 'Langsung'}</div>
                                        <div>Baris Sheet: #{order.rowNumber1Based}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-slate-400 font-medium">Catatan Order</div>
                                      <div className="mt-1 text-slate-700 leading-relaxed">
                                        {order.catatan || 'Tidak ada catatan khusus.'}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Small Screen Card List (Clean Touch Targets >= 44px + Expandable Details) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const phone = formatDisplayPhone(order.noWa);
                    const isPaid = order.sisa <= 0;
                    const statusTone = getJobStatusTone(order.status, isPaid);
                    const isExpanded = expandedRowNum === order.rowNumber1Based;
                    const isUpdatingStatus = updatingRowNumbers.includes(
                      order.rowNumber1Based
                    );
                    const rowStatusOptions = Array.from(
                      new Set([...statusChoices, statusTone.label])
                    );

                    return (
                      <div key={order.rowNumber1Based} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {order.namaKlien || 'Tanpa Nama Klien'}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums truncate">
                              {order.invoiceNo || '—'} · {order.tanggalLead || '—'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                              {formatRupiah(order.totalTagihan)}
                            </div>
                            <div
                              className={`text-xs font-mono tabular-nums font-semibold ${
                                isPaid ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {isPaid ? 'Lunas' : `Sisa ${formatRupiah(order.sisa)}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800">{order.paket}</span>
                            {order.qty > 0 && (
                              <span className="font-mono tabular-nums"> · {order.qty} pcs</span>
                            )}
                            {order.deadline && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Deadline: {order.deadline}
                              </div>
                            )}
                          </div>
                          {onUpdateStatus ? (
                            <div className="inline-flex items-center gap-1.5 shrink-0">
                              {isUpdatingStatus ? (
                                <Loader2 className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
                              ) : (
                                <span
                                  className={`w-2 h-2 rounded-full ${statusTone.dotClass}`}
                                  aria-hidden="true"
                                />
                              )}
                              <select
                                value={statusTone.label}
                                disabled={isUpdatingStatus}
                                onChange={(e) => onUpdateStatus(order, e.target.value)}
                                aria-label={`Ubah status ${order.namaKlien}`}
                                className={`min-h-[42px] px-3 py-1.5 text-xs font-bold rounded-xl border ${statusTone.bgClass} ${statusTone.borderClass} ${statusTone.textClass}`}
                              >
                                {rowStatusOptions.map((st) => (
                                  <option key={st} value={st} className="text-slate-900 bg-white">
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${statusTone.dotClass}`}
                                aria-hidden="true"
                              />
                              <span className={`font-semibold ${statusTone.textClass}`}>
                                {statusTone.label}
                              </span>
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
                            <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                              <div>Bayar: {formatRupiah(order.bayar)}</div>
                              <div>Metode: {order.metodeBayar || '—'}</div>
                              <div>Acara: {order.jenisAcara || '—'}</div>
                              <div>Baris: #{order.rowNumber1Based}</div>
                            </div>
                            {order.catatan && (
                              <div className="pt-1.5 border-t border-slate-200/70 text-slate-700">
                                <strong>Catatan:</strong> {order.catatan}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          {order.invoiceNo && (
                            <button
                              type="button"
                              onClick={() => onOpenInvoice(order.invoiceNo)}
                              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-xl cursor-pointer"
                            >
                              <FileDown className="w-4 h-4" />
                              <span>PDF Invoice</span>
                            </button>
                          )}
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => onQuickMarkPaidAndDone(order)}
                              className="min-h-[44px] inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Lunasi</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRowNum(isExpanded ? null : order.rowNumber1Based)
                            }
                            aria-label="Detail order"
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          {phone.waUrl && (
                            <a
                              href={phone.waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl"
                              title="Chat WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditRow(order.rowNumber1Based, order.rawValues)}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
                            title="Edit order"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRow(order.rowNumber1Based, order.rawValues)}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-600 bg-rose-50 rounded-xl cursor-pointer"
                            title="Hapus order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
