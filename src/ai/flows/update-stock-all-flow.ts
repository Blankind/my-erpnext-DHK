
'use server';

/**
 * @fileOverview A flow to consolidate stock data from multiple reference files.
 * Replicates the logic of the Python consolidation script.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const UpdateStockAllInputSchema = z.object({
  balanceData: z.array(z.any()).describe('Data from Stock_Balance files'),
  indenData: z.array(z.any()).describe('Data from MR_ALL_INDEN files'),
  masterData: z.array(z.any()).describe('Data from Item_Master file'),
  h1Data: z.array(z.any()).describe('Data from H-_Blank files'),
  priceData: z.array(z.any()).describe('Data from Item_Price files'),
});

export type UpdateStockAllInput = z.infer<typeof UpdateStockAllInputSchema>;

const UpdateStockAllOutputSchema = z.object({
  excelBase64: z.string().describe('The generated consolidated Excel file as base64.'),
  fileName: z.string().describe('The suggested file name.'),
});

export type UpdateStockAllOutput = z.infer<typeof UpdateStockAllOutputSchema>;

export async function updateStockAll(input: UpdateStockAllInput): Promise<UpdateStockAllOutput> {
  return updateStockAllFlow(input);
}

const updateStockAllFlow = ai.defineFlow(
  {
    name: 'updateStockAllFlow',
    inputSchema: UpdateStockAllInputSchema,
    outputSchema: UpdateStockAllOutputSchema,
  },
  async (input) => {
    const { balanceData, indenData, masterData, h1Data, priceData } = input;

    // 1. Process Balance Data
    // Group by [Item, Warehouse] and sum Balance Qty
    const balanceMap = new Map<string, { item: string, itemName: string, warehouse: string, balanceQty: number }>();
    balanceData.forEach(row => {
      const item = String(row.Item || '');
      const warehouse = String(row.Warehouse || '').toUpperCase().trim();
      const key = `${item}|${warehouse}`;
      const qty = Number(row['Balance Qty'] || 0);
      
      if (balanceMap.has(key)) {
        balanceMap.get(key)!.balanceQty += qty;
      } else {
        balanceMap.set(key, { item, itemName: String(row['Item Name'] || ''), warehouse, balanceQty: qty });
      }
    });

    // 2. Process Inden Data
    const indenMap = new Map<string, number>();
    indenData.forEach(row => {
      // Python filter: docstatus == 1, qty > 0, target_warehouse notna
      if (row.docstatus === 1 && Number(row.quantity) > 0 && row.target_warehouse) {
        const item = String(row.item_code || '');
        const warehouse = String(row.target_warehouse || '').toUpperCase().trim();
        const key = `${item}|${warehouse}`;
        indenMap.set(key, (indenMap.get(key) || 0) + Number(row.quantity || 0));
      }
    });

    // 3. Process H1 Data
    const h1Map = new Map<string, number>();
    h1Data.forEach(row => {
      const item = String(row.item_code || '');
      const warehouse = String(row.warehouse || '').toUpperCase().trim();
      const key = `${item}|${warehouse}`;
      h1Map.set(key, (h1Map.get(key) || 0) + Number(row.quantity || 0));
    });

    // 4. Merge Keys
    const allKeys = new Set([...balanceMap.keys(), ...indenMap.keys(), ...h1Map.keys()]);
    const mergedRows: any[] = [];
    allKeys.forEach(key => {
      const [item, warehouse] = key.split('|');
      const b = balanceMap.get(key);
      const cabang = warehouse.split(' - ')[0].trim().toUpperCase();
      
      mergedRows.push({
        Item: item,
        Warehouse: warehouse,
        Cabang: cabang,
        'Item Name': b?.itemName || '',
        'Balance Qty': b?.balanceQty || 0,
        'Inden Qty': indenMap.get(key) || 0,
        'H1 Qty': h1Map.get(key) || 0,
      });
    });

    // 5. Pivot
    // Group by Item, then for each branch (Cabang) get Balance, Inden, H1
    const branches = ['KREMBUNG', 'LINGTIM', 'LAMONGAN', 'BANGIL', 'KOMBES', 'TRANSIT', 'EXPAND'];
    const pivotMap = new Map<string, any>();
    
    mergedRows.forEach(row => {
      if (!pivotMap.has(row.Item)) {
        pivotMap.set(row.Item, { Item: row.Item, 'total dhk': 0 });
      }
      const p = pivotMap.get(row.Item);
      const c = row.Cabang.toLowerCase();
      
      p[`${c} dhk`] = (p[`${c} dhk`] || 0) + row['Balance Qty'];
      p[`${c} inden dhk`] = (p[`${c} inden dhk`] || 0) + row['Inden Qty'];
      p[`${c} h1`] = (p[`${c} h1`] || 0) + row['H1 Qty'];
      
      // Accumulate total DHK (excluding inden)
      if (!c.includes('inden')) {
        p['total dhk'] += row['Balance Qty'];
      }
    });

    // 6. Process Price Data
    const priceMap = new Map<string, { 'HJ G': number, 'HJ T': number, 'HJ LM': number }>();
    priceData.forEach(row => {
      const pl = String(row['Price List'] || row['price_list'] || '').toLowerCase();
      const item = String(row['Item Code'] || row['item_code'] || '');
      const rate = Number(row.rate || 0);
      
      if (!priceMap.has(item)) {
        priceMap.set(item, { 'HJ G': 0, 'HJ T': 0, 'HJ LM': 0 });
      }
      const p = priceMap.get(item)!;
      if (pl === 'grosir') p['HJ G'] = rate;
      else if (pl === '88') p['HJ T'] = rate;
      else if (pl === 'lm 88') p['HJ LM'] = rate;
    });

    // 7. Final Join with Master
    const finalData = masterData.map(m => {
      const item = String(m.item || m.Item || '');
      const p = pivotMap.get(item) || {};
      const prices = priceMap.get(item) || { 'HJ G': 0, 'HJ T': 0, 'HJ LM': 0 };
      
      return {
        Item: item,
        'Item Name': m.item_name || m['Item Name'] || '',
        berat: m.berat || 0,
        jenis: m.jenis || '',
        'HJ G': prices['HJ G'],
        'HJ T': prices['HJ T'],
        'HJ LM': prices['HJ LM'],
        'krembung dhk': p['krembung dhk'] || 0,
        'krembung inden dhk': p['krembung inden dhk'] || 0,
        'krembung h1': p['krembung h1'] || 0,
        'lingtim dhk': p['lingtim dhk'] || 0,
        'lingtim inden dhk': p['lingtim inden dhk'] || 0,
        'lingtim h1': p['lingtim h1'] || 0,
        'lamongan dhk': p['lamongan dhk'] || 0,
        'lamongan inden dhk': p['lamongan inden dhk'] || 0,
        'lamongan h1': p['lamongan h1'] || 0,
        'bangil dhk': p['bangil dhk'] || 0,
        'bangil inden dhk': p['bangil inden dhk'] || 0,
        'bangil h1': p['bangil h1'] || 0,
        'kombes dhk': p['kombes dhk'] || 0,
        'kombes inden dhk': p['kombes inden dhk'] || 0,
        'kombes h1': p['kombes h1'] || 0,
        'transit dhk': p['transit dhk'] || 0,
        'expand dhk': p['expand dhk'] || 0,
        'total dhk': p['total dhk'] || 0,
      };
    });

    // 8. Generate Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(finalData);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toLocaleDateString('id-ID').replace(/\//g, '-');

    return {
      excelBase64: excelBuffer,
      fileName: `Stock all cabang ${dateStr}.xlsx`,
    };
  }
);
