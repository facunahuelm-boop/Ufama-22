// Roles del sistema (ver sección 7 del análisis: Roles y permisos)
export const ROLES = [
  "socio",
  "comision_obra",
  "comision_trabajo",
  "comision_compras",
  "comision_seguridad",
  "administracion",
  "tesoreria",
  "consejo_directivo",
  "fiscal",
  "tecnico",
  "admin",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  socio: "Socio/a",
  comision_obra: "Comisión de Obra",
  comision_trabajo: "Comisión de Trabajo",
  comision_compras: "Comisión de Compras",
  comision_seguridad: "Comisión de Seguridad",
  administracion: "Administración",
  tesoreria: "Tesorería",
  consejo_directivo: "Consejo Directivo",
  fiscal: "Comisión Fiscal",
  tecnico: "IAT / Dirección técnica",
  admin: "Administrador del sistema",
};

type Access = "none" | "read" | "edit" | "approve" | "config";

export type Module = "obra" | "trabajo" | "compras" | "seguridad" | "finanzas" | "documentos" | "auditoria";

// Matriz de permisos (sección 7 del análisis). Punto de partida configurable,
// no una definición legal ni estatutaria cerrada.
const MATRIX: Record<Role, Record<Module, Access>> = {
  socio: { obra: "read", trabajo: "read", compras: "none", seguridad: "read", finanzas: "read", documentos: "read", auditoria: "none" },
  comision_obra: { obra: "edit", trabajo: "read", compras: "edit", seguridad: "read", finanzas: "none", documentos: "read", auditoria: "none" },
  comision_trabajo: { obra: "read", trabajo: "edit", compras: "edit", seguridad: "read", finanzas: "none", documentos: "read", auditoria: "none" },
  comision_compras: { obra: "read", trabajo: "read", compras: "edit", seguridad: "read", finanzas: "read", documentos: "read", auditoria: "none" },
  comision_seguridad: { obra: "read", trabajo: "read", compras: "edit", seguridad: "edit", finanzas: "none", documentos: "read", auditoria: "none" },
  administracion: { obra: "read", trabajo: "read", compras: "read", seguridad: "read", finanzas: "edit", documentos: "edit", auditoria: "none" },
  tesoreria: { obra: "read", trabajo: "read", compras: "approve", seguridad: "read", finanzas: "approve", documentos: "read", auditoria: "read" },
  consejo_directivo: { obra: "approve", trabajo: "approve", compras: "approve", seguridad: "approve", finanzas: "approve", documentos: "edit", auditoria: "read" },
  fiscal: { obra: "read", trabajo: "read", compras: "read", seguridad: "read", finanzas: "read", documentos: "read", auditoria: "read" },
  tecnico: { obra: "edit", trabajo: "read", compras: "read", seguridad: "edit", finanzas: "none", documentos: "read", auditoria: "none" },
  admin: { obra: "config", trabajo: "config", compras: "config", seguridad: "config", finanzas: "config", documentos: "config", auditoria: "read" },
};

export function accessTo(role: Role, mod: Module): Access {
  return MATRIX[role]?.[mod] ?? "none";
}

export function canRead(role: Role, mod: Module) {
  return accessTo(role, mod) !== "none";
}
export function canEdit(role: Role, mod: Module) {
  return ["edit", "approve", "config"].includes(accessTo(role, mod));
}
export function canApprove(role: Role, mod: Module) {
  return ["approve", "config"].includes(accessTo(role, mod));
}

// Roles que pueden ver montos financieros detallados
export const ROLES_FINANZAS_DETALLE: Role[] = ["administracion", "tesoreria", "consejo_directivo", "fiscal", "admin"];
