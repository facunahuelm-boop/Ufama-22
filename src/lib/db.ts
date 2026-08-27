import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Base de datos SQLite local (desarrollo / demo).
// Para producción, migrar a PostgreSQL (Supabase): ver README.md "Migrar a Supabase".

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "coop.db");

declare global {
  // eslint-disable-next-line no-var
  var __coopDb: DatabaseSync | undefined;
}

function createDb(): DatabaseSync {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  const schema = fs.readFileSync(path.join(process.cwd(), "src/lib/schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

// Reutilizar la conexión entre recargas en desarrollo (hot reload de Next.js)
export const db: DatabaseSync = global.__coopDb ?? createDb();
if (process.env.NODE_ENV !== "production") global.__coopDb = db;

// ---------- helpers genéricos ----------

export function all<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

export function get<T = any>(sql: string, params: any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function run(sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/** Inserta y devuelve el id autogenerado */
export function insert(table: string, data: Record<string, any>): number {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
  const result = run(sql, keys.map((k) => data[k] ?? null));
  return Number(result.lastInsertRowid);
}

export function update(table: string, id: number, data: Record<string, any>) {
  const keys = Object.keys(data);
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  return run(sql, [...keys.map((k) => data[k] ?? null), id]);
}

/** Registro de auditoría de solo agregado. Nunca se edita ni se borra desde la aplicación. */
export function audit(params: {
  usuario_id: number | null;
  accion: string;
  entidad: string;
  entidad_id?: number | null;
  valor_anterior?: any;
  valor_nuevo?: any;
}) {
  insert("auditoria", {
    usuario_id: params.usuario_id,
    accion: params.accion,
    entidad: params.entidad,
    entidad_id: params.entidad_id ?? null,
    valor_anterior: params.valor_anterior ? JSON.stringify(params.valor_anterior) : null,
    valor_nuevo: params.valor_nuevo ? JSON.stringify(params.valor_nuevo) : null,
  });
}

/** Crea una alerta si todavía no existe una abierta igual (misma ref) */
export function upsertAlerta(a: {
  tipo: string;
  severidad: "critica" | "importante" | "informativa";
  origen_modulo: string;
  titulo: string;
  descripcion?: string;
  asignado_a_rol?: string;
  ref_tabla?: string;
  ref_id?: number;
}) {
  const existing = get(
    `SELECT id FROM alertas WHERE tipo = ? AND ref_tabla IS ? AND ref_id IS ? AND estado = 'abierta'`,
    [a.tipo, a.ref_tabla ?? null, a.ref_id ?? null]
  );
  if (existing) return;
  insert("alertas", {
    tipo: a.tipo,
    severidad: a.severidad,
    origen_modulo: a.origen_modulo,
    titulo: a.titulo,
    descripcion: a.descripcion ?? null,
    asignado_a_rol: a.asignado_a_rol ?? null,
    estado: "abierta",
    ref_tabla: a.ref_tabla ?? null,
    ref_id: a.ref_id ?? null,
  });
}
