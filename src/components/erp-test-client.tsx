'use client';

import { useState, useEffect } from 'react';
import type { Settings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, Server } from 'lucide-react';
import { AppHeader } from '@/components/header';
import { testErpConnection } from '@/ai/flows/test-erp-connection';
import Link from 'next/link';

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

interface ConnectionStatus {
  status: TestStatus;
  message: string;
  version?: string;
}

const defaultSettings: Settings = {
  DHK: { 
    url: process.env.NEXT_PUBLIC_DHK_URL || 'https://dehikas.digitalasiasolusindo.com', 
    key: process.env.NEXT_PUBLIC_DHK_KEY || '57d7aaf633158d0', 
    secret: process.env.NEXT_PUBLIC_DHK_SECRET || '747f455224bdf7e' 
  },
  TOKO88: { 
    url: process.env.NEXT_PUBLIC_TOKO88_URL || 'https://toko88.digitalasiasolusindo.com', 
    key: process.env.NEXT_PUBLIC_TOKO88_KEY || '8409b8da7daf5c9', 
    secret: process.env.NEXT_PUBLIC_TOKO88_SECRET || '719bf5bcea92c92' 
  },
};

export default function ErpTestClient() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [connectionStatus, setConnectionStatus] = useState<
    Record<keyof Settings, ConnectionStatus>
  >({
    DHK: { status: 'idle', message: 'Ready to test' },
    TOKO88: { status: 'idle', message: 'Ready to test' },
  });
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('erpSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage', error);
    }
  }, []);

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem('erpSettings', JSON.stringify(newSettings));
    toast({
      title: 'Success',
      description: 'ERP settings have been saved.',
    });
    // Reset status after saving new settings
    setConnectionStatus({
        DHK: { status: 'idle', message: 'Ready to test' },
        TOKO88: { status: 'idle', message: 'Ready to test' },
    });
  };

  const handleTestConnection = async (erp: keyof Settings) => {
    setConnectionStatus((prev) => ({
      ...prev,
      [erp]: { status: 'testing', message: 'Testing...' },
    }));

    const result = await testErpConnection({ config: settings[erp] });

    setConnectionStatus((prev) => ({
      ...prev,
      [erp]: {
        status: result.success ? 'success' : 'failed',
        message: result.message,
        version: result.version,
      },
    }));
  };

  const StatusIcon = ({ status }: { status: TestStatus }) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Server className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader
        title="ERP Connection Test"
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-6">
            <CardHeader className="px-0">
                <CardTitle className="font-headline">ERP Connection Test</CardTitle>
                <CardDescription>
                Verify the connection to your ERPNext instances using the saved credentials. You can change credentials in the settings dialog.
                </CardDescription>
            </CardHeader>
          {(Object.keys(settings) as Array<keyof Settings>).map((erp) => (
            <Card key={erp}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className='space-y-1.5'>
                  <CardTitle className="font-semibold text-lg">{erp}</CardTitle>
                  <CardDescription>{settings[erp].url}</CardDescription>
                </div>
                 <Button
                  onClick={() => handleTestConnection(erp)}
                  disabled={connectionStatus[erp].status === 'testing'}
                >
                  {connectionStatus[erp].status === 'testing' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3 rounded-md border p-4">
                  <StatusIcon status={connectionStatus[erp].status} />
                  <div className="flex-grow">
                    <p className="font-medium">
                      {connectionStatus[erp].status.charAt(0).toUpperCase() + connectionStatus[erp].status.slice(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {connectionStatus[erp].message}
                    </p>
                    {connectionStatus[erp].version && (
                        <p className="text-xs text-muted-foreground pt-1">
                            Version: {connectionStatus[erp].version}
                        </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
