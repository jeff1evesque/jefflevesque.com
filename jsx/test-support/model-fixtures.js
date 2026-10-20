/**
 * model-fixtures.js: what the model pages' tests draw (#243): a listing's tasks
 * and models, and a model's history and track record, as the worker hands them
 * to the pages -- see worker/model/report.js.
 *
 * Note: days are weekdays from 2026-09-01, as a model is scored on trading days
 *       alone. Every builder is plain data, so a test can change one field of
 *       what it is handed and leave the rest as they are.
 */

export const TASKS = [
    { id: 'direction', name: 'Next-day direction', description: 'Up or down, scored the next day.' },
    { id: 'beats', name: 'Beat the average', description: 'Above or below the average stock.' },
];

const LIVE_SCORE = { loss: 1.6, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54 };
const BASELINE = { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.52 };

//
// loss's three parts as the listing gives them (#265): not at all, so the worker
// reads each as null
//
const NO_PARTS = { up_log_loss: null, beats_log_loss: null, move_pinball: null };

//
// the baseline's scores on a day its loss is `loss`, its three parts adding up
// to it: on beating the average stock, a coin flip's 0.693
//
function baselineAt(loss = BASELINE.loss) {
    return { ...BASELINE, loss: loss, up_log_loss: 0.7, beats_log_loss: 0.693, move_pinball: loss - 1.393 };
}

/**
 * a model as the listing holds it. Its live version is live, and the listing
 * gives no checks, as one before format 2 does (#263).
 */
export function modelOf(overrides = {}) {
    return {
        name: 'pt-gnn',
        task: 'direction',
        description: 'A graph model of the market',
        started: '2026-09-01',
        retired: null,
        scored_days: 30,
        live: { since: '2026-10-09', kind: 'nightly' },
        attempts: { total: 30, went_live: 4 },
        score: { ...LIVE_SCORE, ...NO_PARTS },
        baseline: { ...BASELINE, ...NO_PARTS },
        down: null,
        behind: [],
        ...overrides,
    };
}

/**
 * how close each of the trainer's checks is to taking a live version down, as a
 * format 2 listing gives them (#263): each day 4 of 5 in a row worse than the
 * baseline, the 5-day average 0 of 10, and the 20-day average not yet.
 */
export function behindOf(each = 4, five = 0, twenty = null) {
    return [
        { days: 1, in_a_row: each, limit: 5 },
        { days: 5, in_a_row: five, limit: 10 },
        { days: 20, in_a_row: twenty, limit: 5 },
    ];
}

/**
 * a model whose live version the trainer took down on the night of 2026-10-19,
 * for doing worse than the baseline 5 scored days in a row (#263).
 */
export function downModelOf(overrides = {}) {
    return modelOf({
        name: 'lagging',
        score: { loss: 1.7, auc_up: 0.48, auc_beats: 0.49, acc_up: 0.5 },
        down: { since: '2026-10-19', days: 1, in_a_row: 5 },
        behind: behindOf(5, 1),
        ...overrides,
    });
}

/**
 * the listing: three models of one task, and one of another. With a `format`,
 * it gives that format_version, as the trainer writes one from 2026-10-15 on
 * (#248); without, it gives none, as a listing before then did.
 */
export function listingOf(models = null, format = null) {
    return {
        ...(format === null ? {} : { format_version: format }),
        tasks: TASKS.map((task) => ({ ...task })),
        models: models || [
            modelOf(),
            modelOf({ name: 'tables', description: 'A model of the tables', score: { loss: 1.62, auc_up: 0.54, auc_beats: 0.52, acc_up: 0.55 }, attempts: { total: 30, went_live: 9 }, live: { since: '2026-10-12', kind: 'weekly' } }),
            modelOf({ name: 'fresh', description: '', started: '2026-10-05', scored_days: 6, score: { loss: 1.64, auc_up: 0.52, auc_beats: 0.51, acc_up: 0.53 }, attempts: { total: 6, went_live: 1 }, live: { since: '2026-10-05', kind: 'first' } }),
            modelOf({ name: 'beater', task: 'beats', retired: '2026-10-02', score: { loss: 1.65, auc_up: 0.51, auc_beats: 0.55, acc_up: 0.5 }, attempts: { total: 20, went_live: 2 } }),
        ],
    };
}

/**
 * `count` weekdays from `from`, oldest first.
 */
export function weekdays(count, from = '2026-09-01') {
    const days = [];
    const at = new Date(`${from}T12:00:00Z`);

    while (days.length < count) {
        if (at.getUTCDay() !== 0 && at.getUTCDay() !== 6) {
            days.push(at.toISOString().slice(0, 10));
        }

        at.setUTCDate(at.getUTCDate() + 1);
    }

    return days;
}

//
// a model's scores on a day its loss is `loss`, and loss's three parts adding up
// to it (#265): worse than the baseline's on up or down, and better on beating
// the average stock
//
function scoresAt(loss) {
    return {
        loss: loss,
        auc_up: 2.16 - loss,
        auc_beats: 2.13 - loss,
        acc_up: 2.14 - loss,
        up_log_loss: 0.72,
        beats_log_loss: 0.62,
        move_pinball: loss - 1.34,
    };
}

//
// the first night the trainer kept its attempts' times (#247)
//
const TIMED_FROM = '2026-10-15';

//
// a night's times, as the worker hands them: none before TIMED_FROM, and from
// it on, a start just before 4 AM Eastern the next morning. The first timed
// night trains for 7 min 17 s and takes 8 min 52 s in all, and each `nth` one
// after it a minute more
//
function timesAt(day, nth) {
    if (day < TIMED_FROM) {
        return { started: null, training_seconds: null, total_seconds: null };
    }

    const next = new Date(`${day}T12:00:00Z`);

    next.setUTCDate(next.getUTCDate() + 1);

    return {
        started: `${next.toISOString().slice(0, 10)}T07:58:10+00:00`,
        training_seconds: 437.2 + nth * 60,
        total_seconds: 532.4 + nth * 60,
    };
}

