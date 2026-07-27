'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { StockRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, CheckCircle, HelpCircle, FileClock, CircleDashed } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StockDataTableProps {
  data: StockRecord[];
  onRowUpdate: (id: number, field: keyof StockRecord, value: any) => void;
}

const ReconciliationStatusIcon = ({ record }: { record: StockRecord }) => {
  const { reconciliationStatus, reconciliationLog, reconciliationDoc } = record;

  let Icon = HelpCircle;
  let color = 'text-muted-foreground';
  let title = 'Pending';
  let log = reconciliationLog || 'This item is pending reconciliation.';

  switch (reconciliationStatus) {
    case 'Processing':
      Icon = Loader2;
      color = 'text-blue-500 animate-spin';
      title = 'Processing...';
      log = 'Reconciliation is in progress.';
      break;
    case 'Success':
      Icon = CheckCircle;
      color = 'text-green-500';
      title = `Success: ${reconciliationDoc}`;
      log = reconciliationLog || 'Reconciliation successful.';
      break;
    case 'Failed':
      Icon = AlertCircle;
      color = 'text-destructive';
      title = 'Failed';
      log = reconciliationLog || 'Reconciliation failed.';
      break;
    case 'Pending':
      if (record.isDiscrepant) {
        Icon = FileClock;
        color = 'text-orange-500';
        title = 'Ready to Reconcile';
        log = 'This discrepant item is ready for reconciliation.';
      } else {
        Icon = CircleDashed;
        color = 'text-muted-foreground';
        title = 'Not Required';
        log = 'No discrepancy found.';
      }
      break;
    case 'Skipped':
        Icon = CircleDashed;
        color = 'text-muted-foreground';
        title = 'Skipped';
        log = reconciliationLog || 'This item was skipped.';
        break;
  }
  
  return (
    <Tooltip>
      <TooltipTrigger>
        <Icon className={cn('h-5 w-5', color)} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log}</p>
      </TooltipContent>
    </Tooltip>
  );
};


export function StockDataTable({ data, onRowUpdate }: StockDataTableProps) {

  const totalDiscrepancy = data.reduce((acc, row) => acc + (row.discrepancyAmount || 0), 0);
  const itemsToReconcile = data.filter(row => row.isDiscrepant).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Review and Adjust</CardTitle>
        <CardDescription>
          Review the validated data. There are currently <span className="font-bold text-primary">{itemsToReconcile} items</span> with a total discrepancy of <span className="font-bold text-primary">{totalDiscrepancy}</span> to be reconciled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Physical</TableHead>
                  <TableHead className="text-right">Stock DHK</TableHead>
                  <TableHead className="text-right">Discrepancy</TableHead>
                  <TableHead className="w-[200px]">Log</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id} className={cn(row.isDiscrepant && 'bg-accent/20 hover:bg-accent/30')}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger>
                            {row.isValidating ? (
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : row.isDiscrepant ? (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{row.explanation || (row.isDiscrepant ? "Discrepancy found" : "No discrepancy")}</p>
                          </TooltipContent>
                        </Tooltip>
                         <ReconciliationStatusIcon record={row} />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium font-mono text-sm">{row.item_code}</TableCell>
                    <TableCell>{row.item_name}</TableCell>
                    <TableCell>{row.Warehouse}</TableCell>
                    <TableCell className="text-right">
                       <Input
                          type="number"
                          value={row.Fisik}
                          onChange={(e) => onRowUpdate(row.id, 'Fisik', e.target.value)}
                          className="min-w-[80px] text-right h-8"
                        />
                    </TableCell>
                    <TableCell className="text-right">
                       <Input
                          type="number"
                          value={row.stock_DHK}
                          onChange={(e) => onRowUpdate(row.id, 'stock_DHK', e.target.value)}
                          className="min-w-[80px] text-right h-8"
                        />
                    </TableCell>
                    <TableCell className="text-right">
                       {row.discrepancyAmount !== undefined && (
                        <Badge variant={row.discrepancyAmount === 0 ? 'secondary' : 'destructive'}>
                          {row.discrepancyAmount}
                        </Badge>
                       )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.reconciliationLog}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
