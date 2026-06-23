import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { getCurrentSession } from "@/lib/session";
import { CURRENT_COHORT } from "@/lib/cohort";
import LogoutButton from "@/components/logout-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "지피터스 반려 에이전트 챌린지 보드",
  description: `지피터스 ${CURRENT_COHORT} 반려 에이전트 챌린지 진행률 공유 보드`,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 text-sm">
            <Link href="/" className="font-semibold tracking-tight">
              🍀 지피터스 반려 에이전트 챌린지 보드
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/archive/22"
                className="text-zinc-500 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                22기 아카이브
              </Link>
              {session ? (
                <>
                  {/*
                   * 공개 페이지(/)는 익명성 요구사항을 따른다: 수강생 닉네임을
                   * 어떤 공유 영역에서도 노출하지 않는다. 헤더는 모든 라우트에
                   * 동일하게 적용되므로 여기서는 역할-중립 라벨만 표시하고,
                   * 닉네임은 /my(본인)·/admin(관리자 화면 내부) 같은 인증된
                   * 컨텍스트에서만 렌더한다.
                   */}
                  {session.role === "admin" ? (
                    <Link href="/admin" className="text-indigo-600 hover:underline dark:text-indigo-300">
                      관리자
                    </Link>
                  ) : (
                    <Link href="/my" className="text-indigo-600 hover:underline dark:text-indigo-300">
                      내 챌린지
                    </Link>
                  )}
                  <LogoutButton />
                </>
              ) : (
                <Link href="/login" className="text-indigo-600 hover:underline dark:text-indigo-300">
                  로그인
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs text-zinc-400">
          지피터스 {CURRENT_COHORT} · 반려 에이전트 챌린지
        </footer>
      </body>
    </html>
  );
}
