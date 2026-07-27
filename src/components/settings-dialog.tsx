'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon } from 'lucide-react';
import type { Settings } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';

const settingsSchema = z.object({
  DHK: z.object({
    url: z.string().url({ message: 'Please enter a valid URL.' }),
    key: z.string().min(1, 'Key is required'),
    secret: z.string().min(1, 'Secret is required'),
  }),
});

interface SettingsDialogProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsDialog({ settings, onSave }: SettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const onSubmit = (data: Settings) => {
    onSave(data);
    setIsOpen(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ERP Settings (DHK)</DialogTitle>
          <DialogDescription>
            Configure the connection details for your DHK instance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4 rounded-lg border p-4">
               <h3 className="font-semibold text-foreground">DHK ERP</h3>
               <div className="space-y-2">
                 <Label htmlFor="DHK-url">URL</Label>
                 <Input id="DHK-url" {...register('DHK.url')} />
                 {errors.DHK?.url && <p className="text-sm text-destructive">{errors.DHK?.url?.message}</p>}
               </div>
               <div className="space-y-2">
                 <Label htmlFor="DHK-key">API Key</Label>
                 <Input id="DHK-key" {...register('DHK.key')} />
                 {errors.DHK?.key && <p className="text-sm text-destructive">{errors.DHK?.key?.message}</p>}
               </div>
               <div className="space-y-2">
                 <Label htmlFor="DHK-secret">API Secret</Label>
                 <Input id="DHK-secret" type="password" {...register('DHK.secret')} />
                 {errors.DHK?.secret && <p className="text-sm text-destructive">{errors.DHK?.secret?.message}</p>}
               </div>
            </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save Settings</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
