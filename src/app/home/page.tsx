'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Archive, 
  PackageSearch, 
  PackagePlus, 
  TrendingUp, 
  ArrowRight,
  Activity,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ClipboardList,
  BarChart3,
  FileCheck2,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function WelcomePage() {
  const modules = [
    { title: "Stock Opname",     desc: "Reconcile physical vs system stock",      icon: Archive,       href: "/stock-opname",        color: "text-blue-500",        bgColor: "bg-blue-50" },
    { title: "Check LCV",        desc: "Analyze unit HPP from landed costs",       icon: BarChart3,     href: "/check-lcv",           color: "text-indigo-500",      bgColor: "bg-indigo-50" },
    { title: "Check Stock",      desc: "Fetch stock levels from Excel",            icon: PackageSearch, href: "/check-stock",         color: "text-emerald-500",     bgColor: "bg-emerald-50" },
    { title: "Real-Time Stock",  desc: "Search live stock and pricing",            icon: Activity,      href: "/real-time-stock",     color: "text-green-500",       bgColor: "bg-green-50" },
    { title: "Attendance Recap", desc: "Process employee attendance records",      icon: ClipboardList, href: "/attendance-summary",  color: "text-cyan-500",        bgColor: "bg-cyan-50" },
    { title: "Toggle Master",    desc: "Enable or disable master records",         icon: SlidersHorizontal, href: "/master-data-toggle", color: "text-amber-500",   bgColor: "bg-amber-50" },
    { title: "Create Item",      desc: "Add new master data with prices",          icon: PackagePlus,   href: "/create-item",         color: "text-purple-500",      bgColor: "bg-purple-50" },
    { title: "Update Item",      desc: "Bulk update item details",                 icon: Pencil,        href: "/update-item",         color: "text-rose-500",        bgColor: "bg-rose-50" },
    { title: "Update Price",     desc: "Bulk update item prices",                  icon: TrendingUp,    href: "/update-price",        color: "text-orange-500",      bgColor: "bg-orange-50" },
    { title: "Delete Price",     desc: "Permanently delete price IDs",             icon: Trash2,        href: "/delete-item-price",   color: "text-destructive",     bgColor: "bg-destructive/10" },
    { title: "Auto Submit",      desc: "Submit PREC & DN documents in bulk",       icon: FileCheck2,    href: "/auto-submit",         color: "text-teal-500",        bgColor: "bg-teal-50" },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="shrink-0 py-6 border-b border-muted/10 bg-background/95 backdrop-blur-sm z-20 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter font-headline text-foreground">
            ERP MANAGER
          </h1>
          <div className="flex flex-col items-center">
            <p className="text-sm md:text-base text-muted-foreground font-medium tracking-tight">
              PT DEHIKAS SINERGI SEMESTA
            </p>
            <p className="text-[10px] text-muted-foreground/50 italic font-medium mt-0.5">
              @2026 by Blank
            </p>
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-6 md:p-8 lg:p-10 scroll-smooth">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {modules.map((module) => (
              <Link key={module.title} href={module.href}>
                <Card className="h-full hover:shadow-xl transition-all cursor-pointer group border-muted/60 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">{module.title}</CardTitle>
                    <div className={`p-2.5 rounded-xl ${module.bgColor}`}>
                      <module.icon className={`h-5 w-5 ${module.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2 font-medium">{module.desc}</p>
                    <div className="flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                      Launch Module <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            <Card className="h-full border-muted/60 bg-primary/5 backdrop-blur-sm xl:col-span-4 lg:col-span-3 md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider">System Status</CardTitle>
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-tight">DHK Instance</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">dehikas2.digitalasiasolusindo.com</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] font-bold py-0 h-5">
                    Online
                  </Badge>
                  <Link href="/erp-test">
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 text-[10px] font-bold py-0 h-5">
                      Diagnostics
                    </Badge>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <footer className="pt-8 text-center border-t border-muted/20 pb-12">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              @2026 by Blank
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
