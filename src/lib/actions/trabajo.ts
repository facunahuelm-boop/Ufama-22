"use server";

import { revalidatePath } from "next/cache";
import { insert, update, get, audit } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/roles";
import { proponerDistribucionJornada } from "@/lib/logic";

export async function crearJornadaAction(formData: FormData) {
  const user = await requireUser();
  if (!canEdit(user.rol, "trabajo")) throw new Error("No autorizado");
  const id = insert("jornadas_trabajo", {
    fecha: String(formData.get("fecha") || ""),
    descripcion: String(formData.get("descripcion") || "") || null,
    herramientas_necesarias: String(formData.get("herramientas_necesarias") || "") || null,
    estado: "planificada",
  });
  const nombres = String(formData.get("tareas") || "").split("\n").map((s) => s.trim()).filter(Boolean);
  nombres.forEach((nombre) => insert("tareas_jornada", { jornada_id: id, nombre, prioridad: "media", personas_necesarias: 3 }));
  revalidatePath("/trabajo");
}

export async function proponerDistribucionAction(formData: FormData) {
  const user = await requireUser();
  if (!canEdit(user.rol, "trabajo")) throw new Error("No autorizado");
  const jornadaId = Number(formData.get("jornada_id"));
  proponerDistribucionJornada(jornadaId);
  revalidatePath("/trabajo");
}

export async function confirmarAsignacionAction(formData: FormData) {
  const user = await requireUser();
  if (!canEdit(user.rol, "trabajo")) throw new Error("No autorizado");
  const id = Number(formData.get("id"));
  update("asignaciones_jornada", id, { confirmado: 1 });
  revalidatePath("/trabajo");
}

export async function anotarmeAction(formData: FormData) {
  const user = await requireUser();
  if (!user.nucleo_id) throw new Error("Tu usuario no tiene un núcleo familiar asociado.");
  const tareaJornadaId = Number(formData.get("tarea_jornada_id"));
  const jornadaId = Number(formData.get("jornada_id"));
  insert("asignaciones_jornada", { jornada_id: jornadaId, tarea_jornada_id: tareaJornadaId, nucleo_id: user.nucleo_id, propuesta_por_ia: 0, confirmado: 1 });
  revalidatePath("/trabajo");
}

export async function registrarAsistenciaAction(formData: FormData) {
  const user = await requireUser();
  if (!canEdit(user.rol, "trabajo")) throw new Error("No autorizado");
  const jornadaId = Number(formData.get("jornada_id"));
  const nucleoId = Number(formData.get("nucleo_id"));
  const presente = formData.get("presente") === "on" ? 1 : 0;
  const horas = Number(formData.get("horas") || 0);
  const existing = get<any>(`SELECT id FROM asistencias WHERE jornada_id = ? AND nucleo_id = ?`, [jornadaId, nucleoId]);
  if (existing) {
    update("asistencias", existing.id, { presente, horas });
  } else {
    insert("asistencias", { jornada_id: jornadaId, nucleo_id: nucleoId, presente, horas });
  }
  if (presente && horas > 0) {
    const nucleo = get<any>(`SELECT * FROM nucleos_familiares WHERE id = ?`, [nucleoId]);
    update("nucleos_familiares", nucleoId, { horas_acumuladas: (nucleo?.horas_acumuladas || 0) + horas });
  }
  audit({ usuario_id: user.id, accion: "registrar_asistencia", entidad: "asistencias", entidad_id: nucleoId, valor_nuevo: { jornadaId, presente, horas } });
  revalidatePath(`/trabajo/${jornadaId}`);
}

export async function marcarJornadaRealizadaAction(formData: FormData) {
  const user = await requireUser();
  if (!canEdit(user.rol, "trabajo")) throw new Error("No autorizado");
  const id = Number(formData.get("id"));
  update("jornadas_trabajo", id, { estado: "realizada" });
  revalidatePath("/trabajo");
  revalidatePath(`/trabajo/${id}`);
}
