
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onFileUploaded: (data: any[]) => void;
  isProcessing: boolean;
  requiredHeaders?: string[];
  buttonText?: string;
}

export function FileUploader({ 
    onFileUploaded, 
    isProcessing, 
    requiredHeaders, 
    buttonText = 'Upload Excel File' 
}: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const json = XLSX.utils.sheet_to_json<any>(worksheet, { raw: true });

          if (json.length === 0) {
            toast({
              variant: 'destructive',
              title: 'Empty File',
              description: 'The uploaded file contains no data.',
            });
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
          }

          if (requiredHeaders) {
            const header = Object.keys(json[0]).map(h => h.trim().toLowerCase());
            
            if (requiredHeaders[0] && !header.includes(requiredHeaders[0].toLowerCase())) {
                 toast({
                    variant: 'destructive',
                    title: 'Invalid File Format',
                    description: `The uploaded file is missing the primary required column: ${requiredHeaders[0]}.`,
                  });
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  return;
              }
          }
          
          onFileUploaded(json);
        } catch (error) {
          console.error(error);
          toast({
            variant: 'destructive',
            title: 'Error Parsing File',
            description: 'There was an issue processing your Excel file. Please ensure it is a valid format.',
          });
        } finally {
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
      <>
        <Input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full">
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isProcessing ? 'Processing...' : buttonText}
        </Button>
      </>
  );
}
