/**
 * listing-preference.js: what a reader chose on a listing page, kept between
 * visits -- the stream they last charted there, and the order they dragged its
 * rows into.
 *
 * /data opens on a chart, and lists its streams under it. A
 * reader who charts the same stream on every visit, or watches two streams more
 * than the rest, answers the same two questions every time the page asks them:
 * which one, and in what order. Asking again is the page forgetting an answer it
 * already has -- the reasoning layout-preference.js gives for how a page is
 * arranged, and kept the way it keeps that.
 *
 * Note: localStorage, per browser rather than per account. A reader who is not
 *       signed in charts streams too, and the theme switch keeps its choice the
 *       same way.
 *
 * Note: everything read here is UNTRUSTED, as it is in layout-preference.js: a
 *       string in someone's browser, which an older version of this code may
 *       have written and a newer one will read. A stream is kept only while the
 *       page still lists it, and an order is fitted to the streams the page lists
 *       now: one that has gone is dropped, and one that is new joins at the end.
 *
 * Note: and every access is guarded. localStorage throws outright in Safari's
 *       private mode and wherever site data is blocked, and a page that cannot
 *       remember a chart still has to draw one.
 */

const KEY = 'jefflevesque.listing';

//
// bumped when the SHAPE below changes, and a record of any other version is
// discarded rather than migrated -- see layout-preference.js.
//
const VERSION = 1;

//
// the pages that keep a choice, each under its own name.
//
// Note: /stream kept one too, until it drew every stream at once as a row of
//       bars (#152). It charts none and has no order to drag, so a choice a
//       reader kept for it before is left where it is and never read.
//
const PAGES = ['data'];

/**
 * the stored document, or null for anything unreadable.
 */
function load() {
    let raw;

    try {
        raw = window.localStorage.getItem(KEY);
    } catch (e) {
        return null;
    }

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object' || parsed.v !== VERSION) {
            return null;
        }

        return parsed;
    } catch (e) {
        return null;
    }
}

//
// a plain object, or null. Arrays and null both report 'object' to typeof.
//
function record(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

//
// what `page` holds, or null.
//
function saved(page) {
    const stored = load();

    return stored && PAGES.includes(page) ? record(stored[page]) : null;
}

/**
 * the stream `page` last charted, while `streams` still lists it, and null
 * otherwise.
 */
export function readChart(page, streams) {
    const mine = saved(page);
    const chart = mine ? mine.chart : null;

    return typeof chart === 'string' && Array.isArray(streams) && streams.includes(chart)
        ? chart
        : null;
}

/**
 * the reader's order of `streams` on `page`, or null for the page's own order.
 *
 * Note: fitted to `streams` rather than trusted. A stream the page no longer
 *       lists is dropped, a repeat is kept once, and a stream the page lists that
 *       the order does not name joins at the end, in the page's order -- so the
 *       order a reader made survives the site gaining a stream.
 */
export function readOrder(page, streams) {
    const mine = saved(page);
    const order = mine ? mine.order : null;

    if (!Array.isArray(order) || !Array.isArray(streams)) {
        return null;
    }

    const kept = [];

    order.forEach((name) => {
        if (typeof name === 'string' && streams.includes(name) && !kept.includes(name)) {
            kept.push(name);
        }
    });

    if (!kept.length) {
        return null;
    }

    streams.forEach((name) => {
        if (!kept.includes(name)) {
            kept.push(name);
        }
    });

    return kept;
}

//
// merge `change` into what `page` holds, a null in it clearing that name.
//
// Note: answers whether it managed it, rather than throwing -- see
//       layout-preference.js's writeLayout.
//
function write(page, change) {
    if (!PAGES.includes(page)) {
        return false;
    }

    const stored = load() || { v: VERSION };
    const mine = { ...(record(stored[page]) || {}), ...change };

    Object.keys(mine).forEach((name) => {
        if (mine[name] === null) {
            delete mine[name];
        }
    });

    stored[page] = mine;

    try {
        window.localStorage.setItem(KEY, JSON.stringify(stored));

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * keep `stream` as the one `page` last charted.
 */
export function writeChart(page, stream) {
    return typeof stream === 'string' && stream ? write(page, { chart: stream }) : false;
}

/**
 * keep `order` as the reader's order of `page`'s streams, or clear it with null
 * -- the page's own order again.
 */
export function writeOrder(page, order) {
    if (order === null) {
        return write(page, { order: null });
    }

    if (!Array.isArray(order) || !order.every((name) => typeof name === 'string' && name)) {
        return false;
    }

    return write(page, { order: [...new Set(order)] });
}

export { KEY, VERSION, PAGES };
