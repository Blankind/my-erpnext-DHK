'use client';

import { useState, useEffect } from 'react';
import type { Settings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { deleteItemPrices } from '@/ai/flows/delete-item-price-flow';

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

type TargetErp = 'DHK' | 'TOKO88' | 'both';

export default function DeleteItemPriceClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [targetErp, setTargetErp] = useState<TargetErp>('both');
  const [inputCodes, setInputCodes] = useState<string>('');
  const [data, setData] = useState<any[]>([]);
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

  const handleDelete = async () => {
    if (!inputCodes.trim()) {
        toast({ variant: 'destructive', title: 'No Data', description: 'Please enter at least one ID.'});
        return;
    }
    
    const confirmDelete = window.confirm("Are you sure you want to PERMANENTLY delete these Item Price records? This action cannot be undone.");
    if (!confirmDelete) return;

    setIsProcessing(true);
    
    const codes = inputCodes.split(/[\n, ]+/).filter(code => code.trim() !== '');
    const recordsToProcess = codes.map((code, index) => ({
      id: index,
      code: code.trim(),
    }));
    
    setData(recordsToProcess.map(r => ({ ...r, statusDHK: 'Pending', statusTOKO88: 'Pending' })));

    try {
      const result = await deleteItemPrices({
        targetErp,
        records: recordsToProcess,
        settings,
      });

      setData(result.results);

      toast({
        title: 'Deletion Complete',
        description: 'Process finished. Review results in the table below.',
      });

    } catch (error: any) {
        console.error('An error occurred during deletion:', error);
        toast({
            variant: 'destructive',
            title: 'Processing Error',
            description: error.message || 'An unknown error occurred.'
        })
    } finally {
        setIsProcessing(false);
    }
  };
  
  const getStatusVariant = (status?: string): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'Success':
        return 'default';
      case 'Failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader title="Delete Item Prices" />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2 text-destructive">
                <Trash2 className="h-6 w-6" />
                Bulk Delete Item Prices
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-destructive/80 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Warning: This will permanently delete Item Price documents based on their ID (e.g., IP-00001).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>1. Select Target ERP</Label>
                 <Select value={targetErp} onValueChange={(v: TargetErp) => setTargetErp(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both DHK & TOKO88</SelectItem>
                    <SelectItem value="DHK">DHK Only</SelectItem>
                    <SelectItem value="TOKO88">TOKO88 Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                 <Label htmlFor="code-input">2. Enter Item Price IDs</Label>
                 <Textarea 
                    id="code-input"
                    placeholder="Enter IDs here (e.g. IP-00001), separated by lines or commas."
                    value={inputCodes}
                    onChange={(e) => setInputCodes(e.target.value)}
                    className="min-h-[100px] font-mono"
                    disabled={isProcessing}
                 />
              </div>
            </div>
            <div>
                <Button variant="destructive" onClick={handleDelete} disabled={isProcessing || !inputCodes.trim()} className="w-full md:w-auto">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    {isProcessing ? 'Deleting...' : `Delete ${inputCodes.split(/[\n, ]+/).filter(c => c.trim()).length} Records`}
                </Button>
            </div>
          </CardContent>
        </Card>

        {data.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle className="font-headline">Deletion Status</CardTitle>
                <CardDescription>Review the outcome of the deletion process.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>DHK Status</TableHead>
                                <TableHead>TOKO88 Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-mono">{record.code}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-col items-start gap-1">
                                        {record.statusDHK === 'Processing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                          record.statusDHK !== 'Pending' && <Badge variant={getStatusVariant(record.statusDHK)}>{record.statusDHK}</Badge>}
                                        {record.logDHK && <p className="text-xs text-muted-foreground">{record.logDHK}</p>}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col items-start gap-1">
                                        {record.statusTOKO88 === 'Processing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                          record.statusTOKO88 !== 'Pending' && <Badge variant={getStatusVariant(record.statusTOKO88)}>{record.statusTOKO88}</Badge>}
                                        {record.logTOKO88 && <p className="text-xs text-muted-foreground">{record.logTOKO88}</p>}
                                      </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
