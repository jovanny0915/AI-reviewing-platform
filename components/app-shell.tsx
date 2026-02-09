"use client";

import React from "react"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-card/80 backdrop-blur-sm px-4 shadow-card">
          <SidebarTrigger className="-ml-1 rounded-md hover:bg-accent" />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto bg-gradient-to-b from-background to-muted/20 p-6">
          <div className="animate-in-fade">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
