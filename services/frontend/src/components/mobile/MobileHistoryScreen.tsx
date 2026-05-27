'use client';

import { ChevronLeft } from 'lucide-react';
import { FC } from 'react';
import HistoryPanel from '@/components/mobile/HistoryPanel';
import { useTranslations } from '@/i18n';
import { Conversation } from '@/utils/userData';

interface MobileHistoryScreenProps {
  conversations: Conversation[];
  selectedConversationIndex: number | null;
  onConversationSelect: (index: number) => void;
  onNewConversation: () => void;
  onDeleteConversation: (index: number) => void;
  onBack: () => void;
}

const MobileHistoryScreen: FC<MobileHistoryScreenProps> = ({
  conversations,
  selectedConversationIndex,
  onConversationSelect,
  onNewConversation,
  onDeleteConversation,
  onBack,
}) => {
  const t = useTranslations();

  return (
    <div
      className='w-full h-dvh flex flex-col bg-voice-bg text-voice-text'
      style={{
        paddingTop: 'var(--safe-area-inset-top)',
        paddingBottom: 'var(--safe-area-inset-bottom)',
      }}
    >
      {/* Header: back button + centered title */}
      <div className='relative flex items-center justify-center px-4 py-3 shrink-0'>
        <button
          aria-label={t('common.back')}
          className='absolute left-2 h-11 w-11 flex items-center justify-center text-voice-accent cursor-pointer'
          onClick={onBack}
          title={t('common.back')}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className='text-[17px] font-semibold text-voice-text'>
          {t('conversation.history')}
        </h1>
      </div>

      {/* Conversation list (reuses HistoryPanel) */}
      <HistoryPanel
        conversations={conversations}
        selectedConversationIndex={selectedConversationIndex}
        onConversationSelect={onConversationSelect}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
      />
    </div>
  );
};

export default MobileHistoryScreen;
