import Link from 'next/link';
import React from 'react';

import {
  BluskySVG,
  DiscordSVG,
  EarthSVG,
  FacebookSVG,
  InstagramSVG,
  LinkedinSVG,
  SpotifySVG,
  TelegramSVG,
  TikTokSVG,
  XSVG,
  YoutubeSVG,
} from '@/components/svg';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useTheme } from '@/context/theme-context';
import { resolveAccentColorHex } from '@/lib/constants/ui';
import { cn } from '@/lib/utils';
import useVRMStore from '@/store/vrmStore';
import { IAgent } from '@/types/agent';

interface AboutModalProps {
  handleCopyURL?: () => void;
  children: (isOpen: boolean) => React.ReactNode; // This will be the trigger button with open state
  agent: IAgent;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  containerWidth: number | undefined;
}

// Function to detect social platform from URL
const detectSocialPlatform = (url: string): string => {
  const urlLower = url.toLowerCase();

  // Extract domain from URL for more precise matching
  let domain = '';
  try {
    const urlObj = new URL(
      urlLower.startsWith('http') ? urlLower : `https://${urlLower}`
    );
    domain = urlObj.hostname;
  } catch {
    // If URL parsing fails, fall back to simple string matching
    domain = urlLower;
  }

  // Check for exact domain matches or subdomains
  if (
    domain === 'facebook.com' ||
    domain === 'fb.com' ||
    domain.endsWith('.facebook.com') ||
    domain.endsWith('.fb.com')
  ) {
    return 'facebook';
  }
  if (domain === 'instagram.com' || domain.endsWith('.instagram.com')) {
    return 'instagram';
  }
  if (
    domain === 'youtube.com' ||
    domain === 'youtu.be' ||
    domain.endsWith('.youtube.com') ||
    domain.endsWith('.youtu.be')
  ) {
    return 'youtube';
  }
  if (
    domain === 'twitter.com' ||
    domain === 'x.com' ||
    domain.endsWith('.twitter.com') ||
    domain.endsWith('.x.com')
  ) {
    return 'twitter';
  }
  if (domain === 'linkedin.com' || domain.endsWith('.linkedin.com')) {
    return 'linkedin';
  }
  if (domain === 'tiktok.com' || domain.endsWith('.tiktok.com')) {
    return 'tiktok';
  }
  if (
    domain === 'discord.com' ||
    domain === 'discord.gg' ||
    domain.endsWith('.discord.com') ||
    domain.endsWith('.discord.gg')
  ) {
    return 'discord';
  }
  if (
    domain === 'telegram.me' ||
    domain === 't.me' ||
    domain === 'telegram.org' ||
    domain.endsWith('.telegram.me') ||
    domain.endsWith('.t.me')
  ) {
    return 'telegram';
  }
  if (
    domain === 'spoti.fi' ||
    domain === 'spotify.com' ||
    domain.endsWith('.spoti.fi') ||
    domain.endsWith('.spotify.com')
  ) {
    return 'spotify';
  }
  if (
    domain === 'blusky.com' ||
    domain === 'bsky.app' ||
    domain === 'bsky.social' ||
    domain.endsWith('.bsky.app') ||
    domain.endsWith('.bsky.social') ||
    domain.endsWith('.blusky.com')
  ) {
    return 'blusky';
  }

  return 'website'; // Default fallback
};

// Function to get appropriate icon component with theme-aware fill
const getSocialIcon = (
  platform: string,
  isDark: boolean,
  accentColorHex?: string | null
) => {
  const fillColor = isDark ? 'white' : 'black';
  const resolvedAccentColorHex = resolveAccentColorHex(accentColorHex);

  switch (platform) {
    case 'facebook':
      return <FacebookSVG fill={fillColor} height={16} width={16} />;
    case 'instagram':
      return <InstagramSVG fill={fillColor} height={16} width={16} />;
    case 'youtube':
      return <YoutubeSVG fill={fillColor} height={16} width={16} />;
    case 'twitter':
      return <XSVG fill={fillColor} height={16} width={16} />;
    case 'linkedin':
      return <LinkedinSVG fill={fillColor} height={16} width={16} />;
    case 'tiktok':
      return <TikTokSVG fill={fillColor} height={16} width={16} />;
    case 'telegram':
      return <TelegramSVG fill={fillColor} height={16} width={16} />;
    case 'discord':
      return <DiscordSVG fill={fillColor} height={16} width={16} />;
    case 'spotify':
      return <SpotifySVG fill={fillColor} height={16} width={16} />;
    case 'blusky':
      return <BluskySVG fill={fillColor} height={16} width={16} />;
    case 'website':
    default:
      return <EarthSVG fill={resolvedAccentColorHex} height={16} width={16} />;
  }
};

const AboutModal = ({
  handleCopyURL: _handleCopyURL,
  children,
  agent,
  isOpen,
  setIsOpen,
  containerWidth,
}: AboutModalProps) => {
  const { theme: _theme, setTheme, isDark } = useTheme();
  const { setAvatarVisibility } = useVRMStore();
  const aboutCardLinks = agent?.defaults?.aboutCardLinks || [];

  const _handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  const _handleAvatarVisibilityChange = (visible: boolean) => {
    // Set user override to control avatar visibility
    setAvatarVisibility(visible);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children(isOpen)}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        // Transparent, no-blur overlay; just used to capture outside clicks
        overlayClassName="bg-transparent backdrop-blur-none"
        className={cn(
          'text-foreground border border-black/0 bg-white/60 rounded-[10px] p-5 gap-y-0 items-start max-h-[calc(80vh-100px)] overflow-y-auto shadow-[4px_8px_50px_0px_#00000015] w-full',
          isDark && 'bg-black/60 border-white/10'
        )}
        style={{ maxWidth: containerWidth ?? 384 }}>
        <div className="flex flex-col items-start gap-y-[28px]">
          <h2 className={cn('text-sm font-bold', isDark && 'text-white')}>
            {agent?.defaults?.aboutCardHeading}
          </h2>
          <p
            className={cn(
              'text-sm font-normal leading-[140%] text-[#1D1D1DCC]',
              isDark && 'text-white/60'
            )}
            dangerouslySetInnerHTML={{
              __html: agent?.defaults?.aboutCardDescription,
            }}></p>
          <div className={'flex gap-x-2 justify-center flex-wrap w-full'}>
            {aboutCardLinks.map((social) => {
              const platform = detectSocialPlatform(social.link);
              return (
                <a
                  key={social.link}
                  href={social.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center justify-center aspect-square flex-1 max-w-[50px]  bg-white/60 dark:bg-background rounded-[5px] hover:bg-black/10 dark:hover:bg-backgroundSecondary transition-colors border-[0.5px] border-black/0',
                    isDark && 'bg-white/10 hover:bg-white/40'
                  )}>
                  {getSocialIcon(
                    platform,
                    isDark,
                    agent?.defaults?.accentColorHex
                  )}
                </a>
              );
            })}
          </div>
          <p
            className={cn(
              'flex items-center justify-center text-[10px] text-black/60 mx-auto',
              isDark && 'text-white/60'
            )}>
            Powered by&nbsp;
            <Link
              href={'https://alias.cm/'}
              target="_blank"
              className="underline hover:text-alias">
              Alias
            </Link>
            &nbsp;|&nbsp;
            <Link
              href={'https://alias.cm/ai-terms'}
              target="_blank"
              className="underline hover:text-alias">
              AI terms
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutModal;
