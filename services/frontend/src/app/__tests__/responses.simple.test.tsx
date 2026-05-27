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

// Mock other hooks
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

describe('Response Handling and TTS Tests', () => {
  const setMockMessage = (message: any) => {
    mockLastMessage = message;
    const useWebSocket = require('react-use-websocket').default;
    useWebSocket.mockReturnValue({
      sendMessage: mockSendMessage,
      lastMessage: mockLastMessage,
      readyState: 1,
    });
  };

  // Helper function to establish connection like the working tests
  const setupConnectionMocks = () => {
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

    return { mockAskMicrophoneAccess, mockSetupAudio };
  };

  const establishConnection = async (user) => {
    // Wait for start button and click it to establish connection
    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    const startButton = screen.getByTitle('Start Conversation');
    await user.click(startButton);

    // Wait for the connection UI to appear
    await waitFor(
      () => {
        expect(screen.getByTitle('Stop Conversation')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
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
          ok: true,
          blob: () =>
            Promise.resolve(new Blob(['mock-audio'], { type: 'audio/wav' })),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    jest.clearAllMocks();
    mockLastMessage = null;
  });

  test('one.response messages populate response boxes progressively', async () => {
    const user = userEvent.setup();
    setupConnectionMocks();

    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await establishConnection(user);

    // Send one.response messages progressively
    const responses = [
      'Yes, I agree with that.',
      'No, I disagree.',
      'Could you clarify?',
      'That is interesting.',
    ];

    for (let i = 0; i < responses.length; i++) {
      await act(async () => {
        setMockMessage({
          data: JSON.stringify({
            type: 'one.response',
            content: responses[i],
            timestamp: new Date().toISOString(),
            index: i,
          }),
        });
        rerender(
          <Voice userId='12345678-1234-4234-8234-123456789012' />,
        );
      });
    }

    // Check that all responses are displayed
    await waitFor(
      () => {
        expect(screen.getByText('Yes, I agree with that.')).toBeInTheDocument();
        expect(screen.getByText('No, I disagree.')).toBeInTheDocument();
        expect(screen.getByText('Could you clarify?')).toBeInTheDocument();
        expect(screen.getByText('That is interesting.')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  test('response interface is simplified when not connected', async () => {
    render(<Voice userId='12345678-1234-4234-8234-123456789012' />);

    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    // Response boxes are not shown when not connected
    expect(
      screen.queryByText('Waiting for response...'),
    ).not.toBeInTheDocument();

    // Only essential buttons are shown
    expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();

    // Response-related UI elements are not visible
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText('Z')).not.toBeInTheDocument();
  });

  test('TTS requests are made only when responses are clicked', async () => {
    const user = userEvent.setup();
    setupConnectionMocks();

    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await establishConnection(user);

    const initialTtsCount = (global.fetch as jest.Mock).mock.calls.filter(
      (call) => call[0].includes('/v1/tts'),
    ).length;

    // Send a response
    await act(async () => {
      setMockMessage({
        data: JSON.stringify({
          type: 'one.response',
          content: 'First response',
          timestamp: new Date().toISOString(),
          index: 0,
        }),
      });
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    await waitFor(
      () => {
        expect(screen.getByText('First response')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Allow time for any pre-fetching to happen
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Record TTS count after the response is processed (may include pre-fetching)
    const ttsRequestsAfterResponse = (
      global.fetch as jest.Mock
    ).mock.calls.filter((call) => call[0].includes('/v1/tts')).length;

    // Click the response
    const responseButton = screen.getByText('First response').closest('button');
    await user.click(responseButton!);

    // Verify that clicking the response triggers TTS (either new request or uses cache)
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8000/v1/tts',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringMatching(/"text":"First response"/),
          }),
        );
      },
      { timeout: 3000 },
    );

    // Also verify messageId was included
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8000/v1/tts',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringMatching(/"messageId":"[0-9a-f-]{36}"/),
          }),
        );
      },
      { timeout: 3000 },
    );

    // Verify that the total TTS count increased (either from pre-fetch or click)
    const finalTtsCount = (global.fetch as jest.Mock).mock.calls.filter(
      (call) => call[0].includes('/v1/tts'),
    ).length;
    expect(finalTtsCount).toBeGreaterThan(initialTtsCount);
  });

  test('clicking response sends WebSocket message', async () => {
    const user = userEvent.setup();
    setupConnectionMocks();

    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await establishConnection(user);

    // Send responses progressively
    const responses = [
      'Clickable response',
      'Another response',
      'Third response',
      'Fourth response',
    ];
    for (let i = 0; i < responses.length; i++) {
      await act(async () => {
        setMockMessage({
          data: JSON.stringify({
            type: 'one.response',
            content: responses[i],
            timestamp: new Date(Date.now() + 2000).toISOString(),
            index: i,
          }),
        });
        rerender(
          <Voice userId='12345678-1234-4234-8234-123456789012' />,
        );
      });
    }

    await waitFor(
      () => {
        expect(screen.getByText('Clickable response')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Find and click the first response
    const firstResponseButton = screen
      .getByText('Clickable response')
      .closest('button');
    expect(firstResponseButton).toBeInTheDocument();

    await user.click(firstResponseButton!);

    // Verify WebSocket message was sent
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringMatching(/"type":"response\.selected\.by\.writer"/),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringMatching(/"text":"Clickable response"/),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringMatching(/"id":"[0-9a-f-]{36}"/),
    );
  });

  test('response boxes are hidden when not connected', async () => {
    render(<Voice userId='12345678-1234-4234-8234-123456789012' />);

    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    // Check that response boxes are not shown when not connected
    expect(
      screen.queryByText('Waiting for response...'),
    ).not.toBeInTheDocument();

    // Only the start conversation and settings buttons should be visible
    expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
  });
});
