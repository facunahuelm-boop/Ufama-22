import dayjs from "dayjs";
import { all, get, upsertAlerta, insert } from "./db";

// ============ SEMÁFORO DE OBRA ============
export type Semaforo = "verde" | "amarillo" | "rojo";

export function semaforoTarea(tarea: {
  estado: string;
  fecha_fin_prevista: string | null;
  id: number;
}): Semaforo {
  if (tarea.estado === "completada") return "verde";
  const problemasCriticos = get<{ n: number }>(
    `SELECT COUNT(*) as n FROM problemas_obra WHERE tarea_id = ? AND estado = 'abierto' AND severidad = 'critica'`,
    [tarea.id]
  );
  if (problemasCriticos && problemasCriticos.n > 0) return "rojo";

  if (tarea.fecha_fin_prevista) {
    const dias = dayjs(tarea.fecha_fin_prevista).diff(dayjs(), "day");
    if (dias < 0) return "rojo";
    if (dias <= 5) return "amarillo";
  }
  const problemasAbiertos = get<{ n: number }>(
    `SELECT COUNT(*) as n FROM problemas_obra WHERE tarea_id = ? AND estado = 'abierto'`,
    [tarea.id]
  );
  if (problemasAbiertos && problemasAbiertos.n > 0) return "amarillo";
  return "verde";
}

export function tareasObraConSemaforo() {
  const tareas = all<any>(
    `SELECT t.*, u.nombre as responsable_nombre, d.nombre as depende_de_nombre
     FROM tareas_obra t
     LEFT JOIN users u ON u.id = t.responsable_id
     LEFT JOIN tareas_obra d ON d.id = t.depende_de_id
     ORDER BY t.fecha_fin_prevista ASC`
  );
  return tareas.map((t) => ({ ...t, semaforo: semaforoTarea(t) }));
}

// ============ FINANZAS ============
export function resumenFinanciero() {
  const ingresos = get<{ s: number }>(`SELECT COALESCE(SUM(monto),0) as s FROM movimientos_financieros WHERE tipo = 'ingreso'`)?.s ?? 0;
  const egresos = get<{ s: number }>(`SELECT COALESCE(SUM(monto),0) as s FROM movimientos_financieros WHERE tipo = 'egreso'`)?.s ?? 0;
  const saldo = ingresos - egresos;

  const comprometido = get<{ s: number }>(`SELECT COALESCE(SUM(monto),0) as s FROM compromisos_futuros`)?.s ?? 0;

  const en30dias = dayjs().add(30, "day").format("YYYY-MM-DD");
  const gastosProyectados = get<{ s: number }>(
    `SELECT COALESCE(SUM(monto),0) as s FROM compromisos_futuros WHERE fecha_estimada <= ?`,
    [en30dias]
  )?.s ?? 0;

  const disponiblePrudencial = saldo - comprometido;

  const porCategoria = all<{ categoria: string; total: number }>(
    `SELECT categoria, COALESCE(SUM(monto),0) as total FROM movimientos_financieros WHERE tipo='egreso' GROUP BY categoria ORDER BY total DESC`
  );

  const presupuestoVsReal = all<any>(
    `SELECT p.categoria, p.monto_presupuestado,
       COALESCE((SELECT SUM(monto) FROM movimientos_financieros m WHERE m.categoria = p.categoria AND m.tipo='egreso'), 0) as gastado
     FROM presupuesto_general p`
  );

  return { ingresos, egresos, saldo, comprometido, gastosProyectados, disponiblePrudencial, porCategoria, presupuestoVsReal };
}

