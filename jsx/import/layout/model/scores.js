/**
 * scores.js: what the model pages know about a score, a model's status and its
 * days (#243), how long a night's attempt took (#247), the trainer's checks that
 * take a live version down for doing worse than the baseline (#263), and the
 * three scores loss adds up (#265).
 *
 * The api scores every model four ways, and the pages offer the four alike from
 * one picker:
 *
 *     loss         three scores added up -- see LOSS_PARTS -- of how far the
 *                  chances predicted for each stock going up, and for it beating
 *                  the average stock, were from what happened, and of how far off
 *                  the size of its move was. Lower is better, and it is the score
 *                  that decides whether a night's attempt goes live
 *     auc_up       how well the predictions rank the stocks that went up above the
 *                  ones that went down: 0.5 is a coin toss
 *     auc_beats    the same for the stocks that beat the average stock
 *     acc_up       the share of stocks whose direction was called right
 *
 * Every chart draws "better" upward, so loss's axis is flipped, and every
 * difference here is signed the same way: positive is better, whichever way the
 * score runs. See betterBy.
 *
 * Note: nothing here says how a model is built. The api serves scores only, and
 *       so do the pages.
 */

import { colors_categorical, themeColors } from '../../general/colors.js';

//
// each with the note its name carries wherever a page names it (#265): what it
// measures, and which way is better. Without one, loss read as a single log
// loss, and a log loss of 1.7 would be poor on most tasks
//
export const SCORES = [
    {
        key: 'loss',
        label: 'Loss',
        lower: true,
        note: 'Loss adds three scores: up or down, beating the average stock, and the size of the move. Lower is better. A coin flip scores 0.693 on each of the first two. The baseline is what knowing nothing scored on the same days.',
    },
    {
        key: 'auc_up',
        label: 'Up/down AUC',
        lower: false,
        note: 'How well the predictions rank the stocks that went up above the ones that went down: 0.5 is a coin flip, and higher is better.',
    },
    {
        key: 'auc_beats',
        label: 'Beat-the-average AUC',
        lower: false,
        note: 'How well the predictions rank the stocks that beat the average stock above the ones that didn’t: 0.5 is a coin flip, and higher is better.',
    },
    {
        key: 'acc_up',
        label: 'Up/down accuracy',
        lower: false,
        share: true,
        note: 'The percent of stocks whose direction, up or down, was called right: higher is better.',
    },
];

//
// the three scores loss adds up (#265), each by the column a history and a track
// record give it, and by its name on the pages: the log loss of whether each
// stock went up, and of whether it beat the average stock, and the pinball loss
// of the size of its move. Each is lower-is-better, as loss is, and is compared
// and printed as loss is. The picker offers none of them
//
export const LOSS_PARTS = [
    { key: 'up_log_loss', label: 'Up or down' },
    { key: 'beats_log_loss', label: 'Beats the average stock' },
    { key: 'move_pinball', label: 'Size of the move' },
];

//
// the score the pages open on, the one that decides what goes live
//
export const DEFAULT_SCORE = 'loss';

//
// how many of a model's scored days its 20-day score takes in, and how many it
// has to have before it is no longer New
//
export const WINDOW = 20;

//
// how many days a row's trend line spans, on the one axis every row shares
//
export const TREND_DAYS = 60;

//
// how many models can be compared at once. Past three, the colors stop being
// easy to tell apart
//
export const COMPARE_MAX = 3;

//
// the colors of the models compared, kept by each while it stays ticked: the
// first three of the charts' categorical colors, the same in either theme
//
export const COMPARE_COLORS = colors_categorical.slice(0, COMPARE_MAX);

//
// better and worse, as the site draws them: the darkest of /stream's bars' blues
// and the red of a miss there, each a theme pair, as '--stream-shade-0' and
// '--stream-missed' are in '_stream.scss'
//
const BETTER = { light: '#1c5cab', dark: '#86b6ef' };
const WORSE = { light: '#d03b3b', dark: '#e66767' };

//
// the live version, in the green of a Live model's pill -- '$green-6', and a
// darker green on a dark page, where the pill's would sit too near the red --
// and the know-nothing baseline in amber, dashed. Checked as a set with better
// and worse, since any two of the four may meet on the attempts chart: apart
// under each kind of colorblindness and to a full-color eye. By day the
// baseline's amber is under 3:1 on the page, and is read beside its legend and
// the table of numbers rather than alone
//
const LIVE = { light: '#237616', dark: '#4a993e' };
const BASELINE = { light: '#c98500', dark: '#eda100' };

