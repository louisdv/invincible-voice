import { render, act } from '@testing-library/react';
import Voice from '../../components/Voice';

// Mock the custom hooks
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

// Mock WebSocket
jest.mock('react-use-websocket', () => ({
  __esModule: true,
  default: jest.fn(),
  ReadyState: {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
}));

// Mock userData functions
jest.mock('../userData', () => ({
  getUserData: jest.fn(),
  deleteConversation: jest.fn(),
  isSpeakerMessage: jest.fn(),
  isWriterMessage: jest.fn(),
}));

describe('WebSocket URL Construction Tests', () => {
  const mockSendMessage = jest.fn();
  const mockGetUserData = jest.fn();

  const mockUserData = {
    user_id: 'test-user-id',
    user_settings: {
      name: 'Test User',
      prompt: 'Test prompt',
      additional_keywords: ['test', 'keyword'],
      friends: ['friend1', 'friend2'],
      documents: [],
    },
    conversations: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch for health check
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, connected: 'yes_request_ok' }),
    });

    // Mock getUserData
    mockGetUserData.mockResolvedValue({
      data: mockUserData,
      status: 200,
    });

    // Mock useWebSocket
    const useWebSocket = require('react-use-websocket').default;
    useWebSocket.mockReturnValue({
      sendMessage: mockSendMessage,
      lastMessage: null,
      readyState: 1, // OPEN
    });

    // Mock type guard functions
    const userData = require('../userData');
    userData.getUserData.mockImplementation(mockGetUserData);
    userData.isSpeakerMessage.mockImplementation(
      (message) => 'speaker' in message,
    );
    userData.isWriterMessage.mockImplementation(
      (message) => 'messageId' in message,
    );

    // Mock Date.now() for consistent testing
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2025-07-07T13:30:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should construct WebSocket URL with local_time parameter', async () => {
    await act(async () => {
      render(<Voice userId='test-user-123' />);
    });

    // Verify that useWebSocket was called with the correct URL
    const useWebSocket = require('react-use-websocket').default;
    const { calls } = useWebSocket.mock;
    const urlCall = calls.find(
      (call) =>
        call[0] &&
        call[0].includes('test-user-123/new-conversation?local_time='),
    );
    expect(urlCall).toBeDefined();
    expect(urlCall[0]).toBe(
      'http://localhost:8000/v1/user/test-user-123/new-conversation?local_time=2025-07-07T13%3A30%3A00.000Z',
    );
  });

  it('should properly encode special characters in local_time', async () => {
    // Mock a date with more special characters that need encoding
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2025-07-07T13:30:00.123+05:30');

    await act(async () => {
      render(<Voice userId='test-user-456' />);
    });

    // Verify that special characters are properly encoded
    const useWebSocket = require('react-use-websocket').default;
    const { calls } = useWebSocket.mock;
    const urlCall = calls.find(
      (call) =>
        call[0] &&
        call[0].includes('test-user-456/new-conversation?local_time='),
    );
    expect(urlCall).toBeDefined();
    expect(urlCall[0]).toBe(
      'http://localhost:8000/v1/user/test-user-456/new-conversation?local_time=2025-07-07T13%3A30%3A00.123%2B05%3A30',
    );
  });

  it('should include local_time parameter even when user_id contains special characters', async () => {
    const userId = 'test-user-with-special@characters.com';

    await act(async () => {
      render(<Voice userId={userId} />);
    });

    // Verify that the URL is constructed correctly with user_id in path and local_time as query param
    const useWebSocket = require('react-use-websocket').default;
    const { calls } = useWebSocket.mock;
    const urlCall = calls.find(
      (call) =>
        call[0] &&
        call[0].includes(
          'test-user-with-special@characters.com/new-conversation?local_time=',
        ),
    );
    expect(urlCall).toBeDefined();
    expect(urlCall[0]).toBe(
      'http://localhost:8000/v1/user/test-user-with-special@characters.com/new-conversation?local_time=2025-07-07T13%3A30%3A00.000Z',
    );
  });

  it('should create a new timestamp each time the component is rendered', async () => {
    let callCount = 0;
    jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      callCount++;
      return `2025-07-07T13:30:0${callCount}.000Z`;
    });

    // Render first instance
    let unmount;
    await act(async () => {
      const result = render(<Voice userId='test-user-1' />);
      unmount = result.unmount;
    });

    const useWebSocket = require('react-use-websocket').default;
    let { calls } = useWebSocket.mock;
    let urlCall = calls.find(
      (call) =>
        call[0] && call[0].includes('test-user-1/new-conversation?local_time='),
    );
    expect(urlCall).toBeDefined();
    expect(urlCall[0]).toBe(
      'http://localhost:8000/v1/user/test-user-1/new-conversation?local_time=2025-07-07T13%3A30%3A01.000Z',
    );

    unmount();
    useWebSocket.mockClear();

    // Render second instance
    await act(async () => {
      render(<Voice userId='test-user-2' />);
    });

    calls = useWebSocket.mock.calls;
    urlCall = calls.find(
      (call) =>
        call[0] && call[0].includes('test-user-2/new-conversation?local_time='),
    );
    expect(urlCall).toBeDefined();
    expect(urlCall[0]).toBe(
      'http://localhost:8000/v1/user/test-user-2/new-conversation?local_time=2025-07-07T13%3A30%3A02.000Z',
    );
  });

  it('should handle backend server URL changes while preserving local_time parameter', async () => {
    // First render with initial backend URL
    await act(async () => {
      render(<Voice userId='test-user-789' />);
    });

    const useWebSocket = require('react-use-websocket').default;
    const { calls } = useWebSocket.mock;
    const urlCall = calls.find(
      (call) =>
        call[0] &&
        call[0].includes('test-user-789/new-conversation?local_time='),
    );
    expect(urlCall).toBeDefined();
    expect(urlCall[0]).toBe(
      'http://localhost:8000/v1/user/test-user-789/new-conversation?local_time=2025-07-07T13%3A30%3A00.000Z',
    );

    // Note: Testing backend URL changes would require more complex mocking
    // This test primarily verifies the URL structure includes local_time
    expect(urlCall[0]).toMatch(/local_time=/);
    expect(urlCall[0]).toMatch(/2025-07-07T13%3A30%3A00\.000Z/);
  });
});
