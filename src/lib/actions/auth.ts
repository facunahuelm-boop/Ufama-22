"use server";

import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { verifyPassword, createSessionCookie, clearSessionCookie } from "@/lib/auth";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await get<any>(`SELECT * FROM users WHERE email = ? AND activo = 1`, [email]);
  if (!user) return { error: "No encontramos ese usuario." };

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return { error: "Contraseña incorrecta." };

  await createSessionCookie({
    id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, nucleo_id: user.nucleo_id,
  });
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
