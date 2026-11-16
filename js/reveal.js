// Scroll reveals: section heads and cards rise into place as they reach the screen, in a short
// cascade. Content is visible by default. Only when motion is allowed and the observer exists is
// html.motion-ok added (after every target is observed), so a script problem never hides anything.

export const REVEAL_SELECTOR = [
    '.section__head > *',
    '.bento > .tile',
    '.cta-band',
    '.pricing__step',
    '.pricing__card',
    '.steps__list > .step',
    '.chat-demo',
    '.chat__msgs',
    '.install__tabs',
    '.device',
    '.install__panels',
    '.install__help',
    '.diaspora__card',
    '.faq__list > .faq__item',
    '.final-cta__card',
    '.site-footer__grid > *'
].join(', ');

const MAX_CASCADE = 5;

export function initReveal(doc = document, {
    reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    IO = globalThis.IntersectionObserver,
    onReveal
} = {}) {
    if (reducedMotion || typeof IO !== 'function') return;
    const targets = [...doc.querySelectorAll(REVEAL_SELECTOR)];
    if (!targets.length) return;

    // Cascade index: the element's place among the targets that share its parent.
    const seen = new Map();
    targets.forEach(target => {
        const index = seen.get(target.parentElement) ?? 0;
        seen.set(target.parentElement, index + 1);
        target.classList.add('reveal');
        target.style.setProperty('--reveal-i', String(Math.min(index, MAX_CASCADE)));
    });

    const observer = new IO(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
            onReveal?.(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(target => observer.observe(target));
    doc.documentElement.classList.add('motion-ok');
}
