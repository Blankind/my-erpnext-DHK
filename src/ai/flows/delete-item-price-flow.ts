'use server';

/**
 * @fileOverview A flow to delete Item Price documents in bulk for DHK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { deleteDocument } from '@/services/erpnext-service';

const DeleteItemPriceInputSchema = z.object({
  records: z.array(z.object({
      id: z.number(),
      code: z.string().describe('The document ID (name) of the Item Price record.'),
  })),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
});
export type DeleteItemPriceInput = z.infer<typeof DeleteItemPriceInputSchema>;

const ResultRecordSchema = z.object({
    id: z.number(),
    code: z.string(),
    statusDHK: z.enum(['Pending', 'Success', 'Failed', 'Skipped', 'Processing']),
    logDHK: z.string().optional(),
});

const DeleteItemPriceOutputSchema = z.object({
  results: z.array(ResultRecordSchema),
});
export type DeleteItemPriceOutput = z.infer<typeof DeleteItemPriceOutputSchema>;

export async function deleteItemPrices(input: DeleteItemPriceInput): Promise<DeleteItemPriceOutput> {
  return deleteItemPriceFlow(input);
}

const deleteItemPriceFlow = ai.defineFlow(
  {
    name: 'deleteItemPriceFlow',
    inputSchema: DeleteItemPriceInputSchema,
    outputSchema: DeleteItemPriceOutputSchema,
  },
  async ({ records, settings }) => {
    let results = records.map(r => ({
        id: r.id,
        code: r.code,
        statusDHK: 'Pending' as const,
        logDHK: '',
    }));

    const updateResult = (id: number, status: any, log: string) => {
        const index = results.findIndex(r => r.id === id);
        if (index !== -1) {
            results[index].statusDHK = status;
            results[index].logDHK = log;
        }
    };
    
    for (const record of records) {
        updateResult(record.id, 'Processing', `Deleting ${record.code}...`);
        try {
            const log = await deleteDocument(settings.DHK, 'Item Price', record.code);
            updateResult(record.id, 'Success', log);
        } catch (error: any) {
            console.error(`Error deleting ${record.code} in DHK:`, error);
            updateResult(record.id, 'Failed', error.message || 'An unknown error occurred.');
        }
    }

    return { results };
  }
);
