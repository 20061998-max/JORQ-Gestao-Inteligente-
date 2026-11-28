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

// Load Firebase Project ID & Database ID from generated config (no IAM required for verifyIdToken)
let firebaseProjectId = '';
let firestoreDatabaseId = '(default)';
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const rawCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    firebaseProjectId = rawCfg.projectId || '';
    firestoreDatabaseId = rawCfg.firestoreDatabaseId || '(default)';
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
  paymentMethod?: 'pix' | 'recurring';
  nextBillingDate: string | null;
  lastVerifiedAt: string;
  pixData?: {
    paymentId: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string;
    expiresAt: string;
  };
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

interface CompanyTrialRecord {
  companyId: string;
  active: boolean;
  trialExpiresAt: string;
  trialGrantedAt: string;
  trialNote?: string;
}

interface MpLedger {
  processedEvents: Record<string, string>;
  subscriptions: Record<string, VerifiedSubscriptionRecord>;
  companyAccess: Record<string, VerifiedSubscriptionRecord>;
  companyTrials: Record<string, CompanyTrialRecord>;
  webhookLogs: WebhookLogEntry[];
}

function readLedger(): MpLedger {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LEDGER_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')) as Partial<MpLedger>;
      return {
        processedEvents: parsed.processedEvents || {},
        subscriptions: parsed.subscriptions || {},
        companyAccess: parsed.companyAccess || {},
        companyTrials: parsed.companyTrials || {},
        webhookLogs: Array.isArray(parsed.webhookLogs) ? parsed.webhookLogs : [],
      };
    }
  } catch (err) {
    console.error('Error reading MP ledger:', err);
  }
  return {
    processedEvents: {},
    subscriptions: {},
    companyAccess: {},
    companyTrials: {},
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

function isRecordExpired(isoStr?: string | null, nowMs = Date.now()): boolean {
  if (!isoStr) return false;
  const ts = Date.parse(isoStr);
  if (Number.isNaN(ts)) return false;
  return ts <= nowMs;
}

async function fetchFirestoreCompanyInfo(
  idToken: string | undefined,
  companyId: string
): Promise<{ status: string; trialExpiresAt: string; trialGrantedAt: string; trialNote: string } | null> {
  if (!idToken || !firebaseProjectId || !companyId) return null;
  try {
    const dbName = firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseProjectId
    )}/databases/${encodeURIComponent(dbName)}/documents/companies/${encodeURIComponent(companyId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { fields?: Record<string, { stringValue?: string }> };
    const fields = data.fields || {};
    return {
      status: fields.status?.stringValue || 'active',
      trialExpiresAt: fields.trialExpiresAt?.stringValue || '',
      trialGrantedAt: fields.trialGrantedAt?.stringValue || '',
      trialNote: fields.trialNote?.stringValue || '',
    };
  } catch {
    return null;
  }
}

// Verify Firebase ID token middleware
interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    emailVerified: boolean;
  };
  rawIdToken?: string;
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
    req.rawIdToken = idToken;
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

function getCycleMonths(billingCycle: string): number {
  switch (billingCycle) {
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
    default:
      return 1;
  }
}

