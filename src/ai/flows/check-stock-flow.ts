'use server';

/**
 * @fileOverview A flow to check stock levels for a list of items from a file.
 *
 * - checkStock - The main function to trigger the stock checking process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getLatestStockQty } from '@/services/erpnext-service';
import type { Settings, CheckStockRecord } from '@/lib/types';

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


const CheckStockRecordSchema = z.object({
    id: z.number(),
    item_code: z.string(),
    Warehouse: z.string(),
    tanggal: z.string(),
    jam: z.string(),
    status: z.enum(['Pending', 'Processing', 'Success', 'Failed']),
    stock_DHK: z.number().optional(),
    log: z.string().optional(),
});

const CheckStockInputSchema = z.object({
  records: z.array(CheckStockRecordSchema),
  settings: z.custom<Settings>(),
});

export type CheckStockInput = z.infer<typeof CheckStockInputSchema>;

const CheckStockOutputSchema = z.object({
  results: z.array(CheckStockRecordSchema),
});
export type CheckStockOutput = z.infer<typeof CheckStockOutputSchema>;

export async function checkStock(input: CheckStockInput): Promise<CheckStockOutput> {
  return checkStockFlow(input);
}

const checkStockFlow = ai.defineFlow(
  {
    name: 'checkStockFlow',
    inputSchema: CheckStockInputSchema,
    outputSchema: CheckStockOutputSchema,
  },
  async ({ records, settings }) => {
    
    const processRecord = async (record: CheckStockRecord): Promise<CheckStockRecord> => {
        try {
            const warehouseDHK = getMappedWarehouse(record.Warehouse, 'DHK');
            
            const stockDHK = await getLatestStockQty(settings.DHK, record.item_code, warehouseDHK);

            return {
                ...record,
                stock_DHK: stockDHK,
                status: 'Success',
                log: 'Successfully fetched stock level.'
            };

        } catch (error: any) {
            console.error(`Error processing stock for ${record.item_code}:`, error);
            return {
                ...record,
                status: 'Failed',
                log: error.message || 'An unknown error occurred.',
            };
        }
    };

    const results = await Promise.all(records.map(processRecord));

    return { results };
  }
);
