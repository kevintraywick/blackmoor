import { canSpend, record } from './spend';

interface SendArgs {
  to: string;     // E.164 format: +15551234567
  body: string;   // already truncated to 320 chars by the caller
}

interface TwilioResponse {
  sid: string;
  price?: string | null;        // negative number as string, e.g. "-0.0079"
  price_unit?: string | null;   // "USD"
  status: string;
}

/**
 * Send an SMS via Twilio. Silently returns false if any required env var
 * is missing, if the budget is paused, or if the API call fails.
 *
 * Cost recording: Twilio returns the per-message price in the response.
 * We record the absolute value so the ledger amounts are positive.
 */
export async function sendSms({ to, body }: SendArgs): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from || !to) return false;

  if (!(await canSpend('twilio'))) {
    console.log('sendSms: skipped — budget paused');
    return false;
  }

  // Twilio Messaging API uses Basic auth with account SID + auth token.
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const params = new URLSearchParams();
  params.set('To', to);
  params.set('From', from);
  params.set('Body', body.slice(0, 320));

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${auth}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: params,
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      // Status + statusText only — never log the response body (CLAUDE.md)
      console.error('sendSms failed:', res.status, res.statusText);
      return false;
    }

    const tw: TwilioResponse = await res.json();
    const priceUsd = tw.price ? Math.abs(parseFloat(tw.price)) : 0.008;

    await record({
      service: 'twilio',
      amount_usd: priceUsd,
      units: 1,
      unit_kind: 'sms',
      details: { sid: tw.sid, status: tw.status, to_masked: to.slice(0, 5) + '****' },
    });

    return true;
  } catch (err) {
    console.error('sendSms error:', err);
    return false;
  }
}
