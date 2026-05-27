import { render, screen, fireEvent } from '@testing-library/react';
import frMessages from '@/messages/fr.json';
import type { UserSettings } from '@/utils/userData';
import MobileSettingsPopup from '../MobileSettingsPopup';

// Force FR translations regardless of the default test locale, with {count}
// interpolation left intact (the component calls .replace itself).
jest.mock('@/i18n', () => {
  const fr = jest.requireActual('@/messages/fr.json');
  const getNested = (obj: Record<string, unknown>, path: string): string => {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
    return typeof value === 'string' ? value : path;
  };
  return {
    useTranslations: () => (key: string) => getNested(fr, key),
  };
});

// Mock the data layer so navigated sub-screens never hit the network.
jest.mock('@/utils/userData', () => ({
  __esModule: true,
  updateUserSettings: jest.fn().mockResolvedValue({ error: null, status: 200 }),
  getVoices: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  createVoice: jest.fn().mockResolvedValue({ data: null, status: 200 }),
}));

// VoiceScreen uses TTS playback — stub it.
jest.mock('@/utils/ttsUtil', () => ({
  __esModule: true,
  playTTSStream: jest.fn().mockResolvedValue(undefined),
}));

// Heavy children rendered inside sub-screens — keep jsdom deterministic.
jest.mock('@/components/settings/VoiceSelector', () => ({
  __esModule: true,
  default: () => <div data-testid='voice-selector' />,
}));
jest.mock('@/components/settings/VoiceUploadForm', () => ({
  __esModule: true,
  default: () => <div data-testid='voice-upload-form' />,
}));
jest.mock('@/components/settings/DocumentEditorPopup', () => ({
  __esModule: true,
  default: () => null,
}));

void frMessages;

const mockSettings: UserSettings = {
  name: 'Alice',
  prompt: 'Sois utile.',
  additional_keywords: ['mistral', 'gradium'],
  friends: ['Bob', 'Carol', 'Dan'],
  documents: [{ title: 'Notes', content: 'contenu' }],
  contexts: [
    { id: '1', label: 'Travail' },
    { id: '2', label: 'Maison' },
  ],
  voice: null,
  expected_transcription_language: null,
  accepted_terms_of_services: true,
};

const renderPopup = () =>
  render(
    <MobileSettingsPopup
      userSettings={mockSettings}
      email='a@b.test'
      onSave={jest.fn()}
      onCancel={jest.fn()}
    />,
  );

describe('MobileSettingsPopup — index router', () => {
  it('renders all sections on the index screen', () => {
    renderPopup();

    // Profile card
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('a@b.test')).toBeInTheDocument();

    // Conversation section
    expect(screen.getByText(/^voix$/i)).toBeInTheDocument();
    expect(screen.getByText(/langue de transcription/i)).toBeInTheDocument();
    expect(screen.getByText(/^personnalité$/i)).toBeInTheDocument();

    // Personnalisation section
    expect(screen.getByText(/^contextes$/i)).toBeInTheDocument();
    expect(screen.getByText(/^mots-clés supplémentaires$/i)).toBeInTheDocument();
    expect(screen.getByText(/^amis$/i)).toBeInTheDocument();
    expect(screen.getByText(/^documents$/i)).toBeInTheDocument();

    // Account section
    expect(screen.getByText(/confidentialité/i)).toBeInTheDocument();
  });

  it('renders counts via {count} interpolation', () => {
    renderPopup();
    expect(screen.getByText('2 contextes')).toBeInTheDocument();
    expect(screen.getByText('2 mots-clés')).toBeInTheDocument();
    expect(screen.getByText('3 proches')).toBeInTheDocument();
    expect(screen.getByText('1 documents')).toBeInTheDocument();
  });

  it('drills into the Voice sub-screen', async () => {
    renderPopup();

    fireEvent.click(screen.getByText(/^voix$/i));

    // Sub-screen child rendered (awaited to flush async getVoices state),
    // index-only sections gone.
    expect(await screen.findByTestId('voice-selector')).toBeInTheDocument();
    expect(screen.queryByText(/confidentialité/i)).toBeNull();
  });

  it('drills into the Contexts sub-screen showing its CRUD input', () => {
    renderPopup();

    fireEvent.click(screen.getByText(/^contextes$/i));

    // ContextsScreen seeds from settings and shows the existing labels.
    expect(screen.getByText('Travail')).toBeInTheDocument();
    expect(screen.getByText('Maison')).toBeInTheDocument();
    // Index profile card no longer present.
    expect(screen.queryByText('a@b.test')).toBeNull();
  });
});
