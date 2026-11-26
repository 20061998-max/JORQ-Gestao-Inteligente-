import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response, type NextFunction } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

dotenv.config();

const __dirname = import.meta.dirname;
const PORT = Number(process.env.PORT || 3000);
const BOOTSTRAPPED_ADMIN_EMAIL = 'josuelroque05052020@gmail.com';

// Load Firebase Project ID from generated config (no IAM required for verifyIdToken)
let firebaseProjectId = '';
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const rawCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    firebaseProjectId = rawCfg.projectId || '';
  }
} catch (err) {
  console.error('Failed to read firebase-applet-config.json:', err);
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp(firebaseProjectId ? { projectId: firebaseProjectId } : undefined);

// ==================== FREE MULTI-LAYER SECURITY SUITE ====================
const securityStats = {
  rateLimitedRequests: 0,
  blockedOriginRequests: 0,
  sanitizedPayloads: 0,
  invalidWebhookSignatures: 0,
  startedAt: new Date().toISOString(),
};

// 1. In-memory sliding-window rate limiter (zero external cost)
interface RateBucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, RateBucket>();

function createRateLimiter(maxRequests: number, windowMs: number, bucketPrefix: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const key = `${bucketPrefix}:${clientIp}`;
    const now = Date.now();
    const existing = rateBuckets.get(key);

    if (!existing || now > existing.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      securityStats.rateLimitedRequests += 1;
      const retrySec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({
        error: `Muitas requisições em sequência. Aguarde ${retrySec}s antes de tentar novamente.`,
      });
      return;
    }

    existing.count += 1;
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - existing.count)));
    next();
  };
}

// Cleanup stale rate buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets.entries()) {
    if (now > b.resetAt) rateBuckets.delete(k);
  }
}, 5 * 60 * 1000).unref();

// 2. Recursive Prototype Pollution & NoSQL Operator Sanitizer
function sanitizeObject(value: unknown, depth = 0): { clean: unknown; modified: boolean } {
  if (depth > 8 || value === null || typeof value !== 'object') {
    return { clean: value, modified: false };
  }
  if (Array.isArray(value)) {
    let modified = false;
    const arr = value.map((item) => {
      const res = sanitizeObject(item, depth + 1);
      if (res.modified) modified = true;
      return res.clean;
    });
    return { clean: arr, modified };
  }
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  let modified = false;
  for (const key of Object.keys(input)) {
    if (
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype' ||
      key.startsWith('$')
    ) {
      modified = true;
      continue;
    }
    const nested = sanitizeObject(input[key], depth + 1);
    if (nested.modified) modified = true;
    output[key] = nested.clean;
  }
  return { clean: output, modified };
}

function inputSanitizerMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    const { clean, modified } = sanitizeObject(req.body);
    if (modified) {
      securityStats.sanitizedPayloads += 1;
      req.body = clean;
    }
  }
  next();
}

// 3. Free HTTP Security Headers (CSP, HSTS, COOP, Permissions-Policy, Nosniff)
function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), usb=(), payment=(self)'
  );

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://firebasestorage.googleapis.com https://*.firebasestorage.app https://www.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://api.mercadopago.com https://www.google.com",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.mercadopago.com.br https://www.google.com https://www.recaptcha.net",
    "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.mercadopago.com.br",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);

  next();
}

// 4. Same-Origin / Host Verification on Protected API Calls
function verifyRequestOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const appUrl = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').trim();
  try {
    const originHost = new URL(origin).host;
    const appHost = appUrl && appUrl !== 'MY_APP_URL' ? new URL(appUrl).host : '';
    if (originHost === forwardedHost || (appHost && originHost === appHost)) {
      next();
      return;
    }
  } catch {
    // invalid origin header
  }
  securityStats.blockedOriginRequests += 1;
  res.status(403).json({ error: 'Origem da requisição não autorizada.' });
}

// Server-side persistent ledger for Mercado Pago idempotency, webhook events, and authoritative access verification
const DATA_DIR = path.resolve(__dirname, '.data');
const LEDGER_FILE = path.join(DATA_DIR, 'mp-ledger.json');

