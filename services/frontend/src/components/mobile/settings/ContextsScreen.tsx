'use client';
import { FC, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { UserSettings, Context, updateUserSettings } from '@/utils/userData';
import SubScreenShell from './_SubScreenShell';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const ContextsScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [contexts, setContexts] = useState<Context[]>(settings.contexts ?? []);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const label = input.trim();
    if (!label) return;
    if (label.length > 100) {
      setError(t('settings.contextTooLong'));
      return;
    }
    if (contexts.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      setError(t('settings.contextDuplicate'));
      return;
    }
    setContexts([...contexts, { id: crypto.randomUUID(), label }]);
    setInput('');
    setError(null);
  };

  const handleRemove = (id: string) => {
    setContexts(contexts.filter((c) => c.id !== id));
  };

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, contexts };
    const res = await updateUserSettings(updated);
    if (!res.error) onSave(updated);
  };

  return (
    <SubScreenShell
      title={t('settings.contexts')}
      onBack={onBack}
      onSave={handleSave}
      saveLabel={t('common.save')}
    >
      <div className='flex flex-col gap-4 pt-2'>
        <div className='flex flex-col gap-1'>
          <div className='flex gap-2'>
            <input
              type='text'
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder={t('settings.addContextPlaceholder')}
              className='flex-1 px-4 py-3 rounded-[14px] bg-voice-surface text-voice-text border border-voice-border focus:outline-none focus:ring-2 focus:ring-voice-accent'
            />
            <button
              type='button'
              onClick={handleAdd}
              className='px-5 rounded-[14px] bg-voice-accent text-white font-medium'
            >
              +
            </button>
          </div>
          {error && <p className='px-1 text-[13px] text-voice-danger'>{error}</p>}
        </div>

        {contexts.length === 0 ? (
          <p className='px-1 text-[15px] text-voice-text-tertiary'>
            {t('settings.noContextsAdded')}
          </p>
        ) : (
          <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border overflow-hidden'>
            {contexts.map((c) => (
              <div
                key={c.id}
                className='flex items-center justify-between px-4 py-3'
              >
                <span className='text-[17px] text-voice-text break-words pr-3'>
                  {c.label}
                </span>
                <button
                  type='button'
                  onClick={() => handleRemove(c.id)}
                  className='shrink-0 w-8 h-8 flex items-center justify-center text-voice-text-tertiary'
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SubScreenShell>
  );
};

export default ContextsScreen;
