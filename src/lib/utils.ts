import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// Helper function to convert Excel time (fraction of a day) to HH:mm:ss string
export function excelTimeToHHMMSS(excelTime: number | string): string {
    if (typeof excelTime === 'string') {
        // If it's already in HH:mm or HH:mm:ss format, return it.
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(excelTime)) {
            return excelTime.length === 5 ? `${excelTime}:00` : excelTime;
        }
        // If it's a string representation of a number, parse it.
        const numericTime = parseFloat(excelTime);
        if(!isNaN(numericTime)) return excelTimeToHHMMSS(numericTime);
        return '00:00:00'; // fallback for invalid string formats
    }
    
    // If it's a number, it's an Excel time fraction.
    if (typeof excelTime !== 'number' || excelTime < 0 || excelTime >= 1) {
        return '00:00:00'; 
    }
    const totalSeconds = Math.round(excelTime * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

// Helper function to convert Excel date serial number to YYYY-MM-DD string
export function excelDateToYYYYMMDD(excelDate: number | string): string {
    // If it's a string, it might be in YYYY-MM-DD or other parsable format
    if (typeof excelDate === 'string') {
        // Check if it's already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
            return excelDate;
        }
        // Try parsing common date formats from Excel like MM/DD/YYYY
        const parts = excelDate.match(/(\d+)[/-](\d+)[/-](\d+)/);
        if (parts) {
            // Assuming MM/DD/YYYY, adjust if another format is common
            const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
            const date = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T00:00:00Z`);
             if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        }
        const parsedSerial = parseInt(excelDate, 10);
        if (!isNaN(parsedSerial)) {
           return excelDateToYYYYMMDD(parsedSerial);
        }

        const date = new Date(excelDate);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
           return date.toISOString().split('T')[0];
        }
        return excelDate;
    }

    // If it's a number, it's an Excel serial date
    if (typeof excelDate === 'number') {
        // The Excel epoch starts on 1900-01-01, but there's a bug where it thinks 1900 is a leap year.
        // The convention is to treat the number as days since 1899-12-30.
        const date = new Date(Date.UTC(1899, 11, 30 + excelDate));
        return date.toISOString().split('T')[0];
    }
    
    // Fallback for other types
    return String(excelDate);
}
