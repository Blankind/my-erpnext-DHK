'use server';

/**
 * @fileOverview A flow to enable or disable master data records in DHK bulk.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { setDocumentDisabledStatus } from '@/services/erpnext-service';

const ToggleMasterDataStatusInputSchema = z.object({
  doctype: z.enum(['Item', 'Customer', 'Supplier']),
  action: z.enum(['enable', 'disable']),
  records: z.array(z.object({
      id: z.number(),
      code: z.string(),
  })),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
});
export type ToggleMasterDataStatusInput = z.infer<typeof ToggleMasterDataStatusInputSchema>;


const ResultRecordSchema = z.object({
    id: z.number(),
    code: z.string(),
    statusDHK: z.enum(['Pending', 'Success', 'Failed', 'Skipped', 'Processing']),
    logDHK: z.string().optional(),
});

const ToggleMasterDataStatusOutputSchema = z.object({
  results: z.array(ResultRecordSchema),
});
export type ToggleMasterDataStatusOutput = z.infer<typeof ToggleMasterDataStatusOutputSchema>;


export async function toggleMasterDataStatus(input: ToggleMasterDataStatusInput): Promise<ToggleMasterDataStatusOutput> {
  return toggleMasterDataStatusFlow(input);
}


const toggleMasterDataStatusFlow = ai.defineFlow(
  {
    name: 'toggleMasterDataStatusFlow',
    inputSchema: ToggleMasterDataStatusInputSchema,
    outputSchema: ToggleMasterDataStatusOutputSchema,
  },
  async ({ doctype, action, records, settings }) => {
    const disabledValue = action === 'disable' ? 1 : 0;
    const statusAction = action === 'disable' ? 'Disabling' : 'Enabling';

    let results = records.map(r => ({
        id: r.id,
        code: r.code,
        statusDHK: 'Pending' as const,
        logDHK: '',
    }));

    const updateResult = (id: number, status: 'Success' | 'Failed' | 'Processing', log: string) => {
        const index = results.findIndex(r => r.id === id);
        if (index !== -1) {
            results[index].statusDHK = status;
            results[index].logDHK = log;
        }
    };
    
    for (const record of records) {
        updateResult(record.id, 'Processing', `${statusAction} ${record.code}...`);
        try {
            const log = await setDocumentDisabledStatus(settings.DHK, doctype as any, record.code, disabledValue);
            updateResult(record.id, 'Success', log);
        } catch (error: any) {
            console.error(`Error processing ${record.code} in DHK:`, error);
            updateResult(record.id, 'Failed', error.message || 'An unknown error occurred.');
        }
    }

    return { results };
  }
);
