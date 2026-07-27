'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PackageSearch, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getRealTimeStock, GetRealTimeStockOutput, searchItems } from '@/ai/flows/get-real-time-stock';
import { Badge } from '@/components/ui/badge';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useDebounce } from 'use-debounce';

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

const DHK_WAREHOUSE_ORDER = ["KREMBUNG - PD", "LINGTIM - PD", "LAMONGAN - PD", "BANGIL - PD", "KOMBES - PD", "Transit - PD"];
const TOKO88_WAREHOUSE_ORDER = ["Stores - T", "LINGTIM - T", "LAMONGAN - T", "BANGIL - T", "KOMBES - T", "Transit - T"];
const PRICE_LIST_ORDER = ["Grosir", "88", "LM 88"];

const getStandardizedData = (data: any[], order: string[], keyField: string, valueField: string) => {
  const dataMap = new Map(data.map(item => [item[keyField], item[valueField]]));
  return order.map(key => ({
    [keyField]: key,
    [valueField]: dataMap.get(key) ?? 0,
  }));
};

export default function RealTimeStockClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<GetRealTimeStockOutput | null>(null);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [suggestions, setSuggestions] = useState<{ label: string; value: string }[]>([]);
  const [isSuggestionBoxOpen, setIsSuggestionBoxOpen] = useState(false);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('erpSettings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    } catch (error) {
      console.error('Failed to load settings from localStorage', error);
    }
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedSearchQuery.length < 2) {
        setSuggestions([]);
        setIsSuggestionBoxOpen(false);
        return;
      }
      try {
        const response = await searchItems({ query: debouncedSearchQuery, settings });
        setSuggestions(response.results);
        setIsSuggestionBoxOpen(response.results.length > 0);
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
        setSuggestions([]);
        setIsSuggestionBoxOpen(false);
      }
    };
    fetchSuggestions();
  }, [debouncedSearchQuery, settings]);

  const handleSearch = useCallback(async (searchVal: string) => {
    if (!searchVal) {
      toast({ variant: 'destructive', title: 'Input Required', description: 'Please enter an item code or name.' });
      return;
    }

    setIsProcessing(true);
    setResults(null);
    setIsSuggestionBoxOpen(false); // Close suggestions on search
    setSearchQuery(searchVal); // Update input to reflect selected item

    try {
      const searchResults = await getRealTimeStock({ query: searchVal, settings });
      setResults(searchResults);
      if (searchResults.message) {
        toast({
          variant: 'default',
          title: 'Info',
          description: searchResults.message,
        });
      }
    } catch (error: any) {
      console.error('An error occurred during search:', error);
      toast({
        variant: 'destructive',
        title: 'Processing Error',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [settings, toast]);
  

  const ERPResultCard = ({ erpName, stockData, priceData }: { erpName: 'DHK' | 'TOKO88', stockData: any[], priceData: any[] }) => {
    const warehouseOrder = erpName === 'DHK' ? DHK_WAREHOUSE_ORDER : TOKO88_WAREHOUSE_ORDER;
    const standardizedStock = getStandardizedData(stockData, warehouseOrder, 'warehouse', 'actual_qty');
    const standardizedPrices = getStandardizedData(priceData, PRICE_LIST_ORDER, 'price_list', 'price_list_rate');

    return (
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-primary">{erpName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Stok</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gudang</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standardizedStock.length > 0 ? standardizedStock.map((stock, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{stock.warehouse}</TableCell>
                      <TableCell className="text-right font-mono">{stock.actual_qty.toFixed(2)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">No stock data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Harga</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Price List</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standardizedPrices.length > 0 ? standardizedPrices.map((price, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{price.price_list}</TableCell>
                      <TableCell className="text-right font-mono">
                        {price.price_list_rate.toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">No price data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader title="Real-Time Stock Check" />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><PackageSearch /> Cek Stok & Harga Item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative w-full">
                <Command className="overflow-visible bg-transparent">
                  <CommandInput
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch(searchQuery);
                        setIsSuggestionBoxOpen(false); // Close on enter
                      }
                    }}
                    placeholder="Ketik kode atau nama item..."
                    className="flex-grow"
                    disabled={isProcessing}
                  />
                  {isSuggestionBoxOpen && suggestions.length > 0 && (
                    <CommandList className="absolute z-50 top-full mt-2 w-full rounded-md border bg-background shadow-lg">
                      {suggestions.map((s) => (
                        <CommandItem
                          key={s.value}
                          value={s.value}
                          onSelect={(currentValue) => {
                             handleSearch(currentValue);
                             setSearchQuery(currentValue);
                             setIsSuggestionBoxOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          {s.label}
                        </CommandItem>
                      ))}
                    </CommandList>
                  )}
                </Command>
              </div>

              <Button onClick={() => handleSearch(searchQuery)} disabled={isProcessing || !searchQuery}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Cari
              </Button>
            </div>
          </CardContent>
        </Card>

        {isProcessing && (
          <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed">
            <Loader2 className="w-16 h-16 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Fetching real-time data...</p>
          </div>
        )}

        {!isProcessing && !results && (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-secondary/20">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <PackageSearch className="w-16 h-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">No Data to Display</h3>
              <p className="mt-2 text-muted-foreground">Enter an item code or name to start a search.</p>
            </CardContent>
          </Card>
        )}

        {results && results.item_code && (
          <div className="space-y-4">
            <div className="bg-blue-100 border border-blue-200 text-blue-800 rounded-md p-3">
              Hasil untuk: <Badge>{results.item_code}</Badge> <span className="font-semibold">{results.item_name}</span>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
              <ERPResultCard
                erpName="DHK"
                stockData={results.stock_data.filter(s => s.source === 'DHK')}
                priceData={results.price_data.filter(p => p.source === 'DHK')}
              />
              <ERPResultCard
                erpName="TOKO88"
                stockData={results.stock_data.filter(s => s.source === 'TOKO88')}
                priceData={results.price_data.filter(p => p.source === 'TOKO88')}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
