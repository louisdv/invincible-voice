'use client';

import { ArrowLeft, Mic, Pause, Send, Settings, Snowflake } from 'lucide-react';
import ContextsSelector from '@/components/ContextsSelector';
import {
  useCallback,
  useEffect,
  useRef,
  ChangeEvent,
  KeyboardEvent,
  FC,
} from 'react';
import { PendingResponse } from '@/components/chat/ChatInterface';
import ChatPanel from '@/components/mobile/ChatPanel';
import { ResponseSize, RESPONSES_SIZES } from '@/constants';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { useTranslations } from '@/i18n';
import { ChatMessage } from '@/types/chatHistory';
import { Context } from '@/types/user';
import { Conversation } from '@/utils/userData';

interface MobileConversationLayoutProps {
  textInput: string;
  onTextInputChange: (value: string) => void;
  onSendMessage: () => void;
  frozenResponses: PendingResponse[] | null;
  onFreezeToggle: () => void;
  pendingResponses: PendingResponse[];
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  onResponseSizeChange?: (size: ResponseSize) => void;
  onConnectButtonPress: () => void;
  onSettingsPress: () => void;
  chatHistory: ChatMessage[];
  isConnected: boolean;
  currentSpeakerMessage?: string;
  // History-list props are still accepted (threaded from Voice.tsx) but the
  // history TAB has been removed; the list moves to the home screen in 4.2.
  conversations: Conversation[];
  selectedConversationIndex: number | null;
  onConversationSelect: (index: number) => void;
  onNewConversation: () => void;
  onDeleteConversation: (index: number) => void;
  pastConversation?: Conversation;
  isViewingPastConversation?: boolean;
  initialActivePanel?: 'chat' | 'responses' | 'history';
  onBack?: () => void;
  isHistoryMode?: boolean;
  additionalKeywords?: string[];
  contexts?: Context[];
  activeContextIds?: Set<string>;
  onContextToggle?: (contextId: string) => void;
}

