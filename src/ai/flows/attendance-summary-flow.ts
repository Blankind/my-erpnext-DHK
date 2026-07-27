'use server';

/**
 * @fileOverview A flow to process employee attendance records from an Excel file.
 * Strictly follows the logic provided in the Python script.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const AttendanceDetailSchema = z.object({
  "User ID": z.string(),
  "Name": z.string(),
  "Department": z.string(),
  "Day": z.number(),
  "Time In": z.string().nullable(),
  "Time Out": z.string().nullable(),
  "Late": z.boolean(),
  "Early Leave": z.number(),
  "Overtime Minutes": z.number(),
  "Tidak Lengkap Finger": z.number(),
});

const AttendanceSummarySchema = z.object({
  "User ID": z.string(),
  "Name": z.string(),
  "Department": z.string(),
  "Hadir": z.number(),
  "Telat": z.number(),
  "Awal": z.number(),
  "Tidak_Lengkap_Finger": z.number(),
});

const AttendanceSummaryInputSchema = z.object({
  fileBase64: z.string().describe('The Excel file encoded as base64.'),
});

const AttendanceSummaryOutputSchema = z.object({
  details: z.array(AttendanceDetailSchema),
  summary: z.array(AttendanceSummarySchema),
  excelBase64: z.string().optional(),
  fileName: z.string().optional(),
});

export type AttendanceSummaryInput = z.infer<typeof AttendanceSummaryInputSchema>;
export type AttendanceSummaryOutput = z.infer<typeof AttendanceSummaryOutputSchema>;

export async function processAttendance(input: AttendanceSummaryInput): Promise<AttendanceSummaryOutput> {
  return attendanceSummaryFlow(input);
}

const attendanceSummaryFlow = ai.defineFlow(
  {
    name: 'attendanceSummaryFlow',
    inputSchema: AttendanceSummaryInputSchema,
    outputSchema: AttendanceSummaryOutputSchema,
  },
  async (input) => {
    const buffer = Buffer.from(input.fileBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = "Employee Attendance Record";
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`Sheet "${sheetName}" not found in the uploaded file.`);
    }

    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const attendanceRecords: z.infer<typeof AttendanceDetailSchema>[] = [];

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    };

    const thresholdLate = parseTime("08:05");
    const thresholdAwal = parseTime("15:00");
    const thresholdLemburTrigger = parseTime("18:00");
    const thresholdLemburBase = parseTime("17:00");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 6) continue;

      // Python logic: if str(row[4]).strip() == "User ID:"
      if (String(row[4] || '').trim() === "User ID:") {
        const userId = String(row[5] || '').trim();
        const name = String(row[11] || '').trim();
        const department = String(row[23] || '').trim();

        // Attendance data row is i + 2
        const attendanceRow = rows[i + 2];
        if (!attendanceRow) continue;

        // Python logic: absences = attendance_row[1:].dropna()
        // Day starts from index 1 (column B)
        for (let dayIdx = 1; dayIdx < attendanceRow.length; dayIdx++) {
          const timeEntry = attendanceRow[dayIdx];
          if (timeEntry === undefined || timeEntry === null || timeEntry === "") continue;

          let timeIn: string | null = null;
          let timeOut: string | null = null;
          let tidakLengkap = 0;

          if (typeof timeEntry === 'string' && timeEntry.includes("\n")) {
            const parts = timeEntry.split("\n").map(t => t.trim());
            timeIn = parts[0] || null;
            timeOut = parts[1] || null;
            if (!timeIn || !timeOut) {
              tidakLengkap = 1;
            }
          } else {
            tidakLengkap = 1;
          }

          let late = false;
          let awal = 0;
          let lembur = 0;

          try {
            if (timeIn) {
              late = parseTime(timeIn) > thresholdLate;
            }
          } catch (e) {}

          try {
            if (timeOut) {
              const timeOutDt = parseTime(timeOut);
              if (timeOutDt < thresholdAwal) {
                awal = 1;
              }
              if (timeOutDt > thresholdLemburTrigger) {
                lembur = Math.floor((timeOutDt.getTime() - thresholdLemburBase.getTime()) / (1000 * 60));
              }
            }
          } catch (e) {}

          attendanceRecords.push({
            "User ID": userId,
            "Name": name,
            "Department": department,
            "Day": dayIdx,
            "Time In": timeIn,
            "Time Out": timeOut,
            "Late": late,
            "Early Leave": awal,
            "Overtime Minutes": lembur,
            "Tidak Lengkap Finger": tidakLengkap
          });
        }
      }
    }

    // Summarize
    const summaryMap = new Map<string, z.infer<typeof AttendanceSummarySchema>>();
    attendanceRecords.forEach(rec => {
      const key = `${rec["User ID"]}|${rec["Name"]}|${rec["Department"]}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          "User ID": rec["User ID"],
          "Name": rec["Name"],
          "Department": rec["Department"],
          "Hadir": 0,
          "Telat": 0,
          "Awal": 0,
          "Tidak_Lengkap_Finger": 0
        });
      }
      const sum = summaryMap.get(key)!;
      sum.Hadir += 1;
      sum.Telat += rec.Late ? 1 : 0;
      sum.Awal += rec["Early Leave"];
      sum.Tidak_Lengkap_Finger += rec["Tidak Lengkap Finger"];
    });

    const summary = Array.from(summaryMap.values());

    // Generate output Excel
    const wbOut = XLSX.utils.book_new();
    const wsRekap = XLSX.utils.json_to_sheet(summary);
    const wsDetail = XLSX.utils.json_to_sheet(attendanceRecords);
    XLSX.utils.book_append_sheet(wbOut, wsRekap, "Rekap Mingguan");
    XLSX.utils.book_append_sheet(wbOut, wsDetail, "Detail Harian");
    
    const excelBase64 = XLSX.write(wbOut, { bookType: 'xlsx', type: 'base64' });

    return {
      details: attendanceRecords,
      summary: summary,
      excelBase64: excelBase64,
      fileName: `Rekap_Absensi_Output_${new Date().toISOString().split('T')[0]}.xlsx`
    };
  }
);
