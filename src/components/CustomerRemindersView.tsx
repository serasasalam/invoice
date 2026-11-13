import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  FileDown,
  Loader2,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Wallet,
  X,
} from 'lucide-react';
import {
  ClosingOrderItem,
  getJobStatusTone,
  JOB_STATUS_OPTIONS,
} from '../services/serasaData';
import { formatRupiah } from './BookkeepingSummary';

export type ReminderCategory = 'belum_dp' | 'pelunasan' | 'follow_up' | 'after_sales';
export type MessageToneKey = 'santai' | 'ramah' | 'rapi';

interface CustomerRemindersViewProps {
  orders: ClosingOrderItem[];
  globalSearch?: string;
  onOpenInvoice: (invoiceNo: string) => void;
  onEditRow: (rowNumber1Based: number, values: string[]) => void;
  onQuickMarkPaidAndDone: (ordersToMark: ClosingOrderItem | ClosingOrderItem[]) => void;
  onUpdateStatus?: (
    target: ClosingOrderItem | ClosingOrderItem[],
    newStatus: string
  ) => Promise<void> | void;
  updatingRowNumbers?: number[];
}

interface FollowUpLogEntry {
  lastSentAt: string;
  category: ReminderCategory;
  count: number;
}

export interface GroupedInvoiceReminder {
  groupKey: string;
  invoiceNo: string;
  namaKlien: string;
  noWa: string;
  tanggalLead: string;
  jenisAcara: string;
  tanggalAcara: string;
  paketSummary: string;
  status: string;
  deadline: string;
  totalTagihan: number;
  bayar: number;
  sisa: number;
  items: ClosingOrderItem[];
  primaryOrder: ClosingOrderItem;
}

type TemplateMap = Record<ReminderCategory, Record<MessageToneKey, string>>;

const FOLLOWUP_LOG_STORAGE_KEY = 'serasa_salam_followup_log_v2';
const TEMPLATES_STORAGE_KEY = 'serasa_salam_wa_templates_v3';
const BANK_INFO_STORAGE_KEY = 'serasa_salam_bank_info_v1';

const TONE_OPTIONS: { key: MessageToneKey; label: string; hint: string }[] = [
  { key: 'santai', label: 'Opsi 1 · Santai & Singkat', hint: 'Seperti chat admin langsung di HP' },
  { key: 'ramah', label: 'Opsi 2 · Akrab & Ngobrol', hint: 'Lebih personal dan enak diajak diskusi' },
  { key: 'rapi', label: 'Opsi 3 · Sopan & Jelas', hint: 'Lebih terstruktur jika perlu nominal' },
];

const DEFAULT_TEMPLATES: TemplateMap = {
  belum_dp: {
    santai: `{sapaan} kak {nama}, ini admin Serasa Salam ya.
Untuk pesanan {paket}-nya belum bisa kami mulai desain karena belum ada DP masuk. Kalau udah siap lanjut, kabari aja ya kak biar langsung kami proses :)`,

    ramah: `Halo kak {nama}, apa kabar?
Izin ngingetin sebentar ya kak soal {paket}-nya. Soalnya kami belum terima DP jadi tim desain belum bisa pegang dulu nih kak. Kalau masih ada yang mau ditanyain soal konsep atau bahan, ngobrol aja dulu gapapa kok kak.{rekening}`,

    rapi: `Selamat {sapaan_bawah} kak {nama}, dari Serasa Salam ya.
Mau konfirmasi untuk pesanan {paket} ({invoice}) totalnya {total}. Saat ini statusnya masih nunggu DP untuk masuk antrean desain{deadline_klausa}.
Kalau sudah transfer DP boleh kabari ke sini ya kak, terima kasih banyak.{rekening}`,
  },

  pelunasan: {
    santai: `{sapaan} kak {nama}, update info nih untuk {paket}-nya sekarang udah masuk tahap {status}.
Sekalian ngingetin sisa pelunasannya tinggal {sisa} lagi ya kak. Kalau udah transfer nanti infokan ke sini biar beres semua :){rekening}`,

    ramah: `Halo kak {nama}, kebetulan {paket}-nya lagi proses di tahap {status} nih.
Nanti sebelum {deadline_natural}, tinggal pelunasan sisanya {sisa} aja ya kak (totalnya {total}, kemarin sudah masuk {bayar}). Santai aja, kalau udah sempat transfer tinggal kirim buktinya di sini ya kak. Makasih banyak!{rekening}`,

    rapi: `Selamat {sapaan_bawah} kak {nama}, izin kasih kabar dari Serasa Salam.
Pesanan {paket} ({invoice}) progresnya sudah sampai tahap {status}. Untuk pembayarannya: total {total}, sudah masuk {bayar}, jadi sisa pelunasannya {sisa} lagi.
Mohon dibantu pelunasannya sebelum proses akhir ya kak supaya pengiriman nanti lancar. Terima kasih.{rekening}`,
  },

  follow_up: {
    santai: `{sapaan} kak {nama}, ngecek aja untuk {paket}-nya yang lagi tahap {status}. Ada yang masih mau direvisi atau udah aman kak?`,

    ramah: `Halo kak {nama}, gimana kabarnya?
Mau follow up sebentar soal {paket} buat {acara_pendek}-nya. Sekarang posisinya di tahap {status}, kira-kira ada catatan tambahan atau bagian yang pengen diubah lagi nggak kak? Biar hasilnya pas sebelum lanjut ke proses berikutnya :)`,

    rapi: `Selamat {sapaan_bawah} kak {nama}, dari Serasa Salam.
Izin konfirmasi pesanan {paket} ({invoice}) saat ini sedang di tahap {status}{deadline_klausa}. Jika ada detail acara atau desain yang perlu disesuaikan lagi, kabari kami ya kak. Terima kasih.`,
  },

  after_sales: {
    santai: `Halo kak {nama}, makasih banyak ya udah pesan undangan di Serasa Salam! Semoga acaranya lancar dan berkesan ya kak :)`,

    ramah: `Halo kak {nama}, semoga persiapan dan {acara_pendek}-nya dilancarkan semua ya!
Terima kasih banyak udah percaya ke Serasa Salam buat {paket}-nya. Kalau undangannya udah sampai dan ada foto atau cerita kesannya, boleh banget share ke kami hehe. Sukses selalu kak!`,

    rapi: `Selamat {sapaan_bawah} kak {nama}, terima kasih sudah mempercayakan pembuatan {paket} di Serasa Salam Undangan.
Semoga {acara_pendek}-nya berjalan lancar. Kalau suatu saat butuh undangan atau kartu lagi, kabari kami kapan saja ya kak. Terima kasih banyak.`,
  },
};

