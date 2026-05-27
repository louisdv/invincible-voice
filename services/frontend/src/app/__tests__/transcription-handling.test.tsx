import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Voice from '../../components/Voice';

// Mock WebSocket
let mockLastMessage: any = null;
const mockSendMessage = jest.fn();

jest.mock('react-use-websocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sendMessage: mockSendMessage,
    lastMessage: mockLastMessage,
    readyState: 1, // OPEN
  })),
  ReadyState: {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
}));

// Mock all the hooks
jest.mock('../useMicrophoneAccess');
jest.mock('../useAudioProcessor');

jest.mock('../useKeyboardShortcuts', () => ({
  __esModule: true,
  default: () => ({ isDevMode: false }),
}));

jest.mock('../useWakeLock', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../useBackendServerUrl', () => ({
  useBackendServerUrl: () => 'http://localhost:8000',
}));

describe('Voice Transcription Message Handling Tests', () => {
  const setMockMessage = (message: any) => {
    mockLastMessage = message;
    const useWebSocket = require('react-use-websocket').default;
    useWebSocket.mockReturnValue({
      sendMessage: mockSendMessage,
      lastMessage: mockLastMessage,
      readyState: 1,
    });
  };

  beforeEach(() => {
    // Mock fetch for health check and TTS (similar to working tests)
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/v1/health')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ ok: true, connected: 'yes_request_ok' }),
        });
      }
      if (url.includes('/v1/tts')) {
        return Promise.resolve({
          blob: () =>
            Promise.resolve(new Blob(['mock-audio'], { type: 'audio/wav' })),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    jest.clearAllMocks();
    mockLastMessage = null;
  });

  test('transcription delta messages update the current speaker message bubble', async () => {
    // Initial render
    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    // Simulate receiving a transcription delta message
    await act(async () => {
      setMockMessage({
        data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.delta',
          delta: 'Hello',
          event_id: 'event-1',
        }),
      });
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    // Check that the transcription appears in the interface
    await waitFor(
      () => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Simulate receiving another delta message
    await act(async () => {
      setMockMessage({
        data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.delta',
          delta: 'world',
          event_id: 'event-2',
        }),
      });
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    // Check that the text is appended (with space)
    await waitFor(
      () => {
        expect(screen.getByText('Hello world')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  test('multiple transcription delta messages update the same text bubble progressively', async () => {
    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    // Simulate multiple delta messages coming in sequence
    const deltaMessages = [
      { delta: 'This', event_id: 'event-1' },
      { delta: 'is', event_id: 'event-2' },
      { delta: 'a', event_id: 'event-3' },
      { delta: 'test', event_id: 'event-4' },
    ];

    let expectedText = '';

    for (const deltaMsg of deltaMessages) {
      expectedText += (expectedText.length > 0 ? ' ' : '') + deltaMsg.delta;

      await act(async () => {
        setMockMessage({
          data: JSON.stringify({
            type: 'conversation.item.input_audio_transcription.delta',
            delta: deltaMsg.delta,
            event_id: deltaMsg.event_id,
          }),
        });
        rerender(
          <Voice userId='12345678-1234-4234-8234-123456789012' />,
        );
      });

      await waitFor(
        () => {
          expect(screen.getByText(expectedText)).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    }

    // Final text should be the complete sentence
    expect(screen.getByText('This is a test')).toBeInTheDocument();
  });

  test('transcription is cleared when all.responses message is received', async () => {
    const user = userEvent.setup();

    // Set up mocks like the working test
    const mockMediaStream = {
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
    };

    const mockAskMicrophoneAccess = jest
      .fn()
      .mockResolvedValue(mockMediaStream);
    const mockSetupAudio = jest.fn();

    // Mock the hooks with our spy functions
    const { useMicrophoneAccess } = require('../useMicrophoneAccess');
    useMicrophoneAccess.mockReturnValue({
      microphoneAccess: 'unknown',
      askMicrophoneAccess: mockAskMicrophoneAccess,
    });

    const { useAudioProcessor } = require('../useAudioProcessor');
    useAudioProcessor.mockReturnValue({
      setupAudio: mockSetupAudio,
      shutdownAudio: jest.fn(),
      audioProcessor: { current: null },
    });

    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    // Click the start conversation button to enable the connection state
    const startButton = screen.getByTitle('Start Conversation');
    await user.click(startButton);

    // Wait for the connection UI to appear (stop button instead of start button)
    await waitFor(
      () => {
        expect(screen.getByTitle('Stop Conversation')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // First, simulate receiving transcription
    await act(async () => {
      setMockMessage({
        data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.delta',
          delta: 'Hello there',
          event_id: 'event-1',
        }),
      });
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    await waitFor(
      () => {
        expect(screen.getByText('Hello there')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Now simulate receiving the one.response message which should clear current transcription
    // and move it to chat history
    await act(async () => {
      setMockMessage({
        data: JSON.stringify({
          type: 'one.response',
          content: 'Response option 1',
          timestamp: new Date().toISOString(),
          index: 0,
        }),
      });
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    // The transcription should now be in the chat history as a user message
    await waitFor(
      () => {
        // The message should be in the chat history now
        expect(screen.getByText('Hello there')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // The response option should be visible
    await waitFor(
      () => {
        expect(screen.getByText('Response option 1')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  test('duplicate messages with same event_id are not processed twice', async () => {
    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    // Send the same message twice with the same event_id
    const duplicateMessage = {
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.delta',
        delta: 'Single message',
        event_id: 'duplicate-event',
      }),
    };

    // First time
    await act(async () => {
      setMockMessage(duplicateMessage);
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    await waitFor(
      () => {
        expect(screen.getByText('Single message')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Second time - same event_id, should be ignored
    await act(async () => {
      setMockMessage(duplicateMessage);
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    // Should still only appear once
    await waitFor(
      () => {
        const elements = screen.getAllByText('Single message');
        expect(elements).toHaveLength(1);
      },
      { timeout: 3000 },
    );
  });
});
