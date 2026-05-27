'use client';
import { FC } from 'react';
import { useTranslations } from '@/i18n';
import { useAuthContext } from '@/auth/authContext';
import SubScreenShell from './_SubScreenShell';

interface Props {
  email: string;
  onBack: () => void;
}

const AccountScreen: FC<Props> = ({ email, onBack }) => {
  const t = useTranslations();
  const { signOut } = useAuthContext();

  return (
    <SubScreenShell
      title={t('settings.privacy')}
      onBack={onBack}
    >
      <div className='flex flex-col gap-6 pt-2'>
        <p className='px-1 text-[15px] leading-relaxed text-voice-text-secondary'>
          {t('settings.privacyExplain')}
        </p>

        <div className='flex flex-col gap-1'>
          <label className='px-1 text-[13px] text-voice-text-secondary'>
            {t('settings.email')}
          </label>
          <div className='px-4 py-3 rounded-[14px] bg-voice-surface text-voice-text-secondary'>
            {email}
          </div>
        </div>

        <button
          type='button'
          onClick={signOut}
          className='w-full py-4 rounded-[14px] bg-voice-elevated border border-voice-danger text-voice-danger font-semibold text-[17px]'
        >
          {t('settings.signOut')}
        </button>
      </div>
    </SubScreenShell>
  );
};

export default AccountScreen;
