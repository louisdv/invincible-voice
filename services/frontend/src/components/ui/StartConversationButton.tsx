'use client';

import { Play } from 'lucide-react';
import { FC } from 'react';

interface Props {
  onClick: () => void;
  label: string;
}

const StartConversationButton: FC<Props> = ({ onClick, label }) => (
  <button
    type='button'
    onClick={onClick}
    className='flex items-center gap-2 px-8 py-4 rounded-full bg-voice-text text-white text-[17px] font-semibold pointer-events-auto cursor-pointer'
  >
    <Play size={18} fill='currentColor' />
    {label}
  </button>
);

export default StartConversationButton;
