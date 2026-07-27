'use server';

/**
 * @fileOverview A flow to create multiple new items with their prices in DHK from a batch file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { createItem, createItemPrice } from '@/services/erpnext-service';
import type { CreateItemResult, ItemPayload, BatchCreateItemResult } from '@/lib/types';

const PriceSchema = z.object({
  price_list: z.string(),
  rate: z.number(),
});

const ItemSchema = z.object({
    item_code: z.string(),
    item_name: z.string(),
    item_group: z.string(),
    stock_uom: z.string(),
    description: z.string().optional(),
    weight_per_unit: z.number().optional(),
    is_sales_item: z.boolean().optional(),
    prices: z.array(PriceSchema).optional(),
});


const CreateItemsBatchInputSchema = z.object({
  items: z.array(ItemSchema),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
});

export type CreateItemsInBatchInput = z.infer<typeof CreateItemsBatchInputSchema>;
export type CreateItemsInBatchOutput = {
    results: BatchCreateItemResult[]
};

export async function createItemsInBatch(input: CreateItemsInBatchInput): Promise<CreateItemsInBatchOutput> {
  return createItemsInBatchFlow(input);
}


const createItemsInBatchFlow = ai.defineFlow(
  {
    name: 'createItemsInBatchFlow',
    inputSchema: CreateItemsBatchInputSchema,
    outputSchema: z.custom<CreateItemsInBatchOutput>(),
  },
  async ({ items, settings }) => {
    
    const processSingleItem = async (item: z.infer<typeof ItemSchema>): Promise<BatchCreateItemResult> => {
        let result: CreateItemResult = {
            itemDHK: { success: false, message: 'Pending' },
            pricesDHK: [],
        };
        
        const itemPayload: ItemPayload = {
            item_code: item.item_code,
            item_name: item.item_name,
            item_group: item.item_group,
            stock_uom: item.stock_uom,
            description: item.description,
            weight_per_unit: item.weight_per_unit,
            is_sales_item: item.is_sales_item,
            targetErp: 'DHK',
        };

        try {
            await createItem(settings.DHK, itemPayload);
            result.itemDHK = { success: true, message: `Item created.` };
        } catch(e: any) {
            result.itemDHK = { success: false, message: e.message || 'Failed.' };
            return { item_code: item.item_code, ...result };
        }

        if (item.prices) {
            for (const price of item.prices) {
                try {
                    await createItemPrice(settings.DHK, item.item_code, price.price_list, price.rate);
                    result.pricesDHK.push({ price_list: price.price_list, success: true, message: `Success` });
                } catch (e: any) {
                    result.pricesDHK.push({ price_list: price.price_list, success: false, message: `Failed` });
                }
            }
        }

        return { item_code: item.item_code, ...result };
    };

    const results = await Promise.all(items.map(item => processSingleItem(item)));
    return { results };
  }
);
