'use client';
import { FC, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { UserSettings, updateUserSettings } from '@/utils/userData';
import SubScreenShell from './_SubScreenShell';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const LanguageScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [language, setLanguage] = useState<string>(
    settings.expected_transcription_language ?? '',
  );

  const options: { value: string; label: string }[] = [
    { value: '', label: t('settings.letSpeechToTextGuess') },
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'de', label: 'Deutsch' },
    { value: 'pt', label: 'Português' },
  ];

  const handleSave = async () => {
    const updated: UserSettings = {
      ...settings,
      expected_transcription_language: language === '' ? null : language,
    };
    const res = await updateUserSettings(updated);
    if (!res.error) onSave(updated);
  };

  return (
    <SubScreenShell
      title={t('settings.expectedTranscriptionLanguage')}
      onBack={onBack}
      onSave={handleSave}
      saveLabel={t('common.save')}
    >
      <div className='pt-2'>
        <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border overflow-hidden'>
          {options.map((opt) => (
            <button
              key={opt.value || 'auto'}
              type='button'
              onClick={() => setLanguage(opt.value)}
              className='w-full flex items-center justify-between px-4 py-3.5 text-left'
            >
              <span className='text-[17px] text-voice-text'>{opt.label}</span>
              {language === opt.value && (
                <Check
                  size={20}
                  className='text-voice-accent'
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </SubScreenShell>
  );
};

export default LanguageScreen;
