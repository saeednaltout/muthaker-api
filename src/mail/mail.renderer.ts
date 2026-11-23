import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import Handlebars from 'handlebars';

import { MAIL_SUBJECTS, type MailLocale, type MailTemplateName } from './mail.types';

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Templates live next to this file (copied to dist/ by nest-cli assets). When a bundler
 * changes __dirname (e.g. Vercel), fall back to the source/dist folders in the project root
 * (vercel.json `includeFiles` ships them with the function).
 */
export function resolveTemplatesDir(): string {
  const candidates = [
    join(__dirname, 'templates'),
    join(process.cwd(), 'dist', 'mail', 'templates'),
    join(process.cwd(), 'src', 'mail', 'templates'),
  ];
  return candidates.find((dir) => existsSync(join(dir, 'layout.hbs'))) ?? candidates[0]!;
}

/**
 * Renders `templates/<locale>/<name>.hbs` inside the shared `templates/layout.hbs`
 * (sets `dir="rtl"` for Arabic). Templates are compiled once and cached.
 */
export class MailRenderer {
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();
  private readonly hbs = Handlebars.create();

  constructor(private readonly dir = resolveTemplatesDir()) {}

  render(name: MailTemplateName, locale: MailLocale, data: object): RenderedMail {
    const subject = MAIL_SUBJECTS[locale][name];
    const body = this.compile(join(locale, `${name}.hbs`))(data);
    const html = this.compile('layout.hbs')({
      body,
      subject,
      lang: locale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      align: locale === 'ar' ? 'right' : 'left',
      year: new Date().getFullYear(),
    });
    return { subject, html, text: toText(body) };
  }

  private compile(file: string): Handlebars.TemplateDelegate {
    let tpl = this.cache.get(file);
    if (!tpl) {
      tpl = this.hbs.compile(readFileSync(join(this.dir, file), 'utf8'), { strict: true });
      this.cache.set(file, tpl);
    }
    return tpl;
  }
}

function toText(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2: $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|div)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot);/gi, decodeEntity)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"' };

/** Reverses Handlebars' escaping (it encodes = ' ` as numeric entities) for the text part. */
function decodeEntity(_match: string, entity: string): string {
  const lower = entity.toLowerCase();
  if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
  if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
  return NAMED_ENTITIES[lower] ?? _match;
}
