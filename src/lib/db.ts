import { Pool } from "pg";

// Base de datos PostgreSQL (Supabase) — producción y desarrollo.
// Requiere la variable de entorno DATABASE_URL (connection string de Supabase).

declare global {
    // eslint-disable-next-line no-var
  var __coopPool: Pool | undefined;
}

function createPool(): Pool {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
          throw new Error(
                  "Falta la variable de entorno DATABASE_URL. Configurala en .env.local con el connection string de Supabase."
                );
    }
    return new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
    });
}

export const pool: Pool = global.__coopPool ?? createPool();
if (process.env.NODE_ENV !== "production") global.__coopPool = pool;

function toPgSql(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await pool.query(toPgSql(sql), params);
    return result.rows as T[];
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const result = await pool.query(toPgSql(sql), params);
    return (result.rows[0] as T) || undefined;
}

export async function run(sql: string, params: any[] = []) {
    return await pool.query(toPgSql(sql), params);
}

export async function insert(table: string, data: Record<string, any>): Promise<number> {
    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING id`;
    const values = keys.map((k) => {
          const v = data[k];
          return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    });
    const result = await pool.query(sql, values);
    return result.rows[0]?.id || 0;
}

export async function update(table: string, id: number, data: Record<string, any>): Promise<void> {
    const keys = Object.keys(data);
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const sql = `UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1}`;
    const values = [
          ...keys.map((k) => {
                  const v = data[k];
                  return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
          }),
          id,
        ];
    await pool.query(sql, values);
}

type AuditParams = {
    usuario_id: number;
    accion: string;
    entidad: string;
    entidad_id: number;
    valor_anterior?: any;
    valor_nuevo?: any;
};

export async function audit(params: AuditParams) {
    await insert("auditoria", {
          usuario_id: params.usuario_id,
          accion: params.accion,
          entidad: params.entidad,
          entidad_id: params.entidad_id,
          valor_anterior:
                  params.valor_anterior !== undefined && params.valor_anterior !== null
              ? typeof params.valor_anterior === "object"
                      ? JSON.stringify(params.valor_anterior)
                      : String(params.valor_anterior)
                    : null,
          valor_nuevo:
                  params.valor_nuevo !== undefined && params.valor_nuevo !== null
              ? typeof params.valor_nuevo === "object"
                      ? JSON.stringify(params.valor_nuevo)
                      : String(params.valor_nuevo)
                    : null,
    });
}

export const registrarAuditoria = audit;

type UpsertAlertaParams = {
    tipo: string;
    severidad: string;
    origen_modulo: string;
    titulo: string;
    descripcion?: string | null;
    asignado_a_rol?: string | null;
    ref_tabla?: string | null;
    ref_id?: number | null;
};

export async function upsertAlerta(params: UpsertAlertaParams): Promise<void> {
    const refTabla = params.ref_tabla ?? null;
    const refId = params.ref_id ?? null;
    const existente = await get<{ id: number }>(
          `SELECT id FROM alertas WHERE tipo = ? AND estado = 'abierta' AND COALESCE(ref_tabla, '') = COALESCE(?, '') AND COALESCE(ref_id, -1) = COALESCE(?, -1)`,
          [params.tipo, refTabla, refId]
        );
    if (existente) {
          await update("alertas", existente.id, {
                  severidad: params.severidad,
                  titulo: params.titulo,
                  descripcion: params.descripcion ?? null,
                  asignado_a_rol: params.asignado_a_rol ?? null,
          });
    } else {
          await insert("alertas", {
                  tipo: params.tipo,
                  severidad: params.severidad,
                  origen_modulo: params.origen_modulo,
                  titulo: params.titulo,
                  descripcion: params.descripcion ?? null,
                  asignado_a_rol: params.asignado_a_rol ?? null,
                  estado: "abierta",
                  ref_tabla: refTabla,
                  ref_id: refId,
          });
    }
}
