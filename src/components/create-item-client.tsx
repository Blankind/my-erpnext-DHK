'use client';

import { useState, useEffect } from 'react';
import type { Settings, CreateItemResult, BatchCreateItemResult } from '@/lib/types';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { FileUploader } from '@/components/file-uploader';
import { createItemWithPrice } from '@/ai/flows/create-item-with-price-flow';
import { createItemsInBatch } from '@/ai/flows/create-items-in-batch-flow';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Trash2, CheckCircle, AlertCircle, Server, PackagePlus, FileSpreadsheet, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from './ui/scroll-area';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';

const defaultSettings: Settings = {
  DHK: { 
    url: 'https://dehikas2.digitalasiasolusindo.com', 
    key: '57d7aaf633158d0', 
    secret: '3d64051fcef8a3f' 
  }
};

const REQUIRED_FILE_HEADERS = ['item_code', 'item_name', 'item_group', 'uom', 'is_sales_item', 'description', 'weight', '99', '88', '89'];

const priceSchema = z.object({
  price_list: z.string().min(1, 'Price list name is required.'),
  rate: z.coerce.number().min(0, 'Price must be a positive number.'),
});

const createItemSchema = z.object({
  item_code: z.string().min(1, 'Item code is required.'),
  item_name: z.string().min(1, 'Item name is required.'),
  item_group: z.string().min(1, 'Item group is required.').default('All Item Groups'),
  stock_uom: z.string().min(1, 'Unit of Measure is required.').default('Nos'),
  description: z.string().optional(),
  weight_per_unit: z.coerce.number().min(0).optional().default(0),
  is_sales_item: z.boolean().default(false),
  set_prices: z.boolean().default(true),
  prices: z.array(priceSchema).optional(),
}).refine(data => {
    if (data.set_prices) {
        return Array.isArray(data.prices) && data.prices.length > 0;
    }
    return true;
}, {
    message: 'At least one price is required when "Set Item Prices" is enabled.',
    path: ['prices'],
});

type CreateItemFormValues = z.infer<typeof createItemSchema>;

type BatchItem = {
    item_code: string;
    item_name: string;
    item_group: string;
    stock_uom: string;
    description?: string;
    weight_per_unit?: number;
    is_sales_item?: boolean;
    prices: { price_list: string; rate: number }[];
};


