import * as Sentry from '@sentry/node';
import { PassThrough } from 'stream';
import { SentryTransport } from '../../src/config/sentryConnection';

// Mock Sentry so no network calls are made
jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

describe('SentryTransport class', () => {
  let transport: SentryTransport;
  const mockCallback = jest.fn();

  beforeEach(() => {
    transport = new SentryTransport({ stream: new PassThrough() });
  });

  it('should send error-level log with message to Sentry.captureMessage', () => {
    const mockErrorMessage = 'Error log message';
    
    transport.log({ level: 'error', message: mockErrorMessage }, mockCallback);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      mockErrorMessage, 
      expect.objectContaining({
        level: 'error',
        tags: { category: 'uncategorized' },
        extra: {}
      })
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should send error-level log with Error object to Sentry.captureException', () => {
    const mockError = new Error('Error object log message');

    transport.log({ level: 'error', error: mockError }, mockCallback);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      mockError, 
      expect.objectContaining({
        level: 'error',
        tags: { category: 'uncategorized' },
        extra: {}
      })
    );
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should send non-error log if category is in alwaysSendCategories', () => {
    const mockInfoMessage = "alwaysSendCategories info message"

    transport.log({ level: 'info', category: 'stats', message: mockInfoMessage }, mockCallback);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      mockInfoMessage, 
      expect.objectContaining({
        level: 'error', // forced to error so it bypasses prod filter
        tags: { category: 'stats' },
        extra: {}
      })
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should not send non-error log if category is not in alwaysSendCategories', () => {
    const mockInfoMessage = "Non alwaysSendCategories info message"
    
    transport.log({ level: 'info', category: 'general', message: mockInfoMessage }, mockCallback);

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});