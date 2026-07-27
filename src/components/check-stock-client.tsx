'use client';

import { useState, useEffect } from 'react';
import type { CheckStockRecord, Settings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { FileUploader } from '@/components/file-uploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet, Download, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { checkStock } from '@/ai/flows/check-stock-flow';
import { excelDateToYYYYMMDD, excelTimeToHHMMSS } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';

const defaultSettings: Settings = {
  DHK: { 
    url: process.env.NEXT_PUBLIC_DHK_URL || 'https://dehikas.digitalasiasolusindo.com', 
    key: process.env.NEXT_PUBLIC_DHK_KEY || '57d7aaf633158d0', 
    secret: process.env.NEXT_PUBLIC_DHK_SECRET || '747f455224bdf7e' 
  },
  TOKO88: { 
    url: process.env.NEXT_PUBLIC_TOKO88_URL || 'https://toko88.digitalasiasolusindo.com', 
    key: process.env.NEXT_PUBLIC_TOKO88_KEY || '8409b8da7daf5c9', 
    secret: process.env.NEXT_PUBLIC_TOKO88_SECRET || '719bf5bcea92c92' 
  },
};

const REQUIRED_FILE_HEADERS = ['item_code', 'Warehouse', 'tanggal', 'jam'];

export default function CheckStockClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [data, setData] = useState<CheckStockRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasResults, setHasResults] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('erpSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    } catch (error) {
      console.error('Failed to load settings from localStorage', error);
    }
  }, []);

  const handleFileUploaded = (uploadedData: any[]) => {
      const records: CheckStockRecord[] = uploadedData.map((row, index) => ({
        id: index,
        item_code: String(row.item_code || ''),
        item_name: String(row.item_name || ''),
        Warehouse: String(row.Warehouse || ''),
        tanggal: excelDateToYYYYMMDD(row.tanggal),
        jam: excelTimeToHHMMSS(row.jam),
        Fisik: row.Fisik !== undefined ? Number(row.Fisik) : undefined,
        status: 'Pending',
      }));
      setData(records);
      setHasResults(false);
      toast({
        title: 'File Uploaded',
        description: `${records.length} records are ready to be processed.`,
      })
  }

  const handleCheckStock = async () => {
    if (data.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'Please upload a file with item data.'});
        return;
    }
    
    setIsProcessing(true);
    setHasResults(false);
    setData(prevData => prevData.map(r => ({...r, status: 'Processing'})));

    try {
      const result = await checkStock({
        records: data.map(({ id, item_code, Warehouse, tanggal, jam }) => ({ id, item_code, Warehouse, tanggal, jam, status: 'Processing'})),
        settings,
      });
      
      setData(prevData => {
        return prevData.map(originalRecord => {
            const resultRecord = result.results.find(r => r.id === originalRecord.id);
            return resultRecord ? { ...originalRecord, ...resultRecord } : originalRecord;
        });
      });

      setHasResults(true);
      toast({
        title: 'Processing Complete',
        description: 'All stock checks have been processed.',
      });

    } catch (error: any) {
        console.error('An error occurred during stock check:', error);
        toast({
            variant: 'destructive',
            title: 'Processing Error',
            description: error.message || 'An unknown error occurred.'
        })
        setData(prevData => prevData.map(r => ({...r, status: 'Failed', log: 'Client-side error' })));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!hasResults || data.length === 0) {
        toast({ variant: 'destructive', title: 'No Results', description: 'There is no data to download.' });
        return;
    }

    const dataToExport = data.map(record => ({
        'item_code': record.item_code,
        'item_name': record.item_name,
        'tanggal': record.tanggal,
        'jam': record.jam,
        'Warehouse': record.Warehouse,
        'Fisik': record.Fisik,
        'stock_DHK': record.stock_DHK,
        'stock_toko88': record.stock_TOKO88,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Check Results');
    XLSX.writeFile(workbook, 'StockCheckResults.xlsx');

    toast({ title: 'Download Started', description: 'Your file is being downloaded.' });
  }

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader 
        title="Check Item Stock"
      />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>Check Stock Levels</CardTitle>
            <CardDescription>Upload an Excel file with `item_code`, `Warehouse`, `tanggal`, and `jam` to fetch the latest stock levels from both ERPs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
               <FileUploader 
                  onFileUploaded={handleFileUploaded} 
                  isProcessing={isProcessing} 
                  requiredHeaders={REQUIRED_FILE_HEADERS}
                  buttonText="Upload Check Stock File"
                />
                <Button onClick={handleCheckStock} disabled={isProcessing || data.length === 0} >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    {isProcessing ? 'Checking Stock...' : `Check ${data.length} Items`}
                </Button>
                 <Button onClick={handleDownload} disabled={isProcessing || !hasResults}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Results
                </Button>
            </div>
          </CardContent>
        </Card>
        
        {!isProcessing && data.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-secondary/20">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <FileSpreadsheet className="w-16 h-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">No Data to Display</h3>
              <p className="mt-2 text-muted-foreground">Upload an Excel file to get started.</p>
            </CardContent>
          </Card>
        )}

        {data.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle>Stock Check Results</CardTitle>
                <CardDescription>Review the fetched stock levels for each item in both ERPs.</CardDescription>
            </CardHeader>
            <CardContent>
                 <ScrollArea className="h-96 rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[150px]">Item Code</TableHead>
                                <TableHead>Warehouse</TableHead>
                                <TableHead className="text-right">Stock DHK</TableHead>
                                <TableHead className="text-right">Stock TOKO88</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-mono">{record.item_code}</TableCell>
                                    <TableCell>{record.Warehouse}</TableCell>
                                    <TableCell className="text-right font-mono">{record.stock_DHK ?? 'N/A'}</TableCell>
                                    <TableCell className="text-right font-mono">{record.stock_TOKO88 ?? 'N/A'}</TableCell>
                                    <TableCell>
                                        {record.status === 'Processing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{record.log || record.status}</span>}
                                    </TableCell>
                                 </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </ScrollArea>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
