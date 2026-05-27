'use client';
import { FC, useState } from 'react';
import { useTranslations } from '@/i18n';
import { UserSettings, updateUserSettings } from '@/utils/userData';
import SubScreenShell from './_SubScreenShell';

interface Props {
  settings: UserSettings;
  email: string;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const ProfileScreen: FC<Props> = ({ settings, email, onBack, onSave }) => {
  const t = useTranslations();
  const [name, setName] = useState(settings.name ?? '');

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, name };
    const res = await updateUserSettings(updated);
    if (!res.error) onSave(updated);
  };

  return (
    <SubScreenShell
      title={t('settings.profile')}
      onBack={onBack}
      onSave={handleSave}
      saveLabel={t('common.save')}
    >
      <div className='flex flex-col gap-6 pt-2'>
        <div className='flex flex-col gap-1'>
          <label className='px-1 text-[13px] text-voice-text-secondary'>
            {t('settings.email')}
          </label>
          <div className='px-4 py-3 rounded-[14px] bg-voice-surface text-voice-text-secondary'>
            {email}
          </div>
        </div>

        <div className='flex flex-col gap-1'>
          <label className='px-1 text-[13px] text-voice-text-secondary'>
            {t('settings.yourName')}
          </label>
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.yourNamePlaceholder')}
            className='w-full px-4 py-3 rounded-[14px] bg-voice-surface text-voice-text border border-voice-border focus:outline-none focus:ring-2 focus:ring-voice-accent'
          />
        </div>
      </div>
    </SubScreenShell>
  );
};

export default ProfileScreen;
