'use client';

import { FC, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { useAuthContext } from '@/auth/authContext';
import { useTranslations } from '@/i18n';
import { updateUserSettings } from '@/utils/userData';
import type { Context, UserSettings } from '@/utils/userData';
import EmailField from './EmailField';
import NameField from './NameField';
import SettingsHeader from './SettingsHeader';

interface MobileSettingsPopupProps {
  userSettings: UserSettings;
  email: string;
  onSave: (settings: UserSettings) => void;
  onCancel: () => void;
}

const MobileSettingsPopup: FC<MobileSettingsPopupProps> = ({
  userSettings,
  email,
  onSave,
  onCancel,
}) => {
  const t = useTranslations();
  const { signOut } = useAuthContext();
  const [name, setName] = useState(userSettings.name || '');
  const [contexts, setContexts] = useState<Context[]>(userSettings.contexts || []);
  const [newContextInput, setNewContextInput] = useState<string>('');
  const [contextInputError, setContextInputError] = useState<string | null>(null);

  const handleAddContext = useCallback(() => {
    const label = newContextInput.trim();
    if (!label) return;
    if (label.length > 100) {
      setContextInputError(t('settings.contextTooLong'));
      return;
    }
    if (contexts.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      setContextInputError(t('settings.contextDuplicate'));
      return;
    }
    setContexts([...contexts, { id: crypto.randomUUID(), label }]);
    setNewContextInput('');
    setContextInputError(null);
  }, [contexts, newContextInput, t]);

  const handleRemoveContext = useCallback((contextId: string) => {
    setContexts((prev) => prev.filter((c) => c.id !== contextId));
  }, []);

  const handleSave = useCallback(async () => {
    const updatedSettings: UserSettings = {
      ...userSettings,
      name,
      contexts,
    };
    const result = await updateUserSettings(updatedSettings);

    if (!result.error) {
      onSave(updatedSettings);
    }
  }, [name, contexts, userSettings, onSave]);

  const handleSignOut = useCallback(() => {
    signOut();
    onCancel();
  }, [signOut, onCancel]);

  return (
    <div className='flex flex-col w-full h-full text-white p-4'>
      <SettingsHeader
        title={t('settings.changeSettings')}
        onCancel={onCancel}
      />

      <div className='flex flex-col gap-4 flex-1'>
        <EmailField email={email} />
        <NameField
          value={name}
          onChange={setName}
          placeholder={t('settings.yourNamePlaceholder')}
        />
        <div className='flex flex-col gap-2'>
          <label className='text-sm font-medium text-white'>
            {t('settings.contexts')}
          </label>
          <div className='flex flex-col gap-1.5'>
            {contexts.map((ctx) => (
              <div
                key={ctx.id}
                className='flex items-center justify-between px-3 py-2 bg-[#1B1B1B] border border-gray-600 rounded-lg'
              >
                <span className='text-sm text-white'>{ctx.label}</span>
                <button
                  type='button'
                  onClick={() => handleRemoveContext(ctx.id)}
                  aria-label={`Remove ${ctx.label}`}
                  className='text-gray-400 hover:text-red-400'
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {contexts.length === 0 && (
              <p className='text-xs italic text-gray-500'>
                {t('settings.noContextsAdded')}
              </p>
            )}
          </div>
          {contextInputError && (
            <p className='text-xs text-red-400'>{contextInputError}</p>
          )}
          <div className='flex gap-2'>
            <input
              type='text'
              value={newContextInput}
              onChange={(e) => {
                setNewContextInput(e.target.value);
                setContextInputError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddContext();
                }
              }}
              maxLength={100}
              placeholder={t('settings.addContextPlaceholder')}
              className='flex-1 px-3 py-2 text-sm text-white bg-[#1B1B1B] border border-gray-600 rounded-lg focus:outline-none focus:border-green'
            />
            <button
              type='button'
              onClick={handleAddContext}
              className='px-4 py-2 text-sm text-white bg-green rounded-lg'
            >
              {t('common.add')}
            </button>
          </div>
        </div>
        <p className='text-xs text-gray-500 text-center mt-1'>
          {t('settings.moreSettingsAvailable')}
        </p>
      </div>

      <div className='flex flex-col gap-3 mt-6'>
        <div className='w-full flex justify-center'>
          <a
            href='https://kyutai.org/privacy-policy'
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm underline text-gray-400 hover:text-white transition-colors'
          >
            {t('common.termsOfService')}
          </a>
        </div>
        <button
          className='w-full px-6 py-3 text-[#FF6459] bg-[#1B1B1B] border border-[#FF6459] rounded-2xl font-medium'
          onClick={handleSignOut}
        >
          {t('settings.signOut')}
        </button>
        <button
          className='w-full px-6 py-3 text-black bg-[#39F2AE] rounded-2xl font-medium'
          onClick={handleSave}
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
};

export default MobileSettingsPopup;
