'use client';

import { useState, useEffect } from 'react';
import type { Settings, ItemUpdateRecord, ItemUpdateResultDetail, ItemDetailStatus, FieldsToUpdate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { FileUploader } from '@/components/file-uploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet, PlayCircle, CheckCircle, AlertCircle, CircleDashed, Edit, HelpCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { updateItemDetails } from '@/ai/flows/update-item-details-flow';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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

const REQUIRED_FILE_HEADERS = ['item_code', 'item_name', 'description', 'weight'];

// Helper to parse potentially empty numeric values from Excel
const parseOptionalNumber = (value: any): number | undefined => {
    if (value === undefined || value === null || String(value).trim() === '') {
        return undefined;
    }
    const num = Number(value);
    return isNaN(num) ? undefined : num;
};


export default function UpdateItemClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [itemData, setItemData] = useState<ItemUpdateRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fieldsToUpdate, setFieldsToUpdate] = useState<FieldsToUpdate>({
    item_name: true,
    description: true,
    weight: true,
  });
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
      const records: ItemUpdateRecord[] = data.map((row, index) => ({
        id: index,
        item_code: String(row.item_code || ''),
        item_name: row.item_name !== undefined && row.item_name !== null ? String(row.item_name) : undefined,
        description: row.description !== undefined && row.description !== null ? String(row.description) : undefined,
        weight: parseOptionalNumber(row.weight),
        statusDHK: [],
        statusTOKO88: [],
      }));
      setItemData(records);
      toast({
        title: 'File Uploaded',
        description: `${records.length} records are ready to be processed.`,
      })
  }

  const handleUpdateItems = async () => {
    if (itemData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'Please upload a file with item data.'});
        return;
    }
    
    if (!fieldsToUpdate.item_name && !fieldsToUpdate.description && !fieldsToUpdate.weight) {
        toast({ variant: 'destructive', title: 'No Fields Selected', description: 'Please select at least one field to update.'});
        return;
    }

    setIsProcessing(true);
    setItemData(prevData => prevData.map(r => ({...r, statusDHK: [{field: 'Item', status: 'Processing', message:'Updating...'}], statusTOKO88: [{field: 'Item', status: 'Processing', message:'Updating...'}] })));

    try {
      const result = await updateItemDetails({
        records: itemData,
        settings,
        fieldsToUpdate,
      });
      
      setItemData(result.results);

      toast({
        title: 'Processing Complete',
        description: 'All item updates have been processed.',
      });

    } catch (error: any) {
        console.error('An error occurred during item update:', error);
        toast({
            variant: 'destructive',
            title: 'Processing Error',
            description: error.message || 'An unknown error occurred.'
        })
        const errorMessage = error.message || 'Client-side error';
        setItemData(prevData => prevData.map(r => ({...r, statusDHK: [{field: 'Item', status: 'Failed', message: errorMessage}], statusTOKO88: [{field: 'Item', status: 'Failed', message: errorMessage}] })));
    }


    setIsProcessing(false);
  };

  const getStatusIcon = (status: ItemDetailStatus) => {
    switch (status) {
        case 'Updated': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'Unchanged': return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
        case 'Failed': return <AlertCircle className="h-4 w-4 text-destructive" />;
        case 'Skipped': return <HelpCircle className="h-4 w-4 text-yellow-500" />;
        case 'Processing': return <Loader2 className="h-4 w-4 animate-spin" />;
        default: return <Edit className="h-4 w-4 text-muted-foreground" />;
    }
  }

  const StatusCell = ({ results }: { results: ItemUpdateResultDetail[] }) => {
    if (!results || results.length === 0) return null;

    if (results.length === 1 && results[0].status === 'Processing') {
        return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> <span>Processing...</span></div>;
    }
    if (results.length === 1 && (results[0].status === 'Skipped' || results[0].status === 'Failed')) {
       return (
         <div className="flex items-center gap-2 text-sm">
            {getStatusIcon(results[0].status)}
            <div>
              <p className="font-semibold">{results[0].status}</p>
              <p className="text-xs text-muted-foreground">{results[0].message}</p>
            </div>
        </div>
       )
    }

    return (
        <div className="flex flex-col gap-2">
            {results.map((res, idx) => (
                 <div key={idx} className="flex items-center gap-2 text-sm">
                    {getStatusIcon(res.status)}
                    <div>
                        <p className={cn("font-semibold", res.status === 'Unchanged' && 'text-muted-foreground')}>{res.field}</p>
                        <p className="text-xs text-muted-foreground">{res.message}</p>
                    </div>
                </div>
            ))}
        </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader 
        title="Update Item Details"
      />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Bulk Item Update</CardTitle>
            <CardDescription>Upload an Excel file with `item_code`, `item_name`, `description`, and `weight`. Then, select which fields you want to update.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
                <Label className="font-semibold">Fields to Update</Label>
                <div className="flex items-center space-x-4 rounded-md border p-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="update-name" checked={fieldsToUpdate.item_name} onCheckedChange={(checked) => setFieldsToUpdate(prev => ({...prev, item_name: !!checked}))} />
                    <Label htmlFor="update-name">Item Name</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="update-desc" checked={fieldsToUpdate.description} onCheckedChange={(checked) => setFieldsToUpdate(prev => ({...prev, description: !!checked}))} />
                    <Label htmlFor="update-desc">Description</Label>
                  </div>
                   <div className="flex items-center space-x-2">
                    <Checkbox id="update-weight" checked={fieldsToUpdate.weight} onCheckedChange={(checked) => setFieldsToUpdate(prev => ({...prev, weight: !!checked}))} />
                    <Label htmlFor="update-weight">Weight</Label>
                  </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
               <FileUploader 
                  onFileUploaded={handleFileUploaded} 
                  isProcessing={isProcessing} 
                  requiredHeaders={REQUIRED_FILE_HEADERS}
                  buttonText="Upload Item File"
                />
                <Button onClick={handleUpdateItems} disabled={isProcessing || itemData.length === 0} >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    {isProcessing ? 'Updating Items...' : `Start Item Update`}
                </Button>
            </div>
          </CardContent>
        </Card>
        
        {!isProcessing && itemData.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-secondary/20">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <FileSpreadsheet className="w-16 h-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">No Data to Display</h3>
              <p className="mt-2 text-muted-foreground">Upload an Excel file to get started.</p>
            </CardContent>
          </Card>
        )}

        {itemData.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle className="font-headline">Item Update Status</CardTitle>
                <CardDescription>Review the status of each item update. Both ERPs will be updated for each item.</CardDescription>
            </CardHeader>
            <CardContent>
                 <ScrollArea className="h-96 rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[150px]">Item Code</TableHead>
                                <TableHead>Item Details</TableHead>
                                <TableHead className="text-right">Weight</TableHead>
                                <TableHead className="w-[250px]">DHK Status</TableHead>
                                <TableHead className="w-[250px]">TOKO88 Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {itemData.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-mono align-top">{record.item_code}</TableCell>
                                    <TableCell className="align-top">
                                        <p className="font-medium">{record.item_name ?? <span className="text-muted-foreground italic">No change</span>}</p>
                                        <p className="text-xs text-muted-foreground max-w-xs truncate" title={record.description}>{record.description ?? <span className="text-muted-foreground italic">No change</span>}</p>
                                    </TableCell>
                                    <TableCell className="text-right font-mono align-top">{record.weight ?? <span className="text-muted-foreground italic">No change</span>}</TableCell>
                                    <TableCell className="align-top">
                                       <StatusCell results={record.statusDHK} />
                                    </TableCell>
                                    <TableCell className="align-top">
                                       <StatusCell results={record.statusTOKO88} />
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
