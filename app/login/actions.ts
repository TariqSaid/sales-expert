"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, makeToken, passwordOk } from "@/lib/auth";

export async function login(_prev: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!process.env.AUTH_SECRET || !passwordOk(password)) {
    return "Wrong password.";
  }
  (await cookies()).set(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/chat");
}