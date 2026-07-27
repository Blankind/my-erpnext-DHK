'use server';
/**
 * @fileOverview Flow to fetch real-time stock and price information for DHK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getStockFromBin, getFilteredItemPrices, findItemsByName, getItemFields } from '@/services/erpnext-service';

const GetRealTimeStockInputSchema = z.object({
  query: z.string().describe('The item code or item name to search for.'),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
});
export type GetRealTimeStockInput = z.infer<typeof GetRealTimeStockInputSchema>;

const StockDataSchema = z.object({
    source: z.string(),
    warehouse: z.string(),
    actual_qty: z.number(),
});
const PriceDataSchema = z.object({
    source: z.string(),
    price_list: z.string(),
    price_list_rate: z.number(),
});

const GetRealTimeStockOutputSchema = z.object({
    item_code: z.string(),
    item_name: z.string(),
    stock_data: z.array(StockDataSchema),
    price_data: z.array(PriceDataSchema),
    message: z.string().optional(),
});
export type GetRealTimeStockOutput = z.infer<typeof GetRealTimeStockOutputSchema>;

export async function getRealTimeStock(input: GetRealTimeStockInput): Promise<GetRealTimeStockOutput> {
    return getRealTimeStockFlow(input);
}

const getRealTimeStockFlow = ai.defineFlow(
    {
        name: 'getRealTimeStockFlow',
        inputSchema: GetRealTimeStockInputSchema,
        outputSchema: GetRealTimeStockOutputSchema,
    },
    async ({ query, settings }) => {
        let item_code = '';
        let item_name = '';

        const searchResultsDHK = await findItemsByName(settings.DHK, query);
        if (searchResultsDHK.length > 0) {
            item_code = searchResultsDHK[0].item_code;
            item_name = searchResultsDHK[0].item_name;
        } else {
            const itemNameResult = await getItemFields(settings.DHK, query, ['item_name']);
            if (itemNameResult && itemNameResult.item_name) {
                item_code = query;
                item_name = itemNameResult.item_name;
            }
        }
        
        if (!item_code) {
             return { item_code: '', item_name: '', stock_data: [], price_data: [], message: `Item "${query}" not found.` };
        }

        const [dhkStock, dhkPrices] = await Promise.all([
            getStockFromBin(settings.DHK, item_code),
            getFilteredItemPrices(settings.DHK, item_code),
        ]);
        
        const stock_data = dhkStock.map(s => ({ ...s, source: 'DHK' }));
        const price_data = dhkPrices.map(p => ({ ...p, source: 'DHK' }));

        return {
            item_code,
            item_name,
            stock_data,
            price_data,
        };
    }
);

const SearchItemsInputSchema = z.object({
  query: z.string(),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
});
export type SearchItemsInput = z.infer<typeof SearchItemsInputSchema>;

export async function searchItems(input: SearchItemsInput): Promise<{ results: { label: string; value: string }[] }> {
    return searchItemsFlow(input);
}

const searchItemsFlow = ai.defineFlow(
    {
        name: 'searchItemsFlow',
        inputSchema: SearchItemsInputSchema,
        outputSchema: z.object({ results: z.array(z.object({ label: z.string(), value: z.string() })) }),
    },
    async ({ query, settings }) => {
        if (!query) return { results: [] };
        const items = await findItemsByName(settings.DHK, query);
        return { results: items.map(i => ({ label: `${i.item_name} (${i.item_code})`, value: i.item_name })) };
    }
);
