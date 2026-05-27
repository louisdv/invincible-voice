'use client';

import { History, Mic, Settings } from 'lucide-react';
import { FC } from 'react';
import { useTranslations } from '@/i18n';

interface MobileNoConversationProps {
  onConnectButtonPress: () => void;
  onSettingsPress: () => void;
  onHistoryPress?: () => void;
  hasHistory?: boolean;
  userName?: string;
}

export const MobileNoConversation: FC<MobileNoConversationProps> = ({
  onConnectButtonPress,
  onSettingsPress,
  onHistoryPress = undefined,
  hasHistory = false,
  userName = '',
}) => {
  const t = useTranslations();

  const greeting = t('conversation.greeting').replace('{name}', userName);

  return (
    <div className='w-full h-dvh flex flex-col bg-voice-bg text-voice-text relative'>
      {/* Safe area spacer for notch/status bar */}
      <div
        style={{ height: 'var(--safe-area-inset-top)' }}
        className='shrink-0'
      />

      <div
        className='flex justify-end px-4 py-3'
        style={{ paddingTop: 'calc(0.75rem + var(--safe-area-inset-top))' }}
      >
        <button
          className='w-11 h-11 flex items-center justify-center rounded-full bg-voice-surface'
          onClick={onSettingsPress}
          title={t('settings.changeSettings')}
        >
          <Settings
            size={20}
            className='text-voice-text'
          />
        </button>
      </div>

      <div className='flex-1 flex flex-col items-center justify-center gap-8 px-8'>
        <h1 className='text-[52px] font-bold tracking-tight text-voice-text leading-none'>
          Voice
        </h1>
        <p className='text-xl font-medium text-voice-text-secondary text-center'>
          {greeting}
        </p>
        <button
          type='button'
          onClick={onConnectButtonPress}
          className='w-40 h-40 rounded-full bg-voice-accent flex items-center justify-center shadow-[0_8px_24px_rgba(10,132,255,0.25)]'
          aria-label={t('conversation.startChatting')}
        >
          <Mic
            size={64}
            className='text-white'
          />
        </button>
        <button
          onClick={onConnectButtonPress}
          className='px-8 py-4 rounded-full bg-voice-text text-white text-[17px] font-semibold'
        >
          {t('conversation.startChatting')}
        </button>
        {hasHistory && onHistoryPress && (
          <button
            className='flex items-center gap-2 px-5 py-3 text-voice-text-secondary text-[15px] font-medium'
            onClick={onHistoryPress}
          >
            <History size={18} />
            {t('conversation.history')}
          </button>
        )}
      </div>

      {/* Safe area spacer for home indicator */}
      <div
        style={{ height: 'var(--safe-area-inset-bottom)' }}
        className='shrink-0'
      />
    </div>
  );
};
