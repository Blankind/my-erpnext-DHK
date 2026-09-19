"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Send, CheckCircle, XCircle, Loader2, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ERPConfig, Settings } from "@/lib/types";
import { AppHeader } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────

type DocType = "Purchase Receipt" | "Delivery Note";
type SubmitStatus = "success" | "error";

interface DocEntry {
  id: string;
  docname: string;
}

interface DocResult {
  docname: string;
  status: SubmitStatus;
  message: string;
}

interface SectionState {
  doctype: DocType;
  label: string;
  series: string[];
  selectedSeries: string[];
  entries: DocEntry[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const PREC_SERIES = [
  "PREC-DHK-KR-.YY.-.DD.-.MM.-.####",
  "PREC-DHK-LT-.YY.-.DD.-.MM.-.####",
  "PREC-DHK-LM-.YY.-.DD.-.MM.-.####",
  "PREC-DHK-BG-.YY.-.DD.-.MM.-.####",
  "PREC-DHK-KM-.YY.-.DD.-.MM.-.####",
];

const DN_SERIES = [
  "DN-DHK-KR-.YY.-.DD.-.MM.-.####",
  "DN-DHK-LT-.YY.-.DD.-.MM.-.####",
  "DN-DHK-LM-.YY.-.DD.-.MM.-.####",
  "DN-DHK-BGL-.YY.-.DD.-.MM.-.####",
  "DN-DHK-KMB-.YY.-.DD.-.MM.-.####",
];

const defaultSettings: Settings = {
  DHK: {
    url:    process.env.NEXT_PUBLIC_DHK_URL    || "https://dehikas2.digitalasiasolusindo.com",
    key:    process.env.NEXT_PUBLIC_DHK_KEY    || "",
    secret: process.env.NEXT_PUBLIC_DHK_SECRET || "",
  },
  TOKO88: {
    url:    process.env.NEXT_PUBLIC_TOKO88_URL    || "https://toko88.digitalasiasolusindo.com",
    key:    process.env.NEXT_PUBLIC_TOKO88_KEY    || "",
    secret: process.env.NEXT_PUBLIC_TOKO88_SECRET || "",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function makeEntry(): DocEntry {
  return { id: makeId(), docname: "" };
}

function resolveDocname(namingSeries: string, input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("-")) return trimmed;

  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth() + 1).padStart(2, "0");
  const dd  = String(now.getDate()).padStart(2, "0");
  const hashes = namingSeries.match(/#+/)?.[0]?.length ?? 4;
  const paddedNum = trimmed.padStart(hashes, "0");

  return namingSeries
    .replace(".YY.", yy)
    .replace(".MM.", mm)
    .replace(".DD.", dd)
    .replace(/\.#+\./, `.${paddedNum}.`)
    .replace(/\.$/, "");
}

async function submitDoc(
  config: ERPConfig,
  doctype: DocType,
  docname: string
): Promise<DocResult> {
  const resource = doctype === "Purchase Receipt" ? "Purchase Receipt" : "Delivery Note";
  const url = `${config.url}/api/resource/${encodeURIComponent(resource)}/${encodeURIComponent(docname)}`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${config.key}:${config.secret}`,
      },
      body: JSON.stringify({ docstatus: 1 }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg =
        err?.exception?.replace("frappe.exceptions.", "") ??
        err?.exc_type ??
        err?.message ??
        `HTTP ${res.status}`;
      return { docname, status: "error", message: msg };
    }

    return { docname, status: "success", message: "Submitted" };
  } catch (e: unknown) {
    return {
      docname,
      status: "error",
      message: e instanceof Error ? e.message : "Network error",
    };
  }
}

// ── Initial state ──────────────────────────────────────────────────────────

const INITIAL_SECTIONS: SectionState[] = [
  {
    doctype: "Purchase Receipt",
    label: "Purchase Receipt (PREC)",
    series: PREC_SERIES,
    selectedSeries: [PREC_SERIES[0]],
    entries: [makeEntry()],
  },
  {
    doctype: "Delivery Note",
    label: "Delivery Note (DN)",
    series: DN_SERIES,
    selectedSeries: [DN_SERIES[0]],
    entries: [makeEntry()],
  },
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function AutoSubmitDoc() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [sections, setSections]  = useState<SectionState[]>(INITIAL_SECTIONS);
  const [results,  setResults]   = useState<DocResult[]>([]);
  const [loading,  setLoading]   = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("erpSettings");
      if (saved) setSettings(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("erpSettings", JSON.stringify(newSettings));
    toast({ title: "Success", description: "ERP settings have been saved." });
  };

  // ── Entry handlers ───────────────────────────────────────────────────

  function addEntry(si: number) {
    setSections(prev =>
      prev.map((s, i) => i !== si ? s : {
        ...s,
        entries:        [...s.entries, makeEntry()],
        selectedSeries: [...s.selectedSeries, s.series[0]],
      })
    );
  }

  function removeEntry(si: number, ei: number) {
    setSections(prev =>
      prev.map((s, i) => {
        if (i !== si || s.entries.length === 1) return s;
        return {
          ...s,
          entries:        s.entries.filter((_, j) => j !== ei),
          selectedSeries: s.selectedSeries.filter((_, j) => j !== ei),
        };
      })
    );
  }

  function updateSeries(si: number, ei: number, val: string) {
    setSections(prev =>
      prev.map((s, i) => i !== si ? s : {
        ...s,
        selectedSeries: s.selectedSeries.map((v, j) => j === ei ? val : v),
      })
    );
  }

  function updateDocname(si: number, ei: number, val: string) {
    setSections(prev =>
      prev.map((s, i) => i !== si ? s : {
        ...s,
        entries: s.entries.map((e, j) => j === ei ? { ...e, docname: val } : e),
      })
    );
  }

  // ── Submit ───────────────────────────────────────────────────────────

  async function handleSubmit() {
    const tasks: { doctype: DocType; docname: string }[] = [];

    for (const section of sections) {
      section.entries.forEach((entry, ei) => {
        const raw = entry.docname.trim();
        if (!raw) return;
        tasks.push({
          doctype: section.doctype,
          docname: resolveDocname(section.selectedSeries[ei], raw),
        });
      });
    }

    if (tasks.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "Masukkan minimal satu nomor dokumen." });
      return;
    }

    setResults([]);
    setLoading(true);

    const settled = await Promise.allSettled(
      tasks.map(t => submitDoc(settings.DHK, t.doctype, t.docname))
    );

    const res: DocResult[] = settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { docname: tasks[i].docname, status: "error", message: "Unknown error" }
    );

    setResults(res);
    setLoading(false);

    const ok  = res.filter(r => r.status === "success").length;
    const err = res.filter(r => r.status === "error").length;
    toast({
      title: "Selesai",
      description: `${ok} berhasil${err > 0 ? `, ${err} gagal` : ""}.`,
      variant: err > 0 && ok === 0 ? "destructive" : "default",
    });
  }

  // ── Derived ──────────────────────────────────────────────────────────

  const totalDocs    = sections.reduce((acc, s) => acc + s.entries.filter(e => e.docname.trim()).length, 0);
  const successCount = results.filter(r => r.status === "success").length;
  const errorCount   = results.filter(r => r.status === "error").length;

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <AppHeader
        title="Auto Submit Document"
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-auto">

        {sections.map((section, si) => (
          <Card key={section.doctype}>
            <CardHeader>
              <CardTitle className="font-headline">{section.label}</CardTitle>
              <CardDescription>
                Pilih naming series lalu masukkan nomor atau nama dokumen penuh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.entries.map((entry, ei) => (
                <div key={entry.id} className="flex gap-2 items-center">
                  <Select
                    value={section.selectedSeries[ei]}
                    onValueChange={v => updateSeries(si, ei, v)}
                    disabled={loading}
                  >
                    <SelectTrigger className="flex-1 min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {section.series.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Nomor / nama dokumen"
                    value={entry.docname}
                    onChange={e => updateDocname(si, ei, e.target.value)}
                    disabled={loading}
                    className="w-44"
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEntry(si, ei)}
                    disabled={loading || section.entries.length === 1}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addEntry(si)}
                disabled={loading}
                className="text-muted-foreground"
              >
                <Plus className="mr-1 h-4 w-4" />
                Tambah dokumen
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={loading || totalDocs === 0}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses {totalDocs} dokumen…</>
          ) : (
            <><Send className="mr-2 h-4 w-4" />Submit {totalDocs > 0 ? `${totalDocs} ` : ""}Dokumen</>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-headline flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5" />
                  Hasil Submit
                </CardTitle>
                <div className="flex gap-2">
                  {successCount > 0 && (
                    <Badge variant="default">{successCount} berhasil</Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="destructive">{errorCount} gagal</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    r.status === "success"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {r.status === "success"
                    ? <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    : <XCircle className="h-4 w-4 shrink-0" />
                  }
                  <span className="font-mono font-medium flex-1">{r.docname}</span>
                  <span className="text-xs opacity-70 shrink-0">{r.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {results.length === 0 && !loading && (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed bg-secondary/20">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <FileCheck2 className="w-16 h-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">Belum ada hasil</h3>
              <p className="mt-2 text-muted-foreground">Isi nomor dokumen lalu klik Submit.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
