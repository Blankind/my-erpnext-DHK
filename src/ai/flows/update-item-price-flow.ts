'use server';

/**
 * @fileOverview A flow to update item prices in bulk for DHK ERP.
 * It maps specific file headers (99, 88, 89) to specific ERP Price Lists (Grosir, 88, LM 88).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { updateItemPrice as updateErpItemPrice, doesDocExist } from '@/services/erpnext-service';

const PRICE_LIST_MAP: Record<string, string> = {
  "99": "Grosir",
  "88": "88",
  "89": "LM 88"
};

const PriceUpdateRecordSchema = z.object({
  item_code: z.string(),
  "99": z.number().optional(),
  "88": z.number().optional(),
  "89": z.number().optional(),
});

const UpdateItemPriceInputSchema = z.object({
  records: z.array(PriceUpdateRecordSchema),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
});
export type UpdateItemPriceInput = z.infer<typeof UpdateItemPriceInputSchema>;

const StatusEnum = z.enum(['Pending', 'Success', 'Failed', 'Skipped', 'Processing', 'Unchanged', 'Updated', 'Created']);

const ResultRecordSchema = z.object({
    id: z.number(),
    item_code: z.string(),
    "Grosir": z.number().optional(),
    "88": z.number().optional(),
    "LM 88": z.number().optional(),
    statusDHK: StatusEnum,
    logDHK: z.string().optional(),
});

const UpdateItemPriceOutputSchema = z.object({
  results: z.array(ResultRecordSchema),
});
export type UpdateItemPriceOutput = z.infer<typeof UpdateItemPriceOutputSchema>;


export async function updateItemPrice(input: UpdateItemPriceInput): Promise<UpdateItemPriceOutput> {
  return updateItemPriceFlow(input);
}


const updateItemPriceFlow = ai.defineFlow(
  {
    name: 'updateItemPriceFlow',
    inputSchema: UpdateItemPriceInputSchema,
    outputSchema: UpdateItemPriceOutputSchema,
  },
  async ({ records, settings }) => {
    
    const processRecord = async (record: z.infer<typeof PriceUpdateRecordSchema>, index: number): Promise<z.infer<typeof ResultRecordSchema>> => {
        
        const dhkExists = await doesDocExist(settings.DHK, 'Item', record.item_code);
        const fileHeaders = Object.keys(PRICE_LIST_MAP);

        const processDHK = async () => {
            const resultsDHK: string[] = [];
            let overallDHKStatus: 'Success' | 'Failed' | 'Unchanged' = 'Unchanged';

            try {
                if (!dhkExists) return { status: 'Skipped' as const, log: 'Item does not exist.' };

                for (const header of fileHeaders) {
                    const priceListName = PRICE_LIST_MAP[header];
                    const newPrice = (record as any)[header];
                    
                    if (typeof newPrice !== 'number' || !priceListName) continue;

                    try {
                        const dhkResult = await updateErpItemPrice(settings.DHK, record.item_code, priceListName, newPrice, null);
                        resultsDHK.push(`${priceListName}: ${dhkResult.status}`);
                        if (dhkResult.status !== 'Unchanged') overallDHKStatus = 'Success';
                    } catch (e: any) {
                        resultsDHK.push(`${priceListName}: Failed (${e.message})`);
                        overallDHKStatus = 'Failed';
                    }
                }
                
                const finalDHKStatus = resultsDHK.length > 0 ? overallDHKStatus : 'Unchanged';
                const finalDHKLog = resultsDHK.join(' | ') || 'No prices to update.';

                return { status: finalDHKStatus, log: finalDHKLog };
            
            } catch (error: any) {
                return { status: 'Failed' as const, log: error.message };
            }
        };

        const dhk = await processDHK();

        return {
            id: index,
            item_code: record.item_code,
            "Grosir": record["99"],
            "88": record["88"],
            "LM 88": record["89"],
            statusDHK: dhk.status,
            logDHK: dhk.log,
        };
    };

    const finalResults = await Promise.all(records.map(processRecord));

    return { results: finalResults };
  }
);
