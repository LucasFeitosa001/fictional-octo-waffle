import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { PwaRegister } from './PwaRegister';

export const metadata: Metadata = {
  title: 'Salonpass Gestão — Painel da salão',
  description: 'Gestão da sua salão: agenda, profissionais, serviços e clientes.',
  appleWebApp: {
    capable: true,
    title: 'Salonpass',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#060606',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
