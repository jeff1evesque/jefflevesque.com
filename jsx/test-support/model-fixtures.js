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
 * a listing as the worker hands one from format 4 on (#293): its `average_days`,
 * how many scored days its models' scores average, and every model carrying it.
 */
export function withAverageDays(listing, days) {
    return {
        ...listing,
        average_days: days,
        models: listing.models.map((model) => ({ ...model, average_days: days })),
    };
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

//
// the day after `day`, 'YYYY-MM-DD': the morning a night's test runs (#318)
//
function dayAfter(day) {
    const next = new Date(`${day}T12:00:00Z`);

    next.setUTCDate(next.getUTCDate() + 1);

    return next.toISOString().slice(0, 10);
}

//
// a night's test days, as the worker hands them (#318): the three weekdays
// before the two whose results aren't in yet
//
function testDaysOf(day) {
    const before = [];
    const at = new Date(`${day}T12:00:00Z`);

    while (before.length < 5) {
        at.setUTCDate(at.getUTCDate() - 1);

        if (at.getUTCDay() !== 0 && at.getUTCDay() !== 6) {
            before.unshift(at.toISOString().slice(0, 10));
        }
    }

    return before.slice(0, 3);
}

/**
 * a history: one night per weekday from `from`, as the worker hands it. `nights`
 * overrides each night by its index. A night from 2026-10-15 on has times, and
 * one before has none. Each is named for the morning after it, when its test
 * runs, and lists its three test days and how many earlier days it studied, 7
 * and one more each night (#318). A nightly update says the morning the version
 * it started from took over, the newest night before it that went live, unless
 * `nights` says otherwise.
 */
export function historyOf(count = 5, nights = {}, from = '2026-10-01') {
    const days = weekdays(count, from);
    const firstTimed = days.filter((day) => day < TIMED_FROM).length;
    const rows = days.map((day, at) => ({
        day: day,
        tested: dayAfter(day),
        kind: 'nightly',
        went_live: false,
        held_out_days: testDaysOf(day),
        training_days: 7 + at,
        trained_again_seconds: null,
        ...timesAt(day, at - firstTimed),
        attempt: scoresAt(1.61 + at * 0.001),
        live: scoresAt(1.6),
        baseline: baselineAt(),
        ...(nights[at] || {}),
    }));
    let tookOver = null;

    return rows.map((row) => {
        const started = row.kind === 'nightly' ? tookOver : null;

        if (row.went_live) {
            tookOver = row.tested;
        }

        return { from: started, ...row };
    });
}

/**
 * a history across the night the trainer began keeping times: Oct 12 to 14
 * without them, and Oct 15 and 16 with them.
 */
export function timedHistoryOf(nights = {}) {
    return historyOf(5, nights, '2026-10-12');
}

/**
 * pt-options' history as the worker read it from the live report on Oct 28, 2026
 * (#318): its loss and profit AUC, to four places. Its Oct 26 night took over,
 * tested early Tue Oct 27 on Oct 20, 21 and 22, and its Oct 27 night was kept
 * back, behind the simple guess. Its first night had no version in charge.
 */
export function ptOptionsHistory() {
    return [
    { day: '2026-10-21', tested: '2026-10-22', from: null, kind: 'weekly', went_live: true, trained_again: null, started: '2026-10-22T09:50:05+00:00', held_out_days: ['2026-10-14', '2026-10-15', '2026-10-19'], training_days: 7, training_seconds: 4816.9, total_seconds: 4865.8, trained_again_seconds: null, attempt: { loss: 0.5849, profit_auc: 0.63 }, live: { loss: null, profit_auc: null }, baseline: { loss: 0.5229, profit_auc: 0.65 } },
    { day: '2026-10-22', tested: '2026-10-23', from: '2026-10-22', kind: 'nightly', went_live: true, trained_again: null, started: '2026-10-23T10:22:26+00:00', held_out_days: ['2026-10-15', '2026-10-19', '2026-10-20'], training_days: 8, training_seconds: 1705.0, total_seconds: 1800.8, trained_again_seconds: null, attempt: { loss: 0.6344, profit_auc: 0.6848 }, live: { loss: 0.6344, profit_auc: 0.6848 }, baseline: { loss: 0.6244, profit_auc: 0.6273 } },
    { day: '2026-10-23', tested: '2026-10-24', from: null, kind: 'weekly', went_live: true, trained_again: null, started: '2026-10-24T10:23:41+00:00', held_out_days: ['2026-10-19', '2026-10-20', '2026-10-21'], training_days: 9, training_seconds: 5403.2, total_seconds: 5502.0, trained_again_seconds: null, attempt: { loss: 0.581, profit_auc: 0.7276 }, live: { loss: 0.6344, profit_auc: 0.6928 }, baseline: { loss: 0.6314, profit_auc: 0.6111 } },
    { day: '2026-10-26', tested: '2026-10-27', from: '2026-10-24', kind: 'nightly', went_live: true, trained_again: null, started: '2026-10-27T09:32:33+00:00', held_out_days: ['2026-10-20', '2026-10-21', '2026-10-22'], training_days: 10, training_seconds: 2353.0, total_seconds: 2459.7, trained_again_seconds: null, attempt: { loss: 0.5758, profit_auc: 0.7329 }, live: { loss: 0.5771, profit_auc: 0.7331 }, baseline: { loss: 0.6218, profit_auc: 0.6258 } },
    { day: '2026-10-27', tested: '2026-10-28', from: '2026-10-27', kind: 'nightly', went_live: false, trained_again: false, started: '2026-10-28T09:39:38+00:00', held_out_days: ['2026-10-21', '2026-10-22', '2026-10-23'], training_days: 11, training_seconds: 3315.6, total_seconds: 3420.3, trained_again_seconds: null, attempt: { loss: 0.6094, profit_auc: 0.6476 }, live: { loss: 0.6238, profit_auc: 0.6361 }, baseline: { loss: 0.5967, profit_auc: 0.589 } },
    ];
}

/**
 * pt-gnn's history as the worker read it from the live report on Oct 28, 2026
 * (#318): its loss and up/down AUC, to four places. Its first six nights have no
 * times, and its Oct 27 night trained again for 657.7 s after its first pass's
 * 2592.5 s, and took over.
 */
export function ptGnnHistory() {
    return [
    { day: '2026-10-09', tested: '2026-10-10', from: null, kind: 'weekly', went_live: true, trained_again: null, started: null, held_out_days: ['2026-10-06', '2026-10-07', '2026-10-08'], training_days: 1, training_seconds: null, total_seconds: null, trained_again_seconds: null, attempt: { loss: 1.6954, auc_up: 0.5528 }, live: { loss: null, auc_up: null }, baseline: { loss: 1.65, auc_up: 0.5 } },
    { day: '2026-10-12', tested: '2026-10-13', from: '2026-10-10', kind: 'nightly', went_live: false, trained_again: null, started: null, held_out_days: ['2026-10-07', '2026-10-08', '2026-10-09'], training_days: 2, training_seconds: null, total_seconds: null, trained_again_seconds: null, attempt: { loss: 1.7303, auc_up: 0.4603 }, live: { loss: 1.7161, auc_up: 0.529 }, baseline: { loss: 1.684, auc_up: 0.5 } },
    { day: '2026-10-13', tested: '2026-10-14', from: '2026-10-10', kind: 'nightly', went_live: true, trained_again: null, started: null, held_out_days: ['2026-10-08', '2026-10-09', '2026-10-12'], training_days: 3, training_seconds: null, total_seconds: null, trained_again_seconds: null, attempt: { loss: 1.6622, auc_up: 0.4995 }, live: { loss: 1.7004, auc_up: 0.5048 }, baseline: { loss: 1.6476, auc_up: 0.5 } },
    { day: '2026-10-14', tested: '2026-10-15', from: '2026-10-14', kind: 'nightly', went_live: false, trained_again: null, started: null, held_out_days: ['2026-10-09', '2026-10-12', '2026-10-13'], training_days: 4, training_seconds: null, total_seconds: null, trained_again_seconds: null, attempt: { loss: 1.6742, auc_up: 0.51 }, live: { loss: 1.6735, auc_up: 0.5116 }, baseline: { loss: 1.6546, auc_up: 0.5 } },
    { day: '2026-10-15', tested: '2026-10-16', from: '2026-10-14', kind: 'nightly', went_live: false, trained_again: null, started: '2026-10-16T07:54:22+00:00', held_out_days: ['2026-10-12', '2026-10-13', '2026-10-14'], training_days: 5, training_seconds: 1016.6, total_seconds: 1109.2, trained_again_seconds: null, attempt: { loss: 1.6603, auc_up: 0.5104 }, live: { loss: 1.6561, auc_up: 0.5068 }, baseline: { loss: 1.6463, auc_up: 0.5 } },
    { day: '2026-10-16', tested: '2026-10-17', from: null, kind: 'weekly', went_live: true, trained_again: null, started: '2026-10-17T17:46:21+00:00', held_out_days: ['2026-10-13', '2026-10-14', '2026-10-15'], training_days: 6, training_seconds: 2112.1, total_seconds: 2207.2, trained_again_seconds: null, attempt: { loss: 1.671, auc_up: 0.5142 }, live: { loss: 1.6815, auc_up: 0.5131 }, baseline: { loss: 1.6475, auc_up: 0.5 } },
    { day: '2026-10-19', tested: '2026-10-20', from: '2026-10-17', kind: 'nightly', went_live: false, trained_again: null, started: '2026-10-20T12:02:59+00:00', held_out_days: ['2026-10-13', '2026-10-14', '2026-10-15'], training_days: 6, training_seconds: 1156.9, total_seconds: 1254.0, trained_again_seconds: null, attempt: { loss: 1.6594, auc_up: 0.5148 }, live: { loss: 1.6716, auc_up: 0.5148 }, baseline: { loss: 1.6449, auc_up: 0.5 } },
    { day: '2026-10-20', tested: '2026-10-21', from: '2026-10-17', kind: 'nightly', went_live: false, trained_again: null, started: '2026-10-21T14:46:19+00:00', held_out_days: ['2026-10-14', '2026-10-15', '2026-10-19'], training_days: 7, training_seconds: 1299.4, total_seconds: 1387.5, trained_again_seconds: null, attempt: { loss: 1.6547, auc_up: 0.5237 }, live: { loss: 1.6675, auc_up: 0.5237 }, baseline: { loss: 1.6395, auc_up: 0.5 } },
    { day: '2026-10-21', tested: '2026-10-22', from: '2026-10-17', kind: 'nightly', went_live: true, trained_again: null, started: '2026-10-22T09:22:43+00:00', held_out_days: ['2026-10-15', '2026-10-19', '2026-10-20'], training_days: 8, training_seconds: 1514.7, total_seconds: 1602.4, trained_again_seconds: null, attempt: { loss: 1.6774, auc_up: 0.5352 }, live: { loss: 1.6903, auc_up: 0.5352 }, baseline: { loss: 1.6958, auc_up: 0.5 } },
    { day: '2026-10-22', tested: '2026-10-23', from: '2026-10-22', kind: 'nightly', went_live: true, trained_again: null, started: '2026-10-23T09:42:46+00:00', held_out_days: ['2026-10-19', '2026-10-20', '2026-10-21'], training_days: 9, training_seconds: 2247.8, total_seconds: 2335.2, trained_again_seconds: null, attempt: { loss: 1.6628, auc_up: 0.4962 }, live: { loss: 1.6689, auc_up: 0.4938 }, baseline: { loss: 1.6551, auc_up: 0.5 } },
    { day: '2026-10-23', tested: '2026-10-24', from: null, kind: 'weekly', went_live: true, trained_again: null, started: '2026-10-24T09:49:35+00:00', held_out_days: ['2026-10-20', '2026-10-21', '2026-10-22'], training_days: 10, training_seconds: 1912.8, total_seconds: 2000.3, trained_again_seconds: null, attempt: { loss: 1.6757, auc_up: 0.5 }, live: { loss: 1.6825, auc_up: 0.479 }, baseline: { loss: 1.6757, auc_up: 0.5 } },
    { day: '2026-10-26', tested: '2026-10-27', from: '2026-10-24', kind: 'nightly', went_live: false, trained_again: null, started: '2026-10-27T08:37:16+00:00', held_out_days: ['2026-10-21', '2026-10-22', '2026-10-23'], training_days: 11, training_seconds: 3174.2, total_seconds: 3269.5, trained_again_seconds: null, attempt: { loss: 1.6759, auc_up: 0.4952 }, live: { loss: 1.6799, auc_up: 0.5 }, baseline: { loss: 1.6738, auc_up: 0.5 } },
    { day: '2026-10-27', tested: '2026-10-28', from: '2026-10-24', kind: 'nightly', went_live: true, trained_again: true, started: '2026-10-28T08:43:08+00:00', held_out_days: ['2026-10-22', '2026-10-23', '2026-10-26'], training_days: 12, training_seconds: 2495.8, total_seconds: 2592.5, trained_again_seconds: 657.7, attempt: { loss: 1.6771, auc_up: 0.5 }, live: { loss: 1.6771, auc_up: 0.5 }, baseline: { loss: 1.6938, auc_up: 0.5 } },
    ];
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

//
// what a format 3 listing adds (#279): each task's scores, the stock tasks' with
// the top 10's two after their four, and a task of options
//
export const STOCK_SCORES = ['loss', 'auc_up', 'auc_beats', 'acc_up', 'top10_gain', 'top10_wins'];

export const OPTIONS_TASK = {
    id: 'option-picks',
    name: 'Option picks',
    description: 'For each S&P 500 option, the chance it makes money held 1, 5 or 20 trading days.',
    scores: ['loss', 'profit_auc', 'top10_gain', 'top10_wins'],
};

//
// the stock scores an options model has none of, as the listing gives them:
// null, as the four are required
//
const NO_STOCK = { auc_up: null, auc_beats: null, acc_up: null };

/**
 * how close each of an options model's checks is to taking its live version
 * down: the three checks for each hold, each day 2 of 5 on the 1-day hold and
 * none in a row on the rest, the 20-day hold's not yet.
 */
export function holdsBehindOf(each = 2) {
    return [1, 5, 20].reduce((checks, hold) => checks.concat([
        { days: 1, in_a_row: hold === 1 ? each : 0, limit: 5, hold: hold },
        { days: 5, in_a_row: hold === 20 ? null : 0, limit: 10, hold: hold },
        { days: 20, in_a_row: hold === 1 ? 0 : null, limit: 5, hold: hold },
    ]), []);
}

/**
 * an options model as a format 3 listing holds it (#279): loss and its own
 * three, and every check on each hold.
 */
export function optionsModelOf(overrides = {}) {
    return modelOf({
        name: 'pt-options',
        task: OPTIONS_TASK.id,
        description: 'Reads the day’s options beside the Training graph',
        started: '2026-09-01',
        scored_days: 30,
        live: { since: '2026-10-14', kind: 'nightly' },
        attempts: { total: 30, went_live: 3 },
        score: { loss: 0.84, ...NO_STOCK, ...NO_PARTS, profit_auc: 0.55, top10_gain: 0.031, top10_wins: 6.2 },
        baseline: { loss: 0.88, ...NO_STOCK, ...NO_PARTS, profit_auc: 0.5, top10_gain: -0.042, top10_wins: 4.1 },
        behind: holdsBehindOf(),
        ...overrides,
    });
}

/**
 * a format 3 listing (#279): the stock tasks naming their scores, the stock
 * models with their top 10's, and the options task with pt-options. `models`,
 * where given, takes the models' place.
 */
export function optionsListingOf(models = null) {
    const top = (model, gain, wins) => ({
        ...model,
        score: { ...model.score, top10_gain: gain, top10_wins: wins },
        baseline: { ...model.baseline, top10_gain: 0.0003, top10_wins: 5.1 },
    });
    const stocks = listingOf().models.map((model, at) => top(model, 0.0012 - at * 0.0002, 5.6 - at * 0.1));

    return {
        format_version: 3,
        tasks: TASKS.map((task) => ({ ...task, scores: STOCK_SCORES.slice() })).concat([{ ...OPTIONS_TASK, scores: OPTIONS_TASK.scores.slice() }]),
        models: models || stocks.concat([optionsModelOf()]),
    };
}

//
// the pinball loss of an options model's gain on every day and hold, the second
// of the two its loss adds up (#322)
//
export const OPTION_GAIN_PINBALL = 0.12;

//
// an options model's scores on a day whose loss is `loss`, the same on each of
// its holds, as `<score>` and each `<score>_1d`, `_5d` and `_20d` -- but a hold
// whose result is not in yet, which is null. Each hold's loss is its two parts
// added up (#322), which the plain columns have neither of, as a track record's
// have not
//
function optionsScoresAt(loss, gain, held = { 1: true, 5: true, 20: true }) {
    const plain = { loss: loss, profit_auc: 1.39 - loss, top10_gain: gain, top10_wins: 6 + gain * 10 };
    const each = { ...plain, profit_log_loss: loss - OPTION_GAIN_PINBALL, gain_pinball: OPTION_GAIN_PINBALL };
    const scores = { ...plain, ...NO_STOCK, ...NO_PARTS };

    [1, 5, 20].forEach((hold) => {
        Object.keys(each).forEach((key) => {
            scores[`${key}_${hold}d`] = held[hold] ? each[key] : null;
        });
    });

    return scores;
}

//
// each score's mean over `recent`, the days that have one, as the worker takes
// it: none where no day does
//
function meanOf(recent, field) {
    const average = {};

    Object.keys(recent[recent.length - 1][field]).forEach((key) => {
        const values = recent.map((row) => row[field][key]).filter((value) => value !== null);

        average[key] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });

    return average;
}

/**
 * a track record's averages, worked out as the worker works them: each day's
 * over the last 20 rows, and from #300 each hold's columns, those ending in
 * `ends`, over the hold's own latest 20 days that have its result, with
 * `hold_days` saying how many each takes in.
 */
function withAverages(rows, ends) {
    rows.forEach((row, at) => {
        const recent = rows.slice(Math.max(0, at - 19), at + 1);

        row.days = recent.length;
        row.average = meanOf(recent, 'score');
        row.baseline_average = meanOf(recent, 'baseline');
        row.hold_days = {};

        ends.forEach((end) => {
            const has = (each) => Object.keys(each.score).some((name) => name.endsWith(end) && each.score[name] !== null);
            const scored = rows.slice(0, at + 1).filter(has).slice(-20);

            [['average', 'score'], ['baseline_average', 'baseline']].forEach(([field, from]) => {
                Object.keys(row[field]).filter((name) => name.endsWith(end)).forEach((name) => {
                    const values = scored.map((each) => each[from][name]).filter((value) => value !== null);

                    row[field][name] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
                });
            });

            row.hold_days[end.slice(1)] = scored.length;
        });
    });

    return rows;
}

/**
 * an options model's track record (#279), its averages worked out as the worker
 * works them: every day's 1-day hold in, its last 4 days' 5-day results not yet,
 * and its last 19 days' 20-day results not yet. `loss(at)` is each day's loss on
 * every hold, `gain(at)` its top 10's gain, and the baseline's are 0.88 and -4%.
 */
export function optionsTrackOf(count = 30, from = '2026-09-01', loss = (at) => 0.84 + (at % 3) * 0.01, gain = (at) => 0.03 + (at % 2) * 0.002) {
    const rows = weekdays(count, from).map((day, at) => {
        const held = { 1: true, 5: at < count - 4, 20: at < count - 19 };

        return {
            day: day,
            score: optionsScoresAt(loss(at), gain(at), held),
            baseline: optionsScoresAt(0.88, -0.04, held),
            down_days: null,
            down_in_a_row: null,
            down_hold: null,
        };
    });

    return withAverages(rows, ['_1d', '_5d', '_20d']);
}

/**
 * a stock model's track record with the top 10's columns a format 3 one has
 * (#279): each day's gain `gain`, and 5.5 of 10 that won, against a random
 * pick's 0.03% and 5.1, in its scores and its averages alike.
 */
export function withTop10(rows, gain = 0.0012) {
    const top = (scores, value, wins) => ({ ...scores, top10_gain: value, top10_wins: wins });

    return rows.map((row) => ({
        ...row,
        score: top(row.score, gain, 5.5),
        baseline: top(row.baseline, 0.0003, 5.1),
        average: top(row.average, gain, 5.5),
        baseline_average: top(row.baseline_average, 0.0003, 5.1),
    }));
}

//
// a format 5 stock model's holds (#300), by the key the listing gives each, and
// how much lower each one's loss is than the 1-day hold's: a longer move is
// called a little better, the baseline's as well as the model's
//
const HELD = { '1d': 0, '5d': 0.04, '20d': 0.07 };

//
// a format 5 stock model's scores on a day (#300), the model's or its
// baseline's: the plain ones, then each hold's as `<score>_1d`, `_5d` and
// `_20d` -- the 1-day hold's the plain ones again -- each null where `held`
// says the hold's result is not in yet, and Combined's, `<score>_combined`, the
// three holds' average, in once all three are. The top 10's on each hold but
// Combined, which has none
//
function heldScoresAt(loss, held, baseline = false) {
    const at = (value) => (baseline ? baselineAt(value) : scoresAt(value));
    const top = baseline ? { top10_gain: 0.0003, top10_wins: 5.1 } : { top10_gain: 0.0012, top10_wins: 5.5 };
    const scores = { ...at(loss), ...top };
    const each = {};

    Object.keys(HELD).forEach((key) => {
        each[key] = { ...at(loss - HELD[key]), ...top };

        Object.keys(each[key]).forEach((name) => {
            scores[`${name}_${key}`] = held[key] ? each[key][name] : null;
        });
    });

    Object.keys(at(loss)).forEach((name) => {
        scores[`${name}_combined`] = held['1d'] && held['5d'] && held['20d']
            ? (each['1d'][name] + each['5d'][name] + each['20d'][name]) / 3
            : null;
    });

    return scores;
}

/**
 * a format 5 stock model's track record (#300), its averages worked out as the
 * worker works them: the plain columns over the last 20 rows, and each hold's
 * over its own latest 20 days that have its result, with `hold_days` saying how
 * many. Every day's 1-day hold is in; the 5-day hold's for all but the newest
 * `notIn` days; and the 20-day hold's, and Combined with it, for the oldest
 * `twenty` -- none, unless a case says so. `loss(at)` is each day's 1-day loss.
 */
export function heldTrackOf(count = 30, { notIn = 5, twenty = 0, from = '2026-09-01', loss = (at) => 1.6 + (at % 3) * 0.01 } = {}) {
    const rows = weekdays(count, from).map((day, at) => {
        const held = { '1d': true, '5d': at < count - notIn, '20d': at < twenty };

        return {
            day: day,
            score: heldScoresAt(loss(at), held),
            baseline: heldScoresAt(BASELINE.loss, held, true),
            down_days: null,
            down_in_a_row: null,
            down_hold: null,
        };
    });

    return withAverages(rows, Object.keys(HELD).concat(['combined']).map((key) => `_${key}`));
}

/**
 * a model's scores on each of its holds as a format 5 listing gives them
 * (#300), from its track record, `rows`, as the trainer averages them: each
 * hold's `days`, every day it has a result on, and its task's scores and the
 * baseline's on it, its newest day's averages, as the worker reads them --
 * loss's parts null, as the listing gives none -- or none for a hold with no
 * day scored yet.
 */
export function holdsFrom(rows, keys = STOCK_SCORES) {
    const newest = rows[rows.length - 1];
    const holds = {};

    Object.keys(newest.hold_days).forEach((key) => {
        const days = rows.filter((row) => Object.keys(row.score).some((name) => name.endsWith(`_${key}`) && row.score[name] !== null)).length;
        const set = (field) => {
            const scores = { ...NO_PARTS };

            keys.forEach((name) => {
                if (`${name}_${key}` in newest[field]) {
                    scores[name] = newest[field][`${name}_${key}`];
                }
            });

            return scores;
        };

        holds[key] = {
            days: days,
            score: days ? set('average') : null,
            baseline: days ? set('baseline_average') : null,
        };
    });

    return holds;
}

/**
 * a format 5 stock model as the listing holds it (#300): tables-gnn, its scores
 * on each hold from its track record, `rows`, and its own scores the 1-day
 * hold's, as the listing's are.
 */
export function heldModelOf(overrides = {}, rows = heldTrackOf()) {
    const holds = holdsFrom(rows);

    return modelOf({
        name: 'tables-gnn',
        description: 'A model of the tables',
        scored_days: holds['1d'].days,
        score: holds['1d'].score,
        baseline: holds['1d'].baseline,
        holds: holds,
        ...overrides,
    });
}

/**
 * a format 5 listing (#300): the stock tasks naming their scores, two stock
 * models with holds -- tables-gnn, and pt-gnn, a little behind it -- and the
 * options task with pt-options, its scores on each of its three holds given
 * too. `models`, where given, takes the models' place.
 */
export function heldListingOf(models = null) {
    const behind = heldTrackOf(30, { loss: (at) => 1.62 + (at % 3) * 0.01 });

    return {
        format_version: 5,
        tasks: TASKS.map((task) => ({ ...task, scores: STOCK_SCORES.slice() })).concat([{ ...OPTIONS_TASK, scores: OPTIONS_TASK.scores.slice() }]),
        models: models || [
            heldModelOf(),
            heldModelOf({ name: 'pt-gnn', description: 'A graph model of the market' }, behind),
            optionsModelOf({ holds: holdsFrom(optionsTrackOf(30), OPTIONS_TASK.scores) }),
        ],
    };
}

/**
 * an options model's history: one night per weekday from `from`, each scored on
 * its own scores, as historyOf's are on the stock scores.
 */
export function optionsHistoryOf(count = 5, from = '2026-10-01') {
    const scores = (loss) => ({ loss: loss, ...NO_STOCK, ...NO_PARTS, profit_auc: 1.39 - loss, top10_gain: 0.03, top10_wins: 6.3 });

    return historyOf(count, {}, from).map((night, at) => ({
        ...night,
        attempt: scores(0.85 + at * 0.001),
        live: scores(0.84),
        baseline: scores(0.88),
    }));
}

/**
 * an options model's picks as the worker hands them (#279): `count` for each of
 * `holds`, best first, made on the night of 2026-10-21 -- or, given `ticker`,
 * that stock's alone.
 */
export function picksOf(holds = [1, 5, 20], count = 10, ticker = null) {
    const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK.B', 'JPM', 'XOM', 'UNH'];
    const sellOn = { 1: '2026-10-23', 5: '2026-10-29', 20: '2026-11-19' };

    return holds.flatMap((hold) => Array.from({ length: count }, (unused, at) => {
        const stock = ticker || TICKERS[at % TICKERS.length];
        const put = at % 3 === 2;

        return {
            day: '2026-10-21',
            hold: hold,
            rank: at + 1,
            ticker: stock,
            contract: `${stock.replace('.', '')}  261120${put ? 'P' : 'C'}00${String(200 + at * 5).padStart(3, '0')}000`,
            call_put: put ? 'p' : 'c',
            strike: 200 + at * 5,
            expiry: '2026-11-20',
            buy_on: '2026-10-22',
            sell_on: sellOn[hold],
            last_bid: 4.1 + at * 0.05,
            last_ask: 4.35 + at * 0.05,
            chance: 0.62 - at * 0.01,
            usual_chance: 0.48,
            gain_low: -0.35,
            gain_middle: 0.12 - at * 0.005,
            gain_high: 0.8,
        };
    }));
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
