"use client"

import * as React from "react"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    Home, 
    TestTube2,
    SlidersHorizontal, 
    TrendingUp, 
    Pencil,
    PackagePlus,
    Archive,
    Search,
    PackageSearch,
    Trash2,
    ClipboardList,
    BarChart3
} from "lucide-react";

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Icons } from '../icons';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from './sheet';

const SidebarContext = React.createContext<any>(undefined);

export function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) throw new Error("useSidebar must be used within a SidebarProvider");
    return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const isMobile = useIsMobile();
    const [isCollapsed, setIsCollapsed] = React.useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const toggleSidebar = () => isMobile ? setIsMobileMenuOpen(p => !p) : setIsCollapsed(p => !p);
    
    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, isMobile, isMobileMenuOpen, setIsMobileMenuOpen }}>
            {children}
        </SidebarContext.Provider>
    );
}

const navItems = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/stock-opname", label: "Stock Opname", icon: Archive },
    { href: "/check-lcv", label: "Check LCV", icon: BarChart3 },
    { href: "/check-stock", label: "Check Stock", icon: Search },
    { href: "/real-time-stock", label: "Real-Time Stock", icon: PackageSearch },
    { href: "/attendance-summary", label: "Attendance Recap", icon: ClipboardList },
    { href: "/master-data-toggle", label: "Toggle Master", icon: SlidersHorizontal },
    { href: "/create-item", label: "Create Item", icon: PackagePlus },
    { href: "/update-item", label: "Update Item", icon: Pencil },
    { href: "/update-price", label: "Update Price", icon: TrendingUp },
    { href: "/delete-item-price", label: "Delete Price", icon: Trash2 },
];

const NavLink = ({ item, isCollapsed }: { item: any, isCollapsed: boolean }) => {
    const pathname = usePathname();
    const isActive = pathname === item.href;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    href={item.href}
                    className={cn(
                        buttonVariants({ variant: isActive ? "secondary" : "ghost", size: isCollapsed ? "icon" : "default" }),
                        !isCollapsed && "justify-start w-full"
                    )}
                >
                    <item.icon className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
                    {!isCollapsed && item.label}
                    {isCollapsed && <span className="sr-only">{item.label}</span>}
                </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
        </Tooltip>
    );
};

export function AppSidebar() {
    const { isCollapsed, isMobile, isMobileMenuOpen, setIsMobileMenuOpen } = useSidebar();

    const SidebarContent = () => (
        <div className={cn("flex h-full flex-col bg-card", isMobile ? "w-full" : isCollapsed ? "w-16" : "w-64")}>
            <header className="flex h-16 items-center justify-center border-b px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Icons.Logo className="h-8 w-8" />
                    {(!isCollapsed || isMobile) && <span className="font-headline text-lg">STOCK MANAGER</span>}
                </Link>
            </header>
            <nav className="flex flex-col gap-2 p-2 flex-grow">
                <TooltipProvider delayDuration={0}>
                    {navItems.map(item => (
                        <NavLink key={item.href} item={item} isCollapsed={isCollapsed && !isMobile} />
                    ))}
                </TooltipProvider>
            </nav>
            <div className="mt-auto p-2 border-t">
                <TooltipProvider delayDuration={0}>
                    <NavLink item={{ href: "/erp-test", label: "ERP Test", icon: TestTube2 }} isCollapsed={isCollapsed && !isMobile} />
                </TooltipProvider>
            </div>
        </div>
    );
    
    if (isMobile) {
        return (
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetContent side="left" className="p-0 w-72">
                    <SidebarContent />
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <aside className={cn("relative h-screen border-r transition-all duration-300", isCollapsed ? "w-16" : "w-64")}>
            <SidebarContent />
        </aside>
    );
}
