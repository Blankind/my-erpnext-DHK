'use server';

/**
 * @fileOverview A flow to test the connection to an ERPNext instance.
 *
 * - testErpConnection - The main function to trigger the connection test.
 * - TestErpConnectionInput - Input schema for the flow.
 * - TestErpConnectionOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ERPConfig } from '@/lib/types';
import { getAppVersion } from '@/services/erpnext-service';

const TestErpConnectionInputSchema = z.object({
  config: z.object({
    url: z.string(),
    key: z.string(),
    secret: z.string(),
  }),
});
export type TestErpConnectionInput = z.infer<
  typeof TestErpConnectionInputSchema
>;

const TestErpConnectionOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  version: z.string().optional(),
});
export type TestErpConnectionOutput = z.infer<
  typeof TestErpConnectionOutputSchema
>;

export async function testErpConnection(
  input: TestErpConnectionInput
): Promise<TestErpConnectionOutput> {
  return testErpConnectionFlow(input);
}

const testErpConnectionFlow = ai.defineFlow(
  {
    name: 'testErpConnectionFlow',
    inputSchema: TestErpConnectionInputSchema,
    outputSchema: TestErpConnectionOutputSchema,
  },
  async ({ config }) => {
    try {
      const versionInfo = await getAppVersion(config);
      if (versionInfo) {
        return {
          success: true,
          message: 'Connection successful!',
          version: versionInfo,
        };
      } else {
        return {
          success: false,
          message: 'Could not retrieve user info. Check credentials.',
        };
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }
);