const CATEGORY_META: Record<
  ReminderCategory,
  {
    label: string;
    shortLabel: string;
    schemeRule: string;
    actionHint: string;
    dotClass: string;
    textClass: string;
    priority: number;
  }
> = {
  belum_dp: {
    label: 'Belum DP (Belum Dikerjakan)',
    shortLabel: 'Belum DP',
    schemeRule: 'Bayar = Rp 0 & Total > Rp 0 (atau Status Menunggu DP)',
    actionHint: 'Sapa klien dengan ramah agar segera DP supaya desain bisa dimulai',
    dotClass: 'bg-rose-600',
    textClass: 'text-rose-800',
    priority: 1,
  },
  pelunasan: {
    label: 'Tagih Pelunasan (Sisa DP)',
    shortLabel: 'Pelunasan',
    schemeRule: 'Sudah DP > Rp 0, masih ada Sisa Tagihan > Rp 0',
    actionHint: 'Kabari progres order sekaligus ingatkan sisa pelunasan dengan sopan',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-800',
    priority: 2,
  },
  follow_up: {
    label: 'Follow Up Progres & Desain',
    shortLabel: 'Follow Up',
    schemeRule: 'Sudah lunas/DP, status Desain / Revisi / Cetak / Finishing',
    actionHint: 'Tanyakan kecocokan desain atau revisi agar proses cetak lancar',
    dotClass: 'bg-sky-600',
    textClass: 'text-sky-800',
    priority: 3,
  },
  after_sales: {
    label: 'After Sales & Testimoni',
    shortLabel: 'Selesai',
    schemeRule: 'Pembayaran Lunas & status Selesai / Dikirim',
    actionHint: 'Ucapkan terima kasih hangat & ajak berbagi kesan setelah acara',
    dotClass: 'bg-emerald-600',
    textClass: 'text-emerald-800',
    priority: 4,
  },
};

function formatDisplayPhone(raw: string): { display: string; waIntl: string | null } {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits || digits === '0' || digits.length < 7) {
    return { display: '', waIntl: null };
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
  return { display: localDisplay, waIntl };
}

function formatIndonesianList(items: string[]): string {
  const unique = Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
  if (unique.length === 0) return 'Undangan Serasa Salam';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')} & ${unique[unique.length - 1]}`;
}