interface VerifiedSubscriptionRecord {
  subscriptionId: string;
  companyId: string;
  userId: string;
  preapprovalId: string;
  planId: string;
  planName: string;
  billingCycle: string;
  totalAmount: number;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | 'overdue';
  mpStatus: string;
  nextBillingDate: string | null;
  lastVerifiedAt: string;
}

interface WebhookLogEntry {
  id: string;
  receivedAt: string;
  type: string;
  action: string;
  dataId: string;
  signatureValid: boolean;
  idempotentDuplicate: boolean;
  resolvedStatus: string;
  error?: string;
}

interface MpLedger {
  processedEvents: Record<string, string>;
  subscriptions: Record<string, VerifiedSubscriptionRecord>;
  companyAccess: Record<string, VerifiedSubscriptionRecord>;
  webhookLogs: WebhookLogEntry[];
}

function readLedger(): MpLedger {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LEDGER_FILE)) {
      return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')) as MpLedger;
    }
  } catch (err) {
    console.error('Error reading MP ledger:', err);
  }
  return {
    processedEvents: {},
    subscriptions: {},
    companyAccess: {},
    webhookLogs: [],
  };
}

function writeLedger(ledger: MpLedger): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${LEDGER_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), 'utf8');
    fs.renameSync(tmp, LEDGER_FILE);
  } catch (err) {
    console.error('Error writing MP ledger:', err);
  }
}

// Verify Firebase ID token middleware
interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    emailVerified: boolean;
  };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }
  const idToken = header.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Token de autenticação inválido.' });
    return;
  }
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(idToken);
    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || '',
      emailVerified: Boolean(decoded.email_verified),
    };
    next();
  } catch (err) {
    console.error('Firebase token verification error:', err);
    res.status(401).json({ error: 'Sessão expirada ou token inválido.' });
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (
    !req.authUser ||
    !req.authUser.emailVerified ||
    req.authUser.email.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL
  ) {
    res.status(403).json({ error: 'Acesso restrito ao administrador autorizado.' });
    return;
  }
  next();
}

// Mercado Pago helpers
function getMpConfig() {
  return {
    accessToken: (process.env.MP_ACCESS_TOKEN || '').trim(),
    webhookSecret: (process.env.MP_WEBHOOK_SECRET || '').trim(),
    environment: process.env.MP_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  };
}

function calculateCyclePricing(
  monthlyPrice: number,
  billingCycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
  cycleDiscounts?: Partial<Record<'monthly' | 'quarterly' | 'semiannual' | 'annual', number>>,
  couponDiscountPercent = 0
) {
  const monthsMap = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
  } as const;
  const defaultDiscounts = {
    monthly: 0,
    quarterly: 3,
    semiannual: 5,
    annual: 8,
  } as const;

  const months = monthsMap[billingCycle];
  const cycleDiscount =
    typeof cycleDiscounts?.[billingCycle] === 'number'
      ? Math.max(0, Math.min(90, Number(cycleDiscounts[billingCycle])))
      : defaultDiscounts[billingCycle];

  const gross = monthlyPrice * months;
  const afterCycle = gross * (1 - cycleDiscount / 100);
  const couponFactor = 1 - Math.max(0, Math.min(90, couponDiscountPercent)) / 100;
  const totalAmount = Math.max(1, Number((afterCycle * couponFactor).toFixed(2)));

  return { months, cycleDiscount, totalAmount };
}

function mapMpStatusToInternal(mpStatus: string): 'pending' | 'authorized' | 'paused' | 'cancelled' | 'overdue' {
  switch ((mpStatus || '').toLowerCase()) {
    case 'authorized':
    case 'approved':
      return 'authorized';
    case 'paused':
      return 'paused';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
    case 'overdue':
      return 'overdue';
    default:
      return 'pending';
  }
}

