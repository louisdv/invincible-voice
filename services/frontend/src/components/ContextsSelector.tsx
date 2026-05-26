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
    <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
      <div className='mb-1 text-sm font-medium text-white'>
        {t('conversation.contexts')}
      </div>
      <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
        {contexts.length === 0 && (
          <p className='text-xs italic text-gray-500'>
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
              className={`h-10 p-px transition-colors cursor-pointer rounded-2xl focus:outline-none focus:ring-2 ${
                isActive
                  ? 'orange-to-light-orange-gradient focus:ring-orange-500'
                  : 'border border-gray-600 focus:ring-gray-500'
              }`}
            >
              <div
                className={`flex flex-col justify-center px-3 h-full text-sm text-white font-medium rounded-2xl ${
                  isActive ? 'bg-[#181818]' : 'bg-[#1B1B1B]'
                }`}
              >
                {ctx.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ContextsSelector;
