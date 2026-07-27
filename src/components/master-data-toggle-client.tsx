'use client';

import { useState, useEffect } from 'react';
import type { Settings, MasterDataRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, PlayCircle, PencilLine } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toggleMasterDataStatus } from '@/ai/flows/toggle-master-data-status';

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

type DocType = 'Item' | 'Customer' | 'Supplier';
type Action = 'disable' | 'enable';
type TargetErp = 'DHK' | 'TOKO88' | 'both';


export default function MasterDataToggleClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [doctype, setDoctype] = useState<DocType>('Item');
  const [action, setAction] = useState<Action>('disable');
  const [targetErp, setTargetErp] = useState<TargetErp>('both');
  const [inputCodes, setInputCodes] = useState<string>('');
  const [data, setData] = useState<MasterDataRecord[]>([]);
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

  const handleProcess = async () => {
    if (!inputCodes.trim()) {
        toast({ variant: 'destructive', title: 'No Data', description: 'Please enter at least one code.'});
        return;
    }
    
    setIsProcessing(true);
    
    const codes = inputCodes.split(/[\n, ]+/).filter(code => code.trim() !== '');
    const recordsToProcess: MasterDataRecord[] = codes.map((code, index) => ({
      id: index,
      code: code.trim(),
      statusDHK: 'Pending',
      logDHK: '',
      statusTOKO88: 'Pending',
      logTOKO88: '',
    }));
    
    setData(recordsToProcess);

    try {
      const result = await toggleMasterDataStatus({
        doctype,
        action,
        targetErp,
        records: recordsToProcess,
        settings,
      });

      setData(result.results);

      toast({
        title: 'Processing Complete',
        description: 'All records have been processed.',
      });

    } catch (error: any) {
        console.error('An error occurred during processing:', error);
        toast({
            variant: 'destructive',
            title: 'Processing Error',
            description: error.message || 'An unknown error occurred.'
        })
    }


    setIsProcessing(false);
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
      <AppHeader 
        title="Toggle Master Data"
      />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Master Data Bulk Update</CardTitle>
            <CardDescription>Enable or disable Items, Customers, or Suppliers in bulk by entering their codes below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>1. Select Doctype</Label>
                <Select value={doctype} onValueChange={(v: DocType) => setDoctype(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Item">Item</SelectItem>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>2. Select Target ERP</Label>
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
                <Label>3. Select Action</Label>
                <RadioGroup value={action} onValueChange={(v: Action) => setAction(v)} className="flex items-center space-x-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="disable" id="disable" />
                    <Label htmlFor="disable">Disable</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="enable" id="enable" />
                    <Label htmlFor="enable">Enable</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <div className="space-y-2">
                 <Label htmlFor="code-input">4. Enter {doctype} Codes</Label>
                 <Textarea 
                    id="code-input"
                    placeholder={`Enter ${doctype} codes here, separated by new lines, commas, or spaces.`}
                    value={inputCodes}
                    onChange={(e) => setInputCodes(e.target.value)}
                    className="min-h-[120px] font-mono"
                    disabled={isProcessing}
                 />
            </div>
            <div>
                <Button onClick={handleProcess} disabled={isProcessing || !inputCodes.trim()} className="w-full md:w-auto">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    {isProcessing ? 'Processing...' : `Start Processing`}
                </Button>
            </div>
          </CardContent>
        </Card>
        
        {isProcessing && data.length > 0 && (
           <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed">
              <Loader2 className="w-16 h-16 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Processing records...</p>
           </div>
        )}

        {!isProcessing && data.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle className="font-headline">Results</CardTitle>
                <CardDescription>Review the status of each record.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Code</TableHead>
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
                                        {record.statusDHK !== 'Pending' && <Badge variant={getStatusVariant(record.statusDHK)}>{record.statusDHK}</Badge>}
                                        {record.logDHK && <p className="text-xs text-muted-foreground">{record.logDHK}</p>}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col items-start gap-1">
                                        {record.statusTOKO88 !== 'Pending' && <Badge variant={getStatusVariant(record.statusTOKO88)}>{record.statusTOKO88}</Badge>}
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

        {!isProcessing && data.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-secondary/20">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <PencilLine className="w-16 h-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">No Data to Display</h3>
              <p className="mt-2 text-muted-foreground">Enter some codes above to get started.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
