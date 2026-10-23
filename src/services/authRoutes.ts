
import { Router, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const router = Router();

/* =========================================================
   CONFIGURATION
   ========================================================= */

const RP_NAME = 'Divyang Sahayak';

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';

const EXPECTED_ORIGIN =
  process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

const ACCOUNT_EMAIL = (process.env.APP_LOGIN_EMAIL || '')
  .trim()
  .toLowerCase();
console.log(
  '[AUTH DEBUG] APP_LOGIN_EMAIL loaded:',
  ACCOUNT_EMAIL || '(EMPTY)'
);
const ACCOUNT_PASSWORD = process.env.APP_LOGIN_PASSWORD || '';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const CHALLENGE_DURATION_MS = 5 * 60 * 1000;

/*
 * Registration requires a separate enrollment secret.
 * Set APP_ENROLLMENT_TOKEN in .env and send it in the
 * X-Enrollment-Token header when registering a passkey.
 *
 * Never expose this secret in public frontend code.
 */

const ENROLLMENT_TOKEN =
  process.env.APP_ENROLLMENT_TOKEN || '';

/* =========================================================
   TYPES
   ========================================================= */

type SupportedTransport =
  | 'usb'
  | 'nfc'
  | 'ble'
  | 'internal'
  | 'hybrid';

type StoredCredential = {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports?: SupportedTransport[];
};

type ChallengePurpose = 'registration' | 'authentication';

type ChallengeRecord = {
  challenge: string;
  expiresAt: number;
};

type StoredSession = {
  email: string;
  expiresAt: number;
};

/* =========================================================
   DEVELOPMENT STORAGE
   Replace with a database before production deployment.
   ========================================================= */

const credentials = new Map<string, StoredCredential>();

const challenges = new Map<string, ChallengeRecord>();

const sessions = new Map<string, StoredSession>();

/* =========================================================
   HELPERS
   ========================================================= */

function equalSecret(a: string, b: string): boolean {
  const first = Buffer.from(a, 'utf8');
  const second = Buffer.from(b, 'utf8');

  return (
    first.length === second.length &&
    timingSafeEqual(first, second)
  );
}

function normalizeTransports(
  values?: readonly string[]
): SupportedTransport[] | undefined {
  if (!values) return undefined;

  const allowed = new Set<string>([
    'usb',
    'nfc',
    'ble',
    'internal',
    'hybrid',
  ]);

  return values.filter(
    (value): value is SupportedTransport => allowed.has(value)
  );
}

/*
 * Convert public-key bytes into the ArrayBuffer-backed
 * Uint8Array type expected by the installed WebAuthn library.
 */
function toCredentialPublicKey(
  value: Uint8Array
): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function readCookie(
  req: Request,
  name: string
): string | undefined {
  const cookieHeader = req.headers.cookie || '';

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');

    if (separator < 0) continue;

    const cookieName = part.slice(0, separator).trim();

    if (cookieName === name) {
      try {
        return decodeURIComponent(
          part.slice(separator + 1).trim()
        );
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function setSessionCookie(
  res: Response,
  token: string
): void {
  const cookie = [
    `divyang_session=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    cookie.push('Secure');
  }

  res.setHeader('Set-Cookie', cookie.join('; '));
}

function clearSessionCookie(res: Response): void {
  const cookie = [
    'divyang_session=',
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookie.push('Secure');
  }

  res.setHeader('Set-Cookie', cookie.join('; '));
}

function createSession(
  res: Response,
  email: string
): void {
  const token = randomBytes(32).toString('hex');

  sessions.set(token, {
    email,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });

  setSessionCookie(res, token);
}

function getActiveSession(
  req: Request
): StoredSession | undefined {
  const token = readCookie(req, 'divyang_session');

  if (!token) return undefined;

  const session = sessions.get(token);

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return undefined;
  }

  return session;
}

function saveChallenge(
  purpose: ChallengePurpose,
  email: string,
  challenge: string
): void {
  challenges.set(`${purpose}:${email}`, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_DURATION_MS,
  });
}

function consumeChallenge(
  purpose: ChallengePurpose,
  email: string
): string | undefined {
  const key = `${purpose}:${email}`;
  const record = challenges.get(key);

  // Challenges are single-use, including failed attempts.
  challenges.delete(key);

  if (!record || record.expiresAt <= Date.now()) {
    return undefined;
  }

  return record.challenge;
}

function getRequestedAccount(
  req: Request
): string | undefined {
  if (!ACCOUNT_EMAIL) return undefined;

  const requestedEmail =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : ACCOUNT_EMAIL;

  return equalSecret(requestedEmail, ACCOUNT_EMAIL)
    ? ACCOUNT_EMAIL
    : undefined;
}

function hasValidEnrollmentToken(req: Request): boolean {
  const suppliedToken = req.get('X-Enrollment-Token') || '';

  if (!ENROLLMENT_TOKEN || !suppliedToken) {
    return false;
  }

  return equalSecret(suppliedToken, ENROLLMENT_TOKEN);
}

/* =========================================================
   PASSWORD LOGIN — OPTIONAL FALLBACK
   POST /api/auth/login
   ========================================================= */

router.post(
  '/login',
  (req: Request, res: Response): void => {
    if (!ACCOUNT_EMAIL || !ACCOUNT_PASSWORD) {
      res.status(503).json({
        error:
          'Configure APP_LOGIN_EMAIL and APP_LOGIN_PASSWORD in .env.',
      });
      return;
    }

    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    const password =
      typeof req.body?.password === 'string'
        ? req.body.password
        : '';

    if (
      !equalSecret(email, ACCOUNT_EMAIL) ||
      !equalSecret(password, ACCOUNT_PASSWORD)
    ) {
      res.status(401).json({
        error: 'Invalid email or password.',
      });
      return;
    }

    createSession(res, ACCOUNT_EMAIL);

    res.json({
      success: true,
      user: { email: ACCOUNT_EMAIL },
    });
  }
);

/* =========================================================
   PASSKEY REGISTRATION OPTIONS
   POST /api/auth/webauthn/register/options

   Requires X-Enrollment-Token.
   ========================================================= */

router.post(
  '/webauthn/register/options',
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!hasValidEnrollmentToken(req)) {
        res.status(403).json({
          error: 'Passkey enrollment is not authorized.',
        });
        return;
      }

      const email = getRequestedAccount(req);

      if (!email) {
        res.status(401).json({
          error: 'Account not recognized.',
        });
        return;
      }

      const existingCredential = credentials.get(email);

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: email,
        userDisplayName: 'Divyang Sahayak User',
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'required',
        },
        excludeCredentials: existingCredential
          ? [
              {
                id: existingCredential.id,
                transports: existingCredential.transports,
              },
            ]
          : [],
      });

      saveChallenge(
        'registration',
        email,
        options.challenge
      );

      res.json({
        publicKey: options,
      });
    } catch (error) {
      console.error(
        'Passkey registration options error:',
        error
      );

      res.status(500).json({
        error: 'Could not create registration options.',
      });
    }
  }
);

/* =========================================================
   VERIFY PASSKEY REGISTRATION
   POST /api/auth/webauthn/register/verify

   Requires X-Enrollment-Token.
   ========================================================= */

router.post(
  '/webauthn/register/verify',
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!hasValidEnrollmentToken(req)) {
        res.status(403).json({
          error: 'Passkey enrollment is not authorized.',
        });
        return;
      }

      const email = getRequestedAccount(req);

      if (!email) {
        res.status(401).json({
          error: 'Account not recognized.',
        });
        return;
      }

      const expectedChallenge = consumeChallenge(
        'registration',
        email
      );

      if (!expectedChallenge) {
        res.status(400).json({
          error: 'Registration challenge expired. Try again.',
        });
        return;
      }

      const verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });

      if (
        !verification.verified ||
        !verification.registrationInfo
      ) {
        res.status(400).json({
          error: 'Passkey registration could not be verified.',
        });
        return;
      }

      const credential =
        verification.registrationInfo.credential;

      credentials.set(email, {
        id: credential.id,
        publicKey: toCredentialPublicKey(
          credential.publicKey
        ),
        counter: credential.counter,
        transports: normalizeTransports(
          credential.transports
        ),
      });

      res.json({
        verified: true,
        message: 'Passkey registered successfully.',
      });
    } catch (error) {
      console.error(
        'Passkey registration verification error:',
        error
      );

      res.status(400).json({
        error: 'Passkey registration failed.',
      });
    }
  }
);

/* =========================================================
   PASSKEY LOGIN OPTIONS
   POST /api/auth/webauthn/login/options
   ========================================================= */

router.post(
  '/webauthn/login/options',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const email = getRequestedAccount(req);

      if (!email) {
        res.status(401).json({
          error: 'Account not recognized.',
        });
        return;
      }

      const storedCredential = credentials.get(email);

      if (!storedCredential) {
        res.status(404).json({
          error:
            'No passkey is registered. Register a passkey first.',
        });
        return;
      }

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: [
          {
            id: storedCredential.id,
            transports: storedCredential.transports,
          },
        ],
        userVerification: 'required',
      });

      saveChallenge(
        'authentication',
        email,
        options.challenge
      );

      res.json({
        publicKey: options,
      });
    } catch (error) {
      console.error(
        'Passkey login options error:',
        error
      );

      res.status(500).json({
        error: 'Could not start passkey authentication.',
      });
    }
  }
);

/* =========================================================
   VERIFY PASSKEY LOGIN
   POST /api/auth/webauthn/login/verify
   ========================================================= */

router.post(
  '/webauthn/login/verify',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const email = getRequestedAccount(req);

      if (!email) {
        res.status(401).json({
          error: 'Account not recognized.',
        });
        return;
      }

      const storedCredential = credentials.get(email);

      if (
        !storedCredential ||
        typeof req.body?.id !== 'string' ||
        req.body.id !== storedCredential.id
      ) {
        res.status(401).json({
          error: 'Unknown passkey.',
        });
        return;
      }

      const expectedChallenge = consumeChallenge(
        'authentication',
        email
      );

      if (!expectedChallenge) {
        res.status(400).json({
          error: 'Authentication challenge expired. Try again.',
        });
        return;
      }

      const verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: storedCredential.id,
          publicKey: toCredentialPublicKey(
            storedCredential.publicKey
          ),
          counter: storedCredential.counter,
          transports: storedCredential.transports,
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        res.status(401).json({
          error: 'Passkey verification failed.',
        });
        return;
      }

      storedCredential.counter =
        verification.authenticationInfo.newCounter;

      createSession(res, email);

      res.json({
        verified: true,
        user: { email },
      });
    } catch (error) {
      console.error(
        'Passkey login verification error:',
        error
      );

      res.status(401).json({
        error: 'Passkey authentication failed.',
      });
    }
  }
);

/* =========================================================
   SESSION STATUS
   GET /api/auth/session
   ========================================================= */

router.get(
  '/session',
  (req: Request, res: Response): void => {
    const session = getActiveSession(req);

    if (!session) {
      res.status(401).json({
        authenticated: false,
      });
      return;
    }

    res.json({
      authenticated: true,
      user: {
        email: session.email,
      },
    });
  }
);

/* =========================================================
   LOGOUT
   POST /api/auth/logout
   ========================================================= */

router.post(
  '/logout',
  (req: Request, res: Response): void => {
    const token = readCookie(req, 'divyang_session');

    if (token) {
      sessions.delete(token);
    }

    clearSessionCookie(res);

    res.json({
      success: true,
    });
  }
);

export default router;
