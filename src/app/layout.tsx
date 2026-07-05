import './globals.css';

import { Metadata } from 'next';
import React, { Suspense } from 'react';

import { BackgroundGradientAnimation } from '@/components/common/background-gradient-animation';
import ConditionalGoogleAnalytics from '@/components/common/ConditionalGoogleAnalytics';
import LoadingWrapper from '@/components/common/LoadingWrapper';
import { Toaster } from '@/components/ui/sonner';
import ContextWrapper from '@/context/context-wrapper';
import { ThemeProvider } from '@/context/theme-context';
import getMetadata from '@/lib/getMetadata';

function stripHtml(html?: string | null): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateMetadata(): Promise<Metadata> {
  const agentData = await getMetadata();
  const defaults = agentData?.defaults;
  const description =
    stripHtml(defaults?.aboutCardDescription) || 'Chat with your AI agent';

  return {
    title: defaults?.pageTitle || 'Alias Agent',
    description,
    icons: {
      icon: defaults?.faviconURL || '/favicon.ico',
      apple: defaults?.faviconURL || '/apple-touch-icon.png',
    },
    openGraph: {
      title: defaults?.pageTitle || 'Alias Agent',
      description,
      images: [
        {
          url: defaults?.logoTopLeftLightModeURL || '/Logo.png',
          width: 200,
          height: 50,
          alt: defaults?.pageTitle || 'Alias Agent',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaults?.pageTitle || 'Alias Agent',
      description,
      images: [defaults?.logoTopLeftLightModeURL || '/Logo.png'],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </head>
      <body className="w-full h-full font-geist ios-viewport-fix">
        <ThemeProvider>
          <ContextWrapper>
            <Suspense fallback={<div className="p-4">Loading...</div>}>
              <RootInner>{children}</RootInner>
            </Suspense>
          </ContextWrapper>
        </ThemeProvider>
        <ConditionalGoogleAnalytics
          gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID}
        />
        <Toaster />
      </body>
    </html>
  );
}

function RootInner({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex w-full h-dvh overflow-hidden bg-black">
      <LoadingWrapper>
        <BackgroundGradientAnimation className="relative z-10 w-full h-full">
          {children}
        </BackgroundGradientAnimation>
      </LoadingWrapper>
    </main>
  );
}
