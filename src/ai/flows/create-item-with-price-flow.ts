'use server';

/**
 * @fileOverview A flow to create a new item with its prices in DHK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { createItem, createItemPrice } from '@/services/erpnext-service';
import type { CreateItemResult, ItemPayload } from '@/lib/types';


const PriceSchema = z.object({
  price_list: z.string(),
  rate: z.number(),
});

const CreateItemInputSchema = z.object({
  item: z.object({
    item_code: z.string(),
    item_name: z.string(),
    item_group: z.string(),
    stock_uom: z.string(),
    description: z.string().optional(),
    weight_per_unit: z.number().optional(),
    is_sales_item: z.boolean().optional(),
    prices: z.array(PriceSchema).optional(),
  }),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
});

export type CreateItemWithPriceInput = z.infer<typeof CreateItemInputSchema>;
export type CreateItemWithPriceOutput = CreateItemResult;


export async function createItemWithPrice(input: CreateItemWithPriceInput): Promise<CreateItemWithPriceOutput> {
  return createItemWithPriceFlow(input);
}


const createItemWithPriceFlow = ai.defineFlow(
  {
    name: 'createItemWithPriceFlow',
    inputSchema: CreateItemInputSchema,
    outputSchema: z.custom<CreateItemWithPriceOutput>(),
  },
  async ({ item, settings }) => {
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
        result.itemDHK = { success: true, message: `Item ${item.item_code} created successfully.` };
    } catch(e: any) {
        result.itemDHK = { success: false, message: e.message || 'Failed to create item in DHK.' };
        return result;
    }

    if (item.prices && item.prices.length > 0) {
        for (const price of item.prices) {
            try {
                await createItemPrice(settings.DHK, item.item_code, price.price_list, price.rate);
                result.pricesDHK.push({ price_list: price.price_list, success: true, message: `Price created.` });
            } catch (e: any) {
                result.pricesDHK.push({ price_list: price.price_list, success: false, message: e.message || `Failed to create price.` });
            }
        }
    }

    return result;
  }
);
