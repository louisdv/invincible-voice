'use client';
import { FC, PropsWithChildren } from 'react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  saveLabel?: string;
}

const SubScreenShell: FC<PropsWithChildren<Props>> = ({
  title,
  onBack,
  onSave,
  saveLabel,
  children,
}) => (
  <div className='w-full h-full flex flex-col bg-voice-bg text-voice-text overflow-y-auto'>
    <div
      style={{ height: 'var(--safe-area-inset-top)' }}
      className='shrink-0'
    />
    <div className='flex items-center px-2 py-2 shrink-0'>
      <button
        onClick={onBack}
        className='w-11 h-11 flex items-center justify-center'
      >
        <ChevronLeft
          size={24}
          className='text-voice-accent'
        />
      </button>
      <h1 className='flex-1 text-center text-[17px] font-semibold pr-11'>
        {title}
      </h1>
    </div>
    <div className='flex-1 min-h-0 px-4 pb-24'>{children}</div>
    {onSave && (
      <div className='sticky bottom-0 px-4 pt-3 pb-6 bg-voice-bg border-t border-voice-border shrink-0'>
        <button
          onClick={onSave}
          className='w-full py-4 rounded-full bg-voice-accent text-white font-semibold text-[17px]'
        >
          {saveLabel ?? 'Enregistrer'}
        </button>
      </div>
    )}
  </div>
);

export default SubScreenShell;
