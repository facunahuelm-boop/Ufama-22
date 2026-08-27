"use server";

import { getCurrentUser } from "@/lib/auth";
import { all, get, insert } from "@/lib/db";
import { redirect } from "next/navigation";
import dayjs from "dayjs";

// Nota: Para producción, instala: npm install jspdf html2canvas xlsx
// Por ahora este es un framework que genera CSV/JSON y puede expandirse a PDF/Excel

export async function generarReporteObraAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const formato = formData.get("formato") as string;

  try {
    // Obtener datos de la obra
    const tareas = all<any>(
      `SELECT t.*, u.nombre as responsable_nombre FROM tareas_obra t
       LEFT JOIN users u ON u.id = t.responsable_id
       ORDER BY t.fecha_inicio ASC`
    );

    const avances = all<any>(
      `SELECT a.*, u.nombre as autor_nombre FROM avances_obra a
       LEFT JOIN users u ON u.id = a.autor_id
       ORDER BY a.fecha DESC LIMIT 20`
    );

    const problemas = all<any>(
      `SELECT p.*, u.nombre as autor_nombre FROM problemas_obra p
       LEFT JOIN users u ON u.id = p.autor_id
       WHERE p.estado = 'abierto'`
    );

    const data = {
      titulo: `Reporte de Obra - ${dayjs().format("MMMM YYYY", { locale: "es" })}`,
      fecha_generacion: dayjs().format("DD/MM/YYYY HH:mm"),
      generado_por: user.nombre,
      resumen: {
        total_tareas: tareas.length,
        tareas_completadas: tareas.filter((t: any) => t.estado === "completada").length,
        tareas_en_curso: tareas.filter((t: any) => t.estado === "en_curso").length,
        tareas_pendientes: tareas.filter((t: any) => t.estado === "pendiente").length,
        problemas_abiertos: problemas.length,
      },
      tareas: tareas.slice(0, 50),
      avances_recientes: avances,
      problemas_abiertos: problemas,
    };

    // Guardar en BD
    const reporteId = insert("reportes_generados", {
      nombre_reporte: data.titulo,
      tipo: "obra",
      formato,
      contenido_json: JSON.stringify(data),
      creado_por_id: user.id,
      archivo_url: null,
    });

    // Por ahora, devolvemos JSON. En producción:
    // - Si formato === "pdf": usar jspdf para generar PDF
    // - Si formato === "xlsx": usar xlsx para generar Excel
    // - Guardar archivo en public/reportes/
    // - Actualizar archivo_url en BD

    return { success: true, reporteId, data };
  } catch (e) {
    console.error("Error generando reporte:", e);
    return { success: false, error: String(e) };
  }
}

export async function generarReporteFinanzasAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const formato = formData.get("formato") as string;

  try {
    const movimientos = all<any>(
      `SELECT * FROM movimientos_finanzas ORDER BY fecha DESC LIMIT 100`
    );

    const compromisos = all<any>(
      `SELECT SUM(monto) as total_comprometido FROM movimientos_finanzas WHERE tipo = 'compromiso' AND activo = 1`
    );

    const ingresos = all<any>(
      `SELECT SUM(monto) as total FROM movimientos_finanzas WHERE tipo = 'ingreso'`
    );

    const egresos = all<any>(
      `SELECT SUM(monto) as total FROM movimientos_finanzas WHERE tipo = 'egreso'`
    );

    const saldoBancario = (ingresos[0]?.total || 0) - (egresos[0]?.total || 0);
    const disponible = saldoBancario - (compromisos[0]?.total_comprometido || 0);

    const data = {
      titulo: `Reporte Financiero - ${dayjs().format("MMMM YYYY", { locale: "es" })}`,
      fecha_generacion: dayjs().format("DD/MM/YYYY HH:mm"),
      generado_por: user.nombre,
      resumen: {
        saldo_bancario: saldoBancario,
        comprometido: compromisos[0]?.total_comprometido || 0,
        disponible_prudencial: disponible,
        total_ingresos: ingresos[0]?.total || 0,
        total_egresos: egresos[0]?.total || 0,
      },
      movimientos_recientes: movimientos.slice(0, 50),
    };

    const reporteId = insert("reportes_generados", {
      nombre_reporte: data.titulo,
      tipo: "finanzas",
      formato,
      contenido_json: JSON.stringify(data),
      creado_por_id: user.id,
      archivo_url: null,
    });

    return { success: true, reporteId, data };
  } catch (e) {
    console.error("Error generando reporte:", e);
    return { success: false, error: String(e) };
  }
}

export async function generarReporteTrabajoAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const formato = formData.get("formato") as string;

  try {
    const jornadas = all<any>(
      `SELECT * FROM jornadas_trabajo ORDER BY fecha DESC LIMIT 12`
    );

    const asistencias = all<any>(
      `SELECT n.nombre, SUM(a.horas) as horas_totales, COUNT(*) as jornadas_asistidas
       FROM asistencias a
       JOIN nucleos_familiares n ON n.id = a.nucleo_id
       GROUP BY a.nucleo_id
       ORDER BY horas_totales DESC`
    );

    const data = {
      titulo: `Reporte de Jornadas de Trabajo - ${dayjs().format("MMMM YYYY", { locale: "es" })}`,
      fecha_generacion: dayjs().format("DD/MM/YYYY HH:mm"),
      generado_por: user.nombre,
      resumen: {
        jornadas_registradas: jornadas.length,
        nucleos_activos: asistencias.length,
        horas_totales_trabajadas: asistencias.reduce((sum: any, n: any) => sum + (n.horas_totales || 0), 0),
      },
      jornadas: jornadas,
      participacion_nucleos: asistencias,
    };

    const reporteId = insert("reportes_generados", {
      nombre_reporte: data.titulo,
      tipo: "trabajo",
      formato,
      contenido_json: JSON.stringify(data),
      creado_por_id: user.id,
      archivo_url: null,
    });

    return { success: true, reporteId, data };
  } catch (e) {
    console.error("Error generando reporte:", e);
    return { success: false, error: String(e) };
  }
}
