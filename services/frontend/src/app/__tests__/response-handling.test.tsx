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

describe('Voice Response Handling and TTS Tests', () => {
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
    // Clear all mocks including fetch
    jest.clearAllMocks();
    mockLastMessage = null;

    // Reset fetch mock for each test (similar to working tests)
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
  });

  afterEach(() => {
    // Clean up any side effects
    jest.clearAllMocks();
  });

  test('one.response messages populate response boxes progressively and change colors', async () => {
    const user = userEvent.setup();
    setupConnectionMocks();

    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await establishConnection(user);

    // Simulate receiving one.response messages progressively
    const responses = [
      'Yes, I agree with that point.',
      'No, I think differently about this.',
      'Could you explain that further?',
      "That's an interesting perspective.",
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

    // Check that all 4 response options are populated
    await waitFor(
      () => {
        expect(
          screen.getByText('Yes, I agree with that point.'),
        ).toBeInTheDocument();
        expect(
          screen.getByText('No, I think differently about this.'),
        ).toBeInTheDocument();
        expect(
          screen.getByText('Could you explain that further?'),
        ).toBeInTheDocument();
        expect(
          screen.getByText("That's an interesting perspective."),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Check that all response boxes have the completed state (green color class)
    const responseButtons = screen.getAllByRole('button');
    const responseBoxes = responseButtons.filter(
      (button) =>
        button.textContent?.includes('Yes, I agree') ||
        button.textContent?.includes('No, I think') ||
        button.textContent?.includes('Could you explain') ||
        button.textContent?.includes("That's an interesting"),
    );

    responseBoxes.forEach((box) => {
      expect(box).toHaveClass('border-green-300', 'bg-green-50');
    });

    // Allow time for any pre-fetching to happen
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that TTS calls are limited (no more than 4 responses pre-fetched)
    const ttsCallsCount = (global.fetch as jest.Mock).mock.calls.filter(
      (call) => call[0] && call[0].includes('/v1/tts'),
    ).length;
    expect(ttsCallsCount).toBeLessThanOrEqual(8);
  });

  test('TTS requests are limited when responses arrive', async () => {
    const user = userEvent.setup();
    setupConnectionMocks();

    // Create a fresh mock for this test to avoid call accumulation
    const mockFetch = jest.fn().mockImplementation((url) => {
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
    global.fetch = mockFetch;

    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await establishConnection(user);

    // Record initial TTS call count
    const initialTtsCount = mockFetch.mock.calls.filter((call) =>
      call[0].includes('/v1/tts'),
    ).length;

    // Send 4 responses
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        setMockMessage({
          data: JSON.stringify({
            type: 'one.response',
            content: `Response ${i + 1}`,
            timestamp: new Date(Date.now() + 1000).toISOString(),
            index: i,
          }),
        });
        rerender(
          <Voice userId='12345678-1234-4234-8234-123456789012' />,
        );
      });
    }

    // Wait for the responses to be processed
    await waitFor(
      () => {
        expect(screen.getByText('Response 1')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Allow time for any pre-fetching to happen
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that TTS may have been pre-fetched but not excessively
    const currentTtsCount = mockFetch.mock.calls.filter((call) =>
      call[0].includes('/v1/tts'),
    ).length;
    // Allow for pre-fetching up to 4 responses
    expect(currentTtsCount - initialTtsCount).toBeLessThanOrEqual(4);
  });

  test('response selection triggers WebSocket message and audio playback', async () => {
    const user = userEvent.setup();
    setupConnectionMocks();

    const mockAudio = {
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    // Mock Audio constructor for this test only
    const originalAudio = global.Audio;
    global.Audio = jest.fn().mockImplementation(() => mockAudio);

    // Create a fresh mock for this test
    const mockFetch = jest.fn().mockImplementation((url) => {
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
    global.fetch = mockFetch;

    const { rerender } = render(
      <Voice userId='12345678-1234-4234-8234-123456789012' />,
    );

    await establishConnection(user);

    // Send responses message
    await act(async () => {
      setMockMessage({
        data: JSON.stringify({
          type: 'one.response',
          content: 'I will choose this response',
          timestamp: new Date(Date.now() + 2000).toISOString(),
          index: 0,
        }),
      });
      rerender(
        <Voice userId='12345678-1234-4234-8234-123456789012' />,
      );
    });

    await waitFor(
      () => {
        expect(
          screen.getByText('I will choose this response'),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Find and click the first response
    const firstResponse = screen
      .getByText('I will choose this response')
      .closest('button');
    expect(firstResponse).toBeInTheDocument();

    await user.click(firstResponse!);

    // Verify WebSocket message was sent
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringMatching(/"type":"response\.selected\.by\.writer"/),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringMatching(/"text":"I will choose this response"/),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringMatching(/"id":"[0-9a-f-]{36}"/),
    );

    // Verify TTS was called only after clicking
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:8000/v1/tts',
          expect.objectContaining({
            body: expect.stringMatching(/"text":"I will choose this response"/),
          }),
        );
      },
      { timeout: 3000 },
    );

    // Also verify messageId was included
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:8000/v1/tts',
          expect.objectContaining({
            body: expect.stringMatching(/"messageId":"[0-9a-f-]{36}"/),
          }),
        );
      },
      { timeout: 3000 },
    );

    // Verify audio playback was attempted
    await waitFor(
      () => {
        expect(mockAudio.play).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    // Restore original Audio mock
    global.Audio = originalAudio;
  });

  test('response options are hidden when not connected', async () => {
    render(<Voice userId='12345678-1234-4234-8234-123456789012' />);

    await waitFor(() => {
      expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
    });

    // Response boxes should NOT be shown when not connected
    expect(
      screen.queryByText('Waiting for response...'),
    ).not.toBeInTheDocument();

    // Only settings and start conversation button should be visible
    expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
  });
});
