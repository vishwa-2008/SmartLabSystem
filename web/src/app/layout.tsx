import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';

export const metadata: Metadata = {
  title: 'KARE Smart Laboratory Equipment Management System',
  description:
    'Official university laboratory equipment circulation and biometric access management portal for Kalasalingam Academy of Research and Education.',
  keywords: [
    'Smart Laboratory',
    'Equipment Management',
    'Biometric Attendance',
    'Fingerprint Circulation',
    'KARE Lab'
  ]
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#F5F7FB] text-slate-800 antialiased selection:bg-[#1B4998] selection:text-white">
        <AuthProvider>
          <DataProvider>{children}</DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
