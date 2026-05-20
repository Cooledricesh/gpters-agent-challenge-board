/**
 * 로그인 페이지.
 *
 * 수강생: 닉네임 + 관리자가 지정한 비밀번호.
 * 관리자: 닉네임 "admin" + ADMIN_PASSWORD env(기본 5231).
 *
 * 이미 로그인되어 있으면 역할에 맞춰 즉시 리다이렉트.
 */

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "student") redirect("/my");

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-12">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">로그인</h1>
        <p className="text-sm text-zinc-500">
          수강생은 닉네임 + 관리자가 지정한 비밀번호로 로그인합니다.
        </p>
      </header>
      <LoginForm />
    </section>
  );
}