// ============ MOTOR DE ALERTAS ============
// Recalcula alertas automáticas a partir de los datos actuales.
// Los umbrales son un punto de partida configurable (ver sección 12 del análisis).
export function recalcularAlertas() {
  // Documentos de seguridad vencidos / próximos a vencer
  const docs = all<any>(`SELECT * FROM documentos_seguridad WHERE fecha_vencimiento IS NOT NULL`);
  const hoy = dayjs();
  docs.forEach((d) => {
    const dias = dayjs(d.fecha_vencimiento).diff(hoy, "day");
    if (dias < 0) {
      upsertAlerta({
        tipo: "documento_vencido",
        severidad: "critica",
        origen_modulo: "seguridad",
        titulo: `Documento vencido: ${d.tipo}`,
        descripcion: `${d.descripcion || d.tipo} venció el ${d.fecha_vencimiento}.`,
        asignado_a_rol: "comision_seguridad",
        ref_tabla: "documentos_seguridad",
        ref_id: d.id,
      });
    } else if (dias <= 15) {
      upsertAlerta({
        tipo: "documento_por_vencer",
        severidad: "importante",
        origen_modulo: "seguridad",
        titulo: `Documento próximo a vencer: ${d.tipo}`,
        descripcion: `${d.descripcion || d.tipo} vence el ${d.fecha_vencimiento} (${dias} días).`,
        asignado_a_rol: "comision_seguridad",
        ref_tabla: "documentos_seguridad",
        ref_id: d.id,
      });
    }
  });

  // Incidentes de seguridad críticos abiertos
  const incidentesCriticos = all<any>(
    `SELECT * FROM incidentes_seguridad WHERE estado != 'resuelto' AND severidad = 'critica'`
  );
  incidentesCriticos.forEach((i) => {
    upsertAlerta({
      tipo: "riesgo_critico",
      severidad: "critica",
      origen_modulo: "seguridad",
      titulo: "Riesgo crítico de seguridad abierto",
      descripcion: i.descripcion,
      asignado_a_rol: "consejo_directivo",
      ref_tabla: "incidentes_seguridad",
      ref_id: i.id,
    });
  });

  // Tareas de obra atrasadas
  const tareas = tareasObraConSemaforo();
  tareas.forEach((t: any) => {
    if (t.semaforo === "rojo" && t.estado !== "completada") {
      const dias = t.fecha_fin_prevista ? -dayjs(t.fecha_fin_prevista).diff(dayjs(), "day") : null;
      upsertAlerta({
        tipo: "tarea_atrasada",
        severidad: t.prioridad === "critica" ? "critica" : "importante",
        origen_modulo: "obra",
        titulo: `Tarea atrasada: ${t.nombre}`,
        descripcion: dias ? `Lleva ${dias} día(s) de atraso.` : "Tiene un problema crítico abierto.",
        asignado_a_rol: "comision_obra",
        ref_tabla: "tareas_obra",
        ref_id: t.id,
      });
    }
  });

  // Problemas de obra críticos abiertos
  const problemas = all<any>(`SELECT * FROM problemas_obra WHERE estado='abierto' AND severidad='critica'`);
  problemas.forEach((p) => {
    upsertAlerta({
      tipo: "problema_critico",
      severidad: "critica",
      origen_modulo: "obra",
      titulo: `Problema crítico abierto: ${p.titulo}`,
      descripcion: p.descripcion,
      asignado_a_rol: "consejo_directivo",
      ref_tabla: "problemas_obra",
      ref_id: p.id,
    });
  });

  // Compras pendientes de aprobación vinculadas a tarea crítica/alta prioridad
  const solicitudes = all<any>(
    `SELECT * FROM solicitudes_compra WHERE estado IN ('pendiente_cotizacion','en_comparacion')`
  );
  solicitudes.forEach((s) => {
    if (s.prioridad === "critica" || s.prioridad === "alta") {
      upsertAlerta({
        tipo: "compra_pendiente_critica",
        severidad: s.prioridad === "critica" ? "critica" : "importante",
        origen_modulo: "compras",
        titulo: `Compra prioritaria sin resolver: ${s.material}`,
        descripcion: `Solicitada por ${s.comision}, prioridad ${s.prioridad}.`,
        asignado_a_rol: "comision_compras",
        ref_tabla: "solicitudes_compra",
        ref_id: s.id,
      });
    }
  });

  // Finanzas: disponible prudencial bajo o negativo
  const fin = resumenFinanciero();
  if (fin.disponiblePrudencial < 0) {
    upsertAlerta({
      tipo: "disponible_negativo",
      severidad: "critica",
      origen_modulo: "finanzas",
      titulo: "El disponible prudencial es negativo",
      descripcion: `Saldo $${fin.saldo.toLocaleString("es-UY")} menos comprometido $${fin.comprometido.toLocaleString("es-UY")} da un disponible negativo.`,
      asignado_a_rol: "tesoreria",
      ref_tabla: "movimientos_financieros",
    });
  } else if (fin.disponiblePrudencial < fin.gastosProyectados) {
    upsertAlerta({
      tipo: "disponible_bajo",
      severidad: "importante",
      origen_modulo: "finanzas",
      titulo: "El disponible prudencial es menor a los gastos proyectados a 30 días",
      descripcion: `Disponible $${fin.disponiblePrudencial.toLocaleString("es-UY")} vs. proyectado $${fin.gastosProyectados.toLocaleString("es-UY")}.`,
      asignado_a_rol: "tesoreria",
      ref_tabla: "movimientos_financieros",
    });
  }

  // Presupuesto vs real: desviación > 15%
  fin.presupuestoVsReal.forEach((p: any) => {
    if (p.monto_presupuestado > 0) {
      const desv = (p.gastado - p.monto_presupuestado) / p.monto_presupuestado;
      if (desv > 0.15) {
        upsertAlerta({
          tipo: "desvio_presupuesto",
          severidad: desv > 0.3 ? "critica" : "importante",
          origen_modulo: "finanzas",
          titulo: `Desviación de presupuesto en ${p.categoria}`,
          descripcion: `Gastado $${p.gastado.toLocaleString("es-UY")} vs. presupuestado $${p.monto_presupuestado.toLocaleString("es-UY")} (${Math.round(desv * 100)}% de más).`,
          asignado_a_rol: "tesoreria",
          ref_tabla: "presupuesto_general",
        });
      }
    }
  });

  // Jornada próxima con tareas sin cubrir
  const proximaJornada = get<any>(
    `SELECT * FROM jornadas_trabajo WHERE fecha >= date('now') AND estado='planificada' ORDER BY fecha ASC LIMIT 1`
  );
  if (proximaJornada) {
    const tareasJ = all<any>(`SELECT * FROM tareas_jornada WHERE jornada_id = ?`, [proximaJornada.id]);
    tareasJ.forEach((tj) => {
      const asignados = get<{ n: number }>(
        `SELECT COUNT(*) as n FROM asignaciones_jornada WHERE tarea_jornada_id = ?`,
        [tj.id]
      )?.n ?? 0;
      if (asignados < tj.personas_necesarias) {
        upsertAlerta({
          tipo: "tarea_jornada_sin_cubrir",
          severidad: "importante",
          origen_modulo: "trabajo",
          titulo: `Tarea sin cubrir en la próxima jornada: ${tj.nombre}`,
          descripcion: `Necesita ${tj.personas_necesarias}, asignados ${asignados}.`,
          asignado_a_rol: "comision_trabajo",
          ref_tabla: "tareas_jornada",
          ref_id: tj.id,
        });
      }
    });
  }
}

