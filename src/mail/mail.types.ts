export type MailLocale = 'ar' | 'en';

/** Template name → the variables it needs. Add new templates here and in templates/{ar,en}. */
export interface MailTemplates {
  'verify-email': { name: string; url: string };
  'reset-password': { name: string; url: string };
}

export type MailTemplateName = keyof MailTemplates;

export interface MailMessage<T extends MailTemplateName = MailTemplateName> {
  to: string;
  template: T;
  locale: MailLocale;
  data: MailTemplates[T];
}

export const MAIL_SUBJECTS: Record<MailLocale, Record<MailTemplateName, string>> = {
  ar: {
    'verify-email': 'تأكيد بريدك الإلكتروني في مُذاكِر',
    'reset-password': 'إعادة تعيين كلمة المرور في مُذاكِر',
  },
  en: {
    'verify-email': 'Verify your Muthaker email',
    'reset-password': 'Reset your Muthaker password',
  },
};

export const MAIL_OUTBOX_TYPE = 'mail.send';
