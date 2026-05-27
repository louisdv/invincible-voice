import { Settings } from 'lucide-react';

interface SettingsButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
  variant?: 'full' | 'icon-only';
}

const SettingsButton = ({
  onClick,
  label,
  className = '',
  variant = 'full',
}: SettingsButtonProps) => {
  if (variant === 'icon-only') {
    return (
      <button
        onClick={onClick}
        className={`shrink-0 h-10 flex flex-row items-center justify-center cursor-pointer bg-voice-surface text-voice-text border border-voice-border rounded-2xl p-2 ${className}`}
        type='button'
      >
        <Settings size={20} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-10 flex flex-row items-center justify-center gap-2 cursor-pointer bg-voice-surface text-voice-text border border-voice-border rounded-2xl text-sm px-5 ${className}`}
      type='button'
    >
      {label}
      <Settings size={20} />
    </button>
  );
};

export default SettingsButton;
