'use client';
import { FC, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { UserSettings, updateUserSettings } from '@/utils/userData';
import SubScreenShell from './_SubScreenShell';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const FriendsScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [friends, setFriends] = useState<string[]>(settings.friends ?? []);
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const value = input.trim();
    if (!value) return;
    if (friends.some((f) => f.toLowerCase() === value.toLowerCase())) {
      setInput('');
      return;
    }
    setFriends([...friends, value]);
    setInput('');
  };

  const handleRemove = (name: string) => {
    setFriends(friends.filter((f) => f !== name));
  };

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, friends };
    const res = await updateUserSettings(updated);
    if (!res.error) onSave(updated);
  };

  return (
    <SubScreenShell
      title={t('settings.friends')}
      onBack={onBack}
      onSave={handleSave}
      saveLabel={t('common.save')}
    >
      <div className='flex flex-col gap-4 pt-2'>
        <div className='flex gap-2'>
          <input
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder={t('settings.addFriendPlaceholder')}
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

        {friends.length === 0 ? (
          <p className='px-1 text-[15px] text-voice-text-tertiary'>
            {t('settings.noFriendsAdded')}
          </p>
        ) : (
          <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border overflow-hidden'>
            {friends.map((f) => (
              <div
                key={f}
                className='flex items-center justify-between px-4 py-3'
              >
                <span className='text-[17px] text-voice-text break-words pr-3'>
                  {f}
                </span>
                <button
                  type='button'
                  onClick={() => handleRemove(f)}
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

export default FriendsScreen;
