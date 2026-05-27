import { LoaderCircleIcon, Play, XCircle } from 'lucide-react';
import { FC } from 'react';
import { useTranslations } from '@/i18n';

interface VoiceSelectorProps {
  selectedVoice: string | null;
  availableVoices: Record<string, string> | null;
  isLoadingVoices: boolean;
  isPlayingVoice: boolean;
  onVoiceChange: (value: string) => void;
  onTestVoice: () => void;
  onDeleteVoice: () => void;
  showDeleteButton?: boolean;
  theme?: 'light' | 'dark';
}

const VoiceSelector: FC<VoiceSelectorProps> = ({
  selectedVoice,
  availableVoices,
  isLoadingVoices,
  isPlayingVoice,
  onVoiceChange,
  onTestVoice,
  onDeleteVoice,
  showDeleteButton = false,
  theme = 'dark',
}) => {
  const t = useTranslations();
  const isLight = theme === 'light';

  const selectClass = isLight
    ? 'flex-1 px-4 py-3 text-base text-voice-text bg-voice-surface border border-voice-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-voice-accent disabled:opacity-50'
    : 'flex-1 px-4 py-3 text-base text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green disabled:opacity-50';

  const testClass = isLight
    ? 'px-4 py-2 text-sm text-voice-text bg-voice-surface border border-voice-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-voice-accent hover:bg-voice-surface disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap'
    : 'px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green hover:bg-[#2B2B2B] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap';

  const deleteClass = isLight
    ? 'px-3 py-2 text-voice-text bg-voice-surface border border-voice-border rounded-2xl focus:outline-none hover:border-voice-danger'
    : 'px-3 py-2 text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-red-500 hover:bg-[#2B2B2B] hover:border-[#FF6459]';

  return (
    <div className='flex flex-col sm:flex-row gap-2'>
      <select
        value={selectedVoice || ''}
        onChange={(e) => onVoiceChange(e.target.value)}
        disabled={isLoadingVoices}
        className={selectClass}
      >
        <option value=''>{t('common.default')}</option>

        {availableVoices &&
          Object.entries(availableVoices)
            .sort(([, langA], [, langB]) => langA.localeCompare(langB))
            .map(([voiceName, language]) => (
              <option
                key={voiceName}
                value={voiceName}
              >
                {voiceName.includes('/')
                  ? voiceName.substring(voiceName.indexOf('/') + 1)
                  : voiceName}
                ({language})
              </option>
            ))}
      </select>

      <button
        type='button'
        onClick={onTestVoice}
        disabled={!selectedVoice || isPlayingVoice}
        className={testClass}
      >
        {isPlayingVoice ? (
          <LoaderCircleIcon
            size={16}
            className='animate-spin'
          />
        ) : (
          <Play size={16} />
        )}
        {t('settings.testYourVoice')}
      </button>

      {showDeleteButton && (
        <button
          type='button'
          onClick={onDeleteVoice}
          className={deleteClass}
          title={t('common.delete')}
        >
          <XCircle
            size={16}
            className={isLight ? 'text-voice-danger' : 'text-[#FF6459]'}
          />
        </button>
      )}
    </div>
  );
};

export default VoiceSelector;