function addMonthsIso(baseIso: string, months: number): string {
  const date = new Date(baseIso);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + months);
    return fallback.toISOString();
  }
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function formatMpApiError(mpData: Record<string, unknown>, fallback: string): string {
  const rawMessage = String(mpData.message || '');
  const causeMsg = Array.isArray(mpData.cause)
    ? mpData.cause.map((c) => String((c as Record<string, unknown>)?.description || '')).join(' ')
    : '';
  const combined = `${rawMessage} ${causeMsg}`.toLowerCase();
  if (
    combined.includes('same') && (combined.includes('email') || combined.includes('collector') || combined.includes('payer')) ||
    combined.includes('cannot pay yourself')
  ) {
    return 'O Mercado Pago não permite pagar com o mesmo e-mail da conta vendedora. Teste usando outra conta ou e-mail de comprador.';
  }
  if (combined.includes('unauthorized') || combined.includes('invalid access token')) {
    return 'Chave MP_ACCESS_TOKEN recusada pelo Mercado Pago. Verifique se o token está correto para o ambiente (Sandbox/Produção).';
  }
  return rawMessage || fallback;
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
            error: formatMpApiError(mpData, 'Falha ao criar assinatura no Mercado Pago.'),
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
          paymentMethod: 'recurring',
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

  // ==================== MERCADO PAGO PIX (QR CODE + COPIA E COLA) ====================
  app.post(
    '/api/mercadopago/create-pix-payment',
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
        payerName,
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
        res.status(400).json({ error: 'Dados do pagamento Pix inválidos.' });
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
      const notificationUrl = `${appUrl}/api/mercadopago/webhook`;

      const resolvedEmail =
        typeof payerEmail === 'string' && payerEmail.includes('@')
          ? payerEmail.trim()
          : req.authUser?.email || 'cliente@jorq.app';
      const firstName =
        typeof payerName === 'string' && payerName.trim()
          ? payerName.trim().split(/\s+/)[0].slice(0, 60)
          : 'Cliente';
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      try {
        const pixPayload = {
          transaction_amount: totalAmount,
          description: `JORQ Gestão Inteligente - Plano ${planName} (${billingCycle})`.slice(0, 200),
          payment_method_id: 'pix',
          external_reference: subscriptionId,
          notification_url: notificationUrl,
          date_of_expiration: expiresAt,
          payer: {
            email: resolvedEmail,
            first_name: firstName,
          },
          metadata: {
            subscription_id: subscriptionId,
            company_id: companyId,
            user_id: req.authUser!.uid,
            plan_id: planId,
            plan_name: planName,
            billing_cycle: billingCycle,
            months,
          },
        };

        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mp.accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify(pixPayload),
        });

        const mpData = (await mpRes.json()) as Record<string, unknown>;
        if (!mpRes.ok) {
          console.error('Mercado Pago /v1/payments (Pix) error:', mpData);
          res.status(502).json({
            error: formatMpApiError(mpData, 'Falha ao gerar QR Code Pix no Mercado Pago.'),
            details: mpData,
          });
          return;
        }

        const paymentId = String(mpData.id || '');
        const preapprovalKey = `pix_${paymentId}`;
        const mpStatus = String(mpData.status || 'pending');
        const internalStatus = mapMpStatusToInternal(mpStatus);
        const poi = (mpData.point_of_interaction || {}) as Record<string, unknown>;
        const txData = (poi.transaction_data || {}) as Record<string, unknown>;
        const qrCode = String(txData.qr_code || '');
        const qrCodeBase64 = String(txData.qr_code_base64 || '');
        const ticketUrl = String(txData.ticket_url || '');
        const mpExpiresAt = String(mpData.date_of_expiration || expiresAt);

        const nextBillingDate =
          internalStatus === 'authorized'
            ? addMonthsIso(String(mpData.date_approved || new Date().toISOString()), months)
            : null;

        const ledger = readLedger();
        const record: VerifiedSubscriptionRecord = {
          subscriptionId,
          companyId,
          userId: req.authUser!.uid,
          preapprovalId: preapprovalKey,
          planId,
          planName,
          billingCycle,
          totalAmount,
          status: internalStatus,
          mpStatus,
          paymentMethod: 'pix',
          nextBillingDate,
          lastVerifiedAt: new Date().toISOString(),
          pixData: {
            paymentId,
            qrCode,
            qrCodeBase64,
            ticketUrl,
            expiresAt: mpExpiresAt,
          },
        };
        ledger.subscriptions[preapprovalKey] = record;
        if (internalStatus === 'authorized') {
          ledger.companyAccess[companyId] = record;
        }
        writeLedger(ledger);

        res.json({
          paymentId,
          preapprovalId: preapprovalKey,
          initPoint: ticketUrl,
          qrCode,
          qrCodeBase64,
          ticketUrl,
          expiresAt: mpExpiresAt,
          mpStatus,
          status: internalStatus,
          totalAmount,
        });
      } catch (err) {
        console.error('Create Pix payment error:', err);
        res.status(500).json({ error: 'Erro interno ao gerar pagamento Pix no Mercado Pago.' });
      }
    }
  );

  app.post(
    '/api/mercadopago/verify-pix-payment',
    verifyRequestOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const mp = getMpConfig();
      if (!mp.accessToken) {
        res.status(503).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor.' });
        return;
      }

      const { paymentId, companyId, subscriptionId, billingCycle: reqCycle } = req.body || {};
      const rawId = typeof paymentId === 'string' ? paymentId.replace(/^pix_/, '').trim() : '';
      if (!rawId) {
        res.status(400).json({ error: 'Identificador do pagamento Pix obrigatório.' });
        return;
      }

      try {
        const mpRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(rawId)}`,
          {
            headers: {
              Authorization: `Bearer ${mp.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const mpData = (await mpRes.json()) as Record<string, unknown>;
        if (!mpRes.ok) {
          res.status(502).json({ error: 'Não foi possível consultar o Pix no Mercado Pago.', details: mpData });
          return;
        }

        const mpStatus = String(mpData.status || 'pending');
        const internalStatus = mapMpStatusToInternal(mpStatus);
        const key = `pix_${rawId}`;
        const ledger = readLedger();
        const existing = ledger.subscriptions[key];
        const metadata = (mpData.metadata || {}) as Record<string, unknown>;
        const resolvedCycle = String(
          existing?.billingCycle || metadata.billing_cycle || (typeof reqCycle === 'string' && reqCycle) || 'monthly'
        );
        const months = getCycleMonths(resolvedCycle);
        const paidAt =
          typeof mpData.date_approved === 'string' && mpData.date_approved
            ? mpData.date_approved
            : typeof mpData.date_created === 'string' && mpData.date_created
              ? mpData.date_created
              : new Date().toISOString();
        const nextBillingDate =
          internalStatus === 'authorized'
            ? addMonthsIso(paidAt, months)
            : existing?.nextBillingDate || null;
        const expired = internalStatus === 'authorized' && isRecordExpired(nextBillingDate);
        const effectiveStatus = expired ? 'overdue' : internalStatus;

        const poi = (mpData.point_of_interaction || {}) as Record<string, unknown>;
        const txData = (poi.transaction_data || {}) as Record<string, unknown>;

        const updatedRecord: VerifiedSubscriptionRecord = {
          subscriptionId:
            subscriptionId ||
            existing?.subscriptionId ||
            String(mpData.external_reference || key),
          companyId: companyId || existing?.companyId || String(metadata.company_id || ''),
          userId: existing?.userId || req.authUser!.uid,
          preapprovalId: key,
          planId: existing?.planId || String(metadata.plan_id || ''),
          planName: existing?.planName || String(metadata.plan_name || mpData.description || 'Plano JORQ'),
          billingCycle: resolvedCycle,
          totalAmount:
            typeof mpData.transaction_amount === 'number'
              ? Number(mpData.transaction_amount)
              : existing?.totalAmount || 0,
          status: effectiveStatus,
          mpStatus,
          paymentMethod: 'pix',
          nextBillingDate,
          lastVerifiedAt: new Date().toISOString(),
          pixData: existing?.pixData || {
            paymentId: rawId,
            qrCode: String(txData.qr_code || ''),
            qrCodeBase64: String(txData.qr_code_base64 || ''),
            ticketUrl: String(txData.ticket_url || ''),
            expiresAt: String(mpData.date_of_expiration || ''),
          },
        };

        ledger.subscriptions[key] = updatedRecord;
        if (updatedRecord.companyId) {
          const currentAccess = ledger.companyAccess[updatedRecord.companyId];
          if (
            effectiveStatus === 'authorized' ||
            !currentAccess ||
            currentAccess.status !== 'authorized' ||
            isRecordExpired(currentAccess.nextBillingDate) ||
            currentAccess.subscriptionId === updatedRecord.subscriptionId
          ) {
            ledger.companyAccess[updatedRecord.companyId] = updatedRecord;
          }
        }
        writeLedger(ledger);

        res.json({
          serverConfirmed: true,
          status: effectiveStatus,
          mpStatus,
          expired,
          nextBillingDate,
          paidAt,
          lastVerifiedAt: updatedRecord.lastVerifiedAt,
          paymentMethod: 'pix',
          pixData: updatedRecord.pixData,
        });
      } catch (err) {
        console.error('Verify Pix payment error:', err);
        res.status(500).json({ error: 'Erro ao consultar pagamento Pix junto ao Mercado Pago.' });
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

      const { preapprovalId, companyId, subscriptionId, billingCycle: reqCycle } = req.body || {};
      if (typeof preapprovalId !== 'string' || !preapprovalId.trim()) {
        res.status(400).json({ error: 'Identificador da assinatura (preapprovalId) obrigatório.' });
        return;
      }

      const cleanId = preapprovalId.trim();

      try {
        if (cleanId.startsWith('pix_')) {
          const rawPaymentId = cleanId.slice(4);
          const mpRes = await fetch(
            `https://api.mercadopago.com/v1/payments/${encodeURIComponent(rawPaymentId)}`,
            {
              headers: {
                Authorization: `Bearer ${mp.accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
          const mpData = (await mpRes.json()) as Record<string, unknown>;
          if (!mpRes.ok) {
            res.status(502).json({ error: 'Não foi possível consultar o pagamento Pix no Mercado Pago.', details: mpData });
            return;
          }
          const mpStatus = String(mpData.status || 'pending');
          const internalStatus = mapMpStatusToInternal(mpStatus);
          const ledger = readLedger();
          const existing = ledger.subscriptions[cleanId];
          const metadata = (mpData.metadata || {}) as Record<string, unknown>;
          const resolvedCycle = String(
            existing?.billingCycle || metadata.billing_cycle || (typeof reqCycle === 'string' && reqCycle) || 'monthly'
          );
          const paidAt =
            typeof mpData.date_approved === 'string' && mpData.date_approved
              ? mpData.date_approved
              : typeof mpData.date_created === 'string' && mpData.date_created
                ? mpData.date_created
                : new Date().toISOString();
          const nextBillingDate =
            internalStatus === 'authorized'
              ? addMonthsIso(paidAt, getCycleMonths(resolvedCycle))
              : existing?.nextBillingDate || null;
          const expired = internalStatus === 'authorized' && isRecordExpired(nextBillingDate);
          const effectiveStatus = expired ? 'overdue' : internalStatus;

          const updatedRecord: VerifiedSubscriptionRecord = {
            subscriptionId: subscriptionId || existing?.subscriptionId || String(mpData.external_reference || cleanId),
            companyId: companyId || existing?.companyId || String(metadata.company_id || ''),
            userId: existing?.userId || req.authUser!.uid,
            preapprovalId: cleanId,
            planId: existing?.planId || String(metadata.plan_id || ''),
            planName: existing?.planName || String(metadata.plan_name || mpData.description || 'Plano JORQ'),
            billingCycle: resolvedCycle,
            totalAmount:
              typeof mpData.transaction_amount === 'number'
                ? Number(mpData.transaction_amount)
                : existing?.totalAmount || 0,
            status: effectiveStatus,
            mpStatus,
            paymentMethod: 'pix',
            nextBillingDate,
            lastVerifiedAt: new Date().toISOString(),
            pixData: existing?.pixData,
          };
          ledger.subscriptions[cleanId] = updatedRecord;
          if (updatedRecord.companyId) {
            const currentAccess = ledger.companyAccess[updatedRecord.companyId];
            if (
              effectiveStatus === 'authorized' ||
              !currentAccess ||
              currentAccess.status !== 'authorized' ||
              isRecordExpired(currentAccess.nextBillingDate) ||
              currentAccess.subscriptionId === updatedRecord.subscriptionId
            ) {
              ledger.companyAccess[updatedRecord.companyId] = updatedRecord;
            }
          }
          writeLedger(ledger);
          res.json({
            serverConfirmed: true,
            status: effectiveStatus,
            mpStatus,
            expired,
            nextBillingDate,
            paidAt,
            lastVerifiedAt: updatedRecord.lastVerifiedAt,
            paymentMethod: 'pix',
          });
          return;
        }

        const mpRes = await fetch(
          `https://api.mercadopago.com/preapproval/${encodeURIComponent(cleanId)}`,
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
        const ledger = readLedger();
        const existing = ledger.subscriptions[cleanId];
        const resolvedCycle = String(
          existing?.billingCycle || (typeof reqCycle === 'string' && reqCycle) || 'monthly'
        );
        const paidAt =
          typeof mpData.date_created === 'string' && mpData.date_created
            ? mpData.date_created
            : new Date().toISOString();
        const nextBillingDate =
          typeof mpData.next_payment_date === 'string' && mpData.next_payment_date
            ? mpData.next_payment_date
            : typeof mpData.end_date === 'string' && mpData.end_date
              ? mpData.end_date
              : internalStatus === 'authorized'
                ? existing?.nextBillingDate || addMonthsIso(paidAt, getCycleMonths(resolvedCycle))
                : existing?.nextBillingDate || null;
        const expired = internalStatus === 'authorized' && isRecordExpired(nextBillingDate);
        const effectiveStatus = expired ? 'overdue' : internalStatus;

        const updatedRecord: VerifiedSubscriptionRecord = {
          subscriptionId: subscriptionId || existing?.subscriptionId || String(mpData.external_reference || cleanId),
          companyId: companyId || existing?.companyId || '',
          userId: req.authUser!.uid,
          preapprovalId: cleanId,
          planId: existing?.planId || '',
          planName: existing?.planName || String(mpData.reason || 'Plano JORQ'),
          billingCycle: resolvedCycle,
          totalAmount:
            typeof (mpData.auto_recurring as Record<string, unknown> | undefined)?.transaction_amount === 'number'
              ? Number((mpData.auto_recurring as Record<string, unknown>).transaction_amount)
              : existing?.totalAmount || 0,
          status: effectiveStatus,
          mpStatus,
          paymentMethod: 'recurring',
          nextBillingDate,
          lastVerifiedAt: new Date().toISOString(),
        };

        ledger.subscriptions[cleanId] = updatedRecord;
        if (updatedRecord.companyId) {
          const currentAccess = ledger.companyAccess[updatedRecord.companyId];
          if (
            effectiveStatus === 'authorized' ||
            !currentAccess ||
            currentAccess.status !== 'authorized' ||
            isRecordExpired(currentAccess.nextBillingDate) ||
            currentAccess.subscriptionId === updatedRecord.subscriptionId
          ) {
            ledger.companyAccess[updatedRecord.companyId] = updatedRecord;
          }
        }
        writeLedger(ledger);

        res.json({
          serverConfirmed: true,
          status: effectiveStatus,
          mpStatus,
          expired,
          nextBillingDate,
          paidAt,
          lastVerifiedAt: updatedRecord.lastVerifiedAt,
        });
      } catch (err) {
        console.error('Verify subscription error:', err);
        res.status(500).json({ error: 'Erro ao validar assinatura junto ao Mercado Pago.' });
      }
    }
  );

  // Sync multiple subscriptions & return parameters at once, enforcing plan expiration and Cliente Teste trials
  app.post(
    '/api/mercadopago/sync-company-access',
    verifyRequestOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      if (
        req.authUser?.emailVerified &&
        req.authUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
      ) {
        res.json({
          verified: true,
          ownerFreeAccess: true,
          expired: false,
          trialActive: false,
          trialExpiresAt: null,
          activeRecord: null,
          syncedSubscriptions: [],
        });
        return;
      }

      const { companyId, subscriptionChecks, subscriptions: bodySubscriptions, returnParams } = req.body || {};
      const rawChecks = Array.isArray(subscriptionChecks)
        ? subscriptionChecks
        : Array.isArray(bodySubscriptions)
          ? bodySubscriptions
          : [];
      if (typeof companyId !== 'string' || !companyId.trim()) {
        res.status(400).json({ error: 'companyId obrigatório.' });
        return;
      }
      const cleanCompanyId = companyId.trim();
      const ledger = readLedger();
      let ledgerDirty = false;

      // Sync company status & Cliente Teste from Firestore using caller's own verified ID token
      const fsCompany = await fetchFirestoreCompanyInfo(req.rawIdToken, cleanCompanyId);
      if (fsCompany) {
        if (fsCompany.status === 'suspended') {
          res.json({
            verified: false,
            suspended: true,
            expired: false,
            trialActive: false,
            trialExpiresAt: null,
            activeRecord: null,
            syncedSubscriptions: [],
          });
          return;
        }
        if (fsCompany.status === 'trial' && fsCompany.trialExpiresAt) {
          ledger.companyTrials[cleanCompanyId] = {
            companyId: cleanCompanyId,
            active: true,
            trialExpiresAt: fsCompany.trialExpiresAt,
            trialGrantedAt: fsCompany.trialGrantedAt,
            trialNote: fsCompany.trialNote,
          };
          ledgerDirty = true;
        } else if (fsCompany.status === 'active' && ledger.companyTrials[cleanCompanyId]?.active) {
          ledger.companyTrials[cleanCompanyId].active = false;
          ledgerDirty = true;
        }
      }

      const trialRecord = ledger.companyTrials[cleanCompanyId];
      const trialActive = Boolean(
        trialRecord && trialRecord.active && trialRecord.trialExpiresAt && !isRecordExpired(trialRecord.trialExpiresAt)
      );
      const trialExpired = Boolean(
        trialRecord && trialRecord.active && trialRecord.trialExpiresAt && isRecordExpired(trialRecord.trialExpiresAt)
      );

      // Re-validate existing ledger companyAccess expiration
      const existingCompanyAccess = ledger.companyAccess[cleanCompanyId];
      let hadExpiredSub = false;
      if (existingCompanyAccess && existingCompanyAccess.status === 'authorized') {
        if (isRecordExpired(existingCompanyAccess.nextBillingDate)) {
          existingCompanyAccess.status = 'overdue';
          ledgerDirty = true;
          hadExpiredSub = true;
        }
      }

      // Build deduplicated list of Mercado Pago candidates to verify
      const mp = getMpConfig();
      const candidates: Array<{
        subscriptionId?: string;
        mpPreapprovalId: string;
        billingCycle?: string;
      }> = [];
      const seenMpIds = new Set<string>();

      const pushCandidate = (mpPreapprovalId?: string, subscriptionId?: string, billingCycle?: string) => {
        const clean = typeof mpPreapprovalId === 'string' ? mpPreapprovalId.trim() : '';
        if (!clean || seenMpIds.has(clean)) return;
        seenMpIds.add(clean);
        candidates.push({ mpPreapprovalId: clean, subscriptionId, billingCycle });
      };

      if (returnParams && typeof returnParams === 'object') {
        const rp = returnParams as Record<string, unknown>;
        const retSubId = typeof rp.subscriptionId === 'string' ? rp.subscriptionId : undefined;
        if (typeof rp.preapprovalId === 'string' && rp.preapprovalId.trim()) {
          pushCandidate(rp.preapprovalId, retSubId);
        }
        const rawPayId =
          (typeof rp.paymentId === 'string' && rp.paymentId.trim()) ||
          (typeof rp.collectionId === 'string' && rp.collectionId.trim()) ||
          '';
        if (rawPayId && rawPayId !== 'null') {
          const pixKey = rawPayId.startsWith('pix_') ? rawPayId : `pix_${rawPayId}`;
          pushCandidate(pixKey, retSubId);
        }
      }

      if (rawChecks.length > 0) {
        for (const item of rawChecks.slice(0, 10)) {
          if (item && typeof item === 'object') {
            const rec = item as Record<string, unknown>;
            const subIdVal =
              typeof rec.subscriptionId === 'string'
                ? rec.subscriptionId
                : typeof rec.id === 'string'
                  ? rec.id
                  : undefined;
            pushCandidate(
              typeof rec.mpPreapprovalId === 'string' ? rec.mpPreapprovalId : '',
              subIdVal,
              typeof rec.billingCycle === 'string' ? rec.billingCycle : undefined
            );
          }
        }
      }

      const syncedSubscriptions: Array<{
        subscriptionId?: string;
        mpPreapprovalId: string;
        status: string;
        mpStatus: string;
        nextBillingDate: string | null;
        paidAt?: string;
        expired: boolean;
      }> = [];

      if (mp.accessToken && candidates.length > 0) {
        for (const cand of candidates) {
          const cleanId = cand.mpPreapprovalId;
          const isPix = cleanId.startsWith('pix_');
          try {
            const mpUrl = isPix
              ? `https://api.mercadopago.com/v1/payments/${encodeURIComponent(cleanId.slice(4))}`
              : `https://api.mercadopago.com/preapproval/${encodeURIComponent(cleanId)}`;
            const mpRes = await fetch(mpUrl, {
              headers: {
                Authorization: `Bearer ${mp.accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (!mpRes.ok) continue;
            const mpData = (await mpRes.json()) as Record<string, unknown>;
            const mpStatus = String(mpData.status || 'pending');
            const internal = mapMpStatusToInternal(mpStatus);
            const existingSub = ledger.subscriptions[cleanId];
            const metadata = (mpData.metadata || {}) as Record<string, unknown>;
            const resolvedCycle = String(
              cand.billingCycle || existingSub?.billingCycle || metadata.billing_cycle || 'monthly'
            );
            const paidAt = isPix
              ? typeof mpData.date_approved === 'string' && mpData.date_approved
                ? mpData.date_approved
                : typeof mpData.date_created === 'string' && mpData.date_created
                  ? mpData.date_created
                  : new Date().toISOString()
              : typeof mpData.date_created === 'string' && mpData.date_created
                ? mpData.date_created
                : new Date().toISOString();
            const nextBillingDate = isPix
              ? internal === 'authorized'
                ? addMonthsIso(paidAt, getCycleMonths(resolvedCycle))
                : existingSub?.nextBillingDate || null
              : typeof mpData.next_payment_date === 'string' && mpData.next_payment_date
                ? mpData.next_payment_date
                : typeof mpData.end_date === 'string' && mpData.end_date
                  ? mpData.end_date
                  : internal === 'authorized'
                    ? existingSub?.nextBillingDate || addMonthsIso(paidAt, getCycleMonths(resolvedCycle))
                    : existingSub?.nextBillingDate || null;

            const expired = internal === 'authorized' && isRecordExpired(nextBillingDate);
            if (expired) hadExpiredSub = true;
            const effectiveStatus = expired ? 'overdue' : internal;
            const resolvedSubId =
              cand.subscriptionId ||
              existingSub?.subscriptionId ||
              String(mpData.external_reference || cleanId);

            const record: VerifiedSubscriptionRecord = {
              subscriptionId: resolvedSubId,
              companyId: cleanCompanyId,
              userId: existingSub?.userId || req.authUser!.uid,
              preapprovalId: cleanId,
              planId: existingSub?.planId || String(metadata.plan_id || ''),
              planName:
                existingSub?.planName ||
                String(metadata.plan_name || mpData.reason || mpData.description || 'Plano JORQ'),
              billingCycle: resolvedCycle,
              totalAmount: isPix
                ? typeof mpData.transaction_amount === 'number'
                  ? Number(mpData.transaction_amount)
                  : existingSub?.totalAmount || 0
                : typeof (mpData.auto_recurring as Record<string, unknown> | undefined)?.transaction_amount === 'number'
                  ? Number((mpData.auto_recurring as Record<string, unknown>).transaction_amount)
                  : existingSub?.totalAmount || 0,
              status: effectiveStatus,
              mpStatus,
              paymentMethod: isPix ? 'pix' : 'recurring',
              nextBillingDate,
              lastVerifiedAt: new Date().toISOString(),
              pixData: existingSub?.pixData,
            };
            ledger.subscriptions[cleanId] = record;
            const currentAccess = ledger.companyAccess[cleanCompanyId];
            if (
              effectiveStatus === 'authorized' ||
              !currentAccess ||
              currentAccess.status !== 'authorized' ||
              isRecordExpired(currentAccess.nextBillingDate) ||
              currentAccess.subscriptionId === resolvedSubId
            ) {
              ledger.companyAccess[cleanCompanyId] = record;
            }
            ledgerDirty = true;

            syncedSubscriptions.push({
              subscriptionId: resolvedSubId,
              mpPreapprovalId: cleanId,
              status: effectiveStatus,
              mpStatus,
              nextBillingDate,
              paidAt,
              expired,
            });
          } catch {
            // ignore transient single MP query error
          }
        }
      }

      if (ledgerDirty) {
        writeLedger(ledger);
      }

      const finalAccess = ledger.companyAccess[cleanCompanyId];
      const paidSubActive = Boolean(
        finalAccess &&
          finalAccess.status === 'authorized' &&
          (!finalAccess.userId || finalAccess.userId === req.authUser?.uid) &&
          !isRecordExpired(finalAccess.nextBillingDate)
      );

      const verified = trialActive || paidSubActive;
      const expired = !verified && (hadExpiredSub || trialExpired || Boolean(finalAccess?.status === 'overdue'));

      res.json({
        verified,
        paidSubActive,
        expired,
        trialActive,
        trialExpiresAt: trialActive ? trialRecord?.trialExpiresAt || null : null,
        activeRecord: paidSubActive ? finalAccess : null,
        syncedSubscriptions,
      });
    }
  );

  app.get(
    '/api/mercadopago/company-access/:companyId',
    verifyRequestOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      // Owner Admin gets permanent free access without payment verification
      if (
        req.authUser?.emailVerified &&
        req.authUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
      ) {
        res.json({ verified: true, ownerFreeAccess: true, trialActive: false, expired: false, record: null });
        return;
      }
      const companyId = String(req.params.companyId || '');
      const ledger = readLedger();
      let ledgerDirty = false;

      const fsCompany = await fetchFirestoreCompanyInfo(req.rawIdToken, companyId);
      if (fsCompany) {
        if (fsCompany.status === 'suspended') {
          res.json({ verified: false, suspended: true, trialActive: false, expired: false, record: null });
          return;
        }
        if (fsCompany.status === 'trial' && fsCompany.trialExpiresAt) {
          ledger.companyTrials[companyId] = {
            companyId,
            active: true,
            trialExpiresAt: fsCompany.trialExpiresAt,
            trialGrantedAt: fsCompany.trialGrantedAt,
            trialNote: fsCompany.trialNote,
          };
          ledgerDirty = true;
        } else if (fsCompany.status === 'active' && ledger.companyTrials[companyId]?.active) {
          ledger.companyTrials[companyId].active = false;
          ledgerDirty = true;
        }
      }

      const trial = ledger.companyTrials[companyId];
      const trialActive = Boolean(
        trial && trial.active && trial.trialExpiresAt && !isRecordExpired(trial.trialExpiresAt)
      );
      const trialExpired = Boolean(
        trial && trial.active && trial.trialExpiresAt && isRecordExpired(trial.trialExpiresAt)
      );

      const record = ledger.companyAccess[companyId];
      let subExpired = false;
      if (record && record.status === 'authorized' && isRecordExpired(record.nextBillingDate)) {
        record.status = 'overdue';
        ledgerDirty = true;
        subExpired = true;
      }

      if (ledgerDirty) {
        writeLedger(ledger);
      }

      const hasPaidValid = Boolean(
        record &&
          (!record.userId || record.userId === req.authUser?.uid) &&
          record.status === 'authorized' &&
          !isRecordExpired(record.nextBillingDate)
      );

      res.json({
        verified: trialActive || hasPaidValid,
        paidSubActive: hasPaidValid,
        trialActive,
        trialExpiresAt: trialActive ? trial?.trialExpiresAt || null : null,
        expired: !(trialActive || hasPaidValid) && (subExpired || trialExpired || record?.status === 'overdue'),
        record: hasPaidValid ? record : null,
      });
    }
  );

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

      const cleanId = preapprovalId.trim();

      try {
        let mpStatusOut = 'cancelled';
        if (cleanId.startsWith('pix_')) {
          const rawPaymentId = cleanId.slice(4);
          await fetch(
            `https://api.mercadopago.com/v1/payments/${encodeURIComponent(rawPaymentId)}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${mp.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'cancelled' }),
            }
          ).catch(() => {});
        } else {
          const mpRes = await fetch(
            `https://api.mercadopago.com/preapproval/${encodeURIComponent(cleanId)}`,
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
          mpStatusOut = String(mpData.status || 'cancelled');
        }

        const ledger = readLedger();
        if (ledger.subscriptions[cleanId]) {
          ledger.subscriptions[cleanId].status = 'cancelled';
          ledger.subscriptions[cleanId].mpStatus = mpStatusOut;
          ledger.subscriptions[cleanId].lastVerifiedAt = new Date().toISOString();
        }
        if (typeof companyId === 'string' && ledger.companyAccess[companyId]) {
          ledger.companyAccess[companyId].status = 'cancelled';
          ledger.companyAccess[companyId].mpStatus = mpStatusOut;
          ledger.companyAccess[companyId].lastVerifiedAt = new Date().toISOString();
        }
        writeLedger(ledger);

        res.json({ cancelled: true, mpStatus: mpStatusOut });
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
            const nextDate =
              typeof mpData.next_payment_date === 'string' && mpData.next_payment_date
                ? mpData.next_payment_date
                : ledger.subscriptions[dataId]?.nextBillingDate || null;
            const expired = internal === 'authorized' && isRecordExpired(nextDate);
            if (ledger.subscriptions[dataId]) {
              ledger.subscriptions[dataId].status = expired ? 'overdue' : internal;
              ledger.subscriptions[dataId].mpStatus = mpStatus;
              ledger.subscriptions[dataId].nextBillingDate = nextDate;
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
              const cycleMonths = getCycleMonths(ledger.subscriptions[preapprovalId].billingCycle || 'monthly');
              if (paymentStatus === 'approved' || paymentStatus === 'processed') {
                ledger.subscriptions[preapprovalId].status = 'authorized';
                ledger.subscriptions[preapprovalId].nextBillingDate = addMonthsIso(
                  new Date().toISOString(),
                  cycleMonths
                );
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
            const mpStatus = String(mpData.status || 'pending');
            resolvedStatus = mpStatus;
            const internal = mapMpStatusToInternal(mpStatus);
            const pixKey = `pix_${dataId}`;
            const metadata = (mpData.metadata || {}) as Record<string, unknown>;
            const existing = ledger.subscriptions[pixKey];
            const compId = existing?.companyId || String(metadata.company_id || '');
            const resolvedCycle = String(existing?.billingCycle || metadata.billing_cycle || 'monthly');
            const paidAt =
              typeof mpData.date_approved === 'string' && mpData.date_approved
                ? mpData.date_approved
                : typeof mpData.date_created === 'string' && mpData.date_created
                  ? mpData.date_created
                  : new Date().toISOString();
            const nextBillingDate =
              internal === 'authorized'
                ? addMonthsIso(paidAt, getCycleMonths(resolvedCycle))
                : existing?.nextBillingDate || null;
            const expired = internal === 'authorized' && isRecordExpired(nextBillingDate);

            const updated: VerifiedSubscriptionRecord = {
              subscriptionId: existing?.subscriptionId || String(mpData.external_reference || pixKey),
              companyId: compId,
              userId: existing?.userId || String(metadata.user_id || ''),
              preapprovalId: pixKey,
              planId: existing?.planId || String(metadata.plan_id || ''),
              planName: existing?.planName || String(metadata.plan_name || mpData.description || 'Plano JORQ'),
              billingCycle: resolvedCycle,
              totalAmount:
                typeof mpData.transaction_amount === 'number'
                  ? Number(mpData.transaction_amount)
                  : existing?.totalAmount || 0,
              status: expired ? 'overdue' : internal,
              mpStatus,
              paymentMethod: 'pix',
              nextBillingDate,
              lastVerifiedAt: new Date().toISOString(),
              pixData: existing?.pixData,
            };
            ledger.subscriptions[pixKey] = updated;
            if (compId) {
              ledger.companyAccess[compId] = updated;
            }
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

  app.post(
    '/api/admin/set-company-access',
    verifyRequestOrigin,
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const { companyId, subscriptionId, userId, planId, planName, billingCycle, totalAmount, status, nextBillingDate } =
        req.body || {};
      if (typeof companyId !== 'string' || !companyId.trim() || !['authorized', 'suspended'].includes(status)) {
        res.status(400).json({ error: 'Parâmetros inválidos para atualizar acesso da empresa.' });
        return;
      }
      const ledger = readLedger();
      const existing = ledger.companyAccess[companyId.trim()];
      const nowIso = new Date().toISOString();
      const resolvedCycle =
        typeof billingCycle === 'string' && billingCycle ? billingCycle : existing?.billingCycle || 'monthly';
      const resolvedNextBillingDate =
        typeof nextBillingDate === 'string' && nextBillingDate.trim()
          ? nextBillingDate.trim()
          : status === 'authorized'
            ? existing?.nextBillingDate || addMonthsIso(nowIso, getCycleMonths(resolvedCycle))
            : existing?.nextBillingDate || null;

      const updated: VerifiedSubscriptionRecord = {
        subscriptionId: typeof subscriptionId === 'string' && subscriptionId ? subscriptionId : existing?.subscriptionId || `admin_${companyId}`,
        companyId: companyId.trim(),
        userId: typeof userId === 'string' && userId ? userId : existing?.userId || '',
        preapprovalId: existing?.preapprovalId || `admin_${companyId}`,
        planId: typeof planId === 'string' ? planId : existing?.planId || '',
        planName: typeof planName === 'string' ? planName : existing?.planName || 'Plano JORQ',
        billingCycle: resolvedCycle,
        totalAmount: typeof totalAmount === 'number' ? totalAmount : existing?.totalAmount || 0,
        status: status === 'authorized' ? 'authorized' : 'paused',
        mpStatus: status === 'authorized' ? 'authorized' : 'paused',
        nextBillingDate: resolvedNextBillingDate,
        lastVerifiedAt: nowIso,
      };
      ledger.companyAccess[companyId.trim()] = updated;
      if (existing?.preapprovalId && ledger.subscriptions[existing.preapprovalId]) {
        ledger.subscriptions[existing.preapprovalId].status = updated.status;
        ledger.subscriptions[existing.preapprovalId].mpStatus = updated.mpStatus;
        ledger.subscriptions[existing.preapprovalId].nextBillingDate = resolvedNextBillingDate;
        ledger.subscriptions[existing.preapprovalId].lastVerifiedAt = nowIso;
      }
      writeLedger(ledger);
      res.json({ ok: true, status: updated.status, nextBillingDate: resolvedNextBillingDate });
    }
  );

  app.post(
    '/api/admin/set-company-trial',
    verifyRequestOrigin,
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const { companyId, active, trialExpiresAt, trialNote } = req.body || {};
      if (typeof companyId !== 'string' || !companyId.trim() || typeof active !== 'boolean') {
        res.status(400).json({ error: 'Parâmetros inválidos para Cliente Teste.' });
        return;
      }
      const cleanId = companyId.trim();
      if (active && (typeof trialExpiresAt !== 'string' || Number.isNaN(Date.parse(trialExpiresAt)))) {
        res.status(400).json({ error: 'Data de expiração do Cliente Teste inválida.' });
        return;
      }
      const ledger = readLedger();
      ledger.companyTrials[cleanId] = {
        companyId: cleanId,
        active,
        trialExpiresAt: active ? String(trialExpiresAt).trim() : '',
        trialGrantedAt: active ? new Date().toISOString() : '',
        trialNote: active && typeof trialNote === 'string' ? trialNote.trim().slice(0, 80) : '',
      };
      writeLedger(ledger);
      res.json({ ok: true, trial: ledger.companyTrials[cleanId] });
    }
  );

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

      const { companyId, preapprovalId, companyName, sector, monthlyGoal, summary, question, mode, language } =
        req.body || {};
      if (!companyName || !summary) {
        res.status(400).json({ error: 'Contexto financeiro da empresa obrigatório.' });
        return;
      }

      const isOwnerAdmin =
        Boolean(req.authUser?.emailVerified) &&
        req.authUser?.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

      if (!isOwnerAdmin) {
        if (typeof companyId !== 'string' || !companyId.trim()) {
          res.status(402).json({
            error: 'Assinatura ativa obrigatória para utilizar o Consultor Financeiro com IA.',
          });
          return;
        }
        const cleanCompId = companyId.trim();
        const ledger = readLedger();
        const fsCompany = await fetchFirestoreCompanyInfo(req.rawIdToken, cleanCompId);
        if (fsCompany?.status === 'suspended') {
          res.status(402).json({
            error: 'Acesso da empresa suspenso no momento.',
          });
          return;
        }
        if (fsCompany?.status === 'trial' && fsCompany.trialExpiresAt) {
          ledger.companyTrials[cleanCompId] = {
            companyId: cleanCompId,
            active: true,
            trialExpiresAt: fsCompany.trialExpiresAt,
            trialGrantedAt: fsCompany.trialGrantedAt,
            trialNote: fsCompany.trialNote,
          };
        }

        const trial = ledger.companyTrials[cleanCompId];
        const hasActiveTrial = Boolean(
          trial && trial.active && trial.trialExpiresAt && !isRecordExpired(trial.trialExpiresAt)
        );

        const access = ledger.companyAccess[cleanCompId];
        let hasActivePlan =
          hasActiveTrial ||
          Boolean(
            access &&
              access.status === 'authorized' &&
              !isRecordExpired(access.nextBillingDate) &&
              (!access.userId || access.userId === req.authUser?.uid)
          );

        if (!hasActivePlan && typeof preapprovalId === 'string' && preapprovalId.trim()) {
          const cleanPreId = preapprovalId.trim();
          const mp = getMpConfig();
          if (mp.accessToken) {
            try {
              const isPix = cleanPreId.startsWith('pix_');
              const mpEndpoint = isPix
                ? `https://api.mercadopago.com/v1/payments/${encodeURIComponent(cleanPreId.slice(4))}`
                : `https://api.mercadopago.com/preapproval/${encodeURIComponent(cleanPreId)}`;
              const mpRes = await fetch(mpEndpoint, {
                headers: {
                  Authorization: `Bearer ${mp.accessToken}`,
                  'Content-Type': 'application/json',
                },
              });
              if (mpRes.ok) {
                const mpData = (await mpRes.json()) as Record<string, unknown>;
                const mpStatus = String(mpData.status || 'pending');
                const internal = mapMpStatusToInternal(mpStatus);
                const existingSub = ledger.subscriptions[cleanPreId];
                const cycle = existingSub?.billingCycle || 'monthly';
                const paidAt = isPix
                  ? typeof mpData.date_approved === 'string' && mpData.date_approved
                    ? mpData.date_approved
                    : typeof mpData.date_created === 'string' && mpData.date_created
                      ? mpData.date_created
                      : new Date().toISOString()
                  : typeof mpData.date_created === 'string' && mpData.date_created
                    ? mpData.date_created
                    : new Date().toISOString();
                const nextDate = isPix
                  ? addMonthsIso(paidAt, getCycleMonths(cycle))
                  : typeof mpData.next_payment_date === 'string' && mpData.next_payment_date
                    ? mpData.next_payment_date
                    : existingSub?.nextBillingDate || addMonthsIso(paidAt, getCycleMonths(cycle));
                const expired = internal === 'authorized' && isRecordExpired(nextDate);

                if (internal === 'authorized' && !expired) {
                  hasActivePlan = true;
                  const record: VerifiedSubscriptionRecord = {
                    subscriptionId: String(mpData.external_reference || cleanPreId),
                    companyId: cleanCompId,
                    userId: req.authUser!.uid,
                    preapprovalId: cleanPreId,
                    planId: existingSub?.planId || '',
                    planName: existingSub?.planName || String(mpData.reason || mpData.description || 'Plano JORQ'),
                    billingCycle: cycle,
                    totalAmount: isPix
                      ? Number(mpData.transaction_amount || 0)
                      : Number(
                          (mpData.auto_recurring as Record<string, unknown> | undefined)?.transaction_amount || 0
                        ),
                    status: 'authorized',
                    mpStatus,
                    paymentMethod: isPix ? 'pix' : 'recurring',
                    nextBillingDate: nextDate,
                    lastVerifiedAt: new Date().toISOString(),
                  };
                  ledger.subscriptions[cleanPreId] = record;
                  ledger.companyAccess[cleanCompId] = record;
                  writeLedger(ledger);
                }
              }
            } catch {
              // ignore transient MP fetch error and deny below
            }
          }
        }

        if (!hasActivePlan) {
          res.status(402).json({
            error:
              'Assinatura ativa obrigatória ou prazo vencido para utilizar o Consultor Financeiro com IA. Regularize seu plano na aba Assinatura.',
          });
          return;
        }
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
