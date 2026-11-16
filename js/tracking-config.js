// The owner's measurement IDs: the only place they are written. An empty (or malformed) ID switches that
// tracker off; with both off the site shows no cookie banner and no "Setări cookie" link.
//   metaPixelId: Meta Events Manager → Surse de date → the pixel/dataset ID (digits only)
//   ga4Id:       Google Analytics → Admin → Fluxuri de date → Web → ID de măsurare (G-…)
export const TRACKING = {
    metaPixelId: '1483723880323031',
    ga4Id: 'G-Z2TV8YTT9D'
};

export function enabledTrackers(config = TRACKING) {
    return {
        statistici: /^G-[A-Z0-9]{4,15}$/.test(config?.ga4Id ?? ''),
        marketing: /^\d{8,20}$/.test(config?.metaPixelId ?? '')
    };
}
