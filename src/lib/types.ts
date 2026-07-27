export interface StockRecord {
  id: number;
  item_code: string;
  item_name: string;
  tanggal: string;
  jam: string;
  Warehouse: string;
  Fisik: number;
  stock_DHK: number;
  isDiscrepant?: boolean;
  discrepancyAmount?: number;
  explanation?: string;
  isValidating?: boolean;
  reconciliationStatus?: 'Pending' | 'Success' | 'Failed' | 'Processing' | 'Skipped';
  reconciliationDoc?: string;
  reconciliationLog?: string;
  valuation_rate?: number;
}

export type RawStockRecord = Omit<StockRecord, "id" | "isDiscrepant" | "discrepancyAmount" | "explanation" | "isValidating" | "reconciliationStatus" | "reconciliationDoc" | "reconciliationLog" > & { valuation_rate?: number };

export interface ERPConfig {
  url: string;
  key: string;
  secret: string;
}

export interface Settings {
  DHK: ERPConfig;
}

export interface MasterDataRecord {
  id: number;
  code: string;
  statusDHK?: 'Pending' | 'Success' | 'Failed' | 'Skipped' | 'Processing';
  logDHK?: string;
}

export type PriceUpdateStatus = 'Pending' | 'Success' | 'Failed' | 'Skipped' | 'Processing' | 'Unchanged' | 'Updated' | 'Created';


export interface PriceUpdateRecord {
  id: number;
  item_code: string;
  "Grosir": number;
  "88": number;
  "LM 88": number;
  statusDHK?: PriceUpdateStatus;
  logDHK?: string;
}

export type ItemDetailStatus = 'Pending' | 'Processing' | 'Updated' | 'Unchanged' | 'Failed' | 'Skipped';

export interface ItemUpdateResultDetail {
  field: 'Name' | 'Description' | 'Weight' | 'Item';
  status: ItemDetailStatus;
  message: string;
}

export interface FieldsToUpdate {
    item_name: boolean;
    description: boolean;
    weight: boolean;
}

export interface ItemUpdateRecord {
    id: number;
    item_code: string;
    item_name: string;
    description: string;
    weight: number;
    statusDHK: ItemUpdateResultDetail[];
}

export interface ItemPayload {
    item_code: string;
    item_name: string;
    item_group: string;
    stock_uom: string;
    targetErp: 'DHK';
    description?: string;
    weight_per_unit?: number;
    is_sales_item?: boolean;
}

export interface CreateItemResult {
    itemDHK: { success: boolean, message: string };
    pricesDHK: { price_list: string, success: boolean, message: string }[];
}

export interface BatchCreateItemResult extends CreateItemResult {
    item_code: string;
}

export interface CheckStockRecord {
    id: number;
    item_code: string;
    item_name?: string;
    Warehouse: string;
    tanggal: string;
    jam: string;
    Fisik?: number;
    stock_DHK?: number;
    status: 'Pending' | 'Processing' | 'Success' | 'Failed';
    log?: string;
}

export interface ReportData {
  dates: string[];
  items: Record<string, Record<string, number | null>>;
}

export interface FullReport {
  DHK: ReportData;
}
