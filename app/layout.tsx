import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AULA – guild' };

const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