//
// how long each attempt took, in the charts' teal, which no other part of the
// page draws: a color already meaning better, worse, live or the baseline
// would say so of a bar too
//
const TOOK = { light: '#1baf7a', dark: '#199e70' };

export const STATUSES = [
    { key: 'live', label: 'Live' },
    { key: 'new', label: 'New' },
    { key: 'down', label: 'Behind baseline' },
    { key: 'retired', label: 'Retired' },
];

export const SORTS = [
    { key: 'score', label: 'Best score' },
    { key: 'name', label: 'Name' },
    { key: 'went', label: 'Most attempts gone live' },
    { key: 'since', label: 'Newest live version' },
];

//
// what each way a live version came to be live is called
//
const LIVE_KINDS = {
    first: 'first version',
    nightly: 'nightly update',
    weekly: 'weekly retrain',
};

/**
 * a score by its key, or the default for a key that is none.
 */
export function scoreOf(key) {
    return SCORES.find((score) => score.key === key) || SCORES.find((score) => score.key === DEFAULT_SCORE);
}

function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * a value as the pages print it: three places, or a share as a percentage to
 * one, and a dash where there is none.
 */
export function formatScore(value, key) {
    if (!finite(value)) {
        return '–';
    }

    return scoreOf(key).share ? `${(value * 100).toFixed(1)}%` : value.toFixed(3);
}

/**
 * how far apart two values are, unsigned: '0.034', or '1.2 pts' for a share.
 */
export function formatGap(value, key) {
    if (!finite(value)) {
        return '–';
    }

    return scoreOf(key).share ? `${(Math.abs(value) * 100).toFixed(1)} pts` : Math.abs(value).toFixed(3);
}

/**
 * a value on an axis: as few places as it needs, up to three, or a share's
 * percentage to one.
 */
export function formatTick(value, key) {
    if (!finite(value)) {
        return '';
    }

    return scoreOf(key).share ? `${Number((value * 100).toFixed(1))}%` : String(Number(value.toFixed(3)));
}

/**
 * a difference on an axis, signed, where up is better: '+0.01', '−0.01',
 * '+1 pts', or '0'.
 */
export function formatSignedTick(value, key) {
    if (!finite(value)) {
        return '';
    }

    const share = scoreOf(key).share;
    const size = share ? Number((Math.abs(value) * 100).toFixed(1)) : Number(Math.abs(value).toFixed(3));

    if (size === 0) {
        return '0';
    }

    return `${value > 0 ? '+' : '−'}${size}${share ? ' pts' : ''}`;
}

/**
 * how much better `value` is than `than` on a score: positive where it is
 * better, negative where it is worse, whichever way the score runs -- lower for
 * loss, higher for the rest. Null where either is missing.
 */
export function betterBy(value, than, key) {
    if (!finite(value) || !finite(than)) {
        return null;
    }

    return scoreOf(key).lower ? than - value : value - than;
}

/**
 * 'better', 'worse' or 'level', for a difference betterBy gave, as the pages
 * print it -- so two values the page prints alike are level, not a hair apart.
 */
export function standing(gap, key) {
    if (!finite(gap) || formatGap(gap, key) === formatGap(0, key)) {
        return 'level';
    }

    return gap > 0 ? 'better' : 'worse';
}

/**
 * the three parts of a track record's day's 20-day loss (#265): each part's
 * average, `value`, the baseline's over the same days, `baseline`, and how the
 * part stands against it, `stands` -- better, worse or level, as loss is
 * compared, or null where the baseline has none. The newest day's are over the
 * same days as the listing's score, so the three add up to it.
 *
 * None for a day without all three, as in a track record without their columns:
 * two parts alone would not add up to the loss.
 *
 * Note: compared as the two are printed, since the page prints the word beside
 *       them. tables-gnn's size of the move was 0.26018 against the baseline's
 *       0.26065 over its first five days: less than half a thousandth apart,
 *       which standing calls level, and printed as 0.260 and 0.261.
 */
export function lossParts(row) {
    const averageOf = (field, key) => (row && row[field] ? row[field][key] : null);
    const printed = (value) => Number(formatScore(value, 'loss'));
    const parts = LOSS_PARTS.map((part) => {
        const value = averageOf('average', part.key);
        const baseline = averageOf('baseline_average', part.key);

        return {
            key: part.key,
            label: part.label,
            value: value,
            baseline: baseline,
            stands: finite(value) && finite(baseline) ? standing(betterBy(printed(value), printed(baseline), 'loss'), 'loss') : null,
        };
    });

    return parts.every((part) => finite(part.value)) ? parts : [];
}