function parseFlexibleDate(raw: string): Date | null {
  const s = (raw || '').trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]) - 1;
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const dt = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const months: Record<string, number> = {
    jan: 0,
    januari: 0,
    feb: 1,
    februari: 1,
    mar: 2,
    maret: 2,
    apr: 3,
    april: 3,
    mei: 4,
    may: 4,
    jun: 5,
    juni: 5,
    jul: 6,
    juli: 6,
    agu: 7,
    agt: 7,
    agustus: 7,
    aug: 7,
    sep: 8,
    september: 8,
    okt: 9,
    oktober: 9,
    oct: 9,
    nov: 10,
    november: 10,
    des: 11,
    desember: 11,
    dec: 11,
  };
  const parts = s.toLowerCase().replace(/,/g, '').split(/\s+/);
  if (parts.length >= 3) {
    const day = Number(parts[0]);
    const mon = months[parts[1]];
    const yr = Number(parts[2]);
    if (!Number.isNaN(day) && mon !== undefined && !Number.isNaN(yr)) {
      const dt = new Date(yr, mon, day);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  return null;
}

function getDeadlineStatus(deadlineStr: string, status: string): {
  daysDiff: number | null;
  label: string;
  isUrgent: boolean;
} {
  const lower = (status || '').toLowerCase();
  if (lower.includes('selesai') || lower.includes('dikirim')) {
    return { daysDiff: null, label: deadlineStr || 'Selesai', isUrgent: false };
  }
  const dt = parseFlexibleDate(deadlineStr);
  if (!dt) {
    return { daysDiff: null, label: deadlineStr || 'Belum diatur', isUrgent: false };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return {
      daysDiff: diff,
      label: `${deadlineStr} (Lewat ${Math.abs(diff)} hari)`,
      isUrgent: true,
    };
  }
  if (diff === 0) {
    return { daysDiff: 0, label: `${deadlineStr} (Hari ini)`, isUrgent: true };
  }
  if (diff <= 5) {
    return { daysDiff: diff, label: `${deadlineStr} (H-${diff})`, isUrgent: true };
  }
  return { daysDiff: diff, label: `${deadlineStr} (H-${diff})`, isUrgent: false };
}

export function groupOrdersByInvoice(orders: ClosingOrderItem[]): GroupedInvoiceReminder[] {
  const map = new Map<string, ClosingOrderItem[]>();

  for (const order of orders) {
    if (!order.namaKlien && !order.invoiceNo) continue;
    const invNorm = (order.invoiceNo || '').trim();
    const key = invNorm ? `INV:${invNorm.toUpperCase()}` : `ROW:${order.rowNumber1Based}`;
    const existing = map.get(key) || [];
    existing.push(order);
    map.set(key, existing);
  }

  const grouped: GroupedInvoiceReminder[] = [];

  for (const [groupKey, items] of map.entries()) {
    const primaryOrder = items[0];
    const totalTagihan = items.reduce((acc, it) => acc + it.totalTagihan, 0);
    const bayar = items.reduce((acc, it) => acc + it.bayar, 0);
    const sisa = items.reduce((acc, it) => acc + it.sisa, 0);

    const validWaOrder = items.find((it) => formatDisplayPhone(it.noWa).waIntl !== null);
    const noWa = validWaOrder?.noWa || primaryOrder.noWa;

    // Pick representative active status if any item isn't finished yet
    const nonFinished = items.find((it) => {
      const st = (it.status || '').toLowerCase();
      return !st.includes('selesai') && !st.includes('dikirim');
    });
    const status = nonFinished?.status || primaryOrder.status || 'Menunggu DP';

    const deadlineItem = items.find((it) => (it.deadline || '').trim() !== '');
    const acaraItem = items.find((it) => (it.tanggalAcara || '').trim() !== '');

    grouped.push({
      groupKey,
      invoiceNo: primaryOrder.invoiceNo || `Baris #${primaryOrder.rowNumber1Based}`,
      namaKlien: primaryOrder.namaKlien || 'Kak',
      noWa,
      tanggalLead: primaryOrder.tanggalLead,
      jenisAcara: primaryOrder.jenisAcara,
      tanggalAcara: acaraItem?.tanggalAcara || primaryOrder.tanggalAcara,
      paketSummary: formatIndonesianList(items.map((it) => it.paket)),
      status,
      deadline: deadlineItem?.deadline || primaryOrder.deadline,
      totalTagihan,
      bayar,
      sisa,
      items,
      primaryOrder,
    });
  }

  return grouped;
}

export function classifyGroupedReminder(group: GroupedInvoiceReminder): ReminderCategory {
  const statusLower = (group.status || '').toLowerCase();
  const isWaitingDp =
    (group.bayar <= 0 && group.totalTagihan > 0) || statusLower.includes('menunggu dp');

  if (isWaitingDp) return 'belum_dp';
  if (group.sisa > 0) return 'pelunasan';
  if (statusLower.includes('selesai') || statusLower.includes('dikirim')) {
    return 'after_sales';
  }
  return 'follow_up';
}

function getTimeGreeting(): { upper: string; lower: string } {
  const hr = new Date().getHours();
  if (hr >= 4 && hr < 11) return { upper: 'Pagi', lower: 'pagi' };
  if (hr >= 11 && hr < 15) return { upper: 'Siang', lower: 'siang' };
  if (hr >= 15 && hr < 18) return { upper: 'Sore', lower: 'sore' };
  return { upper: 'Malam', lower: 'malam' };
}

function toNaturalPackageName(paketSummary: string): string {
  const clean = (paketSummary || '').trim();
  if (!clean) return 'undangan';
  return clean
    .replace(/\bUndangan\b/g, 'undangan')
    .replace(/\bKartu\b/g, 'kartu')
    .replace(/\bCetak\b/g, 'cetak')
    .replace(/\bBasic\b/g, 'basic')
    .replace(/\bPremium\b/g, 'premium')
    .replace(/\bDigital\b/g, 'digital')
    .replace(/\bEksklusif\b/g, 'undangan eksklusif')
    .replace(/\bSouvenir\b/g, 'souvenir');
}

function toNaturalEventPhrase(jenisAcara: string): string {
  const lower = (jenisAcara || '').trim().toLowerCase();
  if (!lower) return 'acara';
  if (lower.includes('wedding') || lower.includes('nikah')) return 'acara nikahan';
  if (lower.includes('khitan')) return 'acara khitanan';
  if (lower.includes('aqiqah')) return 'acara aqiqah';
  if (lower.includes('tunang')) return 'acara tunangan';
  return `acara ${lower}`;
}

function renderReminderMessage(
  template: string,
  group: GroupedInvoiceReminder,
  bankInfo: string
): string {
  const greeting = getTimeGreeting();
  const acaraText =
    [group.jenisAcara, group.tanggalAcara].filter(Boolean).join(' · ') || 'acara kakak';
  const acaraPendek = toNaturalEventPhrase(group.jenisAcara);
  const paketNatural = toNaturalPackageName(group.paketSummary);
  const deadlineRaw = (group.deadline || '').trim();
  const deadlineKlausa = deadlineRaw ? ` (target selesai ${deadlineRaw})` : '';
  const deadlineNatural = deadlineRaw || 'dikirim nanti';
  const statusNatural = (group.status || 'proses').trim().toLowerCase();
  const bankBlock = bankInfo.trim()
    ? `\n\nUntuk transfernya ke sini ya kak:\n${bankInfo.trim()}`
    : '';

  return template
    .replace(/\{sapaan\}/g, greeting.upper)
    .replace(/\{sapaan_bawah\}/g, greeting.lower)
    .replace(/\{nama\}/g, group.namaKlien || 'Kak')
    .replace(/\{invoice\}/g, group.invoiceNo || '-')
    .replace(/\{paket\}/g, paketNatural)
    .replace(/\{total\}/g, formatRupiah(group.totalTagihan))
    .replace(/\{bayar\}/g, formatRupiah(group.bayar))
    .replace(/\{sisa\}/g, formatRupiah(group.sisa))
    .replace(/\{status\}/g, statusNatural)
    .replace(/\{deadline\}/g, deadlineRaw || 'jadwal yang disepakati')
    .replace(/\{deadline_klausa\}/g, deadlineKlausa)
    .replace(/\{deadline_natural\}/g, deadlineNatural)
    .replace(/\{acara\}/g, acaraText)
    .replace(/\{acara_pendek\}/g, acaraPendek)
    .replace(/\{rekening\}/g, bankBlock);
}

function formatShortTimestamp(iso: string): string {
  try {
    const dt = new Date(iso);
    return dt.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const CustomerRemindersView: React.FC<CustomerRemindersViewProps> = ({
  orders,
  globalSearch = '',
  onOpenInvoice,
  onEditRow,
  onQuickMarkPaidAndDone,
  onUpdateStatus,
  updatingRowNumbers = [],
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'actionable' | ReminderCategory>('actionable');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSchemaEditor, setShowSchemaEditor] = useState<boolean>(false);
  const [editingTemplateCat, setEditingTemplateCat] = useState<ReminderCategory>('belum_dp');
  const [editingTemplateTone, setEditingTemplateTone] = useState<MessageToneKey>('santai');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [editingCustomTone, setEditingCustomTone] = useState<MessageToneKey | null>(null);
  const [customDraftMessage, setCustomDraftMessage] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateMap>(() => {
    try {
      const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          belum_dp: { ...DEFAULT_TEMPLATES.belum_dp, ...(parsed.belum_dp || {}) },
          pelunasan: { ...DEFAULT_TEMPLATES.pelunasan, ...(parsed.pelunasan || {}) },
          follow_up: { ...DEFAULT_TEMPLATES.follow_up, ...(parsed.follow_up || {}) },
          after_sales: { ...DEFAULT_TEMPLATES.after_sales, ...(parsed.after_sales || {}) },
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_TEMPLATES;
  });

  const [bankInfo, setBankInfo] = useState<string>(() => {
    try {
      return localStorage.getItem(BANK_INFO_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [followUpLog, setFollowUpLog] = useState<Record<string, FollowUpLogEntry>>(() => {
    try {
      const raw = localStorage.getItem(FOLLOWUP_LOG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // ignore
    }
  }, [templates]);

  useEffect(() => {
    try {
      localStorage.setItem(BANK_INFO_STORAGE_KEY, bankInfo);
    } catch {
      // ignore
    }
  }, [bankInfo]);

  const persistFollowUpLog = (next: Record<string, FollowUpLogEntry>) => {
    setFollowUpLog(next);
    try {
      localStorage.setItem(FOLLOWUP_LOG_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const enrichedItems = useMemo(() => {
    const grouped = groupOrdersByInvoice(orders);

    return grouped
      .map((group) => {
        const category = classifyGroupedReminder(group);
        const deadlineInfo = getDeadlineStatus(group.deadline, group.status);
        const phone = formatDisplayPhone(group.noWa);
        const log = followUpLog[group.groupKey] || null;
        return {
          group,
          category,
          meta: CATEGORY_META[category],
          deadlineInfo,
          phone,
          log,
        };
      })
      .sort((a, b) => {
        if (a.meta.priority !== b.meta.priority) {
          return a.meta.priority - b.meta.priority;
        }
        if (a.deadlineInfo.daysDiff !== null && b.deadlineInfo.daysDiff !== null) {
          return a.deadlineInfo.daysDiff - b.deadlineInfo.daysDiff;
        }
        if (a.deadlineInfo.daysDiff !== null) return -1;
        if (b.deadlineInfo.daysDiff !== null) return 1;
        return b.group.primaryOrder.rowNumber1Based - a.group.primaryOrder.rowNumber1Based;
      });
  }, [orders, followUpLog]);

  const stats = useMemo(() => {
    let belumDpCount = 0;
    let belumDpAmount = 0;
    let pelunasanCount = 0;
    let pelunasanAmount = 0;
    let followUpCount = 0;
    let afterSalesCount = 0;

    for (const item of enrichedItems) {
      if (item.category === 'belum_dp') {
        belumDpCount++;
        belumDpAmount += item.group.totalTagihan;
      } else if (item.category === 'pelunasan') {
        pelunasanCount++;
        pelunasanAmount += item.group.sisa;
      } else if (item.category === 'follow_up') {
        followUpCount++;
      } else {
        afterSalesCount++;
      }
    }

    return {
      actionableCount: belumDpCount + pelunasanCount + followUpCount,
      belumDpCount,
      belumDpAmount,
      pelunasanCount,
      pelunasanAmount,
      followUpCount,
      afterSalesCount,
    };
  }, [enrichedItems]);

  const visibleItems = useMemo(() => {
    const q = (searchQuery || globalSearch).toLowerCase().trim();
    return enrichedItems.filter((item) => {
      if (categoryFilter === 'actionable') {
        if (item.category === 'after_sales') return false;
      } else if (item.category !== categoryFilter) {
        return false;
      }

      if (!q) return true;
      const g = item.group;
      return (
        g.namaKlien.toLowerCase().includes(q) ||
        g.invoiceNo.toLowerCase().includes(q) ||
        g.paketSummary.toLowerCase().includes(q) ||
        g.status.toLowerCase().includes(q) ||
        item.phone.display.includes(q)
      );
    });
  }, [enrichedItems, categoryFilter, searchQuery, globalSearch]);

  const activeDraftItem = useMemo(() => {
    if (!selectedGroupKey) return null;
    return enrichedItems.find((i) => i.group.groupKey === selectedGroupKey) || null;
  }, [enrichedItems, selectedGroupKey]);

  const markAsFollowedUp = (groupKey: string, category: ReminderCategory) => {
    const existing = followUpLog[groupKey];
    persistFollowUpLog({
      ...followUpLog,
      [groupKey]: {
        lastSentAt: new Date().toISOString(),
        category,
        count: (existing?.count || 0) + 1,
      },
    });
  };

  const toggleClearFollowUp = (groupKey: string) => {
    const next = { ...followUpLog };
    delete next[groupKey];
    persistFollowUpLog(next);
  };

  const buildWhatsAppUrl = (waIntl: string, messageText: string) =>
    `https://wa.me/${waIntl}?text=${encodeURIComponent(messageText)}`;

  const handleCopyMessage = async (uniqueCopyId: string, messageText: string) => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedKey(uniqueCopyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const openChooserModal = (groupKey: string) => {
    setSelectedGroupKey(groupKey);
    setEditingCustomTone(null);
    setCustomDraftMessage('');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Pengingat Customer &amp; Follow Up WhatsApp
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Dikelompokkan otomatis 1 customer per Nomor Invoice agar follow up DP, pelunasan, &amp; progres tidak ganda.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSchemaEditor((v) => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer ${
            showSchemaEditor
              ? 'bg-[#114232] text-white border-[#114232]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>{showSchemaEditor ? 'Tutup Pengaturan Template' : 'Atur Skema & Template WA'}</span>
        </button>
      </div>

      {/* Collapsible Schema & WhatsApp Template Editor */}
      {showSchemaEditor && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Skema Aturan &amp; Template Pesan WhatsApp
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Order dengan nomor invoice yang sama digabung otomatis menjadi 1 pengingat. Gaya bahasa dibuat hangat dan sopan — bisa disesuaikan kapan saja.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTemplates(DEFAULT_TEMPLATES)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Template Default</span>
            </button>
          </div>

          {/* 4-Stage Schema Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(CATEGORY_META) as ReminderCategory[]).map((cat) => {
              const m = CATEGORY_META[cat];
              const isSelected = editingTemplateCat === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setEditingTemplateCat(cat)}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/60 border-emerald-700'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${m.dotClass}`} aria-hidden="true" />
                    <span className={`text-xs font-bold ${m.textClass}`}>{m.shortLabel}</span>
                  </div>
                  <div className="mt-1.5 text-xs font-semibold text-slate-800">
                    {m.schemeRule}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    {m.actionHint}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Template Tone Tabs & Textarea + Bank Account */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
            <div className="lg:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800">
                  Edit Variasi Pesan: {CATEGORY_META[editingTemplateCat].shortLabel}
                </label>
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  {TONE_OPTIONS.map((t, idx) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setEditingTemplateTone(t.key)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                        editingTemplateTone === t.key
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Opsi {idx + 1}: {t.key.charAt(0).toUpperCase() + t.key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={7}
                value={templates[editingTemplateCat][editingTemplateTone]}
                onChange={(e) =>
                  setTemplates((prev) => ({
                    ...prev,
                    [editingTemplateCat]: {
                      ...prev[editingTemplateCat],
                      [editingTemplateTone]: e.target.value,
                    },
                  }))
                }
                className="w-full p-3.5 text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700"
              />
              <div className="text-[11px] text-slate-400 font-mono">
                Variabel otomatis: {'{sapaan}'} {'{nama}'} {'{paket}'} {'{invoice}'} {'{total}'}{' '}
                {'{bayar}'} {'{sisa}'} {'{status}'} {'{deadline_klausa}'} {'{acara_pendek}'}{' '}
                {'{rekening}'}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Info Rekening Transfer (Opsional)
              </label>
              <textarea
                rows={7}
                value={bankInfo}
                onChange={(e) => setBankInfo(e.target.value)}
                placeholder={`Contoh:\nBCA 1234567890 a.n. Serasa Salam\natau QRIS nanti kami kirimkan`}
                className="w-full p-3.5 text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-700"
              />
              <p className="text-[11px] text-slate-500">
                Disisipkan otomatis pada pengingat DP &amp; pelunasan bila kolom ini diisi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4 Summary & Filter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setCategoryFilter('actionable')}
          className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
            categoryFilter === 'actionable'
              ? 'bg-[#114232] text-white border-[#114232]'
              : 'bg-white text-slate-900 border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold ${
                categoryFilter === 'actionable' ? 'text-emerald-200' : 'text-slate-500'
              }`}
            >
              Semua Perlu Follow Up
            </span>
            <BellRing
              className={`w-4 h-4 ${
                categoryFilter === 'actionable' ? 'text-emerald-300' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono tabular-nums">
            {stats.actionableCount}
          </div>
          <div
            className={`mt-1 text-xs ${
              categoryFilter === 'actionable' ? 'text-emerald-100/80' : 'text-slate-500'
            }`}
          >
            Customer (1 Invoice = 1 Follow Up)
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('belum_dp')}
          className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
            categoryFilter === 'belum_dp'
              ? 'bg-rose-50 border-rose-400'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">
              Belum DP (Belum Dikerjakan)
            </span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {stats.belumDpCount}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-rose-700">
            Tertahan {formatRupiah(stats.belumDpAmount)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('pelunasan')}
          className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
            categoryFilter === 'pelunasan'
              ? 'bg-amber-50 border-amber-400'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Tagih Pelunasan</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {stats.pelunasanCount}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-amber-700">
            Sisa DP {formatRupiah(stats.pelunasanAmount)}
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('follow_up')}
            className={`text-left p-3.5 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between ${
              categoryFilter === 'follow_up'
                ? 'bg-sky-50 border-sky-400'
                : 'bg-white border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <span className="text-[11px] font-semibold text-sky-800">Follow Up Progres</span>
            <div className="mt-1 text-xl font-extrabold text-slate-900 font-mono tabular-nums">
              {stats.followUpCount}
            </div>
            <span className="text-[11px] text-slate-500">Desain / Cetak</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('after_sales')}
            className={`text-left p-3.5 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between ${
              categoryFilter === 'after_sales'
                ? 'bg-emerald-50 border-emerald-400'
                : 'bg-white border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <span className="text-[11px] font-semibold text-emerald-800">Testimoni</span>
            <div className="mt-1 text-xl font-extrabold text-slate-900 font-mono tabular-nums">
              {stats.afterSalesCount}
            </div>
            <span className="text-[11px] text-slate-500">Lunas &amp; Selesai</span>
          </button>
        </div>
      </div>

      {/* Main Queue: Clean Full-Width List (1 Card per Invoice) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama klien, invoice, atau paket..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-700"
            />
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Menampilkan <strong className="text-slate-900">{visibleItems.length}</strong> customer
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              Tidak ada customer yang perlu diingatkan pada filter ini.
            </p>
            <p className="text-xs text-slate-500">
              Semua pesanan pada kategori ini sudah tertangani atau coba pilih filter lain di atas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[68vh] overflow-y-auto">
            {visibleItems.map((item) => {
              const { group, category, meta, deadlineInfo, phone, log } = item;
              const isSelected = selectedGroupKey === group.groupKey;
              const statusTone = getJobStatusTone(group.status, group.sisa <= 0);
              const isUpdatingGroupStatus = group.items.some((it) =>
                updatingRowNumbers.includes(it.rowNumber1Based)
              );
              const statusOptions = Array.from(
                new Set([...JOB_STATUS_OPTIONS, group.status].filter(Boolean))
              );

              return (
                <div
                  key={group.groupKey}
                  className={`p-4 transition-colors ${
                    isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      {/* Top metadata & category */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`}
                          aria-hidden="true"
                        />
                        <span className={`text-xs font-bold ${meta.textClass}`}>
                          {meta.label}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`text-xs ${
                            deadlineInfo.isUrgent
                              ? 'font-bold text-rose-700'
                              : 'text-slate-500'
                          }`}
                        >
                          Deadline: {deadlineInfo.label}
                        </span>
                      </div>

                      {/* Client Name & Invoice */}
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {group.namaKlien}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {group.invoiceNo}
                        </span>
                        {group.items.length > 1 && (
                          <span className="text-[11px] font-semibold text-emerald-800">
                            ({group.items.length} item digabung)
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          · {phone.display || 'No. WA belum diisi'}
                        </span>
                      </div>

                      {/* Order & Payment summary + Inline Status Updater */}
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className="font-semibold text-slate-800">{group.paketSummary}</span>
                        <span aria-hidden="true">·</span>
                        {onUpdateStatus ? (
                          <label className="inline-flex items-center gap-1.5">
                            <span className="text-slate-500">Tahap:</span>
                            {isUpdatingGroupStatus && (
                              <Loader2 className="w-3 h-3 text-emerald-700 animate-spin" />
                            )}
                            <select
                              value={group.status}
                              disabled={isUpdatingGroupStatus}
                              onChange={(e) => onUpdateStatus(group.items, e.target.value)}
                              aria-label={`Ubah status pekerjaan ${group.namaKlien}`}
                              className={`px-2 py-0.5 text-xs font-bold rounded-lg border focus:outline-none focus:border-emerald-700 disabled:opacity-60 cursor-pointer ${statusTone.bgClass} ${statusTone.borderClass} ${statusTone.textClass}`}
                            >
                              {statusOptions.map((st) => (
                                <option key={st} value={st} className="text-slate-900 bg-white">
                                  {st}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span>Status: {group.status}</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Total {formatRupiah(group.totalTagihan)}
                        </span>
                        {group.sisa > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums font-bold text-amber-800">
                              Sisa {formatRupiah(group.sisa)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Last Followed Up Info */}
                      {log && (
                        <div className="pt-0.5 flex items-center gap-2 text-[11px] text-emerald-700 font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            Sudah di-follow up ({log.count}x · terakhir{' '}
                            {formatShortTimestamp(log.lastSentAt)})
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleClearFollowUp(group.groupKey)}
                            className="text-slate-400 hover:text-slate-700 underline font-normal cursor-pointer"
                          >
                            Reset tanda
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Opens 3-Option Human Message Chooser */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openChooserModal(group.groupKey)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Pilih Pesan / Kirim WA</span>
                      </button>

                      {!phone.waIntl && (
                        <button
                          type="button"
                          onClick={() =>
                            onEditRow(
                              group.primaryOrder.rowNumber1Based,
                              group.primaryOrder.rawValues
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Isi No. WA</span>
                        </button>
                      )}

                      {!log && (
                        <button
                          type="button"
                          onClick={() => markAsFollowedUp(group.groupKey, category)}
                          title="Tandai sudah di-follow up"
                          className="p-2 text-slate-500 hover:text-emerald-800 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {group.invoiceNo && (
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(group.invoiceNo)}
                          title="Buka PDF Invoice untuk dikirim ke WhatsApp"
                          className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Centered Multi-Option Message Picker & Custom Editor Modal */}
      {activeDraftItem && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-chooser-title"
        >
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-white shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span
                    className={`w-2 h-2 rounded-full ${activeDraftItem.meta.dotClass}`}
                    aria-hidden="true"
                  />
                  <span className={activeDraftItem.meta.textClass}>
                    {activeDraftItem.meta.label}
                  </span>
                </div>
                <h3
                  id="wa-chooser-title"
                  className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 truncate"
                >
                  Pilih Gaya Pesan ke {activeDraftItem.group.namaKlien}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeDraftItem.group.paketSummary} ·{' '}
                  <span className="font-mono tabular-nums">
                    {activeDraftItem.phone.display || 'Nomor WA belum diisi'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupKey(null);
                  setEditingCustomTone(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
                aria-label="Tutup pilihan pesan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Status & Payment Strip */}
            <div className="px-6 py-3 bg-slate-50/90 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                {onUpdateStatus && (
                  <label className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-slate-600">Status Kerja:</span>
                    <select
                      value={activeDraftItem.group.status}
                      disabled={activeDraftItem.group.items.some((it) =>
                        updatingRowNumbers.includes(it.rowNumber1Based)
                      )}
                      onChange={(e) =>
                        onUpdateStatus(activeDraftItem.group.items, e.target.value)
                      }
                      aria-label="Ubah status pekerjaan pelanggan"
                      className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-700 cursor-pointer"
                    >
                      {Array.from(
                        new Set(
                          [...JOB_STATUS_OPTIONS, activeDraftItem.group.status].filter(Boolean)
                        )
                      ).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <span className="font-mono tabular-nums text-slate-600">
                  Total {formatRupiah(activeDraftItem.group.totalTagihan)}
                  {activeDraftItem.group.sisa > 0 && (
                    <strong className="text-amber-800">
                      {' '}
                      · Sisa {formatRupiah(activeDraftItem.group.sisa)}
                    </strong>
                  )}
                </span>
              </div>

              {activeDraftItem.group.sisa > 0 && (
                <button
                  type="button"
                  onClick={() => onQuickMarkPaidAndDone(activeDraftItem.group.items)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tandai Lunas</span>
                </button>
              )}
            </div>

            {/* Body: 3 Natural Human Options + Optional Manual Editor */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 bg-[#F8FAF9] flex-1">
              <p className="text-xs text-slate-500">
                Pilih gaya kalimat yang paling pas dengan karakter customer agar terasa seperti chat biasa (bukan template otomatis):
              </p>

              <div className="space-y-3">
                {TONE_OPTIONS.map((tone) => {
                  const rendered = renderReminderMessage(
                    templates[activeDraftItem.category][tone.key],
                    activeDraftItem.group,
                    bankInfo
                  );
                  const copyId = `${activeDraftItem.group.groupKey}:${tone.key}`;
                  const isCopied = copiedKey === copyId;
                  const isEditingThis = editingCustomTone === tone.key;

                  return (
                    <div
                      key={tone.key}
                      className={`bg-white border rounded-2xl p-4 space-y-3 transition-colors ${
                        isEditingThis
                          ? 'border-[#114232] ring-2 ring-[#114232]/10'
                          : 'border-slate-200/90'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div>
                          <div className="text-xs font-extrabold text-slate-900">
                            {tone.label}
                          </div>
                          <div className="text-[11px] text-slate-500">{tone.hint}</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingThis) {
                                setEditingCustomTone(null);
                              } else {
                                setEditingCustomTone(tone.key);
                                setCustomDraftMessage(rendered);
                              }
                            }}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                              isEditingThis
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isEditingThis ? 'Selesai Edit' : 'Ubah Kalimat'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleCopyMessage(
                                copyId,
                                isEditingThis ? customDraftMessage : rendered
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span className="text-emerald-800">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>

                          {activeDraftItem.phone.waIntl ? (
                            <a
                              href={buildWhatsAppUrl(
                                activeDraftItem.phone.waIntl,
                                isEditingThis ? customDraftMessage : rendered
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() =>
                                markAsFollowedUp(
                                  activeDraftItem.group.groupKey,
                                  activeDraftItem.category
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-lg transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Kirim WA</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGroupKey(null);
                                onEditRow(
                                  activeDraftItem.group.primaryOrder.rowNumber1Based,
                                  activeDraftItem.group.primaryOrder.rawValues
                                );
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Isi No. WA</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditingThis ? (
                        <textarea
                          rows={5}
                          value={customDraftMessage}
                          onChange={(e) => setCustomDraftMessage(e.target.value)}
                          className="w-full p-3 text-xs sm:text-sm leading-relaxed bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#114232]"
                        />
                      ) : (
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {rendered}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
