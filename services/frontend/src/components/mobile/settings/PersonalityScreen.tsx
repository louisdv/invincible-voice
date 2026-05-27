'use client';
import { FC, useState } from 'react';
import { useTranslations } from '@/i18n';
import { UserSettings, updateUserSettings } from '@/utils/userData';
import SubScreenShell from './_SubScreenShell';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const PersonalityScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [prompt, setPrompt] = useState(settings.prompt ?? '');

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, prompt };
    const res = await updateUserSettings(updated);
    if (!res.error) onSave(updated);
  };

  return (
    <SubScreenShell
      title={t('settings.personality')}
      onBack={onBack}
      onSave={handleSave}
      saveLabel={t('common.save')}
    >
      <div className='flex flex-col gap-2 pt-2 h-full'>
        <p className='px-1 text-[13px] text-voice-text-secondary'>
          {t('settings.configureAssistant')}
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('settings.promptPlaceholder')}
          className='w-full min-h-[280px] flex-1 px-4 py-3 rounded-[14px] bg-voice-surface text-voice-text border border-voice-border resize-none focus:outline-none focus:ring-2 focus:ring-voice-accent'
        />
      </div>
    </SubScreenShell>
  );
};

export default PersonalityScreen;
