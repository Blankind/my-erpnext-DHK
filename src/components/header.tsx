'use client';

import { SettingsDialog } from '@/components/settings-dialog';
import type { Settings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { History, Loader2, Menu } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

interface AppHeaderProps {
  title: string;
  settings?: Settings;
  onSaveSettings?: (settings: Settings) => void;
  onReconcile?: () => void;
  isReconciling?: boolean;
  canReconcile?: boolean;
}

export function AppHeader({ 
  title,
  settings, 
  onSaveSettings, 
  onReconcile, 
  isReconciling = false, 
  canReconcile = false,
}: AppHeaderProps) {
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center gap-2">
            {isMobile && (
              <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
              >
                  <Menu />
                  <span className="sr-only">Toggle Sidebar</span>
              </Button>
            )}
            <h1 className="font-headline text-xl font-semibold tracking-tight">{title}</h1>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          {onReconcile && (
              <Button onClick={onReconcile} disabled={isReconciling || !canReconcile} size="sm">
                {isReconciling ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <History className="mr-2" />
                )}
                {isReconciling ? 'Reconciling...' : 'Reconcile All'}
              </Button>
          )}
          
          {settings && onSaveSettings && <SettingsDialog settings={settings} onSave={onSaveSettings} />}
        </div>
      </div>
    </header>
  );
}