/**
 * a model's status: Retired once it has stopped being trained, Behind baseline
 * while the trainer has its live version down for doing worse than the baseline
 * (#263), New while it has fewer than 20 scored days, and Live otherwise.
 */
export function statusOf(model) {
    if (model.retired) {
        return 'retired';
    }

    if (model.down) {
        return 'down';
    }

    return model.scored_days < WINDOW ? 'new' : 'live';
}

/**
 * the status as a model's pill says it: New says how many days it has so far.
 */
export function statusLabel(model) {
    const status = statusOf(model);

    if (status === 'new') {
        return `New · ${model.scored_days} ${model.scored_days === 1 ? 'day' : 'days'}`;
    }

    return STATUSES.find((each) => each.key === status).label;
}

/**
 * how a live version came to be live, in words.
 */
export function liveKind(kind) {
    return LIVE_KINDS[kind] || '';
}

/**
 * when a live version was taken down, as its figure says it (#263): 'Taken down
 * Oct 19', the day held on one line where a narrow cell wraps the figure.
 */
export function takenDown(day) {
    return `Taken down ${shortDay(day).replace(' ', ' ')}`;
}

/**
 * the check that took a live version down, in words (#263): 'worse than the
 * baseline 5 scored days in a row' for the check of each day on its own, and
 * 'its 5-day average was worse than the baseline’s 10 days in a row' for an
 * average's. `check` is { days, in_a_row }, as the listing's `down` gives it,
 * and as a track record gives the day whose score set it off. A count it does
 * not have is left out.
 */
export function checkWords({ days, in_a_row: inARow }) {
    const count = finite(inARow)
        ? ` ${inARow} ${days === 1 ? 'scored ' : ''}${inARow === 1 ? 'day' : 'days'} in a row`
        : '';

    return days === 1
        ? `worse than the baseline${count}`
        : `its ${days}-day average was worse than the baseline’s${count}`;
}

//
// one of the trainer's checks by name, 'each day' or '5-day average', and how
// many scored days in a row it has been worse than the baseline, '4 of 5', or
// 'not yet' while it has too few days to say
//
function checkName(check) {
    return check.days === 1 ? 'each day' : `${check.days}-day average`;
}

function checkCount(check) {
    return finite(check.in_a_row) ? `${check.in_a_row} of ${check.limit}` : 'not yet';
}

/**
 * how close each of the trainer's checks is to taking a model's live version
 * down (#263), from the listing's `behind`: 'Days in a row worse than the
 * baseline: each day 4 of 5, 5-day average 0 of 10, 20-day average not yet.'
 * Nothing for a listing that gives no checks, as one before format 2 does.
 */
export function behindLine(behind) {
    if (!Array.isArray(behind) || !behind.length) {
        return '';
    }

    const each = behind.map((check) => `${checkName(check)} ${checkCount(check)}`);

    return `Days in a row worse than the baseline: ${each.join(', ')}.`;
}

/**
 * the same checks as rows of the Live version card on a wide screen (#267), a
 * name and a count each: { key, name: 'Each day', value: '4 of 5' }. None for a
 * listing that gives no checks.
 */
export function behindRows(behind) {
    if (!Array.isArray(behind)) {
        return [];
    }

    return behind.map((check) => {
        const name = checkName(check);

        return { key: `check-${check.days}`, name: `${name.charAt(0).toUpperCase()}${name.slice(1)}`, value: checkCount(check) };
    });
}

//
// the know-nothing baseline's dashes, on every chart and in every legend and
// panel: drawn solid, it read as a second model beside the live version
//
export const BASELINE_DASH = '5 4';

//
// how much of its bar's color the scoring on top of an attempt's training takes
//
export const SCORING_OPACITY = 0.4;

/**
 * the colors every chart draws in, for `theme`: its text and muted gray, its
 * grid and its page, better and worse, the live version and the baseline, and
 * how long an attempt took.
 */
export function chartColors(theme) {
    const shade = themeColors(theme);
    const dark = theme === 'dark';

    return {
        ink: shade['gray-8'],
        muted: shade['gray-6'],
        grid: shade['gray-2'],
        page: shade['white-1'],
        better: dark ? BETTER.dark : BETTER.light,
        worse: dark ? WORSE.dark : WORSE.light,
        live: dark ? LIVE.dark : LIVE.light,
        baseline: dark ? BASELINE.dark : BASELINE.light,
        took: dark ? TOOK.dark : TOOK.light,
    };
}

