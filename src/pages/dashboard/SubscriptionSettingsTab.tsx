import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  QrCode,
  RefreshCw,
  Smartphone,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  attachMpCheckoutToSubscription,
  createPendingPaymentRecord,
  createPendingSubscriptionRecord,
  importCompanyBackupData,
  markNotificationRead,
  markSubscriptionCancelledClient,
  markSubscriptionOverdueClient,
  redeemCouponForSubscriptionClient,
  saveCompanyGoal,
  syncConfirmedSubscriptionClient,
  updateCompanySettings,
  uploadCompanyLogo,
  validateCouponCode,
  type AppNotification,
  type Company,
  type CustomerClient,
  type Expense,
  type LedgerTransaction,
  type PaymentRecord,
  type Plan,
  type Product,
  type Revenue,
  type SavedReport,
  type ServiceItem,
  type Subscription,
} from '../../services/firestoreService';
import {
  calculatePlanPrice,
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  formatTrialRemaining,
  getBillingCycles,
  isIsoDateExpired,
  safeExternalUrl,
  translateSubscriptionStatus,
} from '../../utils/format';
import {
  buildCompanyBackupPayload,
  downloadCompanyBackupJSON,
  getBackupCounts,
  MAX_BACKUP_FILE_BYTES,
  parseAndSanitizeCompanyBackup,
  type BackupCounts,
  type CompanyBackupPayload,
} from '../../utils/backup';
import {
  exportPeriodStatementPDF,
  getMonthDateRange,
  getWeekDateRange,
  type WeeklyPreset,
} from '../../utils/export';
import type { BillingCycle } from '../../types';

interface SubscriptionSettingsTabProps {
  mode: 'subscription' | 'settings' | 'notifications';
  company: Company;
  companyGoal?: number;
  userId: string;
  userEmail: string;
  plans: Plan[];
  subscriptions: Subscription[];
  payments: PaymentRecord[];
  notifications: AppNotification[];
  revenues?: Revenue[];
  expenses?: Expense[];
  transactions?: LedgerTransaction[];
  products?: Product[];
  services?: ServiceItem[];
  clients?: CustomerClient[];
  savedReports?: SavedReport[];
  preselectedPlanId?: string;
  preselectedCycle?: BillingCycle;
  preferredPaymentMode?: 'pix' | 'recurring';
  isOwnerFreeMode?: boolean;
  onSubscriptionVerified: () => void;
}

