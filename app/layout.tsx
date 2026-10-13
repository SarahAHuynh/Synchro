import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Synchro — Make time for your people', description: 'A little less planning. A little more together. Find shared time for the people you love.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
