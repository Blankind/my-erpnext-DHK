'use server';

/**
 * @fileOverview Flow to generate HPP analysis from Landed Cost Vouchers in DHK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { FullReport, ReportData } from '@/lib/types';

const GenerateHppReportInputSchema = z.object({
  settings: z.object({
      DHK: z.object({ url: z.string(), key: z.string(), secret: z.string() }),
  }),
  fromDate: z.string(),
  toDate: z.string(),
});

export type GenerateHppReportInput = z.infer<typeof GenerateHppReportInputSchema>;

export async function generateHppReportFlow(input: GenerateHppReportInput): Promise<FullReport> {
    return generateHppReport(input);
}

const generateHppReport = ai.defineFlow(
    {
        name: 'generateHppReportFlow',
        inputSchema: GenerateHppReportInputSchema,
        outputSchema: z.custom<FullReport>(),
    },
    async ({ settings, fromDate, toDate }) => {
        const fetchFrappe = async (config: any, cmd: string, args: any) => {
            const url = new URL(`${config.url}/api/method/${cmd}`);
            Object.keys(args).forEach(k => url.searchParams.append(k, args[k]));
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `token ${config.key}:${config.secret}` },
                cache: 'no-store'
            });
            if (!res.ok) throw new Error(`Frappe error: ${res.statusText}`);
            const json = await res.json();
            return json.message || json.data;
        };

        const processERP = async (config: any): Promise<ReportData> => {
            const lcvs = await fetchFrappe(config, 'frappe.client.get_list', {
                doctype: 'Landed Cost Voucher',
                filters: JSON.stringify([
                    ['docstatus', '=', 1],
                    ['posting_date', '>=', fromDate],
                    ['posting_date', '<=', toDate]
                ]),
                fields: JSON.stringify(['name', 'posting_date']),
                order_by: 'posting_date asc'
            });

            const itemsMap: Record<string, Record<string, number | null>> = {};
            const datesSet = new Set<string>();

            for (const lcv of lcvs) {
                const doc = await fetchFrappe(config, 'frappe.client.get', { doctype: 'Landed Cost Voucher', name: lcv.name });
                const date = doc.posting_date;
                datesSet.add(date);

                doc.items.forEach((item: any) => {
                    if (!itemsMap[item.item_code]) itemsMap[item.item_code] = {};
                    // Unit HPP = (Basic Rate + (Additional Allocated Cost / Qty))
                    const unitHpp = item.rate + (item.applicable_charges / item.qty);
                    itemsMap[item.item_code][date] = unitHpp;
                });
            }

            const dates = Array.from(datesSet).sort();
            return { dates, items: itemsMap };
        };

        const dhkData = await processERP(settings.DHK);
        return { DHK: dhkData };
    }
);
