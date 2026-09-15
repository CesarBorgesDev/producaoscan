import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { ScanLine, Package, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Image } from "@/components/ui/image";

const LOGO_URL = "https://media.base44.com/images/public/6a9193ac2394a604bc61d87a/a47f78456_dama.PNG";

const nav = [
  { to: "/", label: "Produção", icon: ScanLine, end: true },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-sidebar-border">
          <Image
            src={LOGO_URL}
            alt="DAMA Carnes Nobres"
            fittingType="fit"
            className="w-28 h-10"
          />
        </div>
        <div className="px-6 -mt-1 pb-3 text-[11px] text-sidebar-foreground/80 border-b border-sidebar-border">
          Controle de Produção · Padrão Toledo
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/80">
          Etiquetas pesáveis · EAN-13
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 bg-sidebar border-b border-sidebar-border">
        <div className="px-4 py-3 flex items-center gap-2">
          <Image
            src={LOGO_URL}
            alt="DAMA Carnes Nobres"
            fittingType="fit"
            className="w-24 h-8"
          />
        </div>
        <nav className="flex px-2 pb-2 gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="md:pl-64">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}