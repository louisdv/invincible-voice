import { render, screen } from '@testing-library/react';
import frMessages from '@/messages/fr.json';
import MobileConversationLayout from '../MobileConversationLayout';

// Force FR translations regardless of the default test locale (en).
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

// ChatInterface (via ChatPanel) renders raw chat — stub it to keep the layout deterministic.
jest.mock('@/components/chat/ChatInterface', () => ({
  __esModule: true,
  default: () => <div data-testid='chat-interface' />,
}));

void frMessages;

const baseProps = {
  textInput: '',
  onTextInputChange: jest.fn(),
  onSendMessage: jest.fn(),
  frozenResponses: null,
  onFreezeToggle: jest.fn(),
  pendingResponses: [],
  onResponseSelect: jest.fn(),
  onConnectButtonPress: jest.fn(),
  onSettingsPress: jest.fn(),
  chatHistory: [],
  isConnected: true,
};

describe('MobileConversationLayout — unified view', () => {
  it('does not render Chat / Responses / History tabs', () => {
    render(<MobileConversationLayout {...baseProps} />);
    expect(screen.queryByRole('button', { name: /chat$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /responses/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /history/i })).toBeNull();
  });

  it('renders chat history, suggestions section and input bar simultaneously', () => {
    render(
      <MobileConversationLayout
        {...baseProps}
        pendingResponses={[
          { id: 'r1', text: 'Salut', isComplete: true, messageId: 'm1' },
          { id: 'r2', text: 'Oui', isComplete: true, messageId: 'm2' },
          { id: 'r3', text: 'Non', isComplete: true, messageId: 'm3' },
        ]}
      />,
    );
    expect(screen.getByText(/réponses suggérées/i)).toBeInTheDocument();
    expect(screen.getByText('Salut')).toBeInTheDocument();
    expect(screen.getByText('Oui')).toBeInTheDocument();
    expect(screen.getByText('Non')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/écrire ou dicter/i),
    ).toBeInTheDocument();
  });
});