function validateMpSignature(req: Request, webhookSecret: string): boolean {
  if (!webhookSecret) {
    return true;
  }
  const xSignature = String(req.headers['x-signature'] || '');
  const xRequestId = String(req.headers['x-request-id'] || '');
  const queryDataId = String(req.query['data.id'] || req.query['id'] || req.body?.data?.id || '');

  if (!xSignature || !xRequestId || !queryDataId) {
    return false;
  }

  let ts = '';
  let hashV1 = '';
  for (const part of xSignature.split(',')) {
    const [k, v] = part.split('=');
    if (k && v) {
      if (k.trim() === 'ts') ts = v.trim();
      if (k.trim() === 'v1') hashV1 = v.trim();
    }
  }
  if (!ts || !hashV1) return false;

  const manifest = `id:${queryDataId};request-id:${xRequestId};ts:${ts};`;
  const computed = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  const bufA = Buffer.from(computed, 'hex');
  const bufB = Buffer.from(hashV1, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '512kb' }));
  app.use(inputSanitizerMiddleware);

  const apiLimiter = createRateLimiter(120, 60 * 1000, 'api');
  const aiLimiter = createRateLimiter(20, 60 * 1000, 'ai');
  const checkoutLimiter = createRateLimiter(15, 60 * 1000, 'checkout');
  const webhookLimiter = createRateLimiter(60, 60 * 1000, 'webhook');

  app.use('/api', apiLimiter);

  // ==================== HEALTH & CONFIG ====================
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'jorq-gestao-inteligente' });
  });

  app.get('/api/mercadopago/config-status', (_req, res) => {
    const mp = getMpConfig();
    res.json({
      configured: Boolean(mp.accessToken),
      webhookSecretConfigured: Boolean(mp.webhookSecret),
      environment: mp.environment,
    });
  });

  // Admin-only Security Posture Report
  app.get('/api/security/status', verifyRequestOrigin, requireAuth, requireAdmin, (_req, res) => {
    const mp = getMpConfig();
    res.json({
      headers: {
        csp: true,
        nosniff: true,
        hsts: true,
        referrerPolicy: true,
        coop: true,
        permissionsPolicy: true,
        poweredByHidden: true,
      },
      protections: {
        rateLimiting: true,
        prototypePollutionGuard: true,
        nosqlOperatorSanitizer: true,
        originVerification: true,
        firebaseIdTokenVerification: true,
        firestoreStrictRules: true,
        mpWebhookHmac: Boolean(mp.webhookSecret),
        appCheckConfigured: Boolean((process.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || '').trim()),
      },
      telemetry: securityStats,
    });
  });

  // ==================== MERCADO PAGO SUBSCRIPTIONS ====================
  app.post(
    '/api/mercadopago/create-subscription',
    verifyRequestOrigin,
    checkoutLimiter,
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const mp = getMpConfig();
      if (!mp.accessToken) {
        res.status(503).json({
          error:
            'Integração Mercado Pago aguardando configuração de MP_ACCESS_TOKEN no servidor (Settings > Secrets ou Render).',
          code: 'MP_NOT_CONFIGURED',
        });
        return;
      }

      const {
        subscriptionId,
        companyId,
        planId,
        planName,
        billingCycle,
        monthlyPrice,
        cycleDiscounts,
        couponDiscountPercent,
        payerEmail,
      } = req.body || {};

      if (
        typeof subscriptionId !== 'string' ||
        typeof companyId !== 'string' ||
        typeof planId !== 'string' ||
        typeof planName !== 'string' ||
        !['monthly', 'quarterly', 'semiannual', 'annual'].includes(billingCycle) ||
        typeof monthlyPrice !== 'number' ||
        monthlyPrice <= 0
      ) {
        res.status(400).json({ error: 'Dados da assinatura inválidos.' });
        return;
      }

      const { months, totalAmount } = calculateCyclePricing(
        monthlyPrice,
        billingCycle,
        cycleDiscounts,
        typeof couponDiscountPercent === 'number' ? couponDiscountPercent : 0
      );

      const configuredAppUrl = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').trim();
      const baseHostUrl =
        configuredAppUrl && configuredAppUrl !== 'MY_APP_URL'
          ? configuredAppUrl
          : `${req.protocol}://${req.get('host')}`;
      const appUrl = baseHostUrl.replace(/\/$/, '');
      const backUrl = `${appUrl}/?mp_return=1&subscriptionId=${encodeURIComponent(subscriptionId)}`;
      const notificationUrl = `${appUrl}/api/mercadopago/webhook`;

      try {
        const mpPayload = {
          reason: `JORQ Gestão Inteligente - Plano ${planName} (${billingCycle})`,
          external_reference: subscriptionId,
          payer_email: typeof payerEmail === 'string' && payerEmail ? payerEmail : req.authUser?.email,
          auto_recurring: {
            frequency: months,
            frequency_type: 'months',
            transaction_amount: totalAmount,
            currency_id: 'BRL',
          },
          back_url: backUrl,
          notification_url: notificationUrl,
          status: 'pending',
        };

        const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mp.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mpPayload),
        });

        const mpData = (await mpRes.json()) as Record<string, unknown>;
        if (!mpRes.ok) {
          console.error('Mercado Pago /preapproval error:', mpData);
          res.status(502).json({
            error: (mpData.message as string) || 'Falha ao criar assinatura no Mercado Pago.',
            details: mpData,
          });
          return;
        }

        const preapprovalId = String(mpData.id || '');
        const initPoint = String(mpData.init_point || mpData.sandbox_init_point || '');
        const mpStatus = String(mpData.status || 'pending');

        const ledger = readLedger();
        const record: VerifiedSubscriptionRecord = {
          subscriptionId,
          companyId,
          userId: req.authUser!.uid,
          preapprovalId,
          planId,
          planName,
          billingCycle,
          totalAmount,
          status: mapMpStatusToInternal(mpStatus),
          mpStatus,
          nextBillingDate: typeof mpData.next_payment_date === 'string' ? mpData.next_payment_date : null,
          lastVerifiedAt: new Date().toISOString(),
        };
        ledger.subscriptions[preapprovalId] = record;
        writeLedger(ledger);

        res.json({
          preapprovalId,
          initPoint,
          mpStatus,
          status: record.status,
          totalAmount,
        });
      } catch (err) {
        console.error('Create subscription error:', err);
        res.status(500).json({ error: 'Erro interno ao comunicar com o Mercado Pago.' });
      }
    }
  );

  // Authoritative server-side verification against Mercado Pago API (never trusts client return URL)
  app.post(
    '/api/mercadopago/verify-subscription',
    verifyRequestOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const mp = getMpConfig();
      if (!mp.accessToken) {
        res.status(503).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor.' });
        return;
      }

      const { preapprovalId, companyId, subscriptionId } = req.body || {};
      if (typeof preapprovalId !== 'string' || !preapprovalId.trim()) {
        res.status(400).json({ error: 'Identificador da assinatura (preapprovalId) obrigatório.' });
        return;
      }

      try {
        const mpRes = await fetch(
          `https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId.trim())}`,
          {
            headers: {
              Authorization: `Bearer ${mp.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const mpData = (await mpRes.json()) as Record<string, unknown>;
        if (!mpRes.ok) {
          res.status(502).json({ error: 'Não foi possível consultar a assinatura no Mercado Pago.', details: mpData });
          return;
        }

        const mpStatus = String(mpData.status || 'pending');
        const internalStatus = mapMpStatusToInternal(mpStatus);
        const nextBillingDate = typeof mpData.next_payment_date === 'string' ? mpData.next_payment_date : null;

        const ledger = readLedger();
        const existing = ledger.subscriptions[preapprovalId.trim()];
        const updatedRecord: VerifiedSubscriptionRecord = {
          subscriptionId: subscriptionId || existing?.subscriptionId || String(mpData.external_reference || preapprovalId),
          companyId: companyId || existing?.companyId || '',
          userId: req.authUser!.uid,
          preapprovalId: preapprovalId.trim(),
          planId: existing?.planId || '',
          planName: existing?.planName || String(mpData.reason || 'Plano JORQ'),
          billingCycle: existing?.billingCycle || 'monthly',
          totalAmount:
            typeof (mpData.auto_recurring as Record<string, unknown> | undefined)?.transaction_amount === 'number'
              ? Number((mpData.auto_recurring as Record<string, unknown>).transaction_amount)
              : existing?.totalAmount || 0,
          status: internalStatus,
          mpStatus,
          nextBillingDate,
          lastVerifiedAt: new Date().toISOString(),
        };

        ledger.subscriptions[preapprovalId.trim()] = updatedRecord;
        if (updatedRecord.companyId) {
          ledger.companyAccess[updatedRecord.companyId] = updatedRecord;
        }
        writeLedger(ledger);

        res.json({
          serverConfirmed: true,
          status: internalStatus,
          mpStatus,
          nextBillingDate,
          lastVerifiedAt: updatedRecord.lastVerifiedAt,
        });
      } catch (err) {
        console.error('Verify subscription error:', err);
        res.status(500).json({ error: 'Erro ao validar assinatura junto ao Mercado Pago.' });
      }
    }
  );

  app.get('/api/mercadopago/company-access/:companyId', verifyRequestOrigin, requireAuth, (req: AuthenticatedRequest, res) => {
    // Owner Admin gets permanent free access without payment verification
    if (
      req.authUser?.emailVerified &&
      req.authUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
    ) {
      res.json({ verified: true, ownerFreeAccess: true, record: null });
      return;
    }
    const companyId = String(req.params.companyId || '');
    const ledger = readLedger();
    const record = ledger.companyAccess[companyId];
    if (!record || record.userId !== req.authUser?.uid) {
      res.json({ verified: false, record: null });
      return;
    }
    res.json({ verified: record.status === 'authorized', record });
  });

  app.post(
    '/api/mercadopago/cancel-subscription',
    verifyRequestOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const mp = getMpConfig();
      if (!mp.accessToken) {
        res.status(503).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor.' });
        return;
      }

      const { preapprovalId, companyId } = req.body || {};
      if (typeof preapprovalId !== 'string' || !preapprovalId.trim()) {
        res.status(400).json({ error: 'preapprovalId obrigatório.' });
        return;
      }

      try {
        const mpRes = await fetch(
          `https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId.trim())}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${mp.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'cancelled' }),
          }
        );
        const mpData = (await mpRes.json()) as Record<string, unknown>;
        if (!mpRes.ok) {
          res.status(502).json({ error: 'Falha ao cancelar assinatura no Mercado Pago.', details: mpData });
          return;
        }

        const ledger = readLedger();
        if (ledger.subscriptions[preapprovalId.trim()]) {
          ledger.subscriptions[preapprovalId.trim()].status = 'cancelled';
          ledger.subscriptions[preapprovalId.trim()].mpStatus = 'cancelled';
          ledger.subscriptions[preapprovalId.trim()].lastVerifiedAt = new Date().toISOString();
        }
        if (typeof companyId === 'string' && ledger.companyAccess[companyId]) {
          ledger.companyAccess[companyId].status = 'cancelled';
          ledger.companyAccess[companyId].mpStatus = 'cancelled';
          ledger.companyAccess[companyId].lastVerifiedAt = new Date().toISOString();
        }
        writeLedger(ledger);

        res.json({ cancelled: true, mpStatus: String(mpData.status || 'cancelled') });
      } catch (err) {
        console.error('Cancel subscription error:', err);
        res.status(500).json({ error: 'Erro interno ao cancelar assinatura.' });
      }
    }
  );

  // Mercado Pago Webhook (validates x-signature, enforces idempotency, queries Mercado Pago API directly)
  app.post('/api/mercadopago/webhook', webhookLimiter, async (req, res) => {
    const mp = getMpConfig();
    const signatureValid = validateMpSignature(req, mp.webhookSecret);

    const type = String(req.body?.type || req.query?.topic || 'unknown');
    const action = String(req.body?.action || 'updated');
    const dataId = String(req.body?.data?.id || req.query['data.id'] || req.query['id'] || '');
    const xRequestId = String(req.headers['x-request-id'] || '');
    const idempotencyKey = `${type}:${action}:${dataId}:${xRequestId || req.body?.id || ''}`;

    const ledger = readLedger();

    if (!signatureValid) {
      securityStats.invalidWebhookSignatures += 1;
      ledger.webhookLogs.unshift({
        id: crypto.randomUUID(),
        receivedAt: new Date().toISOString(),
        type,
        action,
        dataId,
        signatureValid: false,
        idempotentDuplicate: false,
        resolvedStatus: 'rejected_signature',
        error: 'Assinatura x-signature inválida.',
      });
      ledger.webhookLogs = ledger.webhookLogs.slice(0, 100);
      writeLedger(ledger);
      res.status(401).json({ error: 'Invalid x-signature' });
      return;
    }

    if (ledger.processedEvents[idempotencyKey]) {
      ledger.webhookLogs.unshift({
        id: crypto.randomUUID(),
        receivedAt: new Date().toISOString(),
        type,
        action,
        dataId,
        signatureValid: true,
        idempotentDuplicate: true,
        resolvedStatus: 'skipped_duplicate',
      });
      ledger.webhookLogs = ledger.webhookLogs.slice(0, 100);
      writeLedger(ledger);
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    let resolvedStatus = 'received';
    let errorMsg: string | undefined;

    try {
      if (mp.accessToken && dataId) {
        if (type === 'subscription_preapproval') {
          const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`, {
            headers: { Authorization: `Bearer ${mp.accessToken}` },
          });
          if (mpRes.ok) {
            const mpData = (await mpRes.json()) as Record<string, unknown>;
            const mpStatus = String(mpData.status || 'pending');
            resolvedStatus = mpStatus;
            const internal = mapMpStatusToInternal(mpStatus);
            if (ledger.subscriptions[dataId]) {
              ledger.subscriptions[dataId].status = internal;
              ledger.subscriptions[dataId].mpStatus = mpStatus;
              ledger.subscriptions[dataId].lastVerifiedAt = new Date().toISOString();
              const compId = ledger.subscriptions[dataId].companyId;
              if (compId) {
                ledger.companyAccess[compId] = ledger.subscriptions[dataId];
              }
            }
          } else {
            errorMsg = `MP preapproval query HTTP ${mpRes.status}`;
          }
        } else if (type === 'subscription_authorized_payment') {
          const mpRes = await fetch(
            `https://api.mercadopago.com/authorized_payments/${encodeURIComponent(dataId)}`,
            { headers: { Authorization: `Bearer ${mp.accessToken}` } }
          );
          if (mpRes.ok) {
            const mpData = (await mpRes.json()) as Record<string, unknown>;
            resolvedStatus = String(mpData.status || 'processed');
            const preapprovalId = String(mpData.preapproval_id || '');
            if (preapprovalId && ledger.subscriptions[preapprovalId]) {
              const paymentStatus = String((mpData.payment as Record<string, unknown> | undefined)?.status || mpData.status || '');
              if (paymentStatus === 'approved' || paymentStatus === 'processed') {
                ledger.subscriptions[preapprovalId].status = 'authorized';
              } else if (paymentStatus === 'rejected') {
                ledger.subscriptions[preapprovalId].status = 'overdue';
              }
              ledger.subscriptions[preapprovalId].lastVerifiedAt = new Date().toISOString();
              const compId = ledger.subscriptions[preapprovalId].companyId;
              if (compId) {
                ledger.companyAccess[compId] = ledger.subscriptions[preapprovalId];
              }
            }
          } else {
            errorMsg = `MP authorized_payment query HTTP ${mpRes.status}`;
          }
        } else if (type === 'payment') {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
            headers: { Authorization: `Bearer ${mp.accessToken}` },
          });
          if (mpRes.ok) {
            const mpData = (await mpRes.json()) as Record<string, unknown>;
            resolvedStatus = String(mpData.status || 'pending');
          } else {
            errorMsg = `MP payment query HTTP ${mpRes.status}`;
          }
        }
      }

      ledger.processedEvents[idempotencyKey] = new Date().toISOString();
      ledger.webhookLogs.unshift({
        id: crypto.randomUUID(),
        receivedAt: new Date().toISOString(),
        type,
        action,
        dataId,
        signatureValid: true,
        idempotentDuplicate: false,
        resolvedStatus,
        ...(errorMsg ? { error: errorMsg } : {}),
      });
      ledger.webhookLogs = ledger.webhookLogs.slice(0, 100);
      writeLedger(ledger);
      res.status(200).json({ ok: true, resolvedStatus });
    } catch (err) {
      console.error('Webhook processing error:', err);
      ledger.webhookLogs.unshift({
        id: crypto.randomUUID(),
        receivedAt: new Date().toISOString(),
        type,
        action,
        dataId,
        signatureValid: true,
        idempotentDuplicate: false,
        resolvedStatus: 'error',
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      });
      ledger.webhookLogs = ledger.webhookLogs.slice(0, 100);
      writeLedger(ledger);
      res.status(500).json({ error: 'Erro ao processar webhook' });
    }
  });

  app.get('/api/mercadopago/webhook-logs', verifyRequestOrigin, requireAuth, requireAdmin, (_req, res) => {
    const ledger = readLedger();
    res.json({
      logs: ledger.webhookLogs,
      verifiedSubscriptions: Object.values(ledger.subscriptions),
    });
  });

  // ==================== SERVER-SIDE GEMINI AI ====================
  app.post(
    '/api/ai/financial-analysis',
    verifyRequestOrigin,
    aiLimiter,
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const apiKey = (process.env.GEMINI_API_KEY || '').trim();
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'Chave Gemini não configurada no servidor (Settings > Secrets).',
        });
        return;
      }

      const { companyName, sector, monthlyGoal, summary, question, mode, language } = req.body || {};
      if (!companyName || !summary) {
        res.status(400).json({ error: 'Contexto financeiro da empresa obrigatório.' });
        return;
      }

      const targetLang: 'pt' | 'en' | 'es' | 'fr' =
        language === 'en' || language === 'es' || language === 'fr' ? language : 'pt';
      const languagePromptMap: Record<'pt' | 'en' | 'es' | 'fr', string> = {
        pt: 'Responda sempre em português do Brasil claro, direto e prático para empreendedores sem formação técnica em contabilidade.',
        en: 'Always respond in clear, direct, practical English tailored for business owners without an accounting background.',
        es: 'Responde siempre en español claro, directo y práctico para emprendedores sin formación técnica en contabilidad.',
        fr: 'Répondez toujours en français clair, direct et pratique pour des dirigeants sans formation technique en comptabilité.',
      };

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const systemInstruction =
          'Você é um consultor financeiro sênior especializado em PMEs para a plataforma JORQ Gestão Inteligente. ' +
          languagePromptMap[targetLang] +
          ' Baseie suas conclusões exclusivamente nos números reais fornecidos no contexto. ' +
          'Formate sua resposta com seções limpas e objetivas sem jargões excessivos.';

        const userPrompt =
          mode === 'qa' && typeof question === 'string' && question.trim()
            ? `Empresa: ${companyName} (Setor: ${sector || 'Geral'}). Meta mensal de receita: R$ ${monthlyGoal || 0}.\n` +
              `Resumo financeiro atual:\n${JSON.stringify(summary, null, 2)}\n\n` +
              `Pergunta do gestor: ${question.trim()}`
            : mode === 'forecast'
            ? `Empresa: ${companyName} (Setor: ${sector || 'Geral'}). Meta mensal de receita: R$ ${monthlyGoal || 0}.\n` +
              `Dados financeiros reais:\n${JSON.stringify(summary, null, 2)}\n\n` +
              `Gere uma previsão financeira objetiva para os próximos 3 meses (cenário conservador, realista e otimista), ` +
              `analise o risco de caixa e recomende 3 ações práticas para atingir ou superar a meta mensal.`
            : `Empresa: ${companyName} (Setor: ${sector || 'Geral'}). Meta mensal de receita: R$ ${monthlyGoal || 0}.\n` +
              `Dados financeiros reais:\n${JSON.stringify(summary, null, 2)}\n\n` +
              `Faça um diagnóstico financeiro completo explicando: (1) Saúde do lucro e margem líquida, ` +
              `(2) Principais ralos de despesa, (3) Desempenho do catálogo de produtos/serviços e clientes, e ` +
              `(4) Plano de ação prioritário para os próximos 30 dias.`;

        const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const extractErrorInfo = (err: unknown): { code: number; status: string; message: string } => {
          const rawMsg = err instanceof Error ? err.message : String(err || '');
          let code =
            typeof (err as { status?: unknown })?.status === 'number'
              ? Number((err as { status?: number }).status)
              : 0;
          let status = '';
          let message = rawMsg;

          try {
            const parsed = JSON.parse(rawMsg);
            const inner = parsed?.error || parsed;
            if (typeof inner?.code === 'number') code = inner.code;
            if (typeof inner?.status === 'string') status = inner.status;
            if (typeof inner?.message === 'string') message = inner.message;
          } catch {
            const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                const inner = parsed?.error || parsed;
                if (typeof inner?.code === 'number') code = inner.code;
                if (typeof inner?.status === 'string') status = inner.status;
                if (typeof inner?.message === 'string') message = inner.message;
              } catch {
                // Keep raw message
              }
            }
          }

          return { code, status, message };
        };

        const isTransientError = (info: { code: number; status: string; message: string }) =>
          info.code === 503 ||
          info.code === 429 ||
          info.status === 'UNAVAILABLE' ||
          info.status === 'INDISPONÍVEL' ||
          /high demand|alta demanda|overloaded|unavailable|temporariamente/i.test(info.message);

        let responseText = '';
        let lastErr: unknown = null;

        for (const modelName of candidateModels) {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: userPrompt,
                config: {
                  systemInstruction,
                },
              });
              responseText = response.text || '';
              if (responseText) break;
            } catch (err) {
              lastErr = err;
              const info = extractErrorInfo(err);
              if (!isTransientError(info)) {
                throw err;
              }
              if (attempt === 0) {
                await sleep(700);
              }
            }
          }
          if (responseText) break;
        }

        if (!responseText) {
          throw lastErr || new Error('Não foi possível obter resposta da Inteligência Artificial.');
        }

        res.json({
          analysis: responseText || 'Não foi possível gerar análise no momento.',
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Gemini AI error:', err);
        const raw = err instanceof Error ? err.message : 'Erro ao consultar inteligência artificial.';
        let httpStatus = 502;
        let friendlyMessage = raw;

        try {
          const parsed = JSON.parse(raw);
          const inner = parsed?.error || parsed;
          const code = Number(inner?.code || 0);
          const status = String(inner?.status || '');
          const msg = String(inner?.message || raw);
          if (code === 503 || status === 'UNAVAILABLE' || status === 'INDISPONÍVEL' || /alta demanda|high demand/i.test(msg)) {
            httpStatus = 503;
            friendlyMessage =
              'O serviço de Inteligência Artificial está com pico temporário de demanda no momento. Aguarde alguns segundos e clique em "Tentar novamente".';
          } else if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
            httpStatus = 429;
            friendlyMessage =
              'Limite temporário de requisições da API Gemini atingido. Aguarde um instante e tente novamente.';
          } else if (code === 400 || code === 401 || code === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
            httpStatus = 403;
            friendlyMessage =
              'A chave GEMINI_API_KEY configurada no servidor foi recusada ou está inválida. Verifique a variável de ambiente no painel do Render.';
          } else {
            friendlyMessage = msg;
          }
        } catch {
          if (/503|alta demanda|high demand|UNAVAILABLE|INDISPON/i.test(raw)) {
            httpStatus = 503;
            friendlyMessage =
              'O serviço de Inteligência Artificial está com pico temporário de demanda no momento. Aguarde alguns segundos e clique em "Tentar novamente".';
          }
        }

        res.status(httpStatus).json({ error: friendlyMessage });
      }
    }
  );

  // ==================== VITE / STATIC SERVING ====================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.all('/api/*', (_req, res) => {
      res.status(404).json({ error: 'Rota de API não encontrada.' });
    });
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JORQ Gestão Inteligente server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
