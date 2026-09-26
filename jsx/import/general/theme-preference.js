/**
 * theme-preference.js: the theme the reader chose -- light or dark -- kept
 * between visits.
 *
 * Until they choose, the page follows the system's own setting, and from the
 * moment they press the toggle in the header it follows their choice instead,
 * on every visit after, whatever the system says. What is stored is only that
 * choice: a reader who never presses it has nothing stored, and a system that
 * changes its mind changes the page.
 *
 * Note: localStorage, for the reason layout-preference.js gives for keeping a
 *       page's arrangement there. A theme is a preference, meant to outlast the
 *       tab, and has nothing to do with who is signed in.
 *
 * Note: a string, not a record. The script in the head of index.html reads it
 *       before the stylesheet has painted anything, so that the page is never
 *       drawn once in the wrong theme and then again in the right one, and that
 *       script has to agree with this one about the key and the two values. A
 *       bare word is the least there is for the two to disagree about. See
 *       index-html.test.js, which holds them together.
 *
 * Note: everything read here is untrusted and every access is guarded, as in
 *       layout-preference.js. A value that is not one of the two themes is no
 *       choice at all, and storage that throws -- Safari's private mode, blocked
 *       site data -- is a reader who has not chosen.
 */

const KEY = 'jefflevesque.theme';

const THEMES = ['light', 'dark'];

//
// the attribute on the root element the stylesheet keys on. See '_theme.scss'.
//
const ATTRIBUTE = 'data-theme';

//
// the system's setting, as the media query names it.
//
const SYSTEM_DARK = '(prefers-color-scheme: dark)';

/**
 * the theme the reader chose, or null for one who has not chosen.
 */
export function readTheme() {
    let stored;

    try {
        stored = window.localStorage.getItem(KEY);
    } catch (e) {
        return null;
    }

    return THEMES.includes(stored) ? stored : null;
}

/**
 * keep `theme` as the reader's choice, and answer whether it could be kept.
 *
 * Note: a value that is not a theme is refused rather than stored. It would be
 *       read back as no choice at all, which is not what the caller asked for.
 */
export function writeTheme(theme) {
    if (!THEMES.includes(theme)) {
        return false;
    }

    try {
        window.localStorage.setItem(KEY, theme);

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * the system's query, or null where there is none to ask -- an old browser, or
 * jsdom.
 */
export function systemQuery() {
    try {
        return typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_DARK) : null;
    } catch (e) {
        return null;
    }
}

/**
 * the theme the system asks for: dark where it says so, and light otherwise.
 */
export function systemTheme() {
    const query = systemQuery();

    return query && query.matches ? 'dark' : 'light';
}

/**
 * the theme to draw: the reader's, where they chose one, and the system's where
 * they did not.
 */
export function currentTheme() {
    return readTheme() || systemTheme();
}

/**
 * put `theme` on the root element, where the stylesheet reads it.
 */
export function applyTheme(theme) {
    document.documentElement.setAttribute(ATTRIBUTE, THEMES.includes(theme) ? theme : 'light');
}

export { KEY, THEMES, ATTRIBUTE, SYSTEM_DARK };
