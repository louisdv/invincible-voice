'use client';

import { FC, Fragment, useCallback, useMemo } from 'react';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';

interface Keyword {
  id: string;
  text: string;
  isComplete: boolean;
}

interface KeywordsSuggestionProps {
  keywords: Keyword[];
  onSelect: (text: string) => void;
  alwaysShow?: boolean;
  mobile?: boolean;
}

const KeywordsSuggestion: FC<KeywordsSuggestionProps> = ({
  keywords,
  onSelect,
  alwaysShow = false,
  mobile = false,
}) => {
  const t = useTranslations();
  const validKeywords = useMemo(
    () => keywords.filter((keyword) => keyword.text.trim()),
    [keywords],
  );
  const displayKeywords = useMemo(() => {
    return alwaysShow
      ? [
          ...Array.from({ length: 10 }, (_, index) => {
            const existingKeyword = keywords[index];
            return (
              existingKeyword || {
                id: `empty-keyword-${index}`,
                text: '',
                isComplete: false,
              }
            );
          }),
        ]
      : validKeywords;
  }, [alwaysShow, keywords, validKeywords]);
  const isPending = useMemo(() => {
    return displayKeywords.some(
      (keyword) => keyword.isComplete || keyword.text.trim(),
    );
  }, [displayKeywords]);
  const onSelectKeyword = useCallback(
    (text: string) => {
      if (text.trim()) {
        onSelect(text);
      }
    },
    [onSelect],
  );

  if (!alwaysShow && validKeywords.length === 0) {
    return null;
  }

  if (mobile) {
    return (
      <div className='w-full'>
        <div className='flex gap-2 pb-2 overflow-x-auto scrollbar-hidden'>
          {displayKeywords.map((keyword) => (
            <MobileKeyword
              key={keyword.id}
              keyword={keyword.text}
              isComplete={keyword.isComplete}
              onSelect={onSelectKeyword}
            />
          ))}
        </div>
        {isPending && (
          <div className='mt-2 text-xs text-center text-voice-text-secondary'>
            {t('settings.keywordsLoading')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='w-full px-6 py-4 bg-voice-elevated border border-voice-border rounded-[40px]'>
      <div className='mb-1 text-sm font-medium text-voice-text'>
        {t('settings.suggestions')}
      </div>
      <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
        {displayKeywords.map((keyword) => (
          <DesktopKeyword
            key={keyword.id}
            keyword={keyword.text.trim() || '…'}
            onSelect={onSelectKeyword}
          />
        ))}
        {isPending && (
          <div className='mt-2 text-xs text-center text-voice-text-secondary'>
            {t('settings.keywordsLoading')}
          </div>
        )}
      </div>
    </div>
  );
};

export default KeywordsSuggestion;

interface MobileKeywordProps {
  keyword: string;
  isComplete: boolean;
  onSelect: (text: string) => void;
}

const MobileKeyword: FC<MobileKeywordProps> = ({
  keyword,
  isComplete,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(keyword);
  }, [onSelect, keyword]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        'shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-full border transition-colors focus:outline-none focus:ring-2 whitespace-nowrap',
        {
          'bg-voice-accent hover:opacity-90 text-white border-voice-accent focus:ring-voice-accent cursor-pointer':
            keyword.trim() && isComplete,
          'bg-voice-surface text-voice-text-secondary border-voice-border cursor-wait':
            keyword.trim() && !isComplete,
          'bg-voice-surface text-voice-text-secondary border-voice-border cursor-default':
            !keyword.trim(),
        },
      )}
      disabled={!keyword.trim() || !isComplete}
    >
      {keyword.trim() ? (
        <Fragment>
          {keyword}
          {!isComplete && (
            <span className='inline-block w-1 h-2 ml-1 bg-voice-text-secondary animate-pulse' />
          )}
        </Fragment>
      ) : (
        <span className='text-voice-text-secondary'>…</span>
      )}
    </button>
  );
};

interface DesktopKeywordProps {
  keyword: string;
  onSelect: (text: string) => void;
}

const DesktopKeyword: FC<DesktopKeywordProps> = ({ keyword, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(keyword);
  }, [onSelect, keyword]);

  return (
    <button
      className='px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors cursor-pointer min-w-16 bg-voice-accent text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-voice-accent'
      onClick={handleClick}
    >
      {keyword || '…'}
    </button>
  );
};
