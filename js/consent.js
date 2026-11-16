// The visitor's cookie choice: Statistici (Google Analytics) and Marketing (Meta Pixel). It is written only
// when the visitor decides, kept in this browser (localStorage, never sent anywhere) and forgotten after
// 6 months, when the banner asks again. Storage that is blocked or full never breaks the page.

export const CONSENT_KEY = 'pixelmagix-consent';
export const CONSENT_DAYS = 182;

const DAY = 24 * 60 * 60 * 1000;
const VERSION = 1;

export function readConsent(storage, now = Date.now()) {
    let record;
    try {
        record = JSON.parse(storage?.getItem(CONSENT_KEY) ?? 'null');
    } catch {
        return null;
    }
    const valid = record?.v === VERSION
        && typeof record.statistici === 'boolean'
        && typeof record.marketing === 'boolean'
        && Number.isFinite(record.at)
        && record.at <= now + DAY
        && now - record.at < CONSENT_DAYS * DAY;
    return valid ? { statistici: record.statistici, marketing: record.marketing, at: record.at } : null;
}

// The cookies each tracker sets on this site (Google Analytics: _ga, _ga_<id>; Meta Pixel: _fbp, _fbc).
export const TRACKER_COOKIES = { statistici: /^_ga/, marketing: /^_fb[cp]$/ };

// Withdrawn consent: expire that category's cookies, on this host and on its parent domains (where the
// trackers put them). Other cookies are left alone; with nothing to remove nothing is written.
export function clearCookies(doc, hostname, pattern) {
    const names = String(doc.cookie ?? '').split(';').map(pair => pair.split('=')[0].trim()).filter(name => pattern.test(name));
    if (!names.length) return;
    const host = String(hostname ?? '');
    const domains = [''];
    if (host.includes('.') && !/^[\d.]+$/.test(host) && !host.startsWith('[')) {
        const labels = host.split('.');
        for (let index = 0; index < labels.length - 1; index += 1) domains.push(`; domain=.${labels.slice(index).join('.')}`);
    }
    names.forEach(name => domains.forEach(domain => {
        doc.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }));
}

export function saveConsent(storage, { statistici, marketing } = {}, now = Date.now()) {
    const choice = { statistici: statistici === true, marketing: marketing === true, at: now };
    try {
        storage?.setItem(CONSENT_KEY, JSON.stringify({ v: VERSION, ...choice }));
    } catch {
        // Not saved (private mode, blocked storage): the choice still applies to this page view.
    }
    return choice;
}
