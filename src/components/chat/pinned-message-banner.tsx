import { AlertCircle, AlertTriangle, Gift, Info, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { PinnedMessageSeverity } from '@/types/agent';

interface PinnedMessageBannerProps {
  message: string;
  severity: PinnedMessageSeverity;
  isDark: boolean;
  onClose?: () => void;
}

const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  message,
  severity,
  isDark: _isDark,
  onClose,
}) => {
  const getSeverityIcon = () => {
    switch (severity) {
      case PinnedMessageSeverity.INFO:
        return <Info className="w-4 h-4" />;
      case PinnedMessageSeverity.WARNING:
        return <AlertTriangle className="w-4 h-4" />;
      case PinnedMessageSeverity.OFFER:
        return <Gift className="w-4 h-4" />;
      case PinnedMessageSeverity.ATTENTION:
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  // Always use brand color (accent) regardless of severity
  const styles = {
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent',
    textColor: 'text-accent',
    icon: getSeverityIcon(),
  };

  return (
    <div
      className={cn(
        'w-full px-4 py-3 rounded-lg border backdrop-blur-sm',
        styles.bgColor,
        styles.borderColor,
        'mb-4'
      )}>
      <div className="flex items-center gap-3">
        <div className={cn('flex-shrink-0', styles.textColor)}>
          {styles.icon}
        </div>
        <div
          className={cn(
            'text-sm font-medium leading-relaxed flex-1 pinned-message-link',
            styles.textColor
          )}
          dangerouslySetInnerHTML={{ __html: message }}></div>

        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              'flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors',
              styles.textColor
            )}
            aria-label="Close banner">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PinnedMessageBanner;
