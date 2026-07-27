
'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet, Download, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { updateStockAll } from '@/ai/flows/update-stock-all-flow';

export default function UpdateStockAllClient() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<{
    balance: any[];
    inden: any[];
    master: any[];
    h1: any[];
    price: any[];
  }>({
    balance: [],
    inden: [],
    master: [],
    h1: [],
    price: [],
  });

  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    const allData: any[] = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);
      allData.push(...json);
    }

    setFiles(prev => ({ ...prev, [type]: allData }));
    toast({
      title: 'Files Uploaded',
      description: `Loaded data from ${uploadedFiles.length} file(s) for ${type}.`,
    });
  };

  const handleProcess = async () => {
    if (files.balance.length === 0 || files.master.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Files',
        description: 'Please upload at least the Stock Balance and Item Master files.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await updateStockAll({
        balanceData: files.balance,
        indenData: files.inden,
        masterData: files.master,
        h1Data: files.h1,
        priceData: files.price,
      });

      // Download the result
      const blob = b64toBlob(result.excelBase64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Stock consolidation complete. File downloaded.',
      });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Processing Error',
        description: error.message || 'An error occurred while generating the stock report.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader title="Update Stock All Cabang" />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <RefreshCw className="h-6 w-6 text-primary" />
              Consolidate All Branch Stock
            </CardTitle>
            <CardDescription>
              Upload the required Excel files to generate a consolidated stock report for all branches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>1. Stock Balance (Required)</Label>
                <Input type="file" multiple accept=".xlsx" onChange={(e) => handleFileUpload(e, 'balance')} />
                <p className="text-[10px] text-muted-foreground">Select one or more 'Stock_Balance' files.</p>
              </div>
              <div className="space-y-2">
                <Label>2. MR ALL INDEN</Label>
                <Input type="file" multiple accept=".xlsx" onChange={(e) => handleFileUpload(e, 'inden')} />
                <p className="text-[10px] text-muted-foreground">Select one or more 'MR_ALL_INDEN' files.</p>
              </div>
              <div className="space-y-2">
                <Label>3. Item Master (Required)</Label>
                <Input type="file" accept=".xlsx" onChange={(e) => handleFileUpload(e, 'master')} />
                <p className="text-[10px] text-muted-foreground">Select the 'Item_Master.xlsx' file.</p>
              </div>
              <div className="space-y-2">
                <Label>4. H-1 (H-_Blank)</Label>
                <Input type="file" multiple accept=".xlsx" onChange={(e) => handleFileUpload(e, 'h1')} />
                <p className="text-[10px] text-muted-foreground">Select one or more 'H-_Blank' files.</p>
              </div>
              <div className="space-y-2">
                <Label>5. Item Price</Label>
                <Input type="file" multiple accept=".xlsx" onChange={(e) => handleFileUpload(e, 'price')} />
                <p className="text-[10px] text-muted-foreground">Select 'Item_Price' files.</p>
              </div>
            </div>

            <Button 
              className="w-full h-12 text-lg font-bold uppercase tracking-widest" 
              onClick={handleProcess} 
              disabled={isProcessing || files.balance.length === 0 || files.master.length === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-5 w-5" />
                  Generate Stock All Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {files.balance.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(files).map(([key, val]) => (
              <Card key={key} className="bg-secondary/20 border-none">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{key}</p>
                  <p className="text-xl font-headline font-bold text-primary">{val.length}</p>
                  <p className="text-[8px] text-muted-foreground">Rows Loaded</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
