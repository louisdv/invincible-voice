'use client';

import { FC, useState } from 'react';
import {
  X,
  ChevronRight,
  MicVocal,
  Languages,
  Sparkles,
  Tag,
  BookText,
  Users,
  FileText,
  Shield,
  LucideIcon,
} from 'lucide-react';
import { useTranslations } from '@/i18n';
import type { UserSettings } from '@/utils/userData';
import ProfileScreen from '@/components/mobile/settings/ProfileScreen';
import VoiceScreen from '@/components/mobile/settings/VoiceScreen';
import LanguageScreen from '@/components/mobile/settings/LanguageScreen';
import PersonalityScreen from '@/components/mobile/settings/PersonalityScreen';
import ContextsScreen from '@/components/mobile/settings/ContextsScreen';
import KeywordsScreen from '@/components/mobile/settings/KeywordsScreen';
import FriendsScreen from '@/components/mobile/settings/FriendsScreen';
import DocumentsScreen from '@/components/mobile/settings/DocumentsScreen';
import AccountScreen from '@/components/mobile/settings/AccountScreen';

interface MobileSettingsPopupProps {
  userSettings: UserSettings;
  email: string;
  onSave: (settings: UserSettings) => void;
  onCancel: () => void;
}

type Route =
  | 'index'
  | 'profile'
  | 'voice'
  | 'language'
  | 'personality'
  | 'contexts'
  | 'keywords'
  | 'friends'
  | 'documents'
  | 'account';

interface SettingsRowProps {
  icon: LucideIcon;
  title: string;
  sub: string;
  onClick: () => void;
}

const SettingsRow: FC<SettingsRowProps> = ({
  icon: Icon,
  title,
  sub,
  onClick,
}) => (
  <button
    type='button'
    onClick={onClick}
    className='w-full flex items-center gap-3 px-4 py-3 text-left'
  >
    <span className='shrink-0 w-9 h-9 flex items-center justify-center rounded-[8px] bg-voice-surface text-voice-accent'>
      <Icon size={20} />
    </span>
    <span className='flex-1 min-w-0'>
      <span className='block text-[17px] text-voice-text'>{title}</span>
      <span className='block text-[13px] text-voice-text-secondary truncate'>
        {sub}
      </span>
    </span>
    <ChevronRight
      size={18}
      className='shrink-0 text-voice-text-tertiary'
    />
  </button>
);

const SectionHeader: FC<{ label: string }> = ({ label }) => (
  <p className='px-4 pt-5 pb-2 text-[13px] uppercase tracking-wide text-voice-text-secondary'>
    {label}
  </p>
);

const MobileSettingsPopup: FC<MobileSettingsPopupProps> = ({
  userSettings,
  email,
  onSave,
  onCancel,
}) => {
  const t = useTranslations();
  const [route, setRoute] = useState<Route>('index');
  const [settings, setSettings] = useState<UserSettings>(userSettings);

  const handleScreenSave = (updated: UserSettings) => {
    setSettings(updated);
    onSave(updated);
    setRoute('index');
  };

  const backToIndex = () => setRoute('index');

  if (route === 'profile') {
    return (
      <ProfileScreen
        settings={settings}
        email={email}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'voice') {
    return (
      <VoiceScreen
        settings={settings}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'language') {
    return (
      <LanguageScreen
        settings={settings}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'personality') {
    return (
      <PersonalityScreen
        settings={settings}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'contexts') {
    return (
      <ContextsScreen
        settings={settings}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'keywords') {
    return (
      <KeywordsScreen
        settings={settings}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'friends') {
    return (
      <FriendsScreen
        settings={settings}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'documents') {
    return (
      <DocumentsScreen
        settings={settings}
        onBack={backToIndex}
        onSave={handleScreenSave}
      />
    );
  }
  if (route === 'account') {
    return (
      <AccountScreen
        email={email}
        onBack={backToIndex}
      />
    );
  }

  const count = (key: string, n: number) =>
    t(key).replace('{count}', String(n));

  const initial = (settings.name?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <div className='w-full h-full flex flex-col bg-voice-surface text-voice-text overflow-y-auto'>
      <div
        style={{ height: 'var(--safe-area-inset-top)' }}
        className='shrink-0'
      />
      <div className='flex items-center px-4 py-3 shrink-0'>
        <h1 className='flex-1 text-[22px] font-bold'>{t('settings.title')}</h1>
        <button
          type='button'
          onClick={onCancel}
          aria-label={t('settings.title')}
          className='w-9 h-9 flex items-center justify-center rounded-full bg-voice-elevated text-voice-text-secondary'
        >
          <X size={20} />
        </button>
      </div>

      <div className='flex-1 min-h-0 px-4 pb-24'>
        <button
          type='button'
          onClick={() => setRoute('profile')}
          className='w-full flex items-center gap-4 p-4 rounded-[14px] bg-voice-elevated text-left'
        >
          <span className='shrink-0 w-14 h-14 flex items-center justify-center rounded-full bg-voice-accent text-white text-[22px] font-semibold'>
            {initial}
          </span>
          <span className='flex-1 min-w-0'>
            <span className='block text-[17px] font-semibold text-voice-text truncate'>
              {settings.name || t('settings.yourNamePlaceholder')}
            </span>
            <span className='block text-[13px] text-voice-text-secondary truncate'>
              {email}
            </span>
          </span>
          <ChevronRight
            size={18}
            className='shrink-0 text-voice-text-tertiary'
          />
        </button>

        <SectionHeader label={t('settings.sectionConversation')} />
        <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border overflow-hidden'>
          <SettingsRow
            icon={MicVocal}
            title={t('settings.voice')}
            sub={settings.voice || t('common.default')}
            onClick={() => setRoute('voice')}
          />
          <SettingsRow
            icon={Languages}
            title={t('settings.expectedTranscriptionLanguage')}
            sub={
              settings.expected_transcription_language ||
              t('settings.letSpeechToTextGuess')
            }
            onClick={() => setRoute('language')}
          />
          <SettingsRow
            icon={Sparkles}
            title={t('settings.personality')}
            sub={t('settings.configurePrompt')}
            onClick={() => setRoute('personality')}
          />
        </div>

        <SectionHeader label={t('settings.sectionPersonalization')} />
        <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border overflow-hidden'>
          <SettingsRow
            icon={BookText}
            title={t('settings.contexts')}
            sub={count('settings.contextsCount', settings.contexts?.length ?? 0)}
            onClick={() => setRoute('contexts')}
          />
          <SettingsRow
            icon={Tag}
            title={t('settings.additionalKeywords')}
            sub={count(
              'settings.keywordsCount',
              settings.additional_keywords?.length ?? 0,
            )}
            onClick={() => setRoute('keywords')}
          />
          <SettingsRow
            icon={Users}
            title={t('settings.friends')}
            sub={count('settings.friendsCount', settings.friends?.length ?? 0)}
            onClick={() => setRoute('friends')}
          />
          <SettingsRow
            icon={FileText}
            title={t('settings.documents')}
            sub={count(
              'settings.documentsCount',
              settings.documents?.length ?? 0,
            )}
            onClick={() => setRoute('documents')}
          />
        </div>

        <SectionHeader label={t('settings.sectionAccount')} />
        <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border overflow-hidden'>
          <SettingsRow
            icon={Shield}
            title={t('settings.privacy')}
            sub={t('settings.privacySub')}
            onClick={() => setRoute('account')}
          />
        </div>
      </div>
    </div>
  );
};

export default MobileSettingsPopup;