const MobileConversationLayout: FC<MobileConversationLayoutProps> = ({
  textInput,
  onTextInputChange,
  onSendMessage,
  frozenResponses,
  onFreezeToggle,
  pendingResponses,
  onResponseSelect,
  onResponseSizeChange = undefined,
  onConnectButtonPress,
  onSettingsPress,
  chatHistory,
  isConnected,
  currentSpeakerMessage = '',
  pastConversation = undefined,
  isViewingPastConversation = false,
  onBack = undefined,
  contexts = [],
  activeContextIds = new Set<string>(),
  onContextToggle = undefined,
}) => {
  const t = useTranslations();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { vh, visualVh } = useViewportHeight();
  const keyboardHeight = Math.max(0, vh - visualVh);

  // Unified view always shows full suggestion cards → request medium responses once.
  useEffect(() => {
    onResponseSizeChange?.(RESPONSES_SIZES.M);
  }, [onResponseSizeChange]);

  const onMessageChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onTextInputChange(event.target.value);
    },
    [onTextInputChange],
  );
  const onMessageKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSendMessage();
      }
    },
    [onSendMessage],
  );

  const responsesToShow = frozenResponses ?? pendingResponses;
  const suggestions = responsesToShow
    .filter((r) => r.text.trim() && r.isComplete)
    .slice(0, 3);

  return (
    <div
      className='w-full flex flex-col bg-voice-bg text-voice-text overflow-hidden'
      style={{
        height: `${vh}px`,
        paddingTop: 'var(--safe-area-inset-top)',
        paddingBottom:
          keyboardHeight > 0
            ? `${keyboardHeight}px`
            : 'var(--safe-area-inset-bottom)',
      }}
    >
      {/* Header: stop (connected) or back button + settings */}
      <div className='flex items-center justify-between px-4 py-3 shrink-0'>
        {isConnected ? (
          <button
            aria-label='Stop conversation'
            className='shrink-0 h-11 px-5 flex items-center justify-center gap-2 rounded-2xl border border-voice-danger text-voice-danger text-sm cursor-pointer'
            onClick={onConnectButtonPress}
            title={t('conversation.stopConversation')}
          >
            <Pause width={18} height={18} className='shrink-0' />
            {t('conversation.stopConversation')}
          </button>
        ) : (
          <button
            aria-label='Back'
            className='shrink-0 h-11 px-5 flex items-center justify-center gap-2 rounded-2xl bg-voice-surface text-voice-text text-sm cursor-pointer'
            onClick={onBack}
            title={t('common.back')}
          >
            <ArrowLeft width={18} height={18} className='shrink-0' />
            {t('common.back')}
          </button>
        )}
        <button
          aria-label='Settings'
          className='shrink-0 h-11 w-11 flex items-center justify-center rounded-full bg-voice-surface text-voice-text cursor-pointer'
          onClick={onSettingsPress}
          title={t('settings.changeSettings')}
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Live speaker banner */}
      {isConnected && currentSpeakerMessage && (
        <div className='mx-4 mb-2 shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-voice-surface text-voice-text-secondary text-xs'>
          <span className='shrink-0 h-2 w-2 rounded-full bg-voice-danger animate-pulse' />
          <span className='truncate'>{currentSpeakerMessage}</span>
        </div>
      )}

      {/* Chat scroll area */}
      <div className='flex flex-col flex-1 min-h-0'>
        <ChatPanel
          chatHistory={chatHistory}
          isConnected={isConnected}
          currentSpeakerMessage={currentSpeakerMessage}
          pastConversation={pastConversation}
          isViewingPastConversation={isViewingPastConversation}
        />
      </div>

      {/* Bottom block — hidden when viewing a past conversation (read-only) */}
      {!isViewingPastConversation && (
        <div className='px-4 pt-2 pb-2 border-t border-voice-border shrink-0'>
          {/* Suggestions */}
          <div className='mb-3'>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-xs font-medium text-voice-text-tertiary'>
                {t('conversation.suggestedResponses').toUpperCase()}
              </span>
              <button
                aria-label={t('conversation.freeze')}
                className='flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-voice-text-secondary cursor-pointer'
                onClick={onFreezeToggle}
                title={t('conversation.freeze')}
              >
                <Snowflake width={14} height={14} className='shrink-0' />
                {t('conversation.freeze')}
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className='flex flex-col gap-2'>
                {suggestions.map((r) => (
                  <button
                    key={r.id}
                    className='w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl bg-voice-accent-soft border border-voice-border text-voice-text text-sm cursor-pointer'
                    onClick={() => onResponseSelect(r.id)}
                    title={r.text}
                  >
                    <span className='min-w-0'>{r.text}</span>
                    <Send
                      width={16}
                      height={16}
                      className='shrink-0 text-voice-accent'
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Context chips */}
          {contexts.length > 0 && (
            <div className='mb-3'>
              <ContextsSelector
                contexts={contexts}
                activeContextIds={activeContextIds}
                onToggle={onContextToggle ?? (() => {})}
              />
            </div>
          )}

          {/* Input bar */}
          <div className='flex items-end gap-2 px-3 py-2 rounded-2xl bg-voice-surface'>
            <Mic
              width={20}
              height={20}
              className='shrink-0 mb-1.5 text-voice-accent'
            />
            <textarea
              ref={textareaRef}
              className='flex-1 bg-transparent resize-none focus:outline-none text-sm text-voice-text placeholder:text-voice-text-tertiary max-h-24'
              placeholder={t('conversation.writeOrDictate')}
              rows={1}
              value={textInput}
              onChange={onMessageChange}
              onKeyDown={onMessageKeyDown}
            />
            <button
              aria-label={t('conversation.sendMessage')}
              className='shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-voice-accent text-white cursor-pointer disabled:opacity-40'
              onClick={onSendMessage}
              disabled={!textInput.trim()}
            >
              <Send width={18} height={18} />
            </button>
          </div>
        </div>
      )}

      {/* Past-conversation read-only: only a back button below the chat */}
      {isViewingPastConversation && (
        <div className='px-4 pt-2 pb-2 border-t border-voice-border shrink-0'>
          <button
            aria-label='Back'
            className='w-full h-11 flex items-center justify-center gap-2 rounded-2xl bg-voice-surface text-voice-text text-sm cursor-pointer'
            onClick={onBack}
            title={t('common.back')}
          >
            <ArrowLeft width={18} height={18} className='shrink-0' />
            {t('common.back')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileConversationLayout;
