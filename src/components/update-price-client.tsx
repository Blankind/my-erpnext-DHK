'use client';

import { useState, useEffect } from 'react';
import type { Settings, PriceUpdateRecord, PriceUpdateStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { FileUploader } from '@/components/file-uploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet, PlayCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { updateItemPrice } from '@/ai/flows/update-item-price-flow';
import { ScrollArea } from './ui/scroll-area';

const defaultSettings: Settings = {
  DHK: { 
    url: 'https://dehikas2.digitalasiasolusindo.com', 
    key: '57d7aaf633158d0', 
    secret: '3d64051fcef8a3f' 
  },
};

const DISPLAY_PRICE_LISTS: (keyof Omit<PriceUpdateRecord, 'id' | 'item_code' | 'statusDHK' | 'logDHK'>)[] = ["Grosir", "88", "LM 88"];
const REQUIRED_FILE_HEADERS = ['item_code', '99', '88', '89'];

const parsePrice = (price: any): number | undefined => {
  if (price === undefined || price === null || price === '') return undefined;
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const cleanedString = String(price).replace(/[^0-9]/g, '');
    if (cleanedString) return parseFloat(cleanedString);
  }
  return undefined;
};


export default function UpdatePriceClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [priceData, setPriceData] = useState<PriceUpdateRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('erpSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    } catch (error) {
      console.error('Failed to load settings from localStorage', error);
    }
  }, []);
  
  const handleFileUploaded = (data: any[]) => {
      const records: PriceUpdateRecord[] = data.map((row, index) => ({
        id: index,
        item_code: row.item_code,
        "Grosir": parsePrice(row['99']),
        "88": parsePrice(row['88']),
        "LM 88": parsePrice(row['89']),
        statusDHK: 'Pending',
        logDHK: '',
      }));
      setPriceData(records);
      toast({ title: 'File Uploaded', description: `${records.length} records ready.` });
  }

  const handleUpdatePrices = async () => {
    if (priceData.length === 0) return;
    setIsProcessing(true);
    setPriceData(prev => prev.map(r => ({...r, statusDHK: 'Processing'})));

    try {
      const recordsToProcess = priceData.map(({ item_code, ...rest }) => ({
          item_code: item_code,
          "99": rest["Grosir"],
          "88": rest["88"],
          "89": rest["LM 88"],
      }));
      
      const result = await updateItemPrice({ records: recordsToProcess, settings });
      setPriceData(result.results);
      toast({ title: 'Complete', description: 'Price updates processed.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setPriceData(prev => prev.map(r => ({...r, statusDHK: 'Failed', logDHK: 'Error'})));
    } finally {
        setIsProcessing(false);
    }
  };
  
  const getStatusVariant = (status?: PriceUpdateStatus): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'Success':
      case 'Updated':
      case 'Created': return 'default';
      case 'Failed': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader title="Update Item Prices (DHK)" />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>Bulk Price Update</CardTitle>
            <CardDescription>Upload Excel with `item_code`, `99` (Grosir), `88`, and `89` (LM 88).</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
             <FileUploader onFileUploaded={handleFileUploaded} isProcessing={isProcessing} requiredHeaders={REQUIRED_FILE_HEADERS} />
             <Button onClick={handleUpdatePrices} disabled={isProcessing || priceData.length === 0}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                Start Update
             </Button>
          </CardContent>
        </Card>
        
        {priceData.length > 0 && (
          <Card>
            <CardHeader><CardTitle>DHK Update Status</CardTitle></CardHeader>
            <CardContent>
                 <ScrollArea className="h-96 rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item Code</TableHead>
                                {DISPLAY_PRICE_LISTS.map(pl => <TableHead key={pl} className="text-right">{pl}</TableHead>)}
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {priceData.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-mono">{record.item_code}</TableCell>
                                    {DISPLAY_PRICE_LISTS.map(pl => (
                                        <TableCell key={pl} className="text-right font-mono">
                                          {typeof (record as any)[pl] === 'number' ? (record as any)[pl].toLocaleString() : '-'}
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                      <div className="flex flex-col">
                                        {record.statusDHK === 'Processing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                          <Badge variant={getStatusVariant(record.statusDHK)}>{record.statusDHK}</Badge>}
                                        {record.logDHK && <p className="text-[10px] text-muted-foreground">{record.logDHK}</p>}
                                      </div>
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
