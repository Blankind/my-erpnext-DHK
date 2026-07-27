'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { StockRecord } from '@/lib/types';

interface ReconciliationLogDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  logData: StockRecord[];
}

export function ReconciliationLogDialog({ isOpen, onOpenChange, logData }: ReconciliationLogDialogProps) {
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reconciliation Logs</DialogTitle>
          <DialogDescription>
            Detailed logs for each reconciled item.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 pr-4">
          {logData.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {logData.map((record) => (
                <AccordionItem value={`item-${record.id}`} key={record.id}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-mono text-sm">{record.item_code}</span>
                      <Badge variant={getStatusVariant(record.reconciliationStatus)}>
                        {record.reconciliationStatus}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                      <p className="whitespace-pre-wrap">{record.reconciliationLog}</p>
                       {record.reconciliationDoc && (
                         <p className="mt-2 font-medium">
                           Document ID: <span className="font-mono">{record.reconciliationDoc}</span>
                         </p>
                       )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
             <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No logs to display yet. Run a reconciliation process.</p>
             </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