export default function CreateItemClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [singleResult, setSingleResult] = useState<CreateItemResult | null>(null);
  const [batchData, setBatchData] = useState<BatchItem[]>([]);
  const [batchResults, setBatchResults] = useState<BatchCreateItemResult[]>([]);

  const { toast } = useToast();

  const form = useForm<CreateItemFormValues>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      item_code: '',
      item_name: '',
      item_group: 'All Item Groups',
      stock_uom: 'Nos',
      description: '',
      weight_per_unit: 0,
      is_sales_item: false,
      set_prices: true,
      prices: [
        { price_list: 'Grosir', rate: 0 },
        { price_list: '88', rate: 0 },
        { price_list: 'LM 88', rate: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prices",
  });
  
  const setPrices = form.watch('set_prices');

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('erpSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    } catch (error) {
      console.error('Failed to load settings from localStorage', error);
    }
  }, []);

  const onSingleSubmit = async (data: CreateItemFormValues) => {
    setIsProcessing(true);
    setSingleResult(null);
    
    try {
      const flowResult = await createItemWithPrice({
          item: data,
          settings,
      });
      setSingleResult(flowResult);
      toast({ title: 'Processing Complete', description: 'Item creation process finished. See results below.' });
    } catch (error: any) {
      console.error('Error creating item:', error);
      toast({ variant: 'destructive', title: 'An Error Occurred', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUploaded = (data: any[]) => {
      const records = data.map((row): BatchItem => {
        const prices = [];
        if (typeof row['99'] === 'number') prices.push({ price_list: 'Grosir', rate: row['99'] });
        if (typeof row['88'] === 'number') prices.push({ price_list: '88', rate: row['88'] });
        if (typeof row['89'] === 'number') prices.push({ price_list: 'LM 88', rate: row['89'] });

        return {
            item_code: String(row.item_code || ''),
            item_name: String(row.item_name || ''),
            item_group: String(row.item_group || 'All Item Groups'),
            stock_uom: String(row.uom || 'Nos'),
            description: String(row.description || ''),
            weight_per_unit: Number(row.weight || 0),
            is_sales_item: row.is_sales_item === 'Y' || row.is_sales_item === true,
            prices: prices,
        }
      });
      
      setBatchData(records);
      setBatchResults([]);
      toast({
        title: 'File Uploaded',
        description: `${records.length} items parsed and ready to be processed.`,
      })
  }

  const handleProcessBatch = async () => {
    if (batchData.length === 0) return;
    setIsProcessing(true);
    setBatchResults([]);

    try {
      const result = await createItemsInBatch({
        items: batchData,
        settings,
      });
      setBatchResults(result.results);
      toast({ title: 'Batch Processing Complete', description: 'All items from the file have been processed.' });
    } catch (error: any) {
        console.error('An error occurred during batch creation:', error);
        toast({ variant: 'destructive', title: 'Processing Error', description: error.message || 'An unknown error occurred.' });
    } finally {
        setIsProcessing(false);
    }
  }


  const SingleResultSection = () => {
    if (!singleResult) return null;

    const ResultCard = ({ title, status, erp }: { title: string, status: { success: boolean, message: string }, erp: 'DHK' }) => {
      if (!status || status.message === 'Skipped') return null;
      return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5"/>
                    <span>{erp} - {title}</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3">
                    {status.success ? <CheckCircle className="h-6 w-6 text-green-500" /> : <AlertCircle className="h-6 w-6 text-destructive" />}
                    <div>
                        <p className="font-semibold">{status.success ? 'Success' : 'Failed'}</p>
                        <p className="text-sm text-muted-foreground">{status.message}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
      );
    };

     const PriceResultCard = ({ title, prices, erp }: { title: string, prices: { price_list: string, success: boolean, message: string }[], erp: 'DHK'}) => {
       if (!prices || prices.length === 0) return null;
       return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5"/>
                    <span>{erp} - {title}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {prices.map((price, index) => (
                    <div key={index} className="flex items-center gap-3">
                        {price.success ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
                         <div>
                            <p className="font-semibold">{price.price_list}</p>
                            <p className="text-sm text-muted-foreground">{price.message}</p>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
       );
     };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Creation Results</CardTitle>
                <CardDescription>Review the outcome of the item creation process in DHK.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-1 gap-4">
                    <ResultCard title="Item Creation" status={singleResult.itemDHK} erp="DHK" />
                </div>
                { singleResult.pricesDHK && singleResult.pricesDHK.length > 0 &&
                  <div className="grid md:grid-cols-1 gap-4">
                      <PriceResultCard title="Price Creation" prices={singleResult.pricesDHK} erp="DHK" />
                  </div>
                }
            </CardContent>
        </Card>
    )
  }

  const BatchResultSection = () => {
    if (batchResults.length === 0) return null;

    const StatusBadge = ({ success, message }: { success: boolean, message: string }) => {
       if (message === 'Skipped') return <Badge variant="secondary" className="w-20 justify-center">Skipped</Badge>;
       return (
         <Badge variant={success ? 'default' : 'destructive'} className="w-20 justify-center">
            {success ? 'Success' : 'Failed'}
         </Badge>
       );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Batch Creation Results</CardTitle>
                <CardDescription>Review the outcome of each item creation in DHK.</CardDescription>
            </CardHeader>
            <CardContent>
                 <ScrollArea className="h-96 rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item Code</TableHead>
                                <TableHead>DHK Item</TableHead>
                                <TableHead>DHK Prices</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batchResults.map((res) => (
                                <TableRow key={res.item_code}>
                                    <TableCell className="font-mono">{res.item_code}</TableCell>
                                    <TableCell><StatusBadge success={res.itemDHK.success} message={res.itemDHK.message} /></TableCell>
                                    <TableCell>
                                        {res.pricesDHK.length === 0 ? <Badge variant="secondary" className="w-20 justify-center">N/A</Badge> : <StatusBadge success={res.pricesDHK.every(p => p.success)} message={res.pricesDHK[0].message} />}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader title="Create New Item" />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Tabs defaultValue="single">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Single Entry</TabsTrigger>
                <TabsTrigger value="batch">Batch Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="single">
                <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Create a Single Master Item (DHK)</CardTitle>
                    <CardDescription>Fill out the form below to create a new item in Dehikas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSingleSubmit)} className="space-y-8">
                        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                        <FormField control={form.control} name="item_code" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Item Code</FormLabel>
                                <FormControl><Input placeholder="e.g., ITEM-0001" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )} />
                            <FormField control={form.control} name="item_name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Item Name</FormLabel>
                                <FormControl><Input placeholder="e.g., New Widget" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )} />
                            <FormField control={form.control} name="item_group" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Item Group</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )} />
                            <FormField control={form.control} name="stock_uom" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit of Measure (UoM)</FormLabel>
                                <FormControl><Input placeholder="e.g., Nos, Kg, Pcs" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>Description</FormLabel>
                                <FormControl><Input placeholder="A brief description of the item" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )} />
                            <FormField control={form.control} name="weight_per_unit" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Weight per Unit (Kg)</FormLabel>
                                <FormControl><Input type="number" step="any" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )} />
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Sales Details</h3>
                             <FormField
                                control={form.control}
                                name="is_sales_item"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Is Sales Item?</FormLabel>
                                            <FormMessage>Enable if this item will be sold to customers.</FormMessage>
                                        </div>
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>


                        <Separator />

                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="set_prices"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Set Item Prices</FormLabel>
                                            <FormMessage>Enable to add price lists for this item upon creation.</FormMessage>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            
                            {setPrices && (
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-lg font-medium">Pricing</h3>
                                    {fields.map((item, index) => (
                                        <div key={item.id} className="flex items-end gap-4">
                                            <FormField control={form.control} name={`prices.${index}.price_list`} render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel>Price List</FormLabel>
                                                    <FormControl><Input placeholder="e.g., Standard Selling" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                            <FormField control={form.control} name={`prices.${index}.rate`} render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel>Price Rate</FormLabel>
                                                    <FormControl><Input type="number" step="any" placeholder="0" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ price_list: '', rate: 0 })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Price
                                    </Button>
                                    <FormField control={form.control} name="prices" render={() => <FormMessage />} />
                                </div>
                            )}
                        </div>

                        <Button type="submit" disabled={isProcessing} className="w-full md:w-auto">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
                        {isProcessing ? 'Creating Item...' : 'Create Item'}
                        </Button>
                    </form>
                    </Form>
                </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="batch">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Create Items in Batch (DHK)</CardTitle>
                        <CardDescription>Upload an Excel file to create multiple items at once in Dehikas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <FileUploader onFileUploaded={handleFileUploaded} isProcessing={isProcessing} requiredHeaders={REQUIRED_FILE_HEADERS} buttonText="Upload Items File" />
                            <Button onClick={handleProcessBatch} disabled={isProcessing || batchData.length === 0} >
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                                {isProcessing ? 'Processing Batch...' : `Process ${batchData.length} Items`}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        {singleResult && <SingleResultSection />}
        {batchResults.length > 0 && <BatchResultSection />}
      </main>
    </div>
  );
}
