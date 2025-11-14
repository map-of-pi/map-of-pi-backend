import { env } from "../utils/env";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { transports } from "winston";

// initialize Sentry only in production environment
if (env.NODE_ENV === 'production') {
  try {
    // initialize Sentry
    Sentry.init({
      dsn: env.SENTRY_DSN,
      integrations: [
        nodeProfilingIntegration(),
      ],
      tracesSampleRate: 1.0, // adjust this based on your need for performance monitoring
      profilesSampleRate: 1.0
    });

  } catch (error: any) {
    throw new Error(`Failed connection to Sentry: ${error}`);
  }
}

// create a custom Sentry transport for Winston in production
class SentryTransport extends transports.Stream {
  // categories that should always be sent to Sentry regardless of log level
  private alwaysSendCategories = new Set(['stats']);

  log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    const { level, message, error, category, ...rest } = info;
    const shouldForceSend =
      category && this.alwaysSendCategories.has(category);

    // Send to Sentry if level is 'error', OR category is in alwaysSendCategories
    if (level === 'error' || shouldForceSend) {
      const sentryLevel = level === 'error' ? 'error' : 'error'; // keep 'error' so it bypasses prod filter
      const tags = { category: category || 'uncategorized' };

      if (error instanceof Error) {
        Sentry.captureException(error, { level: sentryLevel, tags, extra: rest });
      } else {
        Sentry.captureMessage(message || JSON.stringify(info), {
          level: sentryLevel,
          tags,
          extra: rest
        });
      }
    }
    callback();
    return true;
  }
}

export { SentryTransport };