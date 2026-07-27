'use server';

/**
 * @fileOverview A flow to update item details (name, description, weight) in bulk for DHK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { updateItemDetails as updateErpItemDetails, getItemFields, doesDocExist } from '@/services/erpnext-service';
import type { ItemUpdateRecord, ItemUpdateResultDetail, FieldsToUpdate } from '@/lib/types';

const FieldsToUpdateSchema = z.object({
  item_name: z.boolean(),
  description: z.boolean(),
  weight: z.boolean(),
});

const UpdateItemDetailsInputSchema = z.object({
  records: z.array(z.custom<ItemUpdateRecord>()),
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
  fieldsToUpdate: FieldsToUpdateSchema,
});
export type UpdateItemDetailsInput = z.infer<typeof UpdateItemDetailsInputSchema>;

const UpdateItemDetailsOutputSchema = z.object({
  results: z.array(z.custom<ItemUpdateRecord>()),
});
export type UpdateItemDetailsOutput = z.infer<typeof UpdateItemDetailsOutputSchema>;

export async function updateItemDetails(input: UpdateItemDetailsInput): Promise<UpdateItemDetailsOutput> {
  return updateItemDetailsFlow(input);
}

const updateItemDetailsFlow = ai.defineFlow(
  {
    name: 'updateItemDetailsFlow',
    inputSchema: UpdateItemDetailsInputSchema,
    outputSchema: UpdateItemDetailsOutputSchema,
  },
  async ({ records, settings, fieldsToUpdate }) => {
    
    const processRecord = async (record: ItemUpdateRecord): Promise<ItemUpdateRecord> => {
        const { item_code, item_name, description, weight } = record;
        
        const baseResult: ItemUpdateRecord = { ...record, statusDHK: [] };

        const updateErp = async (): Promise<ItemUpdateResultDetail[]> => {
            try {
                const itemExists = await doesDocExist(settings.DHK, 'Item', item_code);
                if (!itemExists) {
                    return [{ field: 'Item', status: 'Skipped', message: 'Item does not exist.' }];
                }
                
                const report: ItemUpdateResultDetail[] = [];
                const payloadToUpdate: Record<string, any> = {};

                if (fieldsToUpdate.item_name && item_name !== undefined && item_name !== null) {
                    const currentName = (await getItemFields(settings.DHK, item_code, ['item_name']))?.item_name;
                    if (currentName !== item_name) {
                        payloadToUpdate.item_name = item_name;
                        report.push({ field: 'Name', status: 'Updated', message: `Will update to "${item_name}".` });
                    } else {
                        report.push({ field: 'Name', status: 'Unchanged', message: 'Value is already up to date.' });
                    }
                }

                if (fieldsToUpdate.description && description !== undefined && description !== null) {
                    const currentDesc = (await getItemFields(settings.DHK, item_code, ['description']))?.description;
                    if (currentDesc !== description) {
                        payloadToUpdate.description = description;
                        report.push({ field: 'Description', status: 'Updated', message: `Will update description.` });
                    } else {
                        report.push({ field: 'Description', status: 'Unchanged', message: 'Value is already up to date.' });
                    }
                }

                if (fieldsToUpdate.weight && weight !== undefined && weight !== null) {
                     const currentWeight = (await getItemFields(settings.DHK, item_code, ['weight_per_unit']))?.weight_per_unit;
                     if (Number(currentWeight) !== weight) {
                         payloadToUpdate.weight_per_unit = weight;
                          report.push({ field: 'Weight', status: 'Updated', message: `Will update to ${weight} Kg.` });
                     } else {
                         report.push({ field: 'Weight', status: 'Unchanged', message: 'Value is already up to date.' });
                     }
                }
                
                if (Object.keys(payloadToUpdate).length > 0) {
                    await updateErpItemDetails(settings.DHK, item_code, payloadToUpdate);
                    Object.keys(payloadToUpdate).forEach(key => {
                        const fieldMap = {'item_name': 'Name', 'description': 'Description', 'weight_per_unit': 'Weight'};
                        const reportIndex = report.findIndex(r => r.field.toLowerCase() === (fieldMap[key as keyof typeof fieldMap] ||'').toLowerCase());
                        if (reportIndex > -1) report[reportIndex].message = `Successfully updated.`;
                    });
                }

                if (report.length === 0) {
                    return [{ field: 'Item', status: 'Skipped', message: 'No fields were selected or values are unchanged.' }];
                }
                
                return report;

            } catch (error: any) {
                 return [{ field: 'Item', status: 'Failed', message: error.message }];
            }
        };

        baseResult.statusDHK = await updateErp();
        return baseResult;
    };

    const finalResults = await Promise.all(records.map(processRecord));

    return { results: finalResults };
  }
);
