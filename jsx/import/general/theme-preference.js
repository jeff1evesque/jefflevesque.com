/**
 * theme-preference.js: which theme the page is in -- light by day and dark in the
 * evening, on the reader's own clock, unless they have asked for the other one.
 *
 * The schedule is the reader's local time, so a reader in Maryland goes dark three
 * hours before one in California: light from 7 in the morning until 7 in the
 * evening, and dark the rest of the day. See DAY_STARTS and EVENING_STARTS.
 *
 * Pressing the switch in the header asks for the other theme for the rest of the
 * stretch the reader is in -- the rest of the day, or of the night. The choice is
 * kept, through reloads and in other tabs, until the schedule's next switch, and
 * then the schedule takes over again. The schedule arrives at the choice there: a
 * reader who asked for the dark theme at noon is still in it at 7 in the evening,
 * when the schedule goes dark too, and follows the schedule from then on. Pressing
 * it back to the theme the schedule gives is no choice at all: the page is simply
 * back on its schedule.
 *
 * Note: localStorage, for the reason layout-preference.js gives for keeping a
 *       page's arrangement there: a choice is meant to outlast a reload, and has
 *       nothing to do with who is signed in. What is stored is the theme and the
 *       moment it lapses, `{ theme, until }`. A choice that has lapsed is no choice.
 *
 * Note: the script in the head of index.html reads the same key, before the
 *       stylesheet has painted anything, so that the page is never drawn once in
 *       the wrong theme and then again in the right one -- and so it has to agree
 *       with this module about the key, the record and the schedule. See
 *       index-html.test.js, which holds them together.
 *
 * Note: everything read here is untrusted and every access is guarded, as in
 *       layout-preference.js. A record that is not a theme and a moment is no
 *       choice at all -- the bare 'light' or 'dark' an earlier version kept among
 *       them -- and storage that throws is a reader who has not chosen.
 */

const KEY = 'jefflevesque.theme';

const THEMES = ['light', 'dark'];

//
// the attribute on the root element the stylesheet keys on. See '_theme.scss'.
//
const ATTRIBUTE = 'data-theme';

//
// the reader's local hours the light theme runs between: from 7 in the morning,
// until 7 in the evening.
//
const DAY_STARTS = 7;
const EVENING_STARTS = 19;

/**
 * the theme the schedule gives `now`, on the reader's own clock.
 */
export function scheduledTheme(now = new Date()) {
    const hour = now.getHours();

    return hour >= DAY_STARTS && hour < EVENING_STARTS ? 'light' : 'dark';
}

/**
 * the moment after `now` at which the schedule next switches: 7 in the morning or
 * 7 in the evening, local time.
 *
 * Note: set by the local clock rather than by adding hours, so a day that gains or
 *       loses an hour still switches at 7.
 */
export function nextSwitch(now = new Date()) {
    const next = new Date(now.getTime());
    const hour = now.getHours();

    if (hour < DAY_STARTS) {
        next.setHours(DAY_STARTS, 0, 0, 0);
    } else if (hour < EVENING_STARTS) {
        next.setHours(EVENING_STARTS, 0, 0, 0);
    } else {
        next.setDate(next.getDate() + 1);
        next.setHours(DAY_STARTS, 0, 0, 0);
    }

    return next;
}

/**
 * the theme the reader asked for, where the choice has not lapsed by `now`, or
 * null.
 */
export function readTheme(now = new Date()) {
    let stored;

    try {
        stored = JSON.parse(window.localStorage.getItem(KEY));
    } catch (e) {
        return null;
    }

    if (!stored || !THEMES.includes(stored.theme) || typeof stored.until !== 'number') {
        return null;
    }

    return stored.until > now.getTime() ? stored.theme : null;
}

/**
 * ask for `theme` until the schedule's next switch, and answer whether that could
 * be kept.
 *
 * Asking for the theme the schedule gives clears whatever was asked before.
 *
 * Note: a value that is not a theme is refused rather than stored. It would be
 *       read back as no choice at all, which is not what the caller asked for.
 */
export function writeTheme(theme, now = new Date()) {
    if (!THEMES.includes(theme)) {
        return false;
    }

    try {
        if (theme === scheduledTheme(now)) {
            window.localStorage.removeItem(KEY);
        } else {
            window.localStorage.setItem(KEY, JSON.stringify({ theme: theme, until: nextSwitch(now).getTime() }));
        }

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * the theme to draw at `now`: the reader's, while their choice holds, and the
 * schedule's otherwise.
 */
export function currentTheme(now = new Date()) {
    return readTheme(now) || scheduledTheme(now);
}

/**
 * put `theme` on the root element, where the stylesheet reads it.
 */
export function applyTheme(theme) {
    document.documentElement.setAttribute(ATTRIBUTE, THEMES.includes(theme) ? theme : 'light');
}

export { KEY, THEMES, ATTRIBUTE, DAY_STARTS, EVENING_STARTS };
