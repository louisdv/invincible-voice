import { LoaderCircleIcon } from 'lucide-react';
import { FC, ChangeEvent } from 'react';
import { useTranslations } from '@/i18n';

interface VoiceUploadFormProps {
  voiceName: string;
  onVoiceNameChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onCreateVoice: () => void;
  onCancel: () => void;
  isCreating: boolean;
  error: string | null;
  theme?: 'light' | 'dark';
}

const VoiceUploadForm: FC<VoiceUploadFormProps> = ({
  voiceName,
  onVoiceNameChange,
  onFileChange,
  onCreateVoice,
  onCancel,
  isCreating,
  error,
  theme = 'dark',
}) => {
  const t = useTranslations();
  const isLight = theme === 'light';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const validExtensions = ['.mp3', '.wav'];
      const fileName = file.name.toLowerCase();
      if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
        onFileChange(null);
        // Error will be set by parent
        return;
      }
      onFileChange(file);
    }
  };

  const containerClass = isLight
    ? 'mt-2 px-4 py-3 bg-voice-surface border border-voice-border rounded-2xl'
    : 'mt-2 px-4 py-3 bg-[#181818] border border-white rounded-2xl';

  const labelClass = isLight
    ? 'text-xs font-medium text-voice-text-secondary'
    : 'text-xs font-medium text-gray-300';

  const inputClass = isLight
    ? 'w-full px-3 py-2 text-sm text-voice-text bg-voice-elevated border border-voice-border rounded-xl focus:outline-none focus:ring-2 focus:ring-voice-accent'
    : 'w-full px-3 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green';

  const fileInputClass = isLight
    ? 'w-full px-3 py-2 text-sm text-voice-text bg-voice-elevated border border-voice-border rounded-xl focus:outline-none focus:ring-2 focus:ring-voice-accent file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-voice-accent file:text-white file:text-sm file:cursor-pointer'
    : 'w-full px-3 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-[#39F2AE] file:text-black file:text-sm file:cursor-pointer';

  const cancelClass = isLight
    ? 'flex-1 px-4 py-2 text-sm text-voice-text bg-voice-elevated border border-voice-border rounded-xl focus:outline-none hover:bg-voice-surface'
    : 'flex-1 px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green hover:bg-[#2B2B2B]';

  const createClass = isLight
    ? 'flex-1 px-4 py-2 text-sm text-white bg-voice-accent rounded-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
    : 'flex-1 px-4 py-2 text-sm text-white bg-[#39F2AE] rounded-xl focus:outline-none hover:bg-[#2EDB9B] disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={containerClass}>
      <div className='flex flex-col gap-3'>
        <div className='flex flex-col gap-1'>
          <label
            htmlFor='voice-upload-name-input'
            className={labelClass}
          >
            {t('settings.voiceName')}
          </label>

          <input
            id='voice-upload-name-input'
            type='text'
            value={voiceName}
            onChange={(e) => onVoiceNameChange(e.target.value)}
            className={inputClass}
            placeholder={t('settings.voiceNamePlaceholder')}
          />
        </div>

        <div className='flex flex-col gap-1'>
          <label
            htmlFor='voice-upload-file-input'
            className={labelClass}
          >
            {t('settings.audioFile')}
          </label>

          <input
            id='voice-upload-file-input'
            type='file'
            accept='.mp3,.wav'
            onChange={handleFileChange}
            className={fileInputClass}
          />
        </div>

        {error && (
          <p className={isLight ? 'text-xs text-voice-danger' : 'text-xs text-red-400'}>
            {error}
          </p>
        )}

        <div className='flex gap-2'>
          <button
            type='button'
            onClick={onCancel}
            className={cancelClass}
          >
            {t('common.cancel')}
          </button>

          <button
            type='button'
            onClick={onCreateVoice}
            disabled={isCreating}
            className={createClass}
          >
            {isCreating ? (
              <LoaderCircleIcon
                size={16}
                className='animate-spin mx-auto'
              />
            ) : (
              t('settings.createVoice')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceUploadForm;
