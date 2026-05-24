import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
