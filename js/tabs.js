// Keyboard model shared by the tab lists (the TV categories and the install guide). Both lists are
// horizontal, so only Left/Right/Home/End move; Up/Down keep scrolling the page.
export function nextIndex(current, key, count) {
    switch (key) {
        case 'ArrowRight':
            return (current + 1) % count;
        case 'ArrowLeft':
            return (current - 1 + count) % count;
        case 'Home':
            return 0;
        case 'End':
            return count - 1;
        default:
            return null;
    }
}

// The install guide's device mockup follows the chosen tab; a new device replays its switch-on animation.
export function showDevice(stage, device) {
    if (!stage || !device || stage.dataset.device === device) return;
    stage.dataset.device = device;
    stage.classList.remove('is-switching');
    void stage.offsetWidth;
    stage.classList.add('is-switching');
}

// Turns a hidden [role=tablist] and its panels (readable one under another without JavaScript)
// into tabs: roving tabindex, aria-selected, one visible panel. onSelect(tab) hears every change.
export function initTabs(root, { onSelect } = {}) {
    const list = root?.querySelector('[role="tablist"]');
    if (!list) return;
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    if (!tabs.length || panels.some(panel => !panel)) return;

    let current = Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'));
    const select = (index, { focus = false } = {}) => {
        tabs.forEach((tab, position) => {
            const active = position === index;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            panels[position].hidden = !active;
        });
        current = index;
        if (focus) tabs[index].focus();
        onSelect?.(tabs[index]);
    };

    panels.forEach((panel, position) => {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabs[position].id);
        panel.tabIndex = 0;
    });
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(index));
        tab.addEventListener('keydown', event => {
            const next = nextIndex(current, event.key, tabs.length);
            if (next === null) return;
            event.preventDefault();
            select(next, { focus: true });
        });
    });
    select(current);
    list.hidden = false;
}
