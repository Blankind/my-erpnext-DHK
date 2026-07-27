'use client';

import { useState, useEffect } from 'react';
import type { Settings, ReportData, FullReport } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet, BarChart3, Calendar as CalendarIcon, Download, Search, AlertCircle, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateHppReportFlow } from '@/ai/flows/generate-hpp-report-flow';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from './header';

const defaultSettings: Settings = {
  DHK: { 
    url: 'https://dehikas2.digitalasiasolusindo.com', 
    key: '57d7aaf633158d0', 
    secret: '3d64051fcef8a3f' 
  },
};

export default function CheckLCVClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [reportData, setReportData] = useState<FullReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    setDate({
      from: subDays(new Date(), 30),
      to: new Date(),
    });

    try {
      const savedSettings = localStorage.getItem('erpSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    } catch (error) {
      console.error('Gagal memuat pengaturan dari localStorage', error);
    }
  }, []);

  const handleGenerateReport = async () => {
    if (!date?.from || !date?.to) {
      toast({ variant: 'destructive', title: 'Rentang Tanggal Diperlukan', description: 'Silakan pilih tanggal mulai dan berakhir.' });
      return;
    }

    setIsProcessing(true);
    setReportData(null);
    
    try {
      const result = await generateHppReportFlow({ 
        settings,
        fromDate: format(date.from, 'yyyy-MM-dd'),
        toDate: format(date.to, 'yyyy-MM-dd'),
      });
      setReportData(result);
      toast({ title: 'Berhasil', description: 'Analisis HPP telah selesai.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Kesalahan Koneksi', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownload = () => {
    if (!reportData || !date?.from || !date?.to) return;
  
    const dataToExport = reportData.DHK;
    if (!dataToExport || Object.keys(dataToExport.items).length === 0) return;
  
    const headers = ['Kode Item', ...dataToExport.dates.map(d => d)];
    const rows = Object.keys(dataToExport.items).sort().map(itemCode => {
      const row: (string | number)[] = [itemCode];
      dataToExport.dates.forEach(dateStr => {
        const hpp = dataToExport.items[itemCode][dateStr];
        row.push(hpp === null || typeof hpp === 'undefined' ? '' : hpp);
      });
      return row;
    });
  
    const worksheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan HPP');
  
    XLSX.writeFile(wb, `Analitik_HPP_DHK_${format(date.from, 'yyyy-MM-dd')}_ke_${format(date.to, 'yyyy-MM-dd')}.xlsx`);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || typeof value === 'undefined') return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  }
  
  const formatDateHeader = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  const renderReportTable = (data: ReportData) => {
    if (!data || Object.keys(data.items).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-slate-50 rounded-full p-6 mb-4">
            <Search className="w-12 h-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Data tidak ditemukan</h3>
          <p className="text-slate-500 max-w-sm mt-1">Tidak ada Landed Cost Voucher pada periode ini.</p>
        </div>
      )
    }

    const itemCodes = Object.keys(data.items).sort();

    return (
      <div className="relative overflow-hidden border rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-20">
              <TableRow>
                <TableHead className="w-[200px] font-bold sticky left-0 z-30 bg-slate-50">Kode Item</TableHead>
                {data.dates.map(dateStr => (
                  <TableHead key={dateStr} className="text-right font-bold min-w-[120px]">{formatDateHeader(dateStr)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemCodes.map(itemCode => (
                <TableRow key={itemCode} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono font-bold sticky left-0 bg-white z-10">{itemCode}</TableCell>
                  {data.dates.map(dateStr => (
                    <TableCell key={`${itemCode}-${dateStr}`} className="text-right font-mono">
                      {formatCurrency(data.items[itemCode][dateStr])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader title="Check LCV (Unit HPP)" />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>HPP Analytics Configuration</CardTitle>
            <CardDescription>Select a date range to analyze item unit costs from Landed Cost Vouchers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-end gap-4">
              <div className="grid gap-2 flex-1 w-full">
                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Filter className="h-3 w-3" /> Periode Analisis
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left h-12">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date?.from ? (
                        date.to ? (
                          <>
                            {format(date.from, "dd MMM yyyy")} - {format(date.to, "dd MMM yyyy")}
                          </>
                        ) : (
                          format(date.from, "dd MMM yyyy")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={date?.from}
                      selected={date}
                      onSelect={setDate}
                      numberOfMonths={2}
                      locale={idLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleGenerateReport} disabled={isProcessing || !date?.from} className="h-12 px-8">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                Jalankan Analisis
              </Button>
            </div>
          </CardContent>
        </Card>

        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">Processing Landed Cost Vouchers...</p>
          </div>
        )}

        {reportData && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Analytical Matrix (DHK)</CardTitle>
                  <CardDescription>Historical Unit Cost per processed Voucher.</CardDescription>
                </div>
                <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4"/> Export Excel
                </Button>
              </CardHeader>
              <CardContent>
                {renderReportTable(reportData.DHK)}
                <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Unit HPP = (Purchase Rate + Additional Costs) / Quantity. If multiple vouchers exist on the same day, the latest one is shown.
                    </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
