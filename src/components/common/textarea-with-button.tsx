'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React, {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
} from 'react';

import {
  AiSVG,
  EyeCrossSVG,
  EyeNonCrossSVG,
  MicSVG,
  SendSVG,
  StopSVG,
  VolumeMaxSVG,
  VolumeMutedSVG,
} from '@/components/svg';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { resolveAccentColorHex } from '@/lib/constants/ui';
import { cn } from '@/lib/utils';
import useVRMStore from '@/store/vrmStore';
import { VRMDisplayEnums } from '@/types/agent';

const ROLLING_PLACEHOLDERS = [
  'What can I help you with?',
  '我能帮你什么？',
  'मैं आपकी क्या मदद कर सकता हूँ?',
  '¿En qué puedo ayudarte?',
  'Comment puis-je vous aider ?',
  'بماذا يمكنني مساعدتك؟',
  'Como posso te ajudar?',
  'আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
  'Чем я могу вам помочь?',
  '何かお手伝いできますか？',
];

// Isolated component — its interval-driven re-renders never propagate to the parent
const RollingPlaceholder = ({
  isDark,
  active,
}: {
  isDark: boolean;
  active: boolean;
}) => {
  const [index, setIndex] = React.useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % ROLLING_PLACEHOLDERS.length),
      2500
    );
    return () => clearInterval(id);
  }, [active]);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex items-center overflow-hidden transition-opacity duration-150',
        active ? 'opacity-100' : 'opacity-0'
      )}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.4, 0.0, 0.2, 1],
          }}
          className={cn(
            'absolute w-full truncate font-geist text-sm font-normal text-black/40',
            isDark && 'text-white/40'
          )}>
          {ROLLING_PLACEHOLDERS[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

// Helper component for hover state on buttons
const HoverButton = ({
  onClick,
  disabled,
  className,
  renderIcon,
}: {
  onClick: () => void;
  disabled: boolean;
  className?: string;
  renderIcon: (isHovered: boolean) => React.ReactNode;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'flex items-center justify-center rounded-full bg-transparent text-white transition-colors',
        'active:opacity-80 disabled:opacity-50 focus:border-none focus:outline-none focus:ring-0 focus:ring-offset-0',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}>
      {renderIcon(isHovered)}
    </button>
  );
};

interface TextareaWithButtonProps {
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onSendClick: (text?: string) => void;
  onMicClick: () => void;
  onCallClick?: () => void;
  isRecording?: boolean;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  isDark?: boolean;
  suggestedQueries?: string[];
  isProcessing?: boolean;
  onStopClick?: () => void;
  hideAvatarButton?: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  onSuggestionSelect?: () => void;
  enableVoiceButton?: boolean;
  accentColorHex?: string | null;
}

/**
 * A reusable component for a styled textarea with integrated
 * mic and send buttons, similar to modern chat interfaces.
 */
export default function TextareaWithButton({
  placeholder: _placeholder,
  value,
  onChange,
  onSendClick,
  onMicClick,
  onCallClick: _onCallClick,
  isRecording = false,
  className = '',
  containerClassName,
  disabled = false,
  isDark = false,
  suggestedQueries,
  isProcessing = false,
  onStopClick,
  hideAvatarButton = false,
  volume = 1,
  onVolumeChange,
  onSuggestionSelect,
  enableVoiceButton = true,
  accentColorHex,
}: TextareaWithButtonProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<
    number | undefined
  >();
  const { isAvatarVisible, setAvatarVisibility, vrmDisplayMode } =
    useVRMStore();
  const resolvedAccentColorHex = resolveAccentColorHex(accentColorHex);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 100);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  useLayoutEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);

    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  const handleAvatarVisibilityChange = (visible: boolean) => {
    // Set user override to control avatar visibility
    setAvatarVisibility(visible);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (value.trim() && !disabled) {
        onSendClick();
        resetTextareaHeight();
      }
    }
  };

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  };

  const handleSendClick = () => {
    if (value.trim() && !disabled) {
      onSendClick(value);
      resetTextareaHeight();
    }
  };

  const handleMicClick = () => {
    if (!disabled) {
      onMicClick();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  const suggestedOptions = suggestedQueries || [];

  const handleSuggestedOptionClick = (option: string) => {
    // Close the popover first
    setIsPopoverOpen(false);

    // Notify parent (e.g. to dismiss terms banner)
    onSuggestionSelect?.();

    // Send the message directly with the option text
    if (option.trim()) {
      onSendClick(option);
    }
  };

  return (
    <div className=" overflow-hidden">
      <div
        ref={containerRef}
        className={cn(
          'relative w-full flex flex-row items-start min-h-[54px] rounded-t-[10px] pl-[18px]  ',
          isDark && 'bg-white/10 border-border',
          containerClassName
        )}>
        {/* Processing Indicator */}
        {isProcessing && (
          <div className="absolute left-[18px] top-1/2 transform -translate-y-1/2 z-10">
            <Loader2 className="w-3 h-3 text-foreground animate-spin" />
          </div>
        )}

        {/* Textarea */}
        <div className="relative flex-1 self-center py-2">
          <RollingPlaceholder isDark={isDark} active={!value} />
          <textarea
            ref={textareaRef}
            className={cn(
              'relative w-full bg-transparent text-foreground text-sm font-geist resize-none leading-snug focus:outline-none',
              isDark && 'text-white',
              className
            )}
            placeholder=""
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              const newHeight = Math.min(target.scrollHeight, 100);
              target.style.height = `${newHeight}px`;
            }}
          />
        </div>

        {/* Button Container - Aligned to top */}
        <div
          className={cn(
            'flex items-center justify-center gap-1 mr-[10px] my-auto p-[5px] h-[30px] rounded-md hover:bg-black/5',
            isDark && 'hover:bg-white/10'
          )}>
          {/* Dynamic Button - Stop when agent thinking, Send when has content, Mic otherwise */}
          {disabled && onStopClick ? (
            <HoverButton
              onClick={onStopClick}
              disabled={false}
              renderIcon={(isHovered) => (
                <StopSVG
                  height={20}
                  width={20}
                  fill={isHovered ? '#ef4444' : isDark ? 'white' : 'black'}
                />
              )}
            />
          ) : canSend ? (
            <HoverButton
              onClick={handleSendClick}
              disabled={false}
              renderIcon={(isHovered) => (
                <SendSVG
                  height={20}
                  width={20}
                  fill={
                    isHovered
                      ? resolvedAccentColorHex
                      : isDark
                        ? 'white'
                        : 'black'
                  }
                />
              )}
            />
          ) : (
            <HoverButton
              onClick={handleMicClick}
              disabled={disabled}
              className={cn(
                isRecording && ' ring-red-500/60 ring-offset-2  animate-pulse'
              )}
              renderIcon={(isHovered) => (
                <MicSVG
                  height={20}
                  width={20}
                  fill={
                    isRecording
                      ? '#ef4444'
                      : isHovered
                        ? resolvedAccentColorHex
                        : isDark
                          ? 'white'
                          : 'black'
                  }
                />
              )}
            />
          )}

          {/* Call button */}
          {/* <IconButton
            icon={
              <CallPhoneUpSVG
                height={26}
                width={26}
                fill={isDark ? darkColors.foreground : lightColors.foreground}
              />
            }
            onClick={onCallClick || handleSendClick}
            className={'bg-transparent text-foreground'}
          /> */}
        </div>
      </div>

      {/* Suggested Query Section */}
      <div
        className={cn(
          'rounded-b-[10px] bg-white/60 overflow-hidden flex flex-row items-center justify-between px-[18px] pr-[10px] py-3',
          isDark && 'bg-white/10'
        )}>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                ' flex items-center justify-between  ',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              disabled={disabled}>
              <div className="flex items-center w-full gap-1">
                <div className="w-4 h-4 rounded-full flex items-center justify-center">
                  <AiSVG height={16} width={16} fill={resolvedAccentColorHex} />
                </div>
                <span
                  className={cn(
                    'text-sm text-foreground ml-1 transition-opacity duration-500 ease-in-out',
                    isDark && 'text-white'
                  )}>
                  Suggestions
                </span>
              </div>
            </button>
          </PopoverTrigger>
          <div className="ml-auto flex items-center gap-2">
            {!hideAvatarButton && (
              <div
                className={cn(
                  'flex items-center px-[10px] h-[30px]  rounded-md hover:bg-black/5',
                  isDark && 'hover:bg-white/10',
                  vrmDisplayMode === VRMDisplayEnums.BANNER &&
                    'px-[5px] md:px-[10px] md:pr-[5px]'
                )}>
                {isAvatarVisible ? (
                  <button
                    className="flex gap-3 items-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAvatarVisibilityChange(false);
                    }}>
                    <p
                      className={cn(
                        'text-sm font-normal hidden sm:block',
                        isDark && 'text-white'
                      )}>
                      {vrmDisplayMode === VRMDisplayEnums.BANNER
                        ? 'Banner'
                        : 'Avatar'}
                    </p>
                    <EyeNonCrossSVG fill={resolvedAccentColorHex} />
                  </button>
                ) : (
                  <button
                    className="flex gap-3 items-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAvatarVisibilityChange(true);
                    }}>
                    <p
                      className={cn(
                        'text-sm font-normal hidden sm:block',
                        isDark && 'text-white'
                      )}>
                      {vrmDisplayMode === VRMDisplayEnums.BANNER
                        ? 'Banner'
                        : 'Avatar'}
                    </p>
                    <EyeCrossSVG fill={isDark ? 'white' : 'black'} />
                  </button>
                )}
              </div>
            )}
            {vrmDisplayMode !== VRMDisplayEnums.NONE && enableVoiceButton ? (
              <div
                className={cn(
                  'flex items-center px-[10px] pr-[5px] h-[30px]  rounded-md hover:bg-black/5',
                  isDark && 'hover:bg-white/10'
                )}>
                {onVolumeChange &&
                  (volume === 0 ? (
                    <button
                      className="flex gap-3 items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onVolumeChange(1);
                      }}>
                      <p
                        className={cn(
                          'text-sm font-normal hidden sm:block',
                          isDark && 'text-white'
                        )}>
                        Unmute
                      </p>
                      <VolumeMutedSVG
                        height={18}
                        width={18}
                        fill={isDark ? 'white' : 'black'}
                      />
                    </button>
                  ) : (
                    <button
                      className="flex gap-3 items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onVolumeChange(0);
                      }}>
                      <p
                        className={cn(
                          'text-sm font-normal hidden sm:block',
                          isDark && 'text-white'
                        )}>
                        Mute
                      </p>
                      <VolumeMaxSVG
                        height={18}
                        width={18}
                        fill={resolvedAccentColorHex}
                      />
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
          <PopoverContent
            className={cn(
              'p-0 bg-white/60 backdrop-blur-[35px] border-[0.5px] border-black/10 rounded-[10px] shadow-[4px_8px_50px_0px_#00000025] z-[70] overflow-hidden',
              isDark && 'bg-black/80 border-white/10'
            )}
            align="start"
            side="top"
            sideOffset={16}
            alignOffset={-18}
            containerWidth={containerWidth}>
            {suggestedOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedOptionClick(option)}
                className={cn(
                  'relative w-full h-[46px] px-5  text-sm text-center text-foreground hover:[background-color:color-mix(in_srgb,var(--color-alias)_40%,transparent)] transition-colors duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 border-b-[0.5px] last:border-b-0 border-black/20',

                  isDark && ' text-white border-white/10'
                )}>
                {option}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
