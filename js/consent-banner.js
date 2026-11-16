// The cookie banner (static HTML in index.html, [data-consent]). It only asks and reports: the choice is
// stored and applied by js/measure.js. "Accept tot" and "Refuz" decide at once; "Setări" opens one switch
// per category. Loaded only when the banner has to show or the footer's "Setări cookie" is used.

const SAVED = 'Am salvat alegerea ta.';

export function initConsentBanner(root, { enabled, onChoice, status, doc = document }) {
    const options = root.querySelector('[data-consent-options]');
    const settings = root.querySelector('[data-consent-settings]');
    const switches = {
        statistici: root.querySelector('input[name="statistici"]'),
        marketing: root.querySelector('input[name="marketing"]')
    };
    // A category whose tracker is switched off in js/tracking-config.js is not offered at all.
    root.querySelectorAll('[data-consent-row]').forEach(row => {
        row.hidden = !enabled[row.dataset.consentRow];
    });

    let current = null;
    let opener = null;
    let saves = 0;

    const expand = open => {
        options.hidden = !open;
        settings.setAttribute('aria-expanded', String(open));
    };
    const open = choice => {
        current = choice ?? null;
        switches.statistici.checked = current?.statistici === true;
        switches.marketing.checked = current?.marketing === true;
        root.hidden = false;
    };
    const close = () => {
        const focusWasInside = root.contains(doc.activeElement);
        root.hidden = true;
        expand(false);
        // Never leave keyboard focus on a hidden button: back to "Setări cookie", or to the content.
        if (focusWasInside) (opener ?? doc.getElementById('continut'))?.focus({ preventScroll: true });
        opener = null;
    };
    const decide = ({ statistici, marketing }) => {
        close();
        saves += 1;
        // A changed text (a trailing no-break space every other time) is announced again by screen readers.
        if (status) status.textContent = saves % 2 ? SAVED : `${SAVED} `;
        onChoice({ statistici: enabled.statistici && statistici, marketing: enabled.marketing && marketing });
    };

    root.querySelector('[data-consent-accept]').addEventListener('click', () => decide({ statistici: true, marketing: true }));
    root.querySelector('[data-consent-reject]').addEventListener('click', () => decide({ statistici: false, marketing: false }));
    root.querySelector('[data-consent-save]').addEventListener('click', () => decide({
        statistici: switches.statistici.checked,
        marketing: switches.marketing.checked
    }));
    settings.addEventListener('click', () => expand(options.hidden));
    // Escape only dismisses a banner reopened over an existing choice: the first one needs an answer.
    root.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !current) return;
        event.preventDefault();
        close();
    });

    return {
        show(choice = null) {
            open(choice);
        },
        openSettings(choice, from = null) {
            open(choice);
            opener = from;
            expand(true);
            root.focus();
        }
    };
}
