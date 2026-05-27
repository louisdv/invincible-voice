'use client';
import { FC, useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/i18n';
import {
  UserSettings,
  updateUserSettings,
  getVoices,
  createVoice,
} from '@/utils/userData';
import { playTTSStream } from '@/utils/ttsUtil';
import VoiceSelector from '@/components/settings/VoiceSelector';
import VoiceUploadForm from '@/components/settings/VoiceUploadForm';
import SubScreenShell from './_SubScreenShell';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const VoiceScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [voice, setVoice] = useState<string | null>(settings.voice ?? null);
  const [availableVoices, setAvailableVoices] = useState<Record<
    string,
    string
  > | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVoices = async () => {
      setIsLoadingVoices(true);
      const result = await getVoices();
      if (result.data) setAvailableVoices(result.data);
      setIsLoadingVoices(false);
    };
    fetchVoices();
  }, []);

  const handleTestVoice = useCallback(async () => {
    if (!voice) return;
    setIsPlayingVoice(true);
    try {
      await playTTSStream({
        text: t('settings.testVoiceMessage'),
        messageId: crypto.randomUUID(),
        voiceName: voice,
      });
    } catch {
      // ignore playback errors
    } finally {
      setIsPlayingVoice(false);
    }
  }, [voice, t]);

  const handleCreateVoice = useCallback(async () => {
    if (!uploadFile || !uploadName.trim()) {
      setUploadError(t('settings.voiceUploadError'));
      return;
    }
    setIsCreating(true);
    setUploadError(null);
    try {
      const result = await createVoice(uploadFile, uploadName);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      if (result.data) {
        const voicesResult = await getVoices();
        if (voicesResult.data) setAvailableVoices(voicesResult.data);
        setVoice(result.data.name);
        setUploadFile(null);
        setUploadName('');
        setShowUpload(false);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCreating(false);
    }
  }, [uploadFile, uploadName, t]);

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, voice };
    const res = await updateUserSettings(updated);
    if (!res.error) onSave(updated);
  };

  return (
    <SubScreenShell
      title={t('settings.voice')}
      onBack={onBack}
      onSave={handleSave}
      saveLabel={t('common.save')}
    >
      <div className='flex flex-col gap-4 pt-2'>
        <VoiceSelector
          theme='light'
          selectedVoice={voice}
          availableVoices={availableVoices}
          isLoadingVoices={isLoadingVoices}
          isPlayingVoice={isPlayingVoice}
          onVoiceChange={(v) => setVoice(v)}
          onTestVoice={handleTestVoice}
          onDeleteVoice={() => {}}
        />

        <button
          type='button'
          onClick={() => setShowUpload((s) => !s)}
          className='w-full py-3 rounded-2xl bg-voice-surface text-voice-text font-medium text-[15px]'
        >
          {t('settings.cloneYourVoice')}
        </button>

        {showUpload && (
          <VoiceUploadForm
            theme='light'
            voiceName={uploadName}
            onVoiceNameChange={setUploadName}
            onFileChange={(f) => {
              setUploadFile(f);
              if (!f) setUploadError(t('settings.voiceUploadInvalidFile'));
              else setUploadError(null);
            }}
            onCreateVoice={handleCreateVoice}
            onCancel={() => {
              setShowUpload(false);
              setUploadFile(null);
              setUploadName('');
              setUploadError(null);
            }}
            isCreating={isCreating}
            error={uploadError}
          />
        )}
      </div>
    </SubScreenShell>
  );
};

export default VoiceScreen;