/**
 * a history: one night per weekday from `from`. `nights` overrides each night
 * by its index. A night from 2026-10-15 on has times, and one before has none.
 */
export function historyOf(count = 5, nights = {}, from = '2026-10-01') {
    const days = weekdays(count, from);
    const firstTimed = days.filter((day) => day < TIMED_FROM).length;

    return days.map((day, at) => ({
        day: day,
        kind: 'nightly',
        went_live: false,
        ...timesAt(day, at - firstTimed),
        attempt: scoresAt(1.61 + at * 0.001),
        live: scoresAt(1.6),
        baseline: baselineAt(),
        ...(nights[at] || {}),
    }));
}

/**
 * a history across the night the trainer began keeping times: Oct 12 to 14
 * without them, and Oct 15 and 16 with them.
 */
export function timedHistoryOf(nights = {}) {
    return historyOf(5, nights, '2026-10-12');
}

/**
 * a track record, its averages worked out as the worker works them: each day
 * over the rows so far, up to 20. `loss(at)` is each day's loss, and
 * `baselineLoss(at)` the baseline's, each with its three parts adding up to it
 * (#265). No day took the live version down.
 */
export function trackOf(count = 5, from = '2026-09-01', loss = (at) => 1.6 + (at % 3) * 0.01, baselineLoss = () => BASELINE.loss) {
    const rows = weekdays(count, from).map((day, at) => ({
        day: day,
        score: scoresAt(loss(at)),
        baseline: baselineAt(baselineLoss(at)),
        down_days: null,
        down_in_a_row: null,
    }));

    rows.forEach((row, at) => {
        const recent = rows.slice(Math.max(0, at - 19), at + 1);
        const mean = (field) => {
            const average = {};

            Object.keys(row[field]).forEach((key) => {
                average[key] = recent.reduce((sum, each) => sum + each[field][key], 0) / recent.length;
            });

            return average;
        };

        row.days = recent.length;
        row.average = mean('score');
        row.baseline_average = mean('baseline');
    });

    return rows;
}

/**
 * a track record without loss's three parts (#265), as the worker reads one:
 * each part null on every day, in its scores and in its averages, and the rest
 * as trackOf has it.
 */
export function olderTrackOf(count = 5) {
    const without = (scores) => ({ ...scores, ...NO_PARTS });

    return trackOf(count).map((row) => ({
        ...row,
        score: without(row.score),
        baseline: without(row.baseline),
        average: without(row.average),
        baseline_average: without(row.baseline_average),
    }));
}

/**
 * two models' track records over the same three days, each with its own
 * baseline, as every model's record has (#263): the baseline's loss is 1.66 in
 * pt-gnn's and 1.70 in tables'. The trainer's differed so on 2026-10-15: 1.733
 * in tables-gnn's record, and 1.702 in pt-gnn's.
 */
export function ownBaselines() {
    return {
        'pt-gnn': trackOf(3),
        tables: trackOf(3, '2026-09-01', undefined, () => 1.7),
    };
}

/**
 * the recharts module with its ResponsiveContainer given a size, as
 * line-chart.test.jsx does it: under jsdom every element measures 0x0, and
 * recharts draws nothing into a container that size. For jest.mock('recharts').
 */
export function sizedRecharts() {
    const actual = jest.requireActual('recharts');
    const React = jest.requireActual('react');

    return {
        ...actual,
        ResponsiveContainer: (props) => React.cloneElement(props.children, { width: 600, height: props.height || 300 }),
    };
}

/**
 * point at a recharts chart at `x`, as a reader's mouse does, so it draws its
 * tooltip.
 *
 * Note: recharts places the pointer by the event's pageX and pageY, which jsdom
 *       does not take from an event's init, so they are set on the event here.
 */
export function pointAt(wrapper, x, y = 60) {
    const { createEvent, fireEvent } = jest.requireActual('@testing-library/react');
    const event = createEvent.mouseMove(wrapper, { clientX: x, clientY: y });

    Object.defineProperty(event, 'pageX', { value: x });
    Object.defineProperty(event, 'pageY', { value: y });
    fireEvent(wrapper, event);
}

/**
 * tap a recharts chart at `x`, as a finger on a phone does: recharts hands the
 * chart's onClick the day under it (#251). Placed as pointAt places the pointer.
 */
export function tapAt(wrapper, x, y = 60) {
    const { createEvent, fireEvent } = jest.requireActual('@testing-library/react');
    const event = createEvent.click(wrapper, { clientX: x, clientY: y });

    Object.defineProperty(event, 'pageX', { value: x });
    Object.defineProperty(event, 'pageY', { value: y });
    fireEvent(wrapper, event);
}

/**
 * lay the model pages out for a phone, as the stylesheet does under 768px
 * (#251). jsdom has no matchMedia, so a page under test is a wide screen until
 * this gives it one that matches. `turn(matches)` turns the window across the
 * width, as a reader would. Undone by wideScreen.
 */
export function phoneScreen(matches = true) {
    const listeners = [];

    window.matchMedia = jest.fn((query) => ({
        matches: matches,
        media: query,
        addEventListener: (type, listener) => listeners.push(listener),
        removeEventListener: (type, listener) => listeners.splice(listeners.indexOf(listener), 1),
    }));

    return {
        listeners: listeners,
        turn: (next) => listeners.slice().forEach((listener) => listener({ matches: next })),
    };
}

export function wideScreen() {
    delete window.matchMedia;
}
