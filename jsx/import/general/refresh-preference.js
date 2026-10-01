/**
 * refresh-preference.js: whether /stream asks for its streams again on its own,
 * kept between visits.
 *
 * /stream asks for every stream again every five minutes while it is showing,
 * and a reader can switch that off from the button beside its api icons. A
 * reader who switched it off meant it for the next visit too, so the choice is
 * kept rather than asked for again.
 *
 * Note: localStorage, per browser, and every access guarded, for the reasons
 *       listing-preference.js gives. A browser that cannot keep the choice
 *       refreshes, as a reader who never made one does.
 */

const KEY = 'jefflevesque.refresh';

//
// the one thing kept: that the reader switched it off. On is what holds nothing,
// so a value that is anything else -- from an older version, or from nowhere --
// reads as on.
//
const OFF = 'off';

/**
 * whether the page refreshes on its own: on, unless this browser kept it off.
 */
export function readRefresh() {
    try {
        return window.localStorage.getItem(KEY) !== OFF;
    } catch (e) {
        return true;
    }
}

/**
 * keep the reader's choice, answering whether it was kept.
 */
export function writeRefresh(on) {
    try {
        if (on) {
            window.localStorage.removeItem(KEY);
        } else {
            window.localStorage.setItem(KEY, OFF);
        }

        return true;
    } catch (e) {
        return false;
    }
}

export { KEY };
