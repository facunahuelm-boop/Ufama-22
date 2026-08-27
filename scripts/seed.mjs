// Carga datos de ejemplo para probar el sistema (no son datos reales).
// Ejecutar con: npm run seed
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "coop.db");

// Empezar de cero para que la demo sea reproducible
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(fs.readFileSync(path.join(ROOT, "src/lib/schema.sql"), "utf8"));

function insert(table, data) {
  const keys = Object.keys(data);
  const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`);
  const info = stmt.run(...keys.map((k) => data[k] ?? null));
  return Number(info.lastInsertRowid);
}

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// ================= NÚCLEOS FAMILIARES =================
const nucleosData = [
  ["Núcleo Pérez", 20],
  ["Núcleo Silva", 18],
  ["Núcleo Gómez", 22],
  ["Núcleo Rodríguez", 20],
  ["Núcleo Fernández", 19],
  ["Núcleo Castro", 21],
  ["Núcleo Núñez", 20],
  ["Núcleo Ramírez", 18],
  ["Núcleo Sosa", 20],
  ["Núcleo López", 20],
  ["Núcleo Martínez", 15],
  ["Núcleo Acosta", 20],
];
const nucleos = nucleosData.map(([nombre, horas]) => insert("nucleos_familiares", { nombre, cuota_social: 0, horas_acumuladas: horas }));

// Habilidades por núcleo (para que la IA de Trabajo tenga con qué proponer)
const habilidadesPorNucleo = {
  0: ["pintura"], 1: ["electricidad"], 2: ["albañilería"], 3: ["plomería"],
  4: ["electricidad"], 5: ["pintura"], 6: ["carpintería"], 7: ["albañilería"],
  8: ["plomería"], 9: ["pintura"], 10: ["electricidad"], 11: ["albañilería"],
};
Object.entries(habilidadesPorNucleo).forEach(([idx, habs]) => {
  habs.forEach((h) => insert("habilidades_nucleo", { nucleo_id: nucleos[idx], habilidad: h }));
});

// ================= USUARIOS =================
const PASSWORD = "cooperativa2026";
const hash = bcrypt.hashSync(PASSWORD, 10);

const usersData = [
  ["Ana Pérez", "ana@coop.uy", "socio", 0],
  ["Beatriz Silva", "beatriz@coop.uy", "comision_obra", 1],
  ["Carlos Gómez", "carlos@coop.uy", "comision_trabajo", 2],
  ["Diana Rodríguez", "diana@coop.uy", "comision_compras", 3],
  ["Eduardo Fernández", "eduardo@coop.uy", "comision_seguridad", 4],
  ["Florencia Castro", "florencia@coop.uy", "administracion", 5],
  ["Gonzalo Núñez", "gonzalo@coop.uy", "tesoreria", 6],
  ["Helena Ramírez", "helena@coop.uy", "consejo_directivo", 7],
  ["Ignacio Sosa", "ignacio@coop.uy", "fiscal", 8],
  ["Arq. Julia Méndez (IAT)", "julia@coop.uy", "tecnico", null],
  ["Administrador del sistema", "admin@coop.uy", "admin", null],
];
const users = {};
usersData.forEach(([nombre, email, rol, nucleoIdx]) => {
  const id = insert("users", {
    nombre, email, password_hash: hash, rol,
    nucleo_id: nucleoIdx === null ? null : nucleos[nucleoIdx],
    activo: 1,
  });
  users[email] = id;
});

// ================= OBRA =================
const etapas = ["Cimientos", "Estructura", "Mampostería", "Instalaciones", "Terminaciones"];
const tareasData = [
  ["Cimientos", "Excavación y armado de zapatas", -60, -50, "completada", "media"],
  ["Cimientos", "Hormigonado de cimientos", -50, -42, "completada", "media"],
  ["Estructura", "Columnas planta baja", -42, -28, "completada", "alta"],
  ["Estructura", "Losa entrepiso", -28, -14, "completada", "alta"],
  ["Estructura", "Columnas planta alta", -14, -2, "en_curso", "alta"],
  ["Estructura", "Losa de techo", -2, 10, "en_curso", "critica"],
  ["Mampostería", "Muros exteriores bloque 1", 5, 20, "pendiente", "media"],
  ["Mampostería", "Muros exteriores bloque 2", 15, 30, "pendiente", "media"],
  ["Mampostería", "Muros interiores", 25, 40, "pendiente", "baja"],
  ["Instalaciones", "Instalación sanitaria bloque 1", 30, 45, "pendiente", "alta"],
  ["Instalaciones", "Instalación eléctrica bloque 1", 35, 50, "pendiente", "alta"],
  ["Instalaciones", "Instalación de agua potable", 40, 55, "pendiente", "media"],
  ["Terminaciones", "Revoques exteriores", 50, 70, "pendiente", "media"],
  ["Terminaciones", "Contrapisos y pisos", 60, 80, "pendiente", "media"],
  ["Terminaciones", "Pintura general", 75, 95, "pendiente", "baja"],
];
const tareas = [];
tareasData.forEach(([etapa, nombre, ini, fin, estado, prioridad], i) => {
  const id = insert("tareas_obra", {
    etapa, nombre,
    descripcion: `${nombre} — etapa ${etapa}.`,
    responsable_id: users["beatriz@coop.uy"],
    fecha_inicio: iso(addDays(today, ini)),
    fecha_fin_prevista: iso(addDays(today, fin)),
    estado, prioridad,
    depende_de_id: null,
  });
  tareas.push(id);
});
// dependencias simples: losa de techo depende de columnas planta alta; muros exteriores dependen de losa de techo
db.prepare(`UPDATE tareas_obra SET depende_de_id = ? WHERE id = ?`).run(tareas[4], tareas[5]);
db.prepare(`UPDATE tareas_obra SET depende_de_id = ? WHERE id = ?`).run(tareas[5], tareas[6]);
db.prepare(`UPDATE tareas_obra SET depende_de_id = ? WHERE id = ?`).run(tareas[5], tareas[7]);

// Forzamos que "Losa de techo" quede atrasada (crítica) a propósito para la demo
db.prepare(`UPDATE tareas_obra SET fecha_fin_prevista = ? WHERE id = ?`).run(iso(addDays(today, -3)), tareas[5]);

// avances
insert("avances_obra", { tarea_id: tareas[3], autor_id: users["beatriz@coop.uy"], fecha: iso(addDays(today, -13)), descripcion: "Losa de entrepiso hormigonada sin observaciones." });
insert("avances_obra", { tarea_id: tareas[4], autor_id: users["beatriz@coop.uy"], fecha: iso(addDays(today, -5)), descripcion: "Avance 70% de columnas de planta alta. Falta encofrado de 4 columnas." });

// problemas
insert("problemas_obra", {
  tarea_id: tareas[5], titulo: "Demora en entrega de hierro para losa de techo",
  descripcion: "El proveedor de hierro avisó un atraso de 10 días en la entrega, lo que retrasa el inicio del armado de la losa de techo.",
  severidad: "critica", estado: "abierto", autor_id: users["beatriz@coop.uy"], fecha: iso(addDays(today, -4)),
});
insert("problemas_obra", {
  tarea_id: tareas[6], titulo: "Falta definir detalle de mampostería en encuentro con caja de escalera",
  descripcion: "El IAT tiene que confirmar el detalle constructivo antes de avanzar con los muros exteriores del bloque 1.",
  severidad: "media", estado: "abierto", autor_id: users["beatriz@coop.uy"], fecha: iso(addDays(today, -1)),
});

// ================= TRABAJO =================
const jornadaIds = [];
for (let semanasAtras = 8; semanasAtras >= 1; semanasAtras--) {
  const fecha = iso(addDays(today, -semanasAtras * 7));
  const jid = insert("jornadas_trabajo", { fecha, descripcion: "Jornada de ayuda mutua", herramientas_necesarias: "Palas, baldes, nivel, andamios", estado: "realizada" });
  jornadaIds.push(jid);
  nucleos.forEach((nid, idx) => {
    const presente = Math.random() > 0.15 ? 1 : 0;
    insert("asistencias", { jornada_id: jid, nucleo_id: nid, presente, horas: presente ? 3 : 0, justificacion: presente ? null : "Falta justificada por trabajo" });
  });
}
// Próxima jornada (futura) con tareas y algunas asignaciones, dejando una sin cubrir a propósito
const proximaFecha = iso(addDays(today, (6 - today.getDay() + 7) % 7 || 7));
const proximaJornada = insert("jornadas_trabajo", { fecha: proximaFecha, descripcion: "Avance de estructura y orden de obra", herramientas_necesarias: "Andamios, taladro, nivel láser", estado: "planificada" });
const tj1 = insert("tareas_jornada", { jornada_id: proximaJornada, nombre: "Encofrado de columnas restantes", habilidad_requerida: "albañilería", prioridad: "alta", personas_necesarias: 6 });
const tj2 = insert("tareas_jornada", { jornada_id: proximaJornada, nombre: "Orden y limpieza general de obra", habilidad_requerida: null, prioridad: "media", personas_necesarias: 5 });
const tj3 = insert("tareas_jornada", { jornada_id: proximaJornada, nombre: "Revisión de instalación eléctrica provisoria", habilidad_requerida: "electricidad", prioridad: "alta", personas_necesarias: 2 });
[2, 7, 11, 0, 5].forEach((idx) => insert("asignaciones_jornada", { jornada_id: proximaJornada, tarea_jornada_id: tj1, nucleo_id: nucleos[idx], propuesta_por_ia: 1, confirmado: 1 }));
[3, 6, 9].forEach((idx) => insert("asignaciones_jornada", { jornada_id: proximaJornada, tarea_jornada_id: tj2, nucleo_id: nucleos[idx], propuesta_por_ia: 1, confirmado: 0 }));
// tj3 (electricidad) queda sin cubrir a propósito, para que el motor de alertas la detecte

// ================= PROVEEDORES =================
const proveedoresData = [
  ["Corralón San José", "2900-1111", "materiales de construcción"],
  ["Ferretería El Tornillo", "2900-2222", "ferretería"],
  ["Materiales Uruguay SA", "2900-3333", "materiales de construcción"],
  ["ElectroObra", "2900-4444", "instalaciones eléctricas"],
  ["Sanitarios del Este", "2900-5555", "instalaciones sanitarias"],
  ["Hierros del Cerro", "2900-6666", "hierro y acero"],
];
const proveedores = {};
proveedoresData.forEach(([nombre, contacto, rubro]) => { proveedores[nombre] = insert("proveedores", { nombre, contacto, rubro }); });

// ================= COMPRAS =================
function crearSolicitud({ solicitante, comision, material, cantidad, unidad, especificacion, prioridad, etapa_obra, fecha_necesaria, presupuesto_estimado, estado }) {
  return insert("solicitudes_compra", {
    solicitante_id: users[solicitante], comision, material, cantidad, unidad, especificacion,
    prioridad, etapa_obra, fecha_necesaria, presupuesto_estimado, estado,
  });
}
function cargarPresupuesto(solicitudId, proveedorNombre, datos) {
  return insert("presupuestos_proveedor", { solicitud_id: solicitudId, proveedor_id: proveedores[proveedorNombre], ...datos });
}

// Solicitud 1: hierro para losa de techo (crítica, pendiente — vinculada al problema de obra)
const sc1 = crearSolicitud({
  solicitante: "beatriz@coop.uy", comision: "Comisión de Obra", material: "Hierro de construcción 8mm",
  cantidad: 800, unidad: "kg", especificacion: "Hierro conformado ADN 420, barras de 12m",
  prioridad: "critica", etapa_obra: "Estructura", fecha_necesaria: iso(addDays(today, 5)),
  presupuesto_estimado: 95000, estado: "en_comparacion",
});
cargarPresupuesto(sc1, "Hierros del Cerro", { precio: 92000, precio_unitario: 115, plazo_entrega_dias: 12, forma_pago: "30 días", garantia: "No informa", costo_envio: 3000 });
cargarPresupuesto(sc1, "Materiales Uruguay SA", { precio: 97000, precio_unitario: 121, plazo_entrega_dias: 5, forma_pago: "contado", garantia: "Certificado de calidad INN", costo_envio: 0 });
cargarPresupuesto(sc1, "Corralón San José", { precio: 99500, precio_unitario: 124, plazo_entrega_dias: 7, forma_pago: "15 días", garantia: "Certificado de calidad INN", costo_envio: 0 });

// Solicitud 2: cemento (ya decidida)
const sc2 = crearSolicitud({
  solicitante: "beatriz@coop.uy", comision: "Comisión de Obra", material: "Cemento Portland",
  cantidad: 100, unidad: "bolsas de 25kg", especificacion: "Cemento portland normal",
  prioridad: "alta", etapa_obra: "Mampostería", fecha_necesaria: iso(addDays(today, 20)),
  presupuesto_estimado: 45000, estado: "aprobada",
});
const p2a = cargarPresupuesto(sc2, "Corralón San José", { precio: 43000, precio_unitario: 430, plazo_entrega_dias: 3, forma_pago: "contado", garantia: "No informa", costo_envio: 0 });
cargarPresupuesto(sc2, "Materiales Uruguay SA", { precio: 46500, precio_unitario: 465, plazo_entrega_dias: 2, forma_pago: "contado", garantia: "No informa", costo_envio: 0 });
cargarPresupuesto(sc2, "Ferretería El Tornillo", { precio: 44800, precio_unitario: 448, plazo_entrega_dias: 5, forma_pago: "15 días", garantia: "No informa", costo_envio: 1500 });
insert("decisiones_compra", { solicitud_id: sc2, presupuesto_id: p2a, decidido_por_id: users["gonzalo@coop.uy"], motivo: "Precio más bajo y entrega rápida.", monto: 43000, fecha: iso(addDays(today, -10)) });

// Solicitud 3: caja térmica eléctrica (pendiente, sin presupuestos aún)
crearSolicitud({
  solicitante: "eduardo@coop.uy", comision: "Comisión de Seguridad", material: "Tablero eléctrico provisorio de obra",
  cantidad: 1, unidad: "unidad", especificacion: "Tablero con térmica y diferencial, IP65",
  prioridad: "alta", etapa_obra: "Instalaciones", fecha_necesaria: iso(addDays(today, 15)),
  presupuesto_estimado: 18000, estado: "pendiente_cotizacion",
});

// Solicitud 4: pintura (entregada)
const sc4 = crearSolicitud({
  solicitante: "carlos@coop.uy", comision: "Comisión de Trabajo", material: "Pintura látex exterior",
  cantidad: 40, unidad: "litros", especificacion: "Látex exterior blanco",
  prioridad: "baja", etapa_obra: "Terminaciones", fecha_necesaria: iso(addDays(today, 90)),
  presupuesto_estimado: 20000, estado: "entregada",
});
const p4a = cargarPresupuesto(sc4, "Ferretería El Tornillo", { precio: 19500, precio_unitario: 487, plazo_entrega_dias: 4, forma_pago: "contado", garantia: "No informa", costo_envio: 0 });
insert("decisiones_compra", { solicitud_id: sc4, presupuesto_id: p4a, decidido_por_id: users["diana@coop.uy"], motivo: "Único presupuesto recibido en plazo, precio razonable.", monto: 19500, fecha: iso(addDays(today, -30)) });

// ================= SEGURIDAD =================
insert("documentos_seguridad", { tipo: "Comunicación de apertura de obra (MTSS)", descripcion: "Trámite ante Inspección de Trabajo", fecha_vencimiento: iso(addDays(today, 200)), responsable_id: users["eduardo@coop.uy"] });
insert("documentos_seguridad", { tipo: "Seguro de accidentes de trabajo (BSE)", descripcion: "Póliza colectiva de la obra", fecha_vencimiento: iso(addDays(today, -3)), responsable_id: users["eduardo@coop.uy"] });
insert("documentos_seguridad", { tipo: "Capacitación en seguridad — inducción general", descripcion: "Vencimiento de la certificación grupal", fecha_vencimiento: iso(addDays(today, 10)), responsable_id: users["eduardo@coop.uy"] });
insert("documentos_seguridad", { tipo: "Certificado de andamios", descripcion: "Habilitación de andamios tubulares", fecha_vencimiento: iso(addDays(today, 120)), responsable_id: users["eduardo@coop.uy"] });

insert("inspecciones_seguridad", {
  fecha: iso(addDays(today, -6)),
  checklist_json: JSON.stringify([
    { item: "Uso de casco en obra", ok: true }, { item: "Vallado de zona de excavación", ok: true },
    { item: "Extintor accesible", ok: true }, { item: "Botiquín completo", ok: false },
    { item: "Señalización de riesgo eléctrico", ok: true },
  ]),
  hallazgos: "Botiquín incompleto: falta reponer gasas y suero fisiológico.",
  autor_id: users["eduardo@coop.uy"],
});

insert("incidentes_seguridad", {
  fecha: iso(addDays(today, -20)), tipo: "incidente", descripcion: "Caída de material desde andamio, sin personas afectadas.",
  severidad: "media", estado: "resuelto", medidas: "Se reforzó el amarre de plataformas y se recordó protocolo de izaje.",
  autor_id: users["eduardo@coop.uy"],
});
insert("incidentes_seguridad", {
  fecha: iso(addDays(today, -2)), tipo: "observacion", descripcion: "Acopio de bloques cerca del paso peatonal interno de obra.",
  severidad: "media", estado: "abierto", medidas: null,
  ia_observacion: "Asistencia preliminar de IA: en la foto se observa material apilado sobre una zona de circulación. Esto es una observación preliminar automática, no un diagnóstico definitivo — debe confirmarlo el responsable de seguridad.",
  autor_id: users["eduardo@coop.uy"],
});

// ================= FINANZAS =================
insert("presupuesto_general", { categoria: "Estructura", monto_presupuestado: 900000, periodo: "2026" });
insert("presupuesto_general", { categoria: "Mampostería", monto_presupuestado: 400000, periodo: "2026" });
insert("presupuesto_general", { categoria: "Instalaciones", monto_presupuestado: 500000, periodo: "2026" });
insert("presupuesto_general", { categoria: "Terminaciones", monto_presupuestado: 350000, periodo: "2026" });
insert("presupuesto_general", { categoria: "Administración", monto_presupuestado: 80000, periodo: "2026" });

const movimientos = [
  ["ingreso", 1200000, "Préstamo ANV — desembolso etapa 1", "Estructura", -70],
  ["ingreso", 45000, "Cuotas sociales del mes", "Administración", -30],
  ["ingreso", 45000, "Cuotas sociales del mes", "Administración", -60],
  ["egreso", 320000, "Estructura", "Estructura", -55],
  ["egreso", 610000, "Estructura", "Estructura", -35],
  ["egreso", 43000, "Mampostería", "Mampostería", -10],
  ["egreso", 19500, "Terminaciones", "Terminaciones", -30],
  ["egreso", 15000, "Administración", "Administración", -20],
  ["egreso", 8000, "Administración", "Administración", -5],
];
movimientos.forEach(([tipo, monto, descripcion, categoria, diasAtras]) => {
  insert("movimientos_financieros", { tipo, monto, categoria, etapa_obra: categoria, fecha: iso(addDays(today, diasAtras)), descripcion, registrado_por_id: users["florencia@coop.uy"] });
});

insert("compromisos_futuros", { descripcion: "Compra de hierro (solicitud pendiente de decisión)", monto: 97000, fecha_estimada: iso(addDays(today, 8)), origen: `solicitud #${sc1}` });
insert("compromisos_futuros", { descripcion: "Cuota de honorarios IAT del mes", monto: 60000, fecha_estimada: iso(addDays(today, 5)), origen: "contrato IAT" });
insert("compromisos_futuros", { descripcion: "Alquiler de andamios (mes en curso)", monto: 25000, fecha_estimada: iso(addDays(today, 3)), origen: "contrato de alquiler" });
insert("compromisos_futuros", { descripcion: "Materiales de instalación sanitaria (próxima etapa)", monto: 180000, fecha_estimada: iso(addDays(today, 25)), origen: "planificación de compras" });

// ================= DOCUMENTOS Y ACTAS =================
const docReglamento = insert("documentos", { categoria: "reglamentos", nombre: "Reglamento de Obra y Ayuda Mutua", descripcion: "Versión vigente aprobada por Asamblea", subido_por_id: users["florencia@coop.uy"], fecha: iso(addDays(today, -200)) });
const docActa1 = insert("documentos", { categoria: "actas", nombre: "Acta Asamblea Ordinaria — aprobación de presupuesto 2026", subido_por_id: users["florencia@coop.uy"], fecha: iso(addDays(today, -70)) });
const docActa2 = insert("documentos", { categoria: "actas", nombre: "Acta Consejo Directivo — compra de hierro", subido_por_id: users["florencia@coop.uy"], fecha: iso(addDays(today, -9)) });

insert("actas", {
  organo: "asamblea", fecha: iso(addDays(today, -70)), titulo: "Aprobación de presupuesto general 2026",
  resumen: "La Asamblea aprobó por mayoría el presupuesto general de obra para 2026, con las categorías Estructura, Mampostería, Instalaciones, Terminaciones y Administración, y facultó a Tesorería a autorizar pagos de hasta $50.000 sin necesidad de aprobación previa del Consejo Directivo.",
  documento_id: docActa1,
});
insert("actas", {
  organo: "consejo_directivo", fecha: iso(addDays(today, -9)), titulo: "Seguimiento de compra de hierro para losa de techo",
  resumen: "El Consejo Directivo tomó conocimiento del atraso del proveedor habitual de hierro y solicitó a la Comisión de Compras avanzar con al menos tres presupuestos alternativos antes de fin de semana, dado el impacto en el cronograma de la etapa Estructura.",
  documento_id: docActa2,
});

console.log("Seed OK.");
console.log("Usuarios de prueba (todos con contraseña: " + PASSWORD + "):");
usersData.forEach(([nombre, email, rol]) => console.log(`  ${email}  ->  ${rol}  (${nombre})`));