// ============ COMPARACIÓN DE PRESUPUESTOS (motor local, sin LLM) ============
export function compararPresupuestos(solicitudId: number) {
  const presupuestos = all<any>(
    `SELECT pp.*, pv.nombre as proveedor_nombre
     FROM presupuestos_proveedor pp JOIN proveedores pv ON pv.id = pp.proveedor_id
     WHERE pp.solicitud_id = ?`,
    [solicitudId]
  );
  if (presupuestos.length === 0) {
    return { texto: "Todavía no hay presupuestos cargados para esta solicitud.", presupuestos: [] };
  }

  const masBarato = [...presupuestos].sort((a, b) => (a.precio + (a.costo_envio || 0)) - (b.precio + (b.costo_envio || 0)))[0];
  const masRapido = [...presupuestos].filter((p) => p.plazo_entrega_dias != null).sort((a, b) => a.plazo_entrega_dias - b.plazo_entrega_dias)[0];
  const conGarantia = presupuestos.filter((p) => p.garantia && p.garantia.trim().length > 0 && !/^no/i.test(p.garantia.trim()));

  const lineas: string[] = [];
  lineas.push(`Comparación entre ${presupuestos.length} presupuesto(s) cargados:`);
  presupuestos.forEach((p) => {
    const total = p.precio + (p.costo_envio || 0);
    lineas.push(
      `• ${p.proveedor_nombre}: $${p.precio.toLocaleString("es-UY")}${p.costo_envio ? ` + $${p.costo_envio.toLocaleString("es-UY")} de envío (total $${total.toLocaleString("es-UY")})` : ""}${p.plazo_entrega_dias != null ? `, entrega en ${p.plazo_entrega_dias} días` : ""}${p.forma_pago ? `, pago: ${p.forma_pago}` : ""}${p.garantia ? `, garantía: ${p.garantia}` : ", sin garantía informada"}.`
    );
  });

  lineas.push("");
  lineas.push(`Proveedor ${masBarato.proveedor_nombre} es el más barato en total (precio + envío).`);
  if (masRapido) lineas.push(`Proveedor ${masRapido.proveedor_nombre} ofrece el plazo de entrega más corto (${masRapido.plazo_entrega_dias} días).`);
  if (conGarantia.length > 0 && masBarato.id !== conGarantia[0].id) {
    lineas.push(`${conGarantia.map((p) => p.proveedor_nombre).join(", ")} ofrece(n) garantía explícita, lo que puede compensar un precio algo mayor.`);
  }
  if (presupuestos.length < 3) {
    lineas.push("");
    lineas.push("Nota: hay menos de tres presupuestos cargados. La buena práctica recomendada para compras relevantes es comparar al menos tres antes de decidir.");
  }
  lineas.push("");
  lineas.push("Esta comparación es una vista objetiva de los datos cargados, no una recomendación de a quién comprarle: la decisión final le corresponde a la persona u órgano con esa atribución.");

  return { texto: lineas.join("\n"), presupuestos, masBarato, masRapido };
}