//
// a day of the api's, 'YYYY-MM-DD', as the instant at its noon in UTC, so it
// reads as the same day in every zone
//
function noonOf(day) {
    return new Date(`${day}T12:00:00Z`);
}

/**
 * a day as an axis or a row names it: 'Oct 14'.
 */
export function shortDay(day) {
    if (!day) {
        return '';
    }

    return noonOf(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * a day as a tooltip names it: 'Wed, Oct 14, 2026'.
 */
export function longDay(day) {
    if (!day) {
        return '';
    }

    return noonOf(day).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

/**
 * a duration in seconds, as the pages print it: '1.3 s' to a tenth under ten
 * seconds, as the history keeps it, and to the whole second past them, '52 s',
 * '8 min 52 s', '1 h 0 min 5 s'. Nothing where there is none.
 */
export function formatDuration(seconds) {
    if (!finite(seconds) || seconds < 0) {
        return '';
    }

    if (seconds < 9.95) {
        return `${seconds.toFixed(1)} s`;
    }

    const whole = Math.round(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const rest = whole % 60;

    if (hours) {
        return `${hours} h ${minutes} min ${rest} s`;
    }

    return minutes ? `${minutes} min ${rest} s` : `${rest} s`;
}

//
// an instant as the history writes one: a date and a time, with its offset
//
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * when an attempt started, as the pages print it: its time of day in Eastern
 * time, as the trading days are kept, '3:58 AM ET', in summer or winter.
 * Nothing for text that is not an instant with its offset, which would be read
 * in the reader's own zone.
 *
 * Note: put together from its parts, since a newer Intl writes a narrow space
 *       before AM, which would print differently from one browser to the next.
 */
export function formatStarted(text) {
    const at = typeof text === 'string' && INSTANT.test(text.trim()) ? new Date(text.trim()) : null;

    if (!at || !finite(at.getTime())) {
        return '';
    }

    const parts = {};

    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
        .formatToParts(at)
        .forEach((part) => {
            parts[part.type] = part.value;
        });

    return `${parts.hour}:${parts.minute} ${parts.dayPeriod} ET`;
}

/**
 * the models in the order `sort` names, for the score on screen:
 *
 *     score    the best latest 20-day score first, which is the lowest loss
 *              and the highest of the rest. A model with none yet comes last
 *     name     by name
 *     went     the most attempts gone live first
 *     since    the live version that went live last first. A retired model's
 *              went live before it retired, and comes after every model still
 *              trained
 *
 * Ties are broken by name, so the order never depends on the listing's.
 */
export function sortModels(models, sort, key) {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const scored = (model) => (model.score && finite(model.score[key]) ? model.score[key] : null);

    const compare = {
        name: byName,
        went: (a, b) => b.attempts.went_live - a.attempts.went_live,
        since: (a, b) => {
            const when = (model) => (model.retired ? '' : model.live.since || '');

            return when(b).localeCompare(when(a));
        },
        score: (a, b) => {
            const x = scored(a);
            const y = scored(b);

            if (x === null || y === null) {
                return (x === null) - (y === null);
            }

            return scoreOf(key).lower ? x - y : y - x;
        },
    }[sort] || byName;

    return models.slice().sort((a, b) => compare(a, b) || byName(a, b));
}

/**
 * why `model` cannot be ticked beside those `picked`, or null where it can: it
 * predicts something else, or three are ticked already. One already ticked can
 * always be unticked.
 */
export function compareBlocked(model, picked) {
    if (!picked.length || picked.some((each) => each.name === model.name)) {
        return null;
    }

    if (picked[0].task !== model.task) {
        return 'Predicts something else, so it can’t be compared with the ticked models';
    }

    if (picked.length >= COMPARE_MAX) {
        return 'Up to three at once, so the colors stay easy to tell apart';
    }

    return null;
}

/**
 * one axis of days for several track records: every day any of them holds,
 * oldest first, each with the row of every record that holds it -- so a day a
 * model was not running is a gap in its line rather than a day it is missing
 * from.
 *
 * `records` is { name: rows }, a record that could not be had being null.
 */
export function alignDays(records) {
    const days = {};

    Object.keys(records).forEach((name) => {
        (records[name] || []).forEach((row) => {
            days[row.day] = days[row.day] || { day: row.day };
            days[row.day][name] = row;
        });
    });

    return Object.keys(days).sort().map((day) => days[day]);
}

/**
 * the last `count` days any of the track records holds: the axis every row's
 * trend line is drawn on.
 */
export function recentDays(records, count = TREND_DAYS) {
    return alignDays(records).slice(-count).map((entry) => entry.day);
}
