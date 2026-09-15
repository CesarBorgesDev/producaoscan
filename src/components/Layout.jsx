import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { ScanLine, Package, Settings, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Image } from "@/components/ui/image";

const LOGO_URL = "https://media.base44.com/images/public/6a9193ac2394a604bc61d87a/a47f78456_dama.PNG";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/", label: "Produção", icon: ScanLine, end: true },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="flex h-16 md:h-[4.75rem] items-center justify-between gap-4">
            <NavLink to="/" className="flex min-w-0 items-center gap-3 md:gap-4">
              <Image
                src={LOGO_URL}
                alt="DAMA Carnes Nobres"
                fittingType="fit"
                className="h-10 w-[140px] md:h-12 md:w-[168px] shrink-0 object-contain"
              />
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <div className="hidden sm:block min-w-0">
                <p className="text-sm font-semibold tracking-tight text-slate-900">
                  Controle de Produção
                </p>
              </div>
            </NavLink>

            <nav className="flex items-center gap-0.5 rounded-full bg-slate-100 p-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-full px-3 py-2 text-xs md:text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
