import { config } from 'dotenv';
config();

import '@/ai/flows/test-erp-connection.ts';
import '@/ai/flows/toggle-master-data-status.ts';
import '@/ai/flows/update-item-price-flow.ts';
import '@/ai/flows/update-item-details-flow.ts';
import '@/ai/flows/create-item-with-price-flow.ts';
import '@/ai/flows/create-items-in-batch-flow.ts';
import '@/ai/flows/validate-stock-discrepancies.ts';
import '@/ai/flows/reconcile-stock-flow.ts';
import '@/ai/flows/check-stock-flow.ts';
import '@/ai/flows/get-real-time-stock.ts';
import '@/ai/flows/delete-item-price-flow.ts';
import '@/ai/flows/attendance-summary-flow.ts';
import '@/ai/flows/generate-hpp-report-flow.ts';
