// WhatsApp click-to-chat links (plain https links: they work inside the Facebook in-app browser).
export const WHATSAPP_NUMBER = '447449765468';

export const TRIAL_MESSAGE = 'Salut! Vreau să primesc testul gratuit de 36h pentru Pixel Magix TV. Mulțumesc!';

export function buildWhatsAppUrl(message, number = WHATSAPP_NUMBER) {
    const text = String(message ?? '').trim() || TRIAL_MESSAGE;
    const digits = String(number).replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
