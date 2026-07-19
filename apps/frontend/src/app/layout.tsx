import type { Metadata } from 'next';
import { Do_Hyeon } from 'next/font/google';
import './globals.css';

const doHyeon = Do_Hyeon({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-moira-wordmark',
});

export const metadata: Metadata = {
  title: '모이라 | 모두가 이어지는 라이브러리',
  description: 'PNU AI 해커톤 팀 프로젝트 모이라의 홈 화면 스켈레톤',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={doHyeon.variable} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
