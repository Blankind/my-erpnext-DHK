'use server';
/**
 * @fileOverview Validates stock discrepancies for DHK.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateStockDiscrepanciesInputSchema = z.object({
  item_code: z.string(),
  item_name: z.string(),
  tanggal: z.string(),
  jam: z.string(),
  Warehouse: z.string(),
  Fisik: z.number(),
  stock_DHK: z.number(),
});
export type ValidateStockDiscrepanciesInput = z.infer<typeof ValidateStockDiscrepanciesInputSchema>;

const ValidateStockDiscrepanciesOutputSchema = z.object({
  isDiscrepant: z.boolean(),
  discrepancyAmount: z.number(),
  explanation: z.string().optional(),
});
export type ValidateStockDiscrepanciesOutput = z.infer<typeof ValidateStockDiscrepanciesOutputSchema>;

export async function validateStockDiscrepancies(input: ValidateStockDiscrepanciesInput): Promise<ValidateStockDiscrepanciesOutput> {
  return validateStockDiscrepanciesFlow(input);
}


const validateStockDiscrepanciesFlow = ai.defineFlow(
  {
    name: 'validateStockDiscrepanciesFlow',
    inputSchema: ValidateStockDiscrepanciesInputSchema,
    outputSchema: ValidateStockDiscrepanciesOutputSchema,
  },
  async (input) => {
    const { Fisik, stock_DHK } = input;
    const discrepancyAmount = Fisik - stock_DHK;
    const isDiscrepant = discrepancyAmount !== 0;

    let explanation = isDiscrepant 
      ? `Physical count is ${Fisik}, but DHK stock is ${stock_DHK}, discrepancy: ${discrepancyAmount}.`
      : 'Physical count matches DHK stock.';

    return { isDiscrepant, discrepancyAmount, explanation };
  }
);
