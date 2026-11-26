import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  attachMpCheckoutToSubscription,
  createPendingSubscriptionRecord,
  markNotificationRead,
  markSubscriptionCancelledClient,
  updateCompanySettings,
  uploadCompanyLogo,
  type AppNotification,
  type Company,
  type PaymentRecord,
  type Plan,
  type Subscription,
} from '../../services/firestoreService';
import {
  calculatePlanPrice,
  formatBRL,
  formatDateBR,
  getBillingCycles,
  translateSubscriptionStatus,
} from '../../utils/format';
import type { BillingCycle } from '../../types';

interface SubscriptionSettingsTabProps {
  mode: 'subscription' | 'settings' | 'notifications';
  company: Company;
  userId: string;
  userEmail: string;
  plans: Plan[];
  subscriptions: Subscription[];
  payments: PaymentRecord[];
  notifications: AppNotification[];
  preselectedPlanId?: string;
  preselectedCycle?: BillingCycle;
  isOwnerFreeMode?: boolean;
  onSubscriptionVerified: () => void;
}

export function SubscriptionSettingsTab({
  mode,
  company,
  userId,
  userEmail,
  plans,
  subscriptions,
  payments,
  notifications,
  preselectedPlanId,
  preselectedCycle,
  isOwnerFreeMode = false,
  onSubscriptionVerified,
}: SubscriptionSettingsTabProps) {
  const { getIdToken, refreshCompany } = useAuth();
  const { lang, t, pick } = useLanguage();
  const billingCycles = getBillingCycles(lang);

  // Subscription checkout state
  const [selectedPlanId, setSelectedPlanId] = useState(preselectedPlanId || '');
  const [cycle, setCycle] = useState<BillingCycle>(preselectedCycle || 'monthly');
  const [couponCode, setCouponCode] = useState('');
  const [mpStatusInfo, setMpStatusInfo] = useState<{
    configured: boolean;
    environment: string;
  } | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMessage, setSubMessage] = useState('');
  const [subError, setSubError] = useState('');

  // Company Settings state
  const [compName, setCompName] = useState(company.name);
  const [tradeName, setTradeName] = useState(company.tradeName || '');
  const [document, setDocument] = useState(company.document || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [address, setAddress] = useState(company.address || '');
  const [sector, setSector] = useState(company.sector || '');
  const [monthlyGoal, setMonthlyGoal] = useState(String(company.monthlyGoal || 0));
  const [logoUrl, setLogoUrl] = useState(company.logoUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

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

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const latestSubscription = subscriptions[0] || null;

  const handleStartCheckout = async () => {
    if (!currentPlan) return;
    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    try {
      const calc = calculatePlanPrice(currentPlan, cycle, 0);
      const subId = await createPendingSubscriptionRecord({
        companyId: company.id,
        userId,
        planId: currentPlan.id,
        planName: currentPlan.name,
        billingCycle: cycle,
        discountPercent: calc.cycleDiscountPercent,
        baseMonthlyPrice: currentPlan.monthlyPrice,
        totalAmount: calc.finalTotal,
        couponCode: couponCode.trim() || undefined,
      });

      const token = await getIdToken();
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
      setSubMessage(
        pick({
          pt: 'Assinatura criada como pendente no servidor. Conclua o pagamento no link oficial do Mercado Pago e clique em "Verificar Pagamento no Servidor".',
          en: 'Subscription created as pending on the server. Complete payment via the official Mercado Pago link and click "Verify Payment on Server".',
          es: 'Suscripción creada como pendiente en el servidor. Complete el pago en el enlace oficial de Mercado Pago y haga clic en "Verificar Pago en el Servidor".',
          fr: 'Abonnement créé en attente sur le serveur. Finalisez le paiement via le lien officiel Mercado Pago puis cliquez sur « Vérifier le Paiement ».',
        })
      );
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

  const handleVerifyPayment = async (sub: Subscription) => {
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
    setSubBusy(true);
    setSubError('');
    setSubMessage('');
    try {
      const token = await getIdToken();
      const res = await fetch('/api/mercadopago/verify-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preapprovalId: sub.mpPreapprovalId,
          subscriptionId: sub.id,
          companyId: company.id,
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
      setSubMessage(
        `${pick({
          pt: 'Status oficial verificado no Mercado Pago:',
          en: 'Official status verified on Mercado Pago:',
          es: 'Estado oficial verificado en Mercado Pago:',
          fr: 'Statut officiel vérifié sur Mercado Pago :',
        })} ${translateSubscriptionStatus(data.status, lang).label} (${data.mpStatus}).`
      );
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
        monthlyGoal: Number(monthlyGoal) || 0,
      });
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
      {latestSubscription && (
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
                <strong>{translateSubscriptionStatus(latestSubscription.status, lang).label}</strong>
                {latestSubscription.nextBillingDate
                  ? ` · ${pick({ pt: 'Próx. vencimento:', en: 'Next billing:', es: 'Próx. cobro:', fr: 'Prochaine échéance :' })} ${formatDateBR(latestSubscription.nextBillingDate, lang)}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {latestSubscription.mpInitPoint && latestSubscription.status === 'pending' && (
                <a
                  href={latestSubscription.mpInitPoint}
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
      )}

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
                  const calc = calculatePlanPrice(plan, cycle);
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
                      </p>
                    </button>
                  );
                })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-2">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {pick({ pt: 'Cupom promocional (opcional)', en: 'Promo coupon (optional)', es: 'Cupón promocional (opcional)', fr: 'Code promo (optionnel)' })}
                </label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="EX: BEMVINDO10"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>
              <button
                type="button"
                disabled={subBusy || !currentPlan}
                onClick={handleStartCheckout}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {subBusy
                    ? pick({ pt: 'Gerando assinatura...', en: 'Creating subscription...', es: 'Generando suscripción...', fr: "Création de l'abonnement..." })
                    : pick({ pt: 'Assinar com Mercado Pago', en: 'Subscribe with Mercado Pago', es: 'Suscribirse con Mercado Pago', fr: "S'abonner avec Mercado Pago" })}
                </span>
              </button>
            </div>
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