// ============ PROPUESTA DE DISTRIBUCIÓN DE JORNADA (IA local) ============
// Arma un borrador de asignación de núcleos a tareas según habilidades,
// prioridad y disponibilidad. Siempre queda como propuesta editable
// (confirmado = 0) hasta que la Comisión de Trabajo la confirme.
export function proponerDistribucionJornada(jornadaId: number) {
  const tareas = all<any>(`SELECT * FROM tareas_jornada WHERE jornada_id = ? ORDER BY CASE prioridad WHEN 'alta' THEN 0 WHEN 'critica' THEN -1 ELSE 1 END`, [jornadaId]);
  const yaAsignados = new Set(all<any>(`SELECT nucleo_id FROM asignaciones_jornada WHERE jornada_id = ?`, [jornadaId]).map((a) => a.nucleo_id));
  const nucleos = all<any>(`SELECT * FROM nucleos_familiares`).filter((n) => !yaAsignados.has(n.id));
  const habilidades = all<any>(`SELECT * FROM habilidades_nucleo`);

  const propuestas: { tarea: string; nucleo: string; motivo: string }[] = [];

  tareas.forEach((t) => {
    const yaEnEstaTarea = all<any>(`SELECT * FROM asignaciones_jornada WHERE tarea_jornada_id = ?`, [t.id]).length;
    let faltan = t.personas_necesarias - yaEnEstaTarea;
    if (faltan <= 0) return;

    // 1) priorizar núcleos con la habilidad requerida
    if (t.habilidad_requerida) {
      const conHabilidad = nucleos.filter((n) => habilidades.some((h) => h.nucleo_id === n.id && h.habilidad === t.habilidad_requerida) && !yaAsignados.has(n.id));
      for (const n of conHabilidad) {
        if (faltan <= 0) break;
        insert("asignaciones_jornada", { jornada_id: jornadaId, tarea_jornada_id: t.id, nucleo_id: n.id, propuesta_por_ia: 1, confirmado: 0 });
        propuestas.push({ tarea: t.nombre, nucleo: n.nombre, motivo: `tiene la habilidad "${t.habilidad_requerida}" registrada` });
        yaAsignados.add(n.id);
        faltan--;
      }
    }
    // 2) completar con cualquier núcleo disponible
    const disponibles = nucleos.filter((n) => !yaAsignados.has(n.id));
    for (const n of disponibles) {
      if (faltan <= 0) break;
      insert("asignaciones_jornada", { jornada_id: jornadaId, tarea_jornada_id: t.id, nucleo_id: n.id, propuesta_por_ia: 1, confirmado: 0 });
      propuestas.push({ tarea: t.nombre, nucleo: n.nombre, motivo: "disponible para la jornada, sin habilidad específica requerida" });
      yaAsignados.add(n.id);
      faltan--;
    }
  });

  return propuestas;
}

export function historialProveedor(proveedorId: number) {
  const compras = all<any>(
    `SELECT sc.material, dc.monto, dc.fecha, sc.id as solicitud_id
     FROM decisiones_compra dc
     JOIN presupuestos_proveedor pp ON pp.id = dc.presupuesto_id
     JOIN solicitudes_compra sc ON sc.id = dc.solicitud_id
     WHERE pp.proveedor_id = ?
     ORDER BY dc.fecha DESC`,
    [proveedorId]
  );
  return compras;
}
