/**
 * layout-preference.js: how the reader arranged a page, kept between visits.
 *
 * A surface that can be rearranged -- columns folded away, a divider dragged --
 * is asking the reader a question the page cannot answer for them: how much of
 * this screen do you want spent on which part. Asking it again on every visit is
 * the page forgetting an answer it already has.
 *
 * What is stored is deliberately small and dull: which things are folded, and
 * how big things are. Nothing here knows what a 'build column' is, so a second
 * surface that wants this does not write a second copy of it.
 *
 * Note: localStorage rather than sessionStorage. The username beside it in this
 *       codebase is session state and is meant to go when the tab does; an
 *       arrangement is a preference and is meant not to. Neither has anything to
 *       do with the other, which is also why this is not in the redux store --
 *       that is seeded from the auth state, and a reader who is not signed in
 *       arranges pages too.
 *
 * Note: everything read here is UNTRUSTED. It is a string in someone's browser:
 *       they can edit it, an older version of this code may have written it, and
 *       a newer one will read it. So every value is checked on the way in and
 *       anything that does not check out is dropped rather than repaired -- a
 *       missing preference is a default, which is always a usable page, while a
 *       repaired one is a guess about what somebody meant.
 *
 * Note: and every access is guarded. localStorage throws outright in Safari's
 *       private mode and wherever site data is blocked, and a page that cannot
 *       remember a column width still has to render.
 */

const KEY = 'jefflevesque.layout';

//
// bumped when the SHAPE below changes. A record written by a version this code
// does not know is discarded rather than migrated: there is nothing here worth
// a migration path, and reading a shape you do not understand is how junk
// reaches a layout.
//
const VERSION = 1;

/**
 * the stored document, or null for anything unreadable.
 *
 * Note: a storage that throws and a storage that is empty land in the same
 *       place on purpose. Neither one has a preference to give.
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
// a plain object, or null. Arrays and null both report 'object' to typeof, and
// an array here would iterate its indices as though they were names.
//
function record(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

//
// the booleans out of `value`, and nothing else. A fold is on or off; a string
// 'false' is not off, and treating it as either is a guess.
//
function flags(value) {
    const from = record(value);
    const out = {};

    if (from) {
        Object.keys(from).forEach((name) => {
            if (typeof from[name] === 'boolean') {
                out[name] = from[name];
            }
        });
    }

    return out;
}

//
// the usable sizes out of `value`: finite and above zero, in css px.
//
// Note: zero and negative are dropped rather than clamped. A column of zero
//       width is not a narrow column, it is a missing one, and the reader who
//       gets it has no edge left to drag it back by.
//
// Note: so are Infinity and NaN, which JSON.parse produces from no input but
//       which a hand-edited record can carry as a bare number that overflows.
//       Either one reaches a layout as a column with no computable width.
//
function sizes(value) {
    const from = record(value);
    const out = {};

    if (from) {
        Object.keys(from).forEach((name) => {
            if (typeof from[name] === 'number' && Number.isFinite(from[name]) && from[name] > 0) {
                out[name] = from[name];
            }
        });
    }

    return out;
}

/**
 * what `surface` was arranged to at `variant`, and empty when that is unknown.
 *
 * `variant` is what makes one surface carry two arrangements. A reader folds
 * both columns on a phone, because a phone has room for one thing; restoring
 * that on a wide monitor is the stored preference disagreeing with the person.
 * Keeping the two apart costs one key and settles it.
 */
export function readLayout(surface, variant) {
    const stored = load();
    const at = stored ? record(record(stored[surface]) && stored[surface][variant]) : null;

    return {
        fold: flags(at && at.fold),
        size: sizes(at && at.size),
    };
}

/**
 * keep `layout` as how `surface` is arranged at `variant`.
 *
 * Note: merged into whatever is already stored, so the other variant -- and any
 *       other surface -- survives. Except when what is there is from a version
 *       this code does not know, which is replaced rather than merged into.
 *
 * Note: answers whether it managed it, rather than throwing. Every caller is a
 *       ui event handler, and none of them has anything useful to do about a
 *       browser that will not store things.
 */
export function writeLayout(surface, variant, layout) {
    const clean = {
        fold: flags(layout && layout.fold),
        size: sizes(layout && layout.size),
    };
    const stored = load() || { v: VERSION };
    const mine = record(stored[surface]) || {};

    stored[surface] = { ...mine, [variant]: clean };

    try {
        window.localStorage.setItem(KEY, JSON.stringify(stored));

        return true;
    } catch (e) {
        return false;
    }
}

export { KEY, VERSION };
