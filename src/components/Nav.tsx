import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { canRead, ROLE_LABELS, type Module } from "@/lib/roles";
import { logoutAction } from "@/lib/actions/auth";

type NavItem = { href: string; label: string; icon: string; mod?: Module };

const ALL_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/obra", label: "Obra", icon: "🏗️", mod: "obra" },
  { href: "/trabajo", label: "Trabajo", icon: "🤝", mod: "trabajo" },
  { href: "/compras", label: "Compras", icon: "🛒", mod: "compras" },
  { href: "/seguridad", label: "Seguridad", icon: "🦺", mod: "seguridad" },
  { href: "/finanzas", label: "Finanzas", icon: "💰", mod: "finanzas" },
  { href: "/documentos", label: "Documentos", icon: "📄", mod: "documentos" },
  { href: "/alertas", label: "Alertas", icon: "🔔" },
  { href: "/buscar", label: "Búsqueda", icon: "🔍" },
  { href: "/reportes", label: "Reportes", icon: "📊" },
  { href: "/ia", label: "Asistente IA", icon: "✨" },
  { href: "/auditoria", label: "Auditoría", icon: "🔎", mod: "auditoria" },
  { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

function itemsFor(user: SessionUser) {
  return ALL_ITEMS.filter((i) => !i.mod || canRead(user.rol, i.mod));
}

export function Sidebar({ user }: { user: SessionUser }) {
  const items = itemsFor(user);
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-[#123240] text-white">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
        <img src="/logo-ufama.png" alt="UFAMA" className="h-9 w-9 rounded-full" />
        <div>
          <div className="text-sm font-bold leading-tight">UFAMA</div>
          <div className="text-[11px] text-white/60 leading-tight">Sistema de gestión</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/85 hover:bg-white/10">
            <span>{i.icon}</span>
            <span>{i.label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-xs text-white/60">{user.nombre}</div>
        <div className="text-[11px] text-white/40">{ROLE_LABELS[user.rol]}</div>
        <form action={logoutAction}>
          <button className="mt-2 text-xs text-white/70 hover:text-white underline underline-offset-2">Cerrar sesión</button>
        </form>
      </div>
    </aside>
  );
}

export function TopBar({ user }: { user: SessionUser }) {
  return (
    <header className="md:hidden sticky top-0 z-20 bg-[#123240] text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src="/logo-ufama.png" alt="UFAMA" className="h-7 w-7 rounded-full" />
        <span className="text-sm font-bold">UFAMA</span>
      </div>
      <div className="text-right leading-tight">
        <div className="text-xs">{user.nombre.split(" ")[0]}</div>
        <div className="text-[10px] text-white/50">{ROLE_LABELS[user.rol]}</div>
      </div>
    </header>
  );
}

export function BottomNav({ user }: { user: SessionUser }) {
  const primary = ["/dashboard", "/obra", "/trabajo", "/ia"];
  const items = itemsFor(user).filter((i) => primary.includes(i.href));
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-black/10 safe-bottom">
      <div className="flex">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] text-[#123240]/80">
            <span className="text-lg leading-none">{i.icon}</span>
            {i.label}
          </Link>
        ))}
        <Link href="/mas" className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] text-[#123240]/80">
          <span className="text-lg leading-none">☰</span>
          Más
        </Link>
      </div>
    </nav>
  );
}

export { ALL_ITEMS, itemsFor };
