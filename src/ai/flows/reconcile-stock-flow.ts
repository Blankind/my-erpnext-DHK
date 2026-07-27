'use server';

/**
 * @fileOverview A flow to handle the stock reconciliation logic for DHK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { createStockReconciliation, doesDocExist } from '@/services/erpnext-service';
import type { Settings } from '@/lib/types';

const ReconciliationItemSchema = z.object({
  item_code: z.string(),
  item_name: z.string(),
  Fisik: z.number(),
  stock_DHK: z.number(),
  discrepancyAmount: z.number(),
  id: z.number(),
});

const ReconcileStockInputSchema = z.object({
  warehouse: z.string().describe('The warehouse for the reconciliation.'),
  reconciliationDate: z.string().describe('The date for the reconciliation (YYYY-MM-DD).'),
  reconciliationTime: z.string().describe('The time for the reconciliation (HH:mm:ss).'),
  items: z.array(ReconciliationItemSchema).describe('The list of items to reconcile.'),
  settings: z.object({
      DHK: z.object({
          url: z.string(),
          key: z.string(),
          secret: z.string(),
      }),
  }).describe('ERP connection settings.'),
});
export type ReconcileStockInput = z.infer<typeof ReconcileStockInputSchema>;

const ItemResultSchema = z.object({
  id: z.number(),
  status: z.enum(['Success', 'Failed', 'Skipped', 'Processing']),
  log: z.string(),
  documentId: z.string().optional(),
});
export type ItemResult = z.infer<typeof ItemResultSchema>;

const ReconcileStockOutputSchema = z.object({
  results: z.array(ItemResultSchema),
});
export type ReconcileStockOutput = z.infer<typeof ReconcileStockOutputSchema>;

const WAREHOUSE_MAP: Record<string, { DHK: string }> = {
    "KOMBES":   { DHK: "KOMBES - PD" },
    "LINGTIM":  { DHK: "LINGTIM - PD" },
    "LAMONGAN": { DHK: "LAMONGAN - PD" },
    "BANGIL":   { DHK: "BANGIL - PD" },
    "KREMBUNG": { DHK: "KREMBUNG - PD" },
};

function getMappedWarehouse(originalWarehouse: string, erp: 'DHK'): string {
    return WAREHOUSE_MAP[originalWarehouse]?.[erp] || originalWarehouse;
}

export async function reconcileStock(input: ReconcileStockInput): Promise<ReconcileStockOutput> {
  return reconcileStockFlow(input);
}

const reconcileStockFlow = ai.defineFlow(
  {
    name: 'reconcileStockFlow',
    inputSchema: ReconcileStockInputSchema,
    outputSchema: ReconcileStockOutputSchema,
  },
  async (input) => {
    const { warehouse, reconciliationDate, reconciliationTime, items, settings } = input;
    
    const results: ItemResult[] = items.map(item => ({
        id: item.id,
        status: item.discrepancyAmount !== 0 ? 'Processing' : 'Skipped',
        log: item.discrepancyAmount !== 0 ? `Starting reconciliation.` : 'No discrepancy.',
    }));

    const updateItemResult = (id: number, status: ItemResult['status'], log: string, documentId?: string) => {
        const index = results.findIndex(r => r.id === id);
        if (index !== -1) {
             results[index] = { ...results[index], id, status, log, documentId };
        }
    };
    
    const itemsToProcess = items.filter(item => item.discrepancyAmount !== 0);
    
    if (itemsToProcess.length > 0) {
        try {
            const mappedWarehouse = getMappedWarehouse(warehouse, 'DHK');
            const docId = await createStockReconciliation(settings.DHK, {
                warehouse: mappedWarehouse,
                reconciliationDate,
                reconciliationTime,
                items: itemsToProcess.map(({item_code, item_name, Fisik}) => ({item_code, item_name, qty: Math.max(0, Fisik)})),
            });
            const successLog = `Success reco: ${docId}`;
            itemsToProcess.forEach(item => updateItemResult(item.id, 'Success', successLog, docId));
        } catch (error: any) {
            const errorMessage = `DHK Reco Error: ${error.message}`;
            itemsToProcess.forEach(item => updateItemResult(item.id, 'Failed', errorMessage));
        }
    }

    return { results };
  }
);
