// Ad origin code: an ad link such as ?utm_source=fb&utm_campaign=IT&utm_content=1 becomes "FB-IT-1",
// written at the end of the WhatsApp message, so the owner sees in each chat which ad brought it.
// It is read from the address of this visit and kept only in memory: nothing is stored.
import { buildWhatsAppUrl } from './whatsapp.js';

const SOURCES = { fb: 'FB', facebook: 'FB', ig: 'IG', instagram: 'IG', msg: 'MSG', messenger: 'MSG', an: 'AN' };

// Upper-case letters and digits only, words joined by "-": nothing else can reach the message.
function part(value, max) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max)
        .replace(/-+$/, '');
}

export function originCode(search) {
    const params = new URLSearchParams(String(search ?? ''));
    const campaign = part(params.get('utm_campaign'), 16);
    const content = part(params.get('utm_content'), 16);
    if (!campaign && !content) return '';
    const raw = String(params.get('utm_source') ?? '').trim().toLowerCase();
    const source = SOURCES[raw] ?? part(raw, 6);
    return [source, campaign, content].filter(Boolean).join('-');
}

export function withOrigin(message, code) {
    return code ? `${message}\n\nCod: ${code}` : message;
}

// Adds the code to a ready wa.me link, keeping its message (a link without one gets a short greeting).
export function addOriginToHref(href, code) {
    if (!code) return href;
    let url;
    try {
        url = new URL(href);
    } catch {
        return href;
    }
    if (url.hostname !== 'wa.me') return href;
    const text = url.searchParams.get('text') ?? '';
    return buildWhatsAppUrl(withOrigin(text.trim() || 'Salut!', code), url.pathname.slice(1));
}
