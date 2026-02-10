"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  FileText,
  Search,
  Eye,
  Stamp,
  Brain,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { AuthMenu } from "@/components/auth-menu";

const navItems = [
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Viewer", href: "/viewer", icon: Eye },
  { title: "Search", href: "/search", icon: Search },
  { title: "Productions", href: "/productions", icon: Stamp },
  { title: "AI Review", href: "/ai-review", icon: Brain },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/80">
      <SidebarHeader className="p-4">
        <Link
          href="/documents"
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
        >
          <Image
            src="/litreview-logo.svg"
            alt="LitReview"
            width={32}
            height={32}
            className="shrink-0 rounded-lg"
          />
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            LitReview
          </span>
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="bg-sidebar-border/80" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 p-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className="rounded-md transition-colors data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground"
                  >
                    <Link href={item.href} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <AuthMenu />
    </Sidebar>
  );
}
