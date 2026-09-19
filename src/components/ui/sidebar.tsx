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
    FileCheck2,
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

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

type SidebarContextType = {
    isCollapsed: boolean;
    isMobile: boolean;
    isMobileMenuOpen: boolean;
    toggleSidebar: () => void;
    setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const isMobile = useIsMobile();
    const [isCollapsed, setIsCollapsed] = React.useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    React.useEffect(() => {
        if (!isMobile) {
            setIsCollapsed(true);
        } else {
            setIsCollapsed(true);
            setIsMobileMenuOpen(false);
        }
    }, [isMobile]);

    const toggleSidebar = () => {
        if (isMobile) {
            setIsMobileMenuOpen(prev => !prev);
        } else {
            const newCollapsedState = !isCollapsed;
            setIsCollapsed(newCollapsedState);
            document.cookie = `${SIDEBAR_COOKIE_NAME}=${newCollapsedState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
        }
    };
    
    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, isMobile, isMobileMenuOpen, setIsMobileMenuOpen }}>
            {children}
        </SidebarContext.Provider>
    );
}

const navItems = [
    { href: "/home",              label: "Home",            icon: Home },
    { href: "/stock-opname",      label: "Stock Opname",    icon: Archive },
    { href: "/check-stock",       label: "Check Stock",     icon: Search },
    { href: "/real-time-stock",   label: "Real-Time Stock", icon: PackageSearch },
    { href: "/master-data-toggle",label: "Toggle Master",   icon: SlidersHorizontal },
    { href: "/create-item",       label: "Create Item",     icon: PackagePlus },
    { href: "/update-item",       label: "Update Item",     icon: Pencil },
    { href: "/update-price",      label: "Update Price",    icon: TrendingUp },
    { href: "/auto-submit",       label: "Auto Submit",     icon: FileCheck2 },
];

const bottomNavItems = [
    { href: "/erp-test", label: "ERP Test", icon: TestTube2 },
];

const NavLink = ({ item, isCollapsed }: { item: typeof navItems[0], isCollapsed: boolean }) => {
    const pathname = usePathname();
    const isActive = pathname === item.href;

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                        href={item.href}
                        className={cn(
                            buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "icon" }),
                            "h-10 w-10"
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                    {item.label}
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Link
            href={item.href}
            className={cn(
                buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "default" }),
                "justify-start"
            )}
        >
            <item.icon className="mr-2 h-5 w-5" />
            {item.label}
        </Link>
    );
};

export function AppSidebar() {
    const { isCollapsed, isMobile, isMobileMenuOpen, setIsMobileMenuOpen } = useSidebar();

    const SidebarContent = () => (
        <div data-collapsed={isCollapsed && !isMobile} className={cn("flex h-full flex-col bg-card", isMobile ? "w-full" : "group-[[data-collapsed=true]]:w-14")}>
            <header className="flex h-16 items-center justify-center border-b px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Icons.Logo className="h-8 w-8" />
                    {!isCollapsed || isMobile ? <span className="font-headline text-lg">STOCK MANAGER</span> : null}
                </Link>
            </header>
            <nav className="flex flex-col gap-2 p-2 flex-grow">
                <TooltipProvider delayDuration={0}>
                    {navItems.map(item => (
                        <NavLink key={item.href} item={item} isCollapsed={isCollapsed && !isMobile} />
                    ))}
                </TooltipProvider>
            </nav>
            <div className="mt-auto p-2">
                <TooltipProvider delayDuration={0}>
                    {bottomNavItems.map(item => (
                        <NavLink key={item.href} item={item} isCollapsed={isCollapsed && !isMobile} />
                    ))}
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
        <aside className={cn("relative h-screen border-r transition-all duration-300 ease-in-out", isCollapsed ? "w-16" : "w-64")}>
            <SidebarContent />
        </aside>
    );
}
