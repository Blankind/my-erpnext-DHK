'use server';

/**
 * @fileOverview Service for interacting with ERPNext instances.
 * Provides functions to fetch data and create/update/delete documents in ERPNext.
 */

import type { ERPConfig, ItemPayload } from '@/lib/types';

interface FrappeCallArgs {
  cmd: string;
  args?: Record<string, any>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
}

async function frappeCall(config: ERPConfig, { cmd, args, method = 'GET', data }: FrappeCallArgs) {
  const url = new URL(config.url);
  url.pathname = '/api/method/' + cmd;

  if (args && method === 'GET') {
    Object.keys(args).forEach(key => url.searchParams.append(key, args[key]));
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `token ${config.key}:${config.secret}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store', // Ensure fresh data,
    signal: AbortSignal.timeout(30000), // 30-second timeout
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `API call failed with status ${response.status}: ${errorBody}`;
    try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.exception) {
            errorMessage = errorJson.exception;
        } else if (errorJson._server_messages) {
            const serverMessages = JSON.parse(errorJson._server_messages);
            errorMessage = serverMessages.map((m: any) => (JSON.parse(m).message || '')).join(', ');
        } else if (errorJson.message) {
            errorMessage = errorJson.message;
        }
    } catch (e) {
        // Ignore parsing error, use the constructed message
    }
    throw new Error(`ERPNext API Error (${response.status} from ${url.toString()}): ${errorMessage}`);
  }

  const result = await response.json();
  return result.message || result;
}

/**
 * Checks if a document exists.
 */
export async function doesDocExist(config: ERPConfig, doctype: string, docname: string): Promise<boolean> {
  try {
    const response = await frappeCall(config, {
      cmd: 'frappe.client.get_value',
      args: {
        doctype,
        filters: JSON.stringify({ name: docname }),
        fieldname: 'name',
      },
    });
    return !!(response && response.name);
  } catch (error) {
    if (error instanceof Error && !error.message.includes('404')) {
      console.error(`Error checking for doc ${doctype}/${docname} in ${config.url}:`, error);
    }
    return false;
  }
}

export async function getAppVersion(config: ERPConfig): Promise<string | null> {
    try {
        const response = await frappeCall(config, {
            cmd: 'frappe.client.get_value',
            args: {
                doctype: "User",
                filters: JSON.stringify({ name: "Administrator" }),
                fieldname: "full_name"
            }
        });
        if (response && response.full_name) {
             return `Authenticated as: ${response.full_name}`;
        }
        return "Authentication successful, but could not fetch user name.";
    } catch (error) {
        console.error(`Error getting app version from ${config.url}:`, error);
        throw error;
    }
}

/**
 * Sets the 'disabled' status of a given document.
 */
export async function setDocumentDisabledStatus(
  config: ERPConfig,
  doctype: 'Item' | 'Customer' | 'Supplier' | 'Customers',
  docname: string,
  disabled: 0 | 1
): Promise<string> {
    try {
        await frappeCall(config, {
            cmd: 'frappe.client.set_value',
            method: 'PUT',
            data: {
                doctype: doctype,
                name: docname,
                fieldname: 'disabled',
                value: disabled,
            },
        });
        const status = disabled ? 'disabled' : 'enabled';
        return `Successfully ${status} ${docname}.`;
    } catch (error) {
        console.error(`Error updating status for ${doctype} ${docname} in ${config.url}:`, error);
        throw error;
    }
}

/**
 * Deletes a document from ERPNext.
 */
export async function deleteDocument(config: ERPConfig, doctype: string, docname: string): Promise<string> {
    try {
        await frappeCall(config, {
            cmd: 'frappe.client.delete',
            method: 'POST',
            data: {
                doctype: doctype,
                name: docname,
            },
        });
        return `Successfully deleted ${docname}.`;
    } catch (error: any) {
        console.error(`Error deleting ${doctype} ${docname} in ${config.url}:`, error);
        throw error;
    }
}

/**
 * Finds an existing Item Price document and returns its name (ID).
 */
export async function findItemPrice(config: ERPConfig, itemCode: string, priceListName: string): Promise<string | null> {
    try {
        const response = await frappeCall(config, {
            cmd: 'frappe.client.get_list',
            args: {
                doctype: 'Item Price',
                filters: JSON.stringify({ item_code: itemCode, price_list: priceListName }),
                fields: JSON.stringify(['name']),
                limit: 1,
            },
        });
        return response && response.length > 0 ? response[0].name : null;
    } catch (error) {
        console.error(`Error finding item price for ${itemCode} in ${priceListName} at ${config.url}:`, error);
        return null;
    }
}

/**
 * Updates or creates an Item Price.
 */
export async function updateItemPrice(
    config: ERPConfig,
    itemCode: string,
    priceListName: string,
    newPrice: number,
    syncId: string | null = null
): Promise<{ status: 'Updated' | 'Created' | 'Unchanged'; message: string, docId: string | null }> {
    try {
        let docIdToUse = syncId;
        
        if (!docIdToUse) {
            docIdToUse = await findItemPrice(config, itemCode, priceListName);
        }

        if (docIdToUse) {
            const docExists = await doesDocExist(config, 'Item Price', docIdToUse);
            if(docExists) {
                const currentDoc = await frappeCall(config, {
                    cmd: 'frappe.client.get',
                    args: { doctype: 'Item Price', name: docIdToUse }
                });
                const currentPrice = currentDoc.price_list_rate;
    
                if (currentPrice === newPrice) {
                    return { status: 'Unchanged', message: `Price is already ${newPrice}.`, docId: docIdToUse };
                }
    
                await frappeCall(config, {
                    cmd: 'frappe.client.set_value',
                    method: 'PUT',
                    data: { doctype: 'Item Price', name: docIdToUse, fieldname: 'price_list_rate', value: newPrice },
                });
                return { status: 'Updated', message: `Updated from ${currentPrice} to ${newPrice}.`, docId: docIdToUse };
            }
        }
        
        const createdDoc = await createItemPriceWithId(config, docIdToUse, itemCode, priceListName, newPrice);
        return { status: 'Created', message: `Created with price ${newPrice}.`, docId: createdDoc.name };

    } catch (error: any) {
        console.error(`Error updating price for ${itemCode} in ${priceListName} at ${config.url}:`, error);
        throw new Error(`Failed for ${priceListName}: ${error.message}`);
    }
}

export async function getItemFields(
  config: ERPConfig,
  itemCode: string,
  fields: string[]
): Promise<Record<string, any> | null> {
  try {
    const response = await frappeCall(config, {
      cmd: 'frappe.client.get_value',
      args: {
        doctype: 'Item',
        filters: JSON.stringify({ item_code: itemCode }),
        fieldname: JSON.stringify(fields),
      },
    });
    return response || null;
  } catch (error) {
    console.error(`Error getting fields for item ${itemCode} in ${config.url}:`, error);
    return null;
  }
}

export async function updateItemDetails(
  config: ERPConfig,
  itemCode: string,
  data: Record<string, any>
): Promise<string> {
  try {
    await frappeCall(config, {
      cmd: 'frappe.client.set_value',
      method: 'PUT',
      data: {
        doctype: 'Item',
        name: itemCode,
        fieldname: data,
      },
    });
    return `Successfully updated item ${itemCode}.`;
  } catch (error: any) {
    console.error(`Error updating details for item ${itemCode} in ${config.url}:`, error);
    throw new Error(`Failed to update ${itemCode}: ${error.message}`);
  }
}

export async function createItem(config: ERPConfig, itemData: ItemPayload) {
    const doc = {
        doctype: 'Item',
        ...itemData
    };

    return await frappeCall(config, {
        cmd: 'frappe.client.insert',
        method: 'POST',
        data: { doc: JSON.stringify(doc) }
    });
}

export async function createItemPrice(config: ERPConfig, itemCode: string, priceList: string, rate: number, docId: string | null = null) {
    const doc: any = {
        doctype: 'Item Price',
        item_code: itemCode,
        price_list: priceList,
        price_list_rate: rate,
    };

    if (docId) {
        doc.name = docId;
    }

    return await frappeCall(config, {
        cmd: 'frappe.client.insert',
        method: 'POST',
        data: { doc: JSON.stringify(doc) }
    });
}

export async function createItemPriceWithId(config: ERPConfig, docId: string | null, itemCode: string, priceList: string, rate: number) {
    const doc: any = {
        doctype: 'Item Price',
        item_code: itemCode,
        price_list: priceList,
        price_list_rate: rate,
    };
    
    if (docId) {
        doc.name = docId;
    }
    
    const response = await frappeCall(config, {
        cmd: 'frappe.client.insert',
        method: 'POST',
        data: { doc: JSON.stringify(doc) }
    });
    return response;
}

interface ReconciliationItem {
    item_code: string;
    item_name: string;
    qty: number;
}

interface CreateReconciliationParams {
    warehouse: string;
    reconciliationDate: string;
    reconciliationTime: string;
    items: ReconciliationItem[];
}

export async function createStockReconciliation(config: ERPConfig, { warehouse, reconciliationDate, reconciliationTime, items }: CreateReconciliationParams) {
  const purpose = 'Stock Reconciliation';
  
  const validItems = items.filter(item => item.qty !== undefined && item.qty !== null && !isNaN(item.qty));
  if(validItems.length === 0) {
      return `No valid items to reconcile in ${config.url.split('//')[1]}`;
  }
  
  const doc = {
    doctype: 'Stock Reconciliation',
    purpose,
    posting_date: reconciliationDate,
    posting_time: reconciliationTime,
    set_posting_time: 1,
    items: validItems.map(item => ({
        doctype: 'Stock Reconciliation Item',
        item_code: item.item_code,
        item_name: item.item_name,
        warehouse,
        qty: item.qty,
    })),
  };

  try {
    const insertedDoc = await frappeCall(config, {
      cmd: 'frappe.client.insert',
      method: 'POST',
      data: {
        doc: JSON.stringify(doc),
      },
    });
    
    if (insertedDoc.name) {
        return `Success reco: ${insertedDoc.name}`;
    }
    
    return "Failed to get document name after creation.";
  } catch (error) {
      console.error(`Error creating stock reconciliation in ${config.url}:`, error);
      throw error;
  }
}

export async function getLatestStockQty(config: ERPConfig, itemCode: string, warehouse: string): Promise<number> {
    try {
        const response = await frappeCall(config, {
            cmd: 'erpnext.stock.utils.get_latest_stock_qty',
            args: {
                item_code: itemCode,
                warehouse: warehouse,
            },
        });
        return typeof response === 'number' ? response : 0;
    } catch (error) {
        console.error(`Error getting stock for item ${itemCode} in ${config.url}`, error);
        return 0;
    }
}

export async function getStockFromBin(config: ERPConfig, itemCode: string): Promise<any[]> {
    try {
        return await frappeCall(config, {
            cmd: 'frappe.client.get_list',
            args: {
                doctype: 'Bin',
                fields: JSON.stringify(['item_code', 'warehouse', 'actual_qty']),
                filters: JSON.stringify({ item_code: itemCode }),
                limit_page_length: 100,
            }
        });
    } catch (error) {
        console.error(`Error fetching stock from Bin in ${config.url}`, error);
        return [];
    }
}

export async function getFilteredItemPrices(config: ERPConfig, itemCode: string): Promise<any[]> {
    try {
        const allPrices = await frappeCall(config, {
            cmd: 'frappe.client.get_list',
            args: {
                doctype: 'Item Price',
                fields: JSON.stringify(['price_list', 'price_list_rate']),
                filters: JSON.stringify({ item_code: itemCode }),
                limit_page_length: 100,
            }
        });
        const allowedLists = ["Grosir", "88", "LM 88"];
        return allPrices.filter((p: any) => allowedLists.includes(p.price_list));
    } catch (error) {
        console.error(`Error fetching item prices in ${config.url}`, error);
        return [];
    }
}

export async function findItemsByName(config: ERPConfig, itemName: string): Promise<any[]> {
    try {
        return await frappeCall(config, {
            cmd: 'frappe.client.get_list',
            args: {
                doctype: 'Item',
                fields: JSON.stringify(['item_code', 'item_name']),
                filters: JSON.stringify([['item_name', 'like', `%${itemName}%`]]),
                limit_page_length: 10,
            }
        });
    } catch (error) {
        console.error(`Error searching items by name in ${config.url}`, error);
        return [];
    }
}
