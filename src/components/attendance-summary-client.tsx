'use client';

import { useState, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, ClipboardList, Search, FileImage } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { processAttendance, AttendanceSummaryOutput } from '@/ai/flows/attendance-summary-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import html2canvas from 'html2canvas';

export default function AttendanceSummaryClient() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [results, setResults] = useState<AttendanceSummaryOutput | null>(null);
  const [summaryFilter, setSummaryFilter] = useState('');
  const [detailFilter, setDetailFilter] = useState('');
  const { toast } = useToast();
  
  const exportHiddenRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResults(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        try {
          const response = await processAttendance({ fileBase64: base64 });
          setResults(response);
          toast({
            title: 'Success',
            description: 'Attendance records processed successfully.',
          });
        } catch (error: any) {
          console.error(error);
          toast({
            variant: 'destructive',
            title: 'Processing Error',
            description: error.message || 'Failed to process attendance file.',
          });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error(error);
      setIsProcessing(false);
      toast({
        variant: 'destructive',
        title: 'File Error',
        description: 'Failed to read the file.',
      });
    }
  };

  const handleDownloadExcel = () => {
    if (!results?.excelBase64 || !results?.fileName) return;

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

    const blob = b64toBlob(results.excelBase64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = results.fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredSummary = useMemo(() => {
    if (!results) return [];
    return results.summary
      .filter(row => 
        row.Name.toLowerCase().includes(summaryFilter.toLowerCase()) || 
        row.Department.toLowerCase().includes(summaryFilter.toLowerCase()) ||
        row["User ID"].toLowerCase().includes(summaryFilter.toLowerCase())
      )
      .sort((a, b) => {
        // Priority 1: Most Late (Telat)
        if (b.Telat !== a.Telat) return b.Telat - a.Telat;
        // Priority 2: Most Early Leave (Awal)
        if (b.Awal !== a.Awal) return b.Awal - a.Awal;
        // Priority 3: Most Incomplete Finger
        if (b.Tidak_Lengkap_Finger !== a.Tidak_Lengkap_Finger) return b.Tidak_Lengkap_Finger - a.Tidak_Lengkap_Finger;
        // Priority 4: Department (Asc)
        if (a.Department !== b.Department) return a.Department.localeCompare(b.Department);
        // Priority 5: Name (Asc)
        return a.Name.localeCompare(b.Name);
      });
  }, [results, summaryFilter]);

  const filteredDetails = useMemo(() => {
    if (!results) return [];
    return results.details
      .filter(row => 
        row.Name.toLowerCase().includes(detailFilter.toLowerCase()) || 
        row.Department.toLowerCase().includes(detailFilter.toLowerCase()) ||
        row["User ID"].toLowerCase().includes(detailFilter.toLowerCase())
      )
      .sort((a, b) => {
        // Detail logs priority: Department -> Name -> Day
        if (a.Department !== b.Department) return a.Department.localeCompare(b.Department);
        if (a.Name !== b.Name) return a.Name.localeCompare(b.Name);
        return a.Day - b.Day;
      });
  }, [results, detailFilter]);

  const handleDownloadPaginatedPNG = async (type: 'summary' | 'detail') => {
    if (!results || !exportHiddenRef.current) return;

    setIsExporting(true);
    toast({ title: "Processing Export", description: "Calculating pages and generating images..." });

    const data = type === 'summary' ? filteredSummary : filteredDetails;
    if (data.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No records match your filters.' });
      setIsExporting(false);
      return;
    }

    // --- Pagination Logic ---
    let chunks: any[][] = [];
    if (type === 'summary') {
      const pageSize = 20;
      for (let i = 0; i < data.length; i += pageSize) {
        chunks.push(data.slice(i, i + pageSize));
      }
    } else {
      const groups: Record<string, any[]> = {};
      data.forEach(row => {
        const groupKey = `${row.Department}|${row["User ID"]}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(row);
      });

      const groupKeys = Object.keys(groups);
      let currentChunk: any[] = [];
      let currentRows = 0;
      const targetRowsPerPage = 30;

      groupKeys.forEach(key => {
        const userRows = groups[key];
        if (currentRows + userRows.length > targetRowsPerPage && currentRows > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentRows = 0;
        }
        currentChunk.push(...userRows);
        currentRows += userRows.length;
      });
      if (currentChunk.length > 0) chunks.push(currentChunk);
    }

    const capturePage = async (chunk: any[], index: number) => {
      exportHiddenRef.current!.innerHTML = '';
      
      const container = document.createElement('div');
      container.style.padding = '40px';
      container.style.background = 'white';
      container.style.width = '1200px';
      container.className = 'font-sans';

      const title = document.createElement('h1');
      title.innerText = `REKAP ABSENSI - ${type.toUpperCase()} (Halaman ${index + 1}/${chunks.length})`;
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '20px';
      title.style.textAlign = 'center';
      title.style.color = '#1e293b';
      container.appendChild(title);

      const timestamp = document.createElement('p');
      timestamp.innerText = `Dicetak pada: ${new Date().toLocaleString('id-ID')}`;
      timestamp.style.fontSize = '12px';
      timestamp.style.color = '#64748b';
      timestamp.style.marginBottom = '20px';
      timestamp.style.textAlign = 'right';
      container.appendChild(timestamp);

      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.border = '1px solid #e2e8f0';

      const thead = document.createElement('thead');
      thead.style.background = '#f8fafc';
      
      const headers = type === 'summary' 
        ? ['User ID', 'Name', 'Department', 'Hadir', 'Telat', 'Pulang Awal', 'Finger Tidak Lengkap']
        : ['User ID', 'Name', 'Day', 'In', 'Out', 'Status', 'OT (m)'];

      const trHead = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.innerText = h;
        th.style.padding = '12px 8px';
        th.style.border = '1px solid #e2e8f0';
        th.style.fontSize = '12px';
        th.style.fontWeight = 'bold';
        th.style.textAlign = 'left';
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      chunk.forEach(row => {
        const tr = document.createElement('tr');
        const cells = type === 'summary' 
          ? [row["User ID"], row.Name, row.Department, String(row.Hadir), String(row.Telat), String(row.Awal), String(row.Tidak_Lengkap_Finger)]
          : [row["User ID"], row.Name, String(row.Day), row["Time In"] || '-', row["Time Out"] || '-', '', String(row["Overtime Minutes"])];

        cells.forEach((c, cIdx) => {
          const td = document.createElement('td');
          td.innerText = c;
          td.style.padding = '10px 8px';
          td.style.border = '1px solid #e2e8f0';
          td.style.fontSize = '11px';

          if (type === 'detail' && cIdx === 5) {
            const statusDiv = document.createElement('div');
            statusDiv.style.display = 'flex';
            statusDiv.style.gap = '4px';
            
            if (row.Late) statusDiv.innerHTML += '<span style="background:#ef4444;color:white;padding:2px 4px;border-radius:2px;font-size:9px;font-weight:bold">LATE</span>';
            if (row["Early Leave"] === 1) statusDiv.innerHTML += '<span style="background:#f97316;color:white;padding:2px 4px;border-radius:2px;font-size:9px;font-weight:bold">EARLY</span>';
            if (row["Tidak Lengkap Finger"] === 1) statusDiv.innerHTML += '<span style="background:#64748b;color:white;padding:2px 4px;border-radius:2px;font-size:9px;font-weight:bold">MISSING</span>';
            if (!row.Late && row["Early Leave"] === 0 && row["Tidak Lengkap Finger"] === 0) statusDiv.innerHTML += '<span style="background:#22c55e;color:white;padding:2px 4px;border-radius:2px;font-size:9px;font-weight:bold">OK</span>';
            
            td.appendChild(statusDiv);
          }
          
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);

      exportHiddenRef.current!.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${type.toUpperCase()}_Page_${index + 1}.png`;
      link.href = dataUrl;
      link.click();
    };

    for (let i = 0; i < chunks.length; i++) {
      await capturePage(chunks[i], i);
      await new Promise(r => setTimeout(r, 500));
    }

    setIsExporting(false);
    toast({ title: "Export Complete", description: `Successfully exported ${chunks.length} page(s).` });
  };

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader title="Attendance Summary" />
      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              Recap Attendance Data
            </CardTitle>
            <CardDescription>
              Upload the "Employee Attendance Record" Excel file to generate summaries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileUpload}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isProcessing}
                />
              </div>
              <Button onClick={handleDownloadExcel} disabled={!results} className="shrink-0">
                <Download className="mr-2 h-4 w-4" />
                Download Recap (XLSX)
              </Button>
            </div>
            {isProcessing && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground font-medium">Analyzing records...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {results && (
          <Tabs defaultValue="rekap" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rekap">Weekly Summary</TabsTrigger>
              <TabsTrigger value="detail">Daily Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="rekap">
              <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Summary Records</CardTitle>
                    <CardDescription>Sorted by most Late, then most Early/Incomplete, then Dept/Name.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search name/dept..."
                        className="pl-8 h-9 w-[200px] lg:w-[300px]"
                        value={summaryFilter}
                        onChange={(e) => setSummaryFilter(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownloadPaginatedPNG('summary')}
                      disabled={isExporting}
                    >
                      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                      PNG Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] rounded-md border">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-center">Present</TableHead>
                          <TableHead className="text-center text-destructive">Late</TableHead>
                          <TableHead className="text-center text-orange-600">Early</TableHead>
                          <TableHead className="text-center text-rose-500">Incomplete</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSummary.length > 0 ? filteredSummary.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono">{row["User ID"]}</TableCell>
                            <TableCell className="font-medium">{row.Name}</TableCell>
                            <TableCell>{row.Department}</TableCell>
                            <TableCell className="text-center">{row.Hadir}</TableCell>
                            <TableCell className="text-center font-bold text-destructive">{row.Telat}</TableCell>
                            <TableCell className="text-center font-bold text-orange-600">{row.Awal}</TableCell>
                            <TableCell className="text-center font-bold text-rose-500">{row.Tidak_Lengkap_Finger}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No matching records found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detail">
              <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Detailed Logs</CardTitle>
                    <CardDescription>Daily breakdown organized by Department and Name.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search name/dept..."
                        className="pl-8 h-9 w-[200px] lg:w-[300px]"
                        value={detailFilter}
                        onChange={(e) => setDetailFilter(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownloadPaginatedPNG('detail')}
                      disabled={isExporting}
                    >
                      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                      PNG Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] rounded-md border">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-center">Day</TableHead>
                          <TableHead className="text-center">In</TableHead>
                          <TableHead className="text-center">Out</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">OT (m)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDetails.length > 0 ? filteredDetails.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono">{row["User ID"]}</TableCell>
                            <TableCell>{row.Name}</TableCell>
                            <TableCell className="text-center">{row.Day}</TableCell>
                            <TableCell className="text-center font-mono">{row["Time In"] || '-'}</TableCell>
                            <TableCell className="text-center font-mono">{row["Time Out"] || '-'}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-wrap gap-1 justify-center">
                                {row.Late && <span className="text-[10px] bg-destructive text-destructive-foreground px-1 rounded font-bold">LATE</span>}
                                {row["Early Leave"] === 1 && <span className="text-[10px] bg-orange-500 text-white px-1 rounded font-bold">EARLY</span>}
                                {row["Tidak Lengkap Finger"] === 1 && <span className="text-[10px] bg-gray-500 text-white px-1 rounded font-bold">MISSING</span>}
                                {!row.Late && row["Early Leave"] === 0 && row["Tidak Lengkap Finger"] === 0 && <span className="text-[10px] bg-green-500 text-white px-1 rounded font-bold">OK</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono">{row["Overtime Minutes"]}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No matching records found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
        
        <div 
          ref={exportHiddenRef} 
          style={{ position: 'absolute', left: '-9999px', top: 0 }}
        />
      </main>
    </div>
  );
}
