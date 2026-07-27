'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StockRecord, RawStockRecord, Settings } from '@/lib/types';
import { validateStockDiscrepancies } from '@/ai/flows/validate-stock-discrepancies';
import { reconcileStock } from '@/ai/flows/reconcile-stock-flow';
import { excelDateToYYYYMMDD, excelTimeToHHMMSS } from '@/lib/utils';
import { format } from 'date-fns';

import { AppHeader } from '@/components/header';
import { FileUploader } from '@/components/file-uploader';
import { StockDataTable } from '@/components/stock-data-table';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileSpreadsheet } from 'lucide-react';

const defaultSettings: Settings = {
  DHK: { 
    url: process.env.NEXT_PUBLIC_DHK_URL || 'https://dehikas.digitalasiasolusindo.com', 
    key: process.env.NEXT_PUBLIC_DHK_KEY || '57d7aaf633158d0', 
    secret: process.env.NEXT_PUBLIC_DHK_SECRET || '747f455224bdf7e' 
  },
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const groupRecords = (records: StockRecord[]) => {
  return records.reduce((acc, record) => {
    const key = `${record.Warehouse}|${record.tanggal}|${record.jam}`;
    if (!acc[key]) {
      acc[key] = {
        warehouse: record.Warehouse,
        reconciliationDate: record.tanggal,
        reconciliationTime: record.jam,
        items: []
      };
    }
    
    if (record.discrepancyAmount !== undefined) {
       acc[key].items.push({
         id: record.id,
         item_code: record.item_code,
         item_name: record.item_name,
         Fisik: record.Fisik,
         stock_DHK: record.stock_DHK,
         discrepancyAmount: record.discrepancyAmount,
         valuation_rate: record.valuation_rate
       });
    }
    return acc;
  }, {} as Record<string, { warehouse: string; reconciliationDate: string; reconciliationTime: string; items: any[] }>);
};


export default function StockOpnameClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [stockData, setStockData] = useState<StockRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('erpSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      const savedData = localStorage.getItem('stockData');
      if (savedData) {
        setStockData(JSON.parse(savedData));
      }
    } catch (error: any) {
      console.error('Failed to load data from localStorage', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load saved data.',
      });
    }
  }, [toast]);

  
  const processAndValidateFile = useCallback(async (data: RawStockRecord[]) => {
    setIsProcessing(true);

    let finalValidatedData: StockRecord[] = [];
    
    const initialData: StockRecord[] = data.map((row, index) => ({
      ...row,
      id: index,
      tanggal: excelDateToYYYYMMDD(row.tanggal),
      jam: excelTimeToHHMMSS(row.jam),
      Fisik: Number(row.Fisik) || 0,
      stock_DHK: Number(row.stock_DHK) || 0,
      isValidating: true,
      reconciliationStatus: 'Pending',
      valuation_rate: Number(row.valuation_rate) || 0,
    }));
    setStockData(initialData);

    for (let i = 0; i < initialData.length; i++) {
        const record = initialData[i];
        try {
            const validationResult = await validateStockDiscrepancies({
                item_code: record.item_code,
                item_name: record.item_name,
                tanggal: record.tanggal,
                jam: record.jam,
                Warehouse: record.Warehouse,
                Fisik: record.Fisik,
                stock_DHK: record.stock_DHK,
                stock_toko88: 0, // Toko88 removed
            });
            
            const updatedRecord = { ...record, ...validationResult, isValidating: false };
            
            setStockData(currentData => {
                const newData = [...currentData];
                newData[i] = updatedRecord;
                finalValidatedData = newData;
                return newData;
            });

        } catch (error: any) {
            console.error(`Validation failed for ${record.item_code}`, error);
             const updatedRecord = { ...record, isDiscrepant: true, discrepancyAmount: 0, explanation: `Validation failed`, isValidating: false };
            setStockData(currentData => {
                const newData = [...currentData];
                newData[i] = updatedRecord;
                finalValidatedData = newData;
                return newData;
            });
        }
    }
    
    localStorage.setItem('stockData', JSON.stringify(finalValidatedData));
    setIsProcessing(false);
    toast({
        title: 'Processing Complete',
        description: `${finalValidatedData.length} records have been validated.`,
    });
  }, []);

  const handleRowUpdate = async (id: number, field: keyof StockRecord, value: any) => {
    const index = stockData.findIndex(row => row.id === id);
    if(index === -1) return;

    const updatedData = [...stockData];
    const recordToUpdate = { ...updatedData[index], [field]: Number(value) || 0, isValidating: true, reconciliationStatus: 'Pending' as const };
    updatedData[index] = recordToUpdate;
    setStockData(updatedData);

    try {
      await delay(200);
      const validationResult = await validateStockDiscrepancies({
        item_code: recordToUpdate.item_code,
        item_name: recordToUpdate.item_name,
        tanggal: String(recordToUpdate.tanggal),
        jam: String(recordToUpdate.jam),
        Warehouse: recordToUpdate.Warehouse,
        Fisik: recordToUpdate.Fisik,
        stock_DHK: recordToUpdate.stock_DHK,
        stock_toko88: 0,
      });
      const finalRecord = { ...recordToUpdate, ...validationResult, isValidating: false };
      const finalData = [...stockData];
      finalData[index] = finalRecord;
      setStockData(finalData);
      localStorage.setItem('stockData', JSON.stringify(finalData));
    } catch (error) {
      console.error(`Failed to re-validate item ${recordToUpdate.item_code}`, error);
      const finalRecord = { ...recordToUpdate, isValidating: false, isDiscrepant: true, explanation: 'Re-validation failed' };
      const finalData = [...stockData];
      finalData[index] = finalRecord;
      setStockData(finalData);
      localStorage.setItem('stockData', JSON.stringify(finalData));
    }
  };


  const handleReconcile = async () => {
    setIsReconciling(true);
    toast({
      title: 'Reconciliation Started',
      description: 'Processing reconciliations for DHK.',
    });

    const itemsToReconcile = stockData.filter(record => record.isDiscrepant && record.reconciliationStatus !== 'Success');
    const groupedItems = Object.values(groupRecords(itemsToReconcile));

    const processingIds = new Set(itemsToReconcile.map(i => i.id));
    setStockData(prevData => prevData.map(d => processingIds.has(d.id) ? { ...d, reconciliationStatus: 'Processing' } : d));

    const reconciliationPromises = groupedItems.map(async (group) => {
      try {
        const result = await reconcileStock({
          ...group,
          settings,
        });

        setStockData(prevData => {
          const newData = [...prevData];
          result.results.forEach(itemResult => {
            const indexToUpdate = newData.findIndex(d => d.id === itemResult.id);
            if (indexToUpdate !== -1) {
              newData[indexToUpdate] = {
                ...newData[indexToUpdate],
                reconciliationStatus: itemResult.status,
                reconciliationDoc: itemResult.documentId,
                reconciliationLog: itemResult.log,
              };
            }
          });
          localStorage.setItem('stockData', JSON.stringify(newData));
          return newData;
        });

      } catch (error: any) {
        const errorMessage = error.message || 'An unknown error occurred.';
        toast({
          variant: 'destructive',
          title: `Reconciliation Error for warehouse ${group.warehouse}`,
          description: errorMessage,
        });
        setStockData(prevData => {
            const newData = prevData.map(d => {
                if (group.items.some(item => item.id === d.id)) {
                    return { ...d, reconciliationStatus: 'Failed' as const, reconciliationLog: `Group reconciliation failed: ${errorMessage}` };
                }
                return d;
            });
            localStorage.setItem('stockData', JSON.stringify(newData));
            return newData;
        });
      }
    }); 

    await Promise.all(reconciliationPromises);

    setIsReconciling(false);
    toast({
        title: 'Reconciliation Complete',
        description: 'All DHK discrepant items have been processed.',
    });
  };

  const hasDiscrepancy = stockData.some(d => d.isDiscrepant && d.reconciliationStatus !== 'Success');

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader
        title="Stock Opname (DHK)"
        onReconcile={handleReconcile}
        isReconciling={isReconciling}
        canReconcile={hasDiscrepancy}
      />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
            <CardHeader>
              <CardTitle className="font-headline">1. Upload Stock Data</CardTitle>
              <CardDescription>Select an Excel file containing stock data for DHK.</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploader onFileUploaded={processAndValidateFile} isProcessing={isProcessing} requiredHeaders={['item_code', 'item_name', 'tanggal', 'jam', 'Warehouse', 'Fisik', 'stock_DHK']} />
            </CardContent>
        </Card>
        
        {isProcessing && (
           <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed">
              <Loader2 className="w-16 h-16 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Validating records...</p>
           </div>
        )}
        {!isProcessing && stockData.length > 0 && (
          <StockDataTable data={stockData} onRowUpdate={handleRowUpdate} />
        )}
        {!isProcessing && stockData.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <FileSpreadsheet className="w-16 h-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold font-headline">No Data to Display</h3>
              <p className="mt-2 text-muted-foreground">Upload an Excel file to start.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
