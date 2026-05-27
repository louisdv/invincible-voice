import { FC } from 'react';
import { useTranslations } from '@/i18n';
import type { Context } from '@/types/user';

interface ContextsSelectorProps {
  contexts: Context[];
  activeContextIds: Set<string>;
  onToggle: (contextId: string) => void;
}

const ContextsSelector: FC<ContextsSelectorProps> = ({
  contexts,
  activeContextIds,
  onToggle,
}) => {
  const t = useTranslations();

  return (
    <div className='w-full px-6 py-4 bg-voice-elevated border border-voice-border rounded-[40px]'>
      <div className='mb-1 text-sm font-medium text-voice-text'>
        {t('conversation.contexts')}
      </div>
      <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
        {contexts.length === 0 && (
          <p className='text-xs italic text-voice-text-secondary'>
            {t('conversation.noContextsAdded')}
          </p>
        )}
        {contexts.map((ctx) => {
          const isActive = activeContextIds.has(ctx.id);
          return (
            <button
              key={ctx.id}
              type='button'
              aria-pressed={isActive}
              onClick={() => onToggle(ctx.id)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 ${
                isActive
                  ? 'bg-voice-accent text-white focus:ring-voice-accent'
                  : 'bg-voice-surface text-voice-text border border-voice-border focus:ring-voice-border'
              }`}
            >
              {ctx.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ContextsSelector;