export function SubscriptionSettingsTab({
  mode,
  company,
  companyGoal,
  userId,
  userEmail,
  plans,
  subscriptions,
  payments,
  notifications,
  revenues = [],
  expenses = [],
  transactions = [],
  products = [],
  services = [],
  clients = [],
  savedReports = [],
  preselectedPlanId,
  preselectedCycle,
  preferredPaymentMode,
  isOwnerFreeMode = false,
  onSubscriptionVerified,
}: SubscriptionSettingsTabProps) {
  const { getIdToken, refreshCompany } = useAuth();
  const { lang, setLang, t, pick } = useLanguage();
  const billingCycles = getBillingCycles(lang);

  // Subscription checkout state
  const [selectedPlanId, setSelectedPlanId] = useState(preselectedPlanId || '');
  const [cycle, setCycle] = useState<BillingCycle>(preselectedCycle || 'monthly');
  const [paymentMode, setPaymentMode] = useState<'pix' | 'recurring'>(preferredPaymentMode || 'pix');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mpStatusInfo, setMpStatusInfo] = useState<{
    configured: boolean;
    environment: string;
  } | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMessage, setSubMessage] = useState('');
  const [subError, setSubError] = useState('');
  const [pixCheckout, setPixCheckout] = useState<{
    subscriptionId: string;
    paymentDocId?: string;
    billingCycle: BillingCycle;
    couponCode?: string;
    paymentId: string;
    preapprovalId: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string;
    expiresAt: string;
    totalAmount: number;
    approved?: boolean;
  } | null>(null);
  const [recurringCheckout, setRecurringCheckout] = useState<{
    subscriptionId: string;
    paymentDocId?: string;
    billingCycle: BillingCycle;
    couponCode?: string;
    preapprovalId: string;
    initPoint: string;
    totalAmount: number;
  } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const checkoutResultRef = useRef<HTMLDivElement | null>(null);

  // Company Settings state
  const [compName, setCompName] = useState(company.name);
  const [tradeName, setTradeName] = useState(company.tradeName || '');
  const [document, setDocument] = useState(company.document || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [address, setAddress] = useState(company.address || '');
  const [sector, setSector] = useState(company.sector || '');
  const [monthlyGoal, setMonthlyGoal] = useState(String(companyGoal ?? company.monthlyGoal ?? 0));
  const [logoUrl, setLogoUrl] = useState(company.logoUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Backup Export & Restore state
  const [pendingBackup, setPendingBackup] = useState<{
    filename: string;
    payload: CompanyBackupPayload;
    counts: BackupCounts;
  } | null>(null);
  const [restoreCompanyProfile, setRestoreCompanyProfile] = useState(true);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const [weeklyPreset, setWeeklyPreset] = useState<WeeklyPreset>('current_week');
  const [selectedStatementMonth, setSelectedStatementMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    if (typeof companyGoal === 'number') {
      setMonthlyGoal(String(companyGoal));
    }
  }, [companyGoal]);

  useEffect(() => {
    if (preselectedPlanId) {
      setSelectedPlanId(preselectedPlanId);
    }
  }, [preselectedPlanId]);

  useEffect(() => {
    if (preselectedCycle) {
      setCycle(preselectedCycle);
    }
  }, [preselectedCycle]);

  useEffect(() => {
    if (preferredPaymentMode) {
      setPaymentMode(preferredPaymentMode);
    }
  }, [preferredPaymentMode]);

  useEffect(() => {
    if (!selectedPlanId && plans.length > 0) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  useEffect(() => {
    fetch('/api/mercadopago/config-status')
      .then((r) => r.json())
      .then((data) => setMpStatusInfo(data))
      .catch(() => setMpStatusInfo({ configured: false, environment: 'sandbox' }));
  }, []);

  const confirmAndSyncSubscription = useCallback(
    async (opts: {
      subscriptionId: string;
      mpPreapprovalId?: string;
      mpStatus: string;
      nextBillingDate?: string | null;
      paymentDocId?: string;
      paidAt?: string;
      couponCode?: string;
      couponRedeemed?: boolean;
    }) => {
      const syncResult = await syncConfirmedSubscriptionClient({
        subscriptionId: opts.subscriptionId,
        companyId: company.id,
        userId,
        mpPreapprovalId: opts.mpPreapprovalId,
        mpStatus: opts.mpStatus,
        nextBillingDate: opts.nextBillingDate,
        paymentDocId: opts.paymentDocId,
        paidAt: opts.paidAt,
      });
      if (syncResult.ok && opts.couponCode && !opts.couponRedeemed) {
        await redeemCouponForSubscriptionClient(opts.subscriptionId, opts.couponCode);
      }
      return syncResult;
    },
    [company.id, userId]
  );

  // Poll Mercado Pago every 5s and on window focus while waiting for Pix QR Code payment confirmation
  useEffect(() => {
    if (!pixCheckout || pixCheckout.approved) return;

    let running = false;
    const checkPixNow = async () => {
      if (running) return;
      running = true;
      try {
        const token = await getIdToken();
        const res = await fetch('/api/mercadopago/verify-pix-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentId: pixCheckout.paymentId,
            preapprovalId: pixCheckout.preapprovalId,
            subscriptionId: pixCheckout.subscriptionId,
            companyId: company.id,
            billingCycle: pixCheckout.billingCycle,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'authorized' && !data.expired) {
          const matchedSub = subscriptions.find((s) => s.id === pixCheckout.subscriptionId);
          const syncRes = await confirmAndSyncSubscription({
            subscriptionId: pixCheckout.subscriptionId,
            mpPreapprovalId: pixCheckout.preapprovalId,
            mpStatus: String(data.mpStatus || 'approved'),
            nextBillingDate: data.nextBillingDate,
            paymentDocId: pixCheckout.paymentDocId,
            paidAt: data.paidAt,
            couponCode: pixCheckout.couponCode || matchedSub?.couponCode,
            couponRedeemed: matchedSub?.couponRedeemed,
          });
          setPixCheckout((prev) => (prev ? { ...prev, approved: true } : prev));
          if (syncRes.ok) {
            setSubMessage(
              pick({
                pt: 'Pagamento Pix confirmado pelo Mercado Pago! Seu acesso foi liberado automaticamente.',
                en: 'Pix payment confirmed by Mercado Pago! Your access has been unlocked automatically.',
                es: '¡Pago Pix confirmado por Mercado Pago! Su acceso fue liberado automáticamente.',
                fr: 'Paiement Pix confirmé par Mercado Pago ! Votre accès est débloqué.',
              })
            );
          } else {
            setSubError(
              syncRes.permissionDenied
                ? 'Pagamento Pix confirmado no Mercado Pago, mas as regras do Firestore ainda não foram publicadas no Firebase Console para gravar o status Ativa.'
                : `Pagamento confirmado, mas falhou ao gravar no Firestore: ${syncRes.error || 'erro desconhecido'}`
            );
          }
          onSubscriptionVerified();
        }
      } catch {
        // ignore background poll error
      } finally {
        running = false;
      }
    };

    const handleVisibility = () => {
      if (window.document.visibilityState === 'visible') {
        checkPixNow();
      }
    };

    const interval = window.setInterval(checkPixNow, 5000);
    window.addEventListener('focus', checkPixNow);
    window.document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkPixNow);
      window.document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pixCheckout, company.id, getIdToken, onSubscriptionVerified, pick, subscriptions, confirmAndSyncSubscription]);

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const latestSubscription = subscriptions[0] || null;
  const activeCouponDiscount = appliedCoupon?.discountPercent || 0;

  const handleApplyCoupon = async () => {
    const clean = couponCode.trim().toUpperCase();
    if (!clean) {
      setAppliedCoupon(null);
      setCouponFeedback(null);
      return;
    }
    setCouponBusy(true);
    setCouponFeedback(null);
    try {
      const res = await validateCouponCode(clean);
      if (!res.valid || !res.coupon) {
        setAppliedCoupon(null);
        setCouponFeedback({
          type: 'error',
          text: res.reason || 'Cupom inválido ou expirado.',
        });
        return;
      }
      setCouponCode(res.coupon.code);
      setAppliedCoupon({
        code: res.coupon.code,
        discountPercent: res.coupon.discountPercent,
      });
      setCouponFeedback({
        type: 'success',
        text: `Cupom ${res.coupon.code} aplicado: -${res.coupon.discountPercent}% de desconto extra!`,
      });
    } catch {
      setAppliedCoupon(null);
      setCouponFeedback({
        type: 'error',
        text: 'Não foi possível validar o cupom no momento.',
      });
    } finally {
      setCouponBusy(false);
    }
  };

  const handleStartCheckout = async () => {
    if (!currentPlan) return;
    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    setPixCheckout(null);
    setRecurringCheckout(null);
    setCopiedPix(false);
    try {
      let resolvedCoupon = appliedCoupon;
      const typedCoupon = couponCode.trim().toUpperCase();
      if (typedCoupon && (!resolvedCoupon || resolvedCoupon.code !== typedCoupon)) {
        const validation = await validateCouponCode(typedCoupon);
        if (!validation.valid || !validation.coupon) {
          setAppliedCoupon(null);
          const msg = validation.reason || 'Cupom inválido ou expirado.';
          setCouponFeedback({ type: 'error', text: msg });
          setSubError(msg);
          return;
        }
        resolvedCoupon = {
          code: validation.coupon.code,
          discountPercent: validation.coupon.discountPercent,
        };
        setAppliedCoupon(resolvedCoupon);
        setCouponFeedback({
          type: 'success',
          text: `Cupom ${validation.coupon.code} aplicado: -${validation.coupon.discountPercent}% de desconto extra!`,
        });
      }

      const couponDiscountPercent = resolvedCoupon?.discountPercent || 0;
      const calc = calculatePlanPrice(currentPlan, cycle, couponDiscountPercent);
      const subId = await createPendingSubscriptionRecord({
        companyId: company.id,
        userId,
        planId: currentPlan.id,
        planName: currentPlan.name,
        billingCycle: cycle,
        discountPercent: calc.cycleDiscountPercent,
        baseMonthlyPrice: currentPlan.monthlyPrice,
        totalAmount: calc.finalTotal,
        couponCode: resolvedCoupon?.code || undefined,
      });

      const token = await getIdToken();

      if (paymentMode === 'pix') {
        const res = await fetch('/api/mercadopago/create-pix-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subscriptionId: subId,
            companyId: company.id,
            planId: currentPlan.id,
            planName: currentPlan.name,
            billingCycle: cycle,
            monthlyPrice: currentPlan.monthlyPrice,
            cycleDiscounts: {
              monthly: currentPlan.discountMonthly,
              quarterly: currentPlan.discountQuarterly,
              semiannual: currentPlan.discountSemiannual,
              annual: currentPlan.discountAnnual,
            },
            couponCode: resolvedCoupon?.code,
            couponDiscountPercent,
            payerEmail: userEmail,
            payerName: company.name,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setSubError(
            data.error ||
              pick({
                pt: 'Erro ao gerar QR Code Pix no Mercado Pago.',
                en: 'Error generating Pix QR Code on Mercado Pago.',
                es: 'Error al generar el código QR Pix en Mercado Pago.',
                fr: 'Erreur lors de la génération du QR Code Pix.',
              })
          );
          return;
        }

        const safeInitUrl = data.ticketUrl || data.initPoint || 'https://www.mercadopago.com.br';
        await attachMpCheckoutToSubscription(
          subId,
          data.preapprovalId,
          safeInitUrl,
          data.mpStatus || 'pending'
        );

        let createdPaymentDocId: string | undefined;
        try {
          createdPaymentDocId = await createPendingPaymentRecord({
            companyId: company.id,
            userId,
            subscriptionId: subId,
            amount: data.totalAmount ?? calc.finalTotal,
            mpPaymentId: String(data.paymentId || data.preapprovalId || ''),
            paymentMethod: 'pix',
          });
        } catch {
          // non-blocking ledger log
        }

        setPixCheckout({
          subscriptionId: subId,
          paymentDocId: createdPaymentDocId,
          billingCycle: cycle,
          couponCode: resolvedCoupon?.code,
          paymentId: String(data.paymentId || ''),
          preapprovalId: String(data.preapprovalId || ''),
          qrCode: String(data.qrCode || ''),
          qrCodeBase64: String(data.qrCodeBase64 || ''),
          ticketUrl: String(data.ticketUrl || ''),
          expiresAt: String(data.expiresAt || ''),
          totalAmount: Number(data.totalAmount ?? calc.finalTotal),
          approved: data.status === 'authorized',
        });

        setSubMessage(
          pick({
            pt: 'QR Code Pix gerado! Escaneie o código abaixo ou copie o Pix Copia e Cola. A confirmação é verificada automaticamente.',
            en: 'Pix QR Code generated! Scan the code below or copy the Pix code. Confirmation is verified automatically.',
            es: '¡QR Code Pix generado! Escanee el código abajo o copie el código Pix.',
            fr: 'QR Code Pix généré ! Scannez le code ci-dessous ou copiez le code Pix.',
          })
        );
        if (data.status === 'authorized') {
          const syncRes = await confirmAndSyncSubscription({
            subscriptionId: subId,
            mpPreapprovalId: String(data.preapprovalId || ''),
            mpStatus: String(data.mpStatus || 'approved'),
            nextBillingDate: data.nextBillingDate,
            paymentDocId: createdPaymentDocId,
            paidAt: data.paidAt,
            couponCode: resolvedCoupon?.code,
          });
          if (!syncRes.ok) {
            setSubError(
              syncRes.permissionDenied
                ? 'Pagamento Pix confirmado no Mercado Pago, mas as regras do Firestore ainda não foram publicadas no Firebase Console para gravar o status Ativa.'
                : `Pagamento confirmado, mas falhou ao gravar no Firestore: ${syncRes.error || 'erro desconhecido'}`
            );
          }
          onSubscriptionVerified();
        }
        window.setTimeout(() => {
          checkoutResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
        return;
      }

      const res = await fetch('/api/mercadopago/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: subId,
          companyId: company.id,
          planId: currentPlan.id,
          planName: currentPlan.name,
          billingCycle: cycle,
          monthlyPrice: currentPlan.monthlyPrice,
          cycleDiscounts: {
            monthly: currentPlan.discountMonthly,
            quarterly: currentPlan.discountQuarterly,
            semiannual: currentPlan.discountSemiannual,
            annual: currentPlan.discountAnnual,
          },
          couponCode: resolvedCoupon?.code,
          couponDiscountPercent,
          payerEmail: userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubError(
          data.error ||
            pick({
              pt: 'Erro ao iniciar assinatura no Mercado Pago.',
              en: 'Error starting Mercado Pago subscription.',
              es: 'Error al iniciar suscripción en Mercado Pago.',
              fr: "Erreur lors de la création de l'abonnement Mercado Pago.",
            })
        );
        return;
      }

      await attachMpCheckoutToSubscription(
        subId,
        data.preapprovalId,
        data.initPoint,
        data.mpStatus || 'pending'
      );

      let createdPaymentDocId: string | undefined;
      try {
        createdPaymentDocId = await createPendingPaymentRecord({
          companyId: company.id,
          userId,
          subscriptionId: subId,
          amount: data.totalAmount ?? calc.finalTotal,
          mpPaymentId: String(data.preapprovalId || ''),
          paymentMethod: 'mercadopago_recurring',
        });
      } catch {
        // non-blocking ledger log
      }

      setRecurringCheckout({
        subscriptionId: subId,
        paymentDocId: createdPaymentDocId,
        billingCycle: cycle,
        couponCode: resolvedCoupon?.code,
        preapprovalId: String(data.preapprovalId || ''),
        initPoint: String(data.initPoint || ''),
        totalAmount: Number(data.totalAmount ?? calc.finalTotal),
      });

      setSubMessage(
        pick({
          pt: 'Link oficial do Mercado Pago gerado abaixo! Clique em "Abrir Pagamento no Mercado Pago Agora" para concluir e depois clique em "Verificar Pagamento no Servidor".',
          en: 'Official Mercado Pago link generated below! Click "Open Mercado Pago Checkout Now" to complete payment, then click "Verify Payment on Server".',
          es: '¡Enlace oficial de Mercado Pago generado abajo! Haga clic en "Abrir Pago en Mercado Pago Ahora" para finalizar.',
          fr: 'Lien officiel Mercado Pago généré ci-dessous ! Cliquez pour finaliser le paiement.',
        })
      );
      window.setTimeout(() => {
        checkoutResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    } catch (err) {
      setSubError(
        err instanceof Error
          ? err.message
          : pick({
              pt: 'Falha ao iniciar assinatura.',
              en: 'Failed to start subscription.',
              es: 'Error al iniciar la suscripción.',
              fr: "Échec du démarrage de l'abonnement.",
            })
      );
    } finally {
      setSubBusy(false);
    }
  };

  const handleCopyPixCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedPix(true);
      window.setTimeout(() => setCopiedPix(false), 3000);
    } catch {
      setSubError('Copie manualmente o código Pix exibido no campo abaixo.');
    }
  };

  const handleVerifyPayment = async (sub: {
    id: string;
    mpPreapprovalId?: string;
    billingCycle?: BillingCycle;
    paymentDocId?: string;
    couponCode?: string;
    couponRedeemed?: boolean;
  }) => {
    if (!sub.mpPreapprovalId) {
      setSubError(
        pick({
          pt: 'Esta assinatura ainda não possui identificador do Mercado Pago.',
          en: 'This subscription does not have a Mercado Pago ID yet.',
          es: 'Esta suscripción aún no tiene un identificador de Mercado Pago.',
          fr: "Cet abonnement ne possède pas encore d'identifiant Mercado Pago.",
        })
      );
      return;
    }
    const existingSub = subscriptions.find((s) => s.id === sub.id);
    const resolvedCycle = sub.billingCycle || existingSub?.billingCycle || 'monthly';
    const resolvedCouponCode = sub.couponCode || existingSub?.couponCode;
    const resolvedCouponRedeemed = sub.couponRedeemed ?? existingSub?.couponRedeemed;

    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    try {
      const token = await getIdToken();
      const isPix = sub.mpPreapprovalId.startsWith('pix_');
      const endpoint = isPix
        ? '/api/mercadopago/verify-pix-payment'
        : '/api/mercadopago/verify-subscription';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preapprovalId: sub.mpPreapprovalId,
          paymentId: isPix ? sub.mpPreapprovalId.slice(4) : undefined,
          subscriptionId: sub.id,
          companyId: company.id,
          billingCycle: resolvedCycle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubError(
          data.error ||
            pick({
              pt: 'Não foi possível validar com o Mercado Pago.',
              en: 'Could not verify with Mercado Pago.',
              es: 'No fue posible validar con Mercado Pago.',
              fr: 'Impossible de vérifier avec Mercado Pago.',
            })
        );
        return;
      }
      if (data.status === 'authorized' && !data.expired) {
        const syncRes = await confirmAndSyncSubscription({
          subscriptionId: sub.id,
          mpPreapprovalId: sub.mpPreapprovalId,
          mpStatus: String(data.mpStatus || 'authorized'),
          nextBillingDate: data.nextBillingDate,
          paymentDocId: sub.paymentDocId,
          paidAt: data.paidAt,
          couponCode: resolvedCouponCode,
          couponRedeemed: resolvedCouponRedeemed,
        });
        setPixCheckout((prev) => (prev ? { ...prev, approved: true } : prev));
        if (syncRes.ok) {
          setSubMessage(
            pick({
              pt: 'Pagamento confirmado e acesso liberado! Sua assinatura já está ativa.',
              en: 'Payment confirmed and workspace unlocked! Your subscription is active.',
              es: '¡Pago confirmado y acceso liberado! Su suscripción está activa.',
              fr: 'Paiement confirmé et accès débloqué ! Votre abonnement est actif.',
            })
          );
        } else {
          setSubError(
            syncRes.permissionDenied
              ? 'Pagamento confirmado no Mercado Pago, mas as regras do Firestore ainda não foram publicadas no Firebase Console para gravar o status Ativa.'
              : `Pagamento confirmado, mas falhou ao gravar no Firestore: ${syncRes.error || 'erro desconhecido'}`
          );
        }
      } else if (data.expired || data.status === 'overdue') {
        if (existingSub?.status === 'authorized') {
          await markSubscriptionOverdueClient(sub.id);
        }
        setSubError(
          pick({
            pt: 'O prazo desta assinatura já venceu. Gere uma nova cobrança abaixo para reativar seu acesso.',
            en: 'This subscription period has expired. Generate a new payment below to restore access.',
            es: 'El plazo de esta suscripción ha vencido. Genere un nuevo pago abajo para reactivar su acceso.',
            fr: 'La période de cet abonnement a expiré. Générez un nouveau paiement ci-dessous.',
          })
        );
      } else {
        setSubMessage(
          `${pick({
            pt: 'Status oficial verificado no Mercado Pago:',
            en: 'Official status verified on Mercado Pago:',
            es: 'Estado oficial verificado en Mercado Pago:',
            fr: 'Statut officiel vérifié sur Mercado Pago :',
          })} ${translateSubscriptionStatus(data.status, lang).label} (${data.mpStatus}).`
        );
      }
      onSubscriptionVerified();
    } catch (err) {
      setSubError(
        err instanceof Error
          ? err.message
          : pick({
              pt: 'Erro ao consultar Mercado Pago.',
              en: 'Error querying Mercado Pago.',
              es: 'Error al consultar Mercado Pago.',
              fr: 'Erreur lors de la consultation de Mercado Pago.',
            })
      );
    } finally {
      setSubBusy(false);
    }
  };

  const handleCancelSubscription = async (sub: Subscription) => {
    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    try {
      if (sub.mpPreapprovalId) {
        const token = await getIdToken();
        const res = await fetch('/api/mercadopago/cancel-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            preapprovalId: sub.mpPreapprovalId,
            companyId: company.id,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setSubError(
            data.error ||
              pick({
                pt: 'Erro ao cancelar no Mercado Pago.',
                en: 'Error cancelling on Mercado Pago.',
                es: 'Error al cancelar en Mercado Pago.',
                fr: "Erreur lors de l'annulation sur Mercado Pago.",
              })
          );
          setSubBusy(false);
          return;
        }
      }
      await markSubscriptionCancelledClient(sub.id);
      setSubMessage(
        pick({
          pt: 'Assinatura cancelada com sucesso.',
          en: 'Subscription cancelled successfully.',
          es: 'Suscripción cancelada con éxito.',
          fr: 'Abonnement annulé avec succès.',
        })
      );
      onSubscriptionVerified();
    } catch (err) {
      setSubError(
        err instanceof Error
          ? err.message
          : pick({
              pt: 'Erro ao cancelar assinatura.',
              en: 'Error cancelling subscription.',
              es: 'Error al cancelar la suscripción.',
              fr: "Erreur lors de l'annulation.",
            })
      );
    } finally {
      setSubBusy(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setSettingsMsg('');
    try {
      const url = await uploadCompanyLogo(company.id, file);
      setLogoUrl(url);
      await updateCompanySettings(company.id, { logoUrl: url });
      await refreshCompany();
      setSettingsMsg(
        pick({
          pt: 'Logotipo atualizado com sucesso.',
          en: 'Logo updated successfully.',
          es: 'Logotipo actualizado con éxito.',
          fr: 'Logo mis à jour avec succès.',
        })
      );
    } catch (err) {
      setSettingsMsg(
        err instanceof Error
          ? `${pick({
              pt: 'Não foi possível enviar o arquivo para o Storage:',
              en: 'Could not upload file to Storage:',
              es: 'No fue posible subir el archivo a Storage:',
              fr: "Impossible d'envoyer le fichier :",
            })} ${err.message}`
          : pick({
              pt: 'Erro ao enviar logo.',
              en: 'Error uploading logo.',
              es: 'Error al subir logotipo.',
              fr: "Erreur lors de l'envoi du logo.",
            })
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      await updateCompanySettings(company.id, {
        name: compName,
        tradeName,
        document,
        phone,
        address,
        sector,
        logoUrl,
      });
      await saveCompanyGoal(company.id, userId, Number(monthlyGoal) || 0);
      await refreshCompany();
      setSettingsMsg(
        pick({
          pt: 'Dados comerciais salvos com sucesso.',
          en: 'Company settings saved successfully.',
          es: 'Datos comerciales guardados con éxito.',
          fr: "Paramètres de l'entreprise enregistrés.",
        })
      );
    } catch (err) {
      setSettingsMsg(
        err instanceof Error
          ? err.message
          : pick({
              pt: 'Erro ao salvar configurações.',
              en: 'Error saving settings.',
              es: 'Error al guardar la configuración.',
              fr: "Erreur lors de l'enregistrement.",
            })
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDownloadCompanyBackup = () => {
    setBackupMsg(null);
    try {
      const payload = buildCompanyBackupPayload({
        company,
        monthlyGoal: Number(monthlyGoal) || companyGoal || company.monthlyGoal || 0,
        userId,
        revenues,
        expenses,
        transactions,
        products,
        services,
        clients,
        savedReports,
      });
      const counts = getBackupCounts(payload);
      const filename = downloadCompanyBackupJSON(payload);
      setBackupMsg({
        type: 'success',
        text: pick({
          pt: `Backup "${filename}" baixado com sucesso (${counts.total} registros + dados da empresa e preferências locais). Guarde este arquivo no celular ou computador.`,
          en: `Backup "${filename}" downloaded (${counts.total} records + company profile and local preferences).`,
          es: `Respaldo "${filename}" descargado (${counts.total} registros + datos de la empresa y preferencias).`,
          fr: `Sauvegarde "${filename}" téléchargée (${counts.total} enregistrements + données de l'entreprise).`,
        }),
      });
    } catch (err) {
      setBackupMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao gerar backup da empresa.',
      });
    }
  };

  const handleDownloadStatementPDF = (kind: 'weekly' | 'monthly') => {
    setBackupMsg(null);
    try {
      const range =
        kind === 'weekly'
          ? getWeekDateRange(weeklyPreset)
          : getMonthDateRange(selectedStatementMonth);

      const filename = exportPeriodStatementPDF({
        periodKind: kind,
        periodLabel: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        company: {
          name: compName || company.name,
          tradeName: tradeName || company.tradeName,
          document: document || company.document,
          phone: phone || company.phone,
          sector: sector || company.sector,
          address: address || company.address,
        },
        monthlyGoal: Number(monthlyGoal) || companyGoal || company.monthlyGoal || 0,
        revenues,
        expenses,
        transactions,
      });
      setBackupMsg({
        type: 'success',
        text: `PDF "${filename}" gerado com o logotipo do JORQ no topo e pronto para visualização ou impressão.`,
      });
    } catch (err) {
      setBackupMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao gerar extrato em PDF.',
      });
    }
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
    }
    if (!file) return;

    setBackupMsg(null);
    setPendingBackup(null);

    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setBackupMsg({
        type: 'error',
        text: pick({
          pt: 'O arquivo selecionado excede o limite de 5 MB.',
          en: 'Selected file exceeds the 5 MB limit.',
          es: 'El archivo seleccionado supera el límite de 5 MB.',
          fr: 'Le fichier sélectionné dépasse la limite de 5 Mo.',
        }),
      });
      return;
    }

    try {
      const text = await file.text();
      const { payload, counts } = parseAndSanitizeCompanyBackup(text);
      setPendingBackup({
        filename: file.name,
        payload,
        counts,
      });
    } catch (err) {
      setBackupMsg({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : pick({
                pt: 'Não foi possível ler este arquivo de backup.',
                en: 'Could not parse this backup file.',
                es: 'No fue posible leer este archivo de respaldo.',
                fr: 'Impossible de lire ce fichier de sauvegarde.',
              }),
      });
    }
  };

  const handleConfirmBackupRestore = async () => {
    if (!pendingBackup) return;
    setBackupBusy(true);
    setBackupMsg(null);

    try {
      const summary = await importCompanyBackupData({
        companyId: company.id,
        userId,
        backup: pendingBackup.payload,
        restoreCompanyProfile,
      });

      if (summary.companyUpdated) {
        const bComp = pendingBackup.payload.company;
        if (bComp.name && bComp.name.length >= 2) setCompName(bComp.name);
        if (bComp.tradeName !== undefined) setTradeName(bComp.tradeName);
        if (bComp.document !== undefined) setDocument(bComp.document);
        if (bComp.phone !== undefined) setPhone(bComp.phone);
        if (bComp.address !== undefined) setAddress(bComp.address);
        if (bComp.sector !== undefined) setSector(bComp.sector);
        if (bComp.logoUrl !== undefined) setLogoUrl(bComp.logoUrl);
        if (typeof bComp.monthlyGoal === 'number') setMonthlyGoal(String(bComp.monthlyGoal));
        await refreshCompany();
      }

      if (summary.appliedLanguage) {
        setLang(summary.appliedLanguage);
      }

      const c = summary.importedCounts;
      const dupText =
        summary.skippedDuplicates > 0
          ? ` (${summary.skippedDuplicates} registros já existentes foram ignorados para evitar duplicação)`
          : '';
      setBackupMsg({
        type: 'success',
        text: `Histórico restaurado com sucesso: ${c.revenues} receitas, ${c.expenses} despesas, ${c.transactions} movimentações, ${c.products} produtos, ${c.services} serviços, ${c.clients} clientes e ${c.savedReports} relatórios importados${dupText}.`,
      });
      setPendingBackup(null);
    } catch (err) {
      setBackupMsg({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Erro ao restaurar o backup da empresa.',
      });
    } finally {
      setBackupBusy(false);
    }
  };

  if (mode === 'notifications') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#1E40AF]" />
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {pick({
                pt: 'Central de Notificações',
                en: 'Notification Center',
                es: 'Centro de Notificaciones',
                fr: 'Centre de Notifications',
              })}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {notifications.filter((n) => !n.read).length}{' '}
            {pick({ pt: 'não lidas', en: 'unread', es: 'no leídas', fr: 'non lues' })}
          </span>
        </div>
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {pick({
              pt: 'Nenhuma notificação registrada para sua empresa.',
              en: 'No notifications recorded for your company.',
              es: 'No hay notificaciones registradas para su empresa.',
              fr: 'Aucune notification enregistrée pour votre entreprise.',
            })}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${
                  n.read ? 'bg-white' : 'bg-blue-50/30'
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-slate-400">{n.category}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{n.message}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(n.id)}
                    className="text-xs font-semibold text-[#1E40AF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {pick({ pt: 'Marcar como lida', en: 'Mark as read', es: 'Marcar como leída', fr: 'Marquer comme lue' })}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'settings') {
    return (
      <>
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 max-w-3xl"
      >
        <div>
          <h2 className="font-display text-lg font-bold text-[#0F172A]">
            {pick({
              pt: 'Configurações da Empresa',
              en: 'Company Settings',
              es: 'Configuración de la Empresa',
              fr: "Paramètres de l'Entreprise",
            })}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {pick({
              pt: 'Personalize sua identidade comercial, logotipo e meta mensal de faturamento.',
              en: 'Customize your business identity, logo, and monthly revenue goal.',
              es: 'Personalice su identidad comercial, logotipo y meta mensual de facturación.',
              fr: 'Personnalisez votre identité commerciale, logo et objectif mensuel.',
            })}
          </p>
        </div>

        {settingsMsg && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
            {settingsMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={pick({ pt: 'Logo da empresa', en: 'Company logo', es: 'Logo de la empresa', fr: "Logo de l'entreprise" })}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">
              LOGO
            </div>
          )}
          <div className="space-y-1.5">
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>
                {uploadingLogo
                  ? pick({ pt: 'Enviando...', en: 'Uploading...', es: 'Subiendo...', fr: 'Envoi...' })
                  : pick({ pt: 'Enviar Logo (Firebase Storage)', en: 'Upload Logo (Firebase Storage)', es: 'Subir Logo (Firebase Storage)', fr: 'Importer un Logo (Storage)' })}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-500">
              {pick({
                pt: 'Formatos PNG, JPG ou WEBP até 2 MB.',
                en: 'PNG, JPG, or WEBP formats up to 2 MB.',
                es: 'Formatos PNG, JPG o WEBP hasta 2 MB.',
                fr: 'Formats PNG, JPG ou WEBP jusqu’à 2 Mo.',
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Razão Social / Nome da Empresa *', en: 'Legal / Company Name *', es: 'Razón Social / Empresa *', fr: 'Raison Sociale / Entreprise *' })}
            </label>
            <input
              type="text"
              required
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Nome Fantasia', en: 'Trade Name', es: 'Nombre Comercial', fr: 'Nom Commercial' })}
            </label>
            <input
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'CNPJ / CPF', en: 'Tax ID', es: 'ID Fiscal', fr: 'SIRET / Fiscal' })}
            </label>
            <input
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Telefone', en: 'Phone', es: 'Teléfono', fr: 'Téléphone' })}
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Segmento', en: 'Industry', es: 'Sector', fr: 'Secteur' })}
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Endereço', en: 'Address', es: 'Dirección', fr: 'Adresse' })}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {pick({ pt: 'Meta Mensal de Receita (R$)', en: 'Monthly Revenue Goal (BRL)', es: 'Meta Mensual de Ingresos (BRL)', fr: 'Objectif Mensuel de Revenus (BRL)' })}
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingSettings}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
        >
          {savingSettings
            ? pick({ pt: 'Salvando...', en: 'Saving...', es: 'Guardando...', fr: 'Enregistrement...' })
            : pick({ pt: 'Salvar Configurações', en: 'Save Settings', es: 'Guardar Configuración', fr: 'Enregistrer' })}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-5 max-w-3xl mt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5 text-[#1E40AF]" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#0F172A]">
                {pick({
                  pt: 'Backup e Transferência de Aparelho (Histórico Completo)',
                  en: 'Backup & Device Transfer (Full History)',
                  es: 'Respaldo y Transferencia de Dispositivo',
                  fr: 'Sauvegarde et Transfert d’Appareil',
                })}
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {pick({
                  pt: 'Baixe um arquivo portátil (.json) no seu celular ou computador com todos os dados da empresa (receitas, despesas, movimentações, produtos, serviços, clientes, relatórios, meta mensal e preferências locais) para restaurar em outro aparelho ou conta sem perder nada.',
                  en: 'Download a portable (.json) file to your phone or computer with all company history so you can restore it on another device without losing data.',
                  es: 'Descarga un archivo portátil (.json) en tu celular o computadora con todo el historial de la empresa para restaurarlo en otro dispositivo sin perder datos.',
                  fr: 'Téléchargez un fichier portable (.json) sur votre téléphone ou ordinateur contenant tout l’historique de votre entreprise.',
                })}
              </p>
            </div>
          </div>
          <Smartphone className="w-5 h-5 text-slate-400 shrink-0 hidden sm:block" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
          <div>
            <p className="text-slate-500">Receitas / Despesas</p>
            <p className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums">
              {revenues.length} / {expenses.length}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Movimentações</p>
            <p className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums">
              {transactions.length}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Produtos / Serviços</p>
            <p className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums">
              {products.length} / {services.length}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Clientes / Relatórios</p>
            <p className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums">
              {clients.length} / {savedReports.length}
            </p>
          </div>
        </div>

        {backupMsg && (
          <div
            className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
              backupMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {backupMsg.text}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 space-y-4">
          <div>
            <h4 className="font-display text-sm font-bold text-[#0F172A]">
              Extrato Financeiro em PDF (Semanal e Mensal com Logotipo JORQ)
            </h4>
            <p className="mt-1 text-xs text-slate-600">
              Gere um extrato estruturado em PDF com o logotipo do site no topo, resumo de receitas/despesas, saldo acumulado e detalhamento por categoria.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Período Semanal
              </label>
              <select
                value={weeklyPreset}
                onChange={(e) => setWeeklyPreset(e.target.value as WeeklyPreset)}
                className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg"
              >
                <option value="current_week">Semana Atual (Seg a Dom)</option>
                <option value="last_7_days">Últimos 7 dias</option>
                <option value="previous_week">Semana Anterior</option>
              </select>
              <button
                type="button"
                onClick={() => handleDownloadStatementPDF('weekly')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Baixar Extrato Semanal (PDF)</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Mês de Referência
              </label>
              <input
                type="month"
                value={selectedStatementMonth}
                onChange={(e) => setSelectedStatementMonth(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleDownloadStatementPDF('monthly')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Baixar Extrato Mensal (PDF)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadCompanyBackup}
            disabled={backupBusy}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {pick({
                pt: 'Baixar Histórico Completo (.json)',
                en: 'Download Full Backup (.json)',
                es: 'Descargar Respaldo Completo (.json)',
                fr: 'Télécharger la Sauvegarde (.json)',
              })}
            </span>
          </button>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>
              {pick({
                pt: 'Restaurar Backup de Outro Aparelho',
                en: 'Restore Backup from Another Device',
                es: 'Restaurar Respaldo de Otro Equipo',
                fr: 'Restaurer une Sauvegarde',
              })}
            </span>
            <input
              ref={backupFileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleBackupFileSelected}
              disabled={backupBusy}
              className="hidden"
            />
          </label>
        </div>

        {pendingBackup && (
          <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#1E40AF]">
                  Arquivo validado pronto para restauração
                </p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {pendingBackup.payload.company.name || 'Empresa'} · {pendingBackup.filename}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Exportado em {formatDateTimeBR(pendingBackup.payload.exportedAt, lang)}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#1E40AF] bg-white px-3 py-1.5 rounded-lg border border-blue-200">
                {pendingBackup.counts.total} registros
              </span>
            </div>

            <div className="text-xs text-slate-700 bg-white border border-blue-100 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <span>Receitas: {pendingBackup.counts.revenues}</span>
              <span>Despesas: {pendingBackup.counts.expenses}</span>
              <span>Movimentações: {pendingBackup.counts.transactions}</span>
              <span>Produtos: {pendingBackup.counts.products}</span>
              <span>Serviços: {pendingBackup.counts.services}</span>
              <span>Clientes: {pendingBackup.counts.clients}</span>
              <span>Relatórios: {pendingBackup.counts.savedReports}</span>
              <span>Meta: {formatBRL(pendingBackup.payload.company.monthlyGoal)}</span>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreCompanyProfile}
                onChange={(e) => setRestoreCompanyProfile(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Atualizar também nome, CNPJ/CPF, telefone, endereço e meta mensal desta empresa</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={backupBusy}
                onClick={handleConfirmBackupRestore}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{backupBusy ? 'Restaurando dados...' : 'Confirmar Restauração Agora'}</span>
              </button>
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => setPendingBackup(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
    );
  }

  // Subscription & Mercado Pago View
  return (
    <div className="space-y-8">
      {isOwnerFreeMode && (
        <div className="bg-white border border-emerald-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#16A34A]">
              {pick({
                pt: 'Modo Cliente do Proprietário',
                en: 'Owner Client Mode',
                es: 'Modo Cliente del Propietario',
                fr: 'Mode Client du Propriétaire',
              })}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
              {pick({
                pt: 'Acesso Total Gratuito Vitalício Ativado',
                en: 'Lifetime Free Full Access Enabled',
                es: 'Acceso Total Gratuito Vitalicio Activado',
                fr: 'Accès Complet Gratuit à Vie Activé',
              })}
            </h3>
            <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
              {pick({
                pt: 'Sua conta proprietária possui liberação automática e permanente para todas as ferramentas do JORQ (lançamentos ilimitados, relatórios PDF/CSV e inteligência artificial) sem necessidade de contratação ou cobrança no Mercado Pago. A vitrine abaixo permanece visível apenas para conferência de como os clientes visualizam seus planos.',
                en: 'Your owner account has automatic lifetime access to all JORQ tools (unlimited entries, PDF/CSV reports, and AI) with no Mercado Pago billing required. The plans below remain visible so you can review what customers see.',
                es: 'Su cuenta propietaria tiene acceso automático y permanente a todas las herramientas de JORQ (registros ilimitados, informes PDF/CSV e inteligencia artificial) sin cobro en Mercado Pago. Los planes abajo siguen visibles solo para referencia.',
                fr: 'Votre compte propriétaire dispose d’un accès gratuit permanent à tous les outils JORQ sans facturation Mercado Pago. Les offres ci-dessous restent visibles à titre de prévisualisation.',
              })}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-500">
              {pick({ pt: 'Valor da assinatura', en: 'Subscription price', es: 'Valor de la suscripción', fr: "Montant de l'abonnement" })}
            </p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[#16A34A]">R$ 0,00</p>
          </div>
        </div>
      )}

      {!isOwnerFreeMode && company.status === 'trial' && (
        <div
          className={`rounded-xl border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isIsoDateExpired(company.trialExpiresAt)
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <Clock
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                isIsoDateExpired(company.trialExpiresAt) ? 'text-[#DC2626]' : 'text-[#1E40AF]'
              }`}
            />
            <div>
              <p
                className={`text-xs font-semibold ${
                  isIsoDateExpired(company.trialExpiresAt) ? 'text-[#DC2626]' : 'text-[#1E40AF]'
                }`}
              >
                {isIsoDateExpired(company.trialExpiresAt)
                  ? 'Período de Cliente Teste Encerrado'
                  : 'Modo Cliente Teste Liberado Gratuitamente'}
              </p>
              <h3 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
                {isIsoDateExpired(company.trialExpiresAt)
                  ? 'Seu acesso gratuito temporário expirou'
                  : `Tempo restante: ${formatTrialRemaining(company.trialExpiresAt)}`}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {company.trialExpiresAt
                  ? `${isIsoDateExpired(company.trialExpiresAt) ? 'Expirou em:' : 'Válido até:'} ${formatDateTimeBR(company.trialExpiresAt, lang)}`
                  : 'Prazo temporário configurado pelo administrador.'}
                {company.trialNote ? ` · ${company.trialNote}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mercado Pago Server Status */}
      {mpStatusInfo && !mpStatusInfo.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-900">
          <strong>Mercado Pago ({mpStatusInfo.environment}):</strong>{' '}
          {pick({
            pt: 'Defina as variáveis privadas MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET no servidor Node.js para habilitar o checkout recorrente real.',
            en: 'Set the private MP_ACCESS_TOKEN and MP_WEBHOOK_SECRET variables on the Node.js server to enable live recurring checkout.',
            es: 'Configure las variables privadas MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET en el servidor Node.js para habilitar el pago recurrente real.',
            fr: 'Définissez les variables privées MP_ACCESS_TOKEN et MP_WEBHOOK_SECRET sur le serveur Node.js pour activer le paiement récurrent réel.',
          })}
        </div>
      )}

      {subError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {subError}
        </div>
      )}
      {subMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
          {subMessage}
        </div>
      )}

      {/* Active / Latest Subscription Card */}
      {latestSubscription && (() => {
        const effectiveLatestStatus =
          latestSubscription.status === 'authorized' &&
          isIsoDateExpired(latestSubscription.nextBillingDate)
            ? 'overdue'
            : latestSubscription.status;
        return (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {pick({ pt: 'Assinatura Atual', en: 'Current Subscription', es: 'Suscripción Actual', fr: 'Abonnement Actuel' })}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold text-[#0F172A]">
                  {latestSubscription.planName} ·{' '}
                  {billingCycles.find((c) => c.id === latestSubscription.billingCycle)?.label}
                </h3>
                <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                  {pick({ pt: 'Valor:', en: 'Amount:', es: 'Valor:', fr: 'Montant :' })} {formatBRL(latestSubscription.totalAmount)} · Status:{' '}
                  <strong className={effectiveLatestStatus === 'overdue' ? 'text-[#DC2626]' : ''}>
                    {translateSubscriptionStatus(effectiveLatestStatus, lang).label}
                  </strong>
                  {latestSubscription.nextBillingDate
                    ? ` · ${
                        effectiveLatestStatus === 'overdue'
                          ? 'Venceu em:'
                          : pick({ pt: 'Próx. vencimento:', en: 'Next billing:', es: 'Próx. cobro:', fr: 'Prochaine échéance :' })
                      } ${formatDateBR(latestSubscription.nextBillingDate, lang)}`
                    : ''}
                  {latestSubscription.couponCode ? ` · Cupom: ${latestSubscription.couponCode}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {safeExternalUrl(latestSubscription.mpInitPoint) && latestSubscription.status === 'pending' && (
                  <a
                    href={safeExternalUrl(latestSubscription.mpInitPoint)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A]"
                  >
                    <span>{pick({ pt: 'Pagar no Mercado Pago', en: 'Pay on Mercado Pago', es: 'Pagar en Mercado Pago', fr: 'Payer sur Mercado Pago' })}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {latestSubscription.mpPreapprovalId && (
                  <button
                    type="button"
                    disabled={subBusy}
                    onClick={() => handleVerifyPayment(latestSubscription)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{pick({ pt: 'Verificar Pagamento no Servidor', en: 'Verify Payment on Server', es: 'Verificar Pago en el Servidor', fr: 'Vérifier le Paiement' })}</span>
                  </button>
                )}
                {latestSubscription.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={subBusy}
                    onClick={() => handleCancelSubscription(latestSubscription)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#DC2626] bg-white border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{pick({ pt: 'Cancelar', en: 'Cancel', es: 'Cancelar', fr: 'Annuler' })}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Plan Selection & Cycle Calculator */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-display text-lg font-bold text-[#0F172A]">
            {pick({ pt: 'Contratar ou Alterar Plano', en: 'Subscribe or Change Plan', es: 'Contratar o Cambiar Plan', fr: "Souscrire ou Changer d'Offre" })}
          </h3>
          <p className="text-xs text-slate-500">
            {pick({
              pt: 'Descontos calculados automaticamente: Mensal (0%), Trimestral (3%), Semestral (5%) e Anual (8%).',
              en: 'Discounts calculated automatically: Monthly (0%), Quarterly (3%), Semiannual (5%), and Annual (8%).',
              es: 'Descuentos calculados automáticamente: Mensual (0%), Trimestral (3%), Semestral (5%) y Anual (8%).',
              fr: 'Remises calculées automatiquement : Mensuel (0 %), Trimestriel (3 %), Semestriel (5 %) et Annuel (8 %).',
            })}
          </p>
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-slate-500">
            {pick({
              pt: 'Nenhum plano ativo disponível no momento. Solicite ao administrador a configuração dos planos.',
              en: 'No active plans available right now. Ask the administrator to configure plans.',
              es: 'No hay planes activos disponibles en este momento.',
              fr: 'Aucune offre active disponible pour le moment.',
            })}
          </p>
        ) : (
          <>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {billingCycles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCycle(c.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    cycle === c.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {c.label} {c.defaultDiscount > 0 ? `(-${c.defaultDiscount}%)` : ''}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans
                .filter((p) => p.active)
                .map((plan) => {
                  const calc = calculatePlanPrice(plan, cycle, activeCouponDiscount);
                  const selected = currentPlan?.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#1E40AF] bg-blue-50/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-base text-[#0F172A]">
                          {plan.name}
                        </span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{plan.targetAudience}</p>
                      <p className="mt-3 font-mono tabular-nums text-2xl font-bold text-[#0F172A]">
                        {formatBRL(calc.finalTotal)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatBRL(calc.monthlyEquivalent)}
                        {t.common.perMonth} · {calc.cycleDiscountPercent}%{' '}
                        {pick({ pt: 'desc.', en: 'off', es: 'dto.', fr: 'rem.' })}
                        {activeCouponDiscount > 0 ? ` + ${activeCouponDiscount}% cupom` : ''}
                      </p>
                    </button>
                  );
                })}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-slate-700">
                {pick({
                  pt: 'Escolha a forma de pagamento:',
                  en: 'Choose payment method:',
                  es: 'Elija el método de pago:',
                  fr: 'Choisissez le mode de paiement :',
                })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('pix')}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMode === 'pix'
                      ? 'border-[#16A34A] bg-emerald-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">
                      {pick({
                        pt: 'Pix (QR Code Instantâneo)',
                        en: 'Pix (Instant QR Code)',
                        es: 'Pix (QR Instantáneo)',
                        fr: 'Pix (QR Code Instantané)',
                      })}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {pick({
                        pt: 'Liberação imediata após leitura do QR Code ou Copia e Cola.',
                        en: 'Instant unlock after scanning QR Code or copying payment key.',
                        es: 'Liberación inmediata tras escanear el código QR.',
                        fr: 'Déblocage immédiat après paiement par QR Code.',
                      })}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('recurring')}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMode === 'recurring'
                      ? 'border-[#1E40AF] bg-blue-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-[#1E40AF] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">
                      {pick({
                        pt: 'Cartão / Assinatura Mercado Pago',
                        en: 'Card / Mercado Pago Recurring',
                        es: 'Tarjeta / Suscripción Mercado Pago',
                        fr: 'Carte / Abonnement Mercado Pago',
                      })}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {pick({
                        pt: 'Renovação automática recorrente no checkout oficial Mercado Pago.',
                        en: 'Automatic recurring billing via official Mercado Pago checkout.',
                        es: 'Renovación automática recurrente en Mercado Pago.',
                        fr: 'Renouvellement automatique via Mercado Pago.',
                      })}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 max-w-sm">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {pick({ pt: 'Cupom promocional (opcional)', en: 'Promo coupon (optional)', es: 'Cupón promocional (opcional)', fr: 'Code promo (optionnel)' })}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setCouponCode(val);
                        if (appliedCoupon && val.trim() !== appliedCoupon.code) {
                          setAppliedCoupon(null);
                          setCouponFeedback(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCoupon();
                        }
                      }}
                      onBlur={() => {
                        const clean = couponCode.trim().toUpperCase();
                        if (clean.length >= 3 && (!appliedCoupon || appliedCoupon.code !== clean) && !couponBusy) {
                          handleApplyCoupon();
                        }
                      }}
                      placeholder="EX: BEMVINDO10"
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
                    />
                    <button
                      type="button"
                      disabled={couponBusy || !couponCode.trim()}
                      onClick={handleApplyCoupon}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {couponBusy ? '...' : 'Aplicar'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={subBusy || !currentPlan}
                  onClick={handleStartCheckout}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 cursor-pointer ${
                    paymentMode === 'pix'
                      ? 'bg-[#16A34A] hover:bg-[#15803D]'
                      : 'bg-[#1E40AF] hover:bg-[#1E3A8A]'
                  }`}
                >
                  {paymentMode === 'pix' ? (
                    <QrCode className="w-4 h-4" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>
                    {subBusy
                      ? pick({
                          pt: paymentMode === 'pix' ? 'Gerando QR Code Pix...' : 'Gerando pagamento...',
                          en: 'Generating payment...',
                          es: 'Generando pago...',
                          fr: 'Génération du paiement...',
                        })
                      : paymentMode === 'pix'
                        ? pick({
                            pt: 'Gerar QR Code Pix',
                            en: 'Generate Pix QR Code',
                            es: 'Generar QR Code Pix',
                            fr: 'Générer QR Code Pix',
                          })
                        : pick({
                            pt: 'Assinar com Mercado Pago',
                            en: 'Subscribe with Mercado Pago',
                            es: 'Suscribirse con Mercado Pago',
                            fr: "S'abonner avec Mercado Pago",
                          })}
                  </span>
                </button>
              </div>
              {couponFeedback && (
                <p
                  className={`text-xs font-semibold ${
                    couponFeedback.type === 'success' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}
                >
                  {couponFeedback.text}
                </p>
              )}
              {currentPlan && appliedCoupon && (() => {
                const preview = calculatePlanPrice(currentPlan, cycle, appliedCoupon.discountPercent);
                const savedAmount = Math.max(0, preview.afterCycleTotal - preview.finalTotal);
                return (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
                    <span>
                      Cupom <strong>{appliedCoupon.code}</strong> (-{appliedCoupon.discountPercent}%) aplicado no plano{' '}
                      <strong>{currentPlan.name}</strong>
                    </span>
                    <span className="font-mono tabular-nums font-bold">
                      De {formatBRL(preview.afterCycleTotal)} por {formatBRL(preview.finalTotal)} (economia de{' '}
                      {formatBRL(savedAmount)})
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Inline Feedback Right Next to Bottom Button */}
            {(subError || subMessage || pixCheckout || recurringCheckout) && (
              <div ref={checkoutResultRef} className="space-y-4 pt-2">
                {subError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    {subError}
                  </div>
                )}
                {subMessage && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                    {subMessage}
                  </div>
                )}

                {pixCheckout && (
                  <div className="border-2 border-emerald-300 bg-emerald-50/40 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-[#16A34A]" />
                        <h4 className="font-display text-base font-bold text-[#0F172A]">
                          {pixCheckout.approved
                            ? 'Pix Confirmado · Assinatura Ativa'
                            : 'Pague via Pix (QR Code Mercado Pago)'}
                        </h4>
                      </div>
                      <span className="font-mono tabular-nums text-base font-bold text-[#16A34A]">
                        {formatBRL(pixCheckout.totalAmount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
                      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-center">
                        {pixCheckout.qrCodeBase64 ? (
                          <img
                            src={`data:image/png;base64,${pixCheckout.qrCodeBase64}`}
                            alt="QR Code Pix Mercado Pago"
                            className="w-44 h-44 object-contain"
                          />
                        ) : (
                          <p className="text-xs text-slate-500 text-center p-4">
                            Imagem QR indisponível; use o código Copia e Cola ao lado.
                          </p>
                        )}
                      </div>

                      <div className="space-y-3 min-w-0">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Pix Copia e Cola
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              readOnly
                              value={pixCheckout.qrCode}
                              onFocus={(e) => e.target.select()}
                              className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyPixCode(pixCheckout.qrCode)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>{copiedPix ? 'Copiado!' : 'Copiar Código Pix'}</span>
                            </button>
                          </div>
                        </div>

                        {pixCheckout.expiresAt && (
                          <p className="text-xs text-slate-500">
                            Expira em:{' '}
                            <span className="font-mono">
                              {new Date(pixCheckout.expiresAt).toLocaleString('pt-BR')}
                            </span>
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={subBusy}
                            onClick={() =>
                              handleVerifyPayment({
                                id: pixCheckout.subscriptionId,
                                mpPreapprovalId: pixCheckout.preapprovalId,
                                billingCycle: pixCheckout.billingCycle,
                                paymentDocId: pixCheckout.paymentDocId,
                                couponCode: pixCheckout.couponCode,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D] cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${subBusy ? 'animate-spin' : ''}`} />
                            <span>Já paguei · Verificar Pix Agora</span>
                          </button>

                          {safeExternalUrl(pixCheckout.ticketUrl) && (
                            <a
                              href={safeExternalUrl(pixCheckout.ticketUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              <span>Abrir Comprovante Pix</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {recurringCheckout && safeExternalUrl(recurringCheckout.initPoint) && (
                  <div className="border-2 border-blue-300 bg-blue-50/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">
                        Checkout Mercado Pago Pronto · {formatBRL(recurringCheckout.totalAmount)}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Clique no botão ao lado para abrir a página oficial segura do Mercado Pago e finalizar o pagamento.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={safeExternalUrl(recurringCheckout.initPoint)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A]"
                      >
                        <span>Abrir Pagamento no Mercado Pago Agora</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        disabled={subBusy}
                        onClick={() =>
                          handleVerifyPayment({
                            id: recurringCheckout.subscriptionId,
                            mpPreapprovalId: recurringCheckout.preapprovalId,
                            billingCycle: recurringCheckout.billingCycle,
                            paymentDocId: recurringCheckout.paymentDocId,
                            couponCode: recurringCheckout.couponCode,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Verificar Pagamento</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Payments History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-[#0F172A]">
            {pick({ pt: 'Histórico de Cobranças', en: 'Billing History', es: 'Historial de Cobros', fr: 'Historique de Facturation' })}
          </h3>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {pick({
              pt: 'Nenhuma cobrança processada ainda.',
              en: 'No charges processed yet.',
              es: 'Aún no se han procesado cobros.',
              fr: 'Aucun paiement traité pour le moment.',
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">{pick({ pt: 'Pagamento', en: 'Payment', es: 'Pago', fr: 'Paiement' })}</th>
                  <th className="py-3 px-5">{pick({ pt: 'Método', en: 'Method', es: 'Método', fr: 'Méthode' })}</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">{pick({ pt: 'Valor', en: 'Amount', es: 'Valor', fr: 'Montant' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-5 font-mono text-xs text-slate-700">
                      {p.mpPaymentId || p.id}
                    </td>
                    <td className="py-3 px-5 text-xs text-slate-600">{p.paymentMethod || 'Mercado Pago'}</td>
                    <td className="py-3 px-5 text-xs font-semibold text-slate-800">{p.status}</td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                      {formatBRL(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
