import { render, screen, waitFor } from '@testing-library/react';

// Mock the Voice component
jest.mock('../Voice', () => {
  return function MockVoice({ userId }: { userId: string }) {
    return (
      <div
        data-testid='invincible-voice'
        data-user-id={userId}
      >
        Voice Component
      </div>
    );
  };
});

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn();
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: mockRandomUUID,
  },
});

// Helper function to test UUID validation (copied from the actual implementation)
function isValidUUID(uuid: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

describe('UUID Validation Logic', () => {
  test('isValidUUID function correctly validates UUIDs', () => {
    // Valid UUIDs (proper v1-v5 with correct variant bits)
    expect(isValidUUID('12345678-1234-4234-8234-123456789012')).toBe(true); // v4
    expect(isValidUUID('a1b2c3d4-e5f6-1234-8abc-123456789012')).toBe(true); // v1
    expect(isValidUUID('00000000-0000-4000-8000-000000000000')).toBe(true); // v4
    expect(isValidUUID('ffffffff-ffff-4fff-bfff-ffffffffffff')).toBe(true); // v4

    // Invalid UUIDs
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('12345678-1234-1234-1234-12345678901')).toBe(false); // too short
    expect(isValidUUID('12345678-1234-1234-1234-1234567890123')).toBe(false); // too long
    expect(isValidUUID('12345678-1234-6234-1234-123456789012')).toBe(false); // wrong version (6 instead of 1-5)
    expect(isValidUUID('12345678-1234-1234-f234-123456789012')).toBe(false); // wrong variant (f instead of 8,9,a,b)
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('null')).toBe(false);
    expect(isValidUUID('undefined')).toBe(false);
  });
});

describe('Home Page Component Tests', () => {
  let mockURLSearchParams: jest.Mock;
  let mockURL: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use a proper v4 UUID format
    mockRandomUUID.mockReturnValue('12345678-1234-4234-8234-123456789012');

    // Mock URLSearchParams
    mockURLSearchParams = jest.fn();
    global.URLSearchParams = mockURLSearchParams;

    // Mock URL constructor
    mockURL = jest.fn();
    global.URL = mockURL;
  });

  test('shows user creation screen when no user_id parameter', async () => {
    // Mock URLSearchParams to return no user_id
    mockURLSearchParams.mockImplementation(() => ({
      get: jest.fn().mockReturnValue(null),
    }));

    // Mock URL constructor
    mockURL.mockImplementation((url: string) => ({
      toString: () => url,
      searchParams: {
        set: jest.fn().mockReturnThis(),
      },
    }));

    // Import component here to ensure mocks are set up
    const Home = require('../page').default;

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByText('Welcome to Voice'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "You don't have a user ID yet. Create a new one by clicking the link below:",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Create New User ID: 12345678-1234-4234-8234-123456789012',
      ),
    ).toBeInTheDocument();
    expect(mockRandomUUID).toHaveBeenCalled();
  });

  test('shows user creation screen when user_id parameter is invalid', async () => {
    // Mock URLSearchParams to return invalid UUID
    mockURLSearchParams.mockImplementation(() => ({
      get: jest.fn().mockReturnValue('invalid-uuid'),
    }));

    mockURL.mockImplementation((url: string) => ({
      toString: () => url,
      searchParams: {
        set: jest.fn().mockReturnThis(),
      },
    }));

    const Home = require('../page').default;

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByText('Welcome to Voice'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "You don't have a user ID yet. Create a new one by clicking the link below:",
      ),
    ).toBeInTheDocument();
  });

  test('renders Voice component with valid UUID', async () => {
    const validUUID = '12345678-1234-4234-8234-123456789012';

    // Mock URLSearchParams to return valid UUID
    mockURLSearchParams.mockImplementation(() => ({
      get: jest.fn().mockReturnValue(validUUID),
    }));

    const Home = require('../page').default;

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByTestId('invincible-voice')).toBeInTheDocument();
    });

    const component = screen.getByTestId('invincible-voice');
    expect(component).toHaveAttribute('data-user-id', validUUID);
  });

  test('crypto.randomUUID is called when no valid UUID is present', async () => {
    mockURLSearchParams.mockImplementation(() => ({
      get: jest.fn().mockReturnValue(null),
    }));

    mockURL.mockImplementation((url: string) => ({
      toString: () => url,
      searchParams: {
        set: jest.fn().mockReturnThis(),
      },
    }));

    const Home = require('../page').default;

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByText('Welcome to Voice'),
      ).toBeInTheDocument();
    });

    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });
});
