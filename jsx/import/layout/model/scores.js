/**
 * scores.js: what the model pages know about a score, a model's status and its
 * days (#243), how long a night's attempt took (#247), the trainer's checks that
 * take a live version down for doing worse than the baseline (#263), the three
 * scores loss adds up (#265), and the lists that show them in place of their sum
 * (#283), and the scores of an options model and of every model's top 10, and an
 * options model's holds (#279), and from format 5 a stock model's, with their
 * average, Combined (#300). From format 6 an attempt's second pass counts in how
 * long it took, and each night is named for the morning its test ran (#318).
 *
 * The api scores the stock models four ways, which a listing before format 3
 * gives every task:
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
 * From format 3, each task names its scores -- see scoresFor -- and the pages
 * offer a task's from a picker of its own. An options model has loss, which adds
 * up two scores for each hold it is held, and three more -- see TRADE_SCORES --
 * and the stock models have the top 10's two beside their four. Each of those is
 * of what a model's picks would have made, so models of different tasks can be
 * compared on one -- see compareBlocked.
 *
 * Every chart draws "better" upward, so loss's axis is flipped, and every
 * difference here is signed the same way: positive is better, whichever way the
 * score runs. See betterBy.
 *
 * Note: nothing here says how a model is built. The api serves scores, and an
 *       options model's picks, and so do the pages.
 *
 * Note: no task is named here. A task that trades options is told apart by the
 *       scores it names -- see tradesOptions -- so a new task is drawn from the
 *       listing alone.
 */

import { colors_categorical, themeColors } from '../../general/colors.js';

//
// each with the note its name carries wherever a page names it (#265): what it
// measures, and which way is better. Without one, loss read as a single log
// loss, and a log loss of 1.7 would be poor on most tasks. A score whose note
// is another for a task that trades options has that one as `optionsNote`
// (#279), and one whose note is another on Combined has it as `combinedNote`
// (#300) -- see noteOf
//
export const SCORES = [
    {
        key: 'loss',
        label: 'Loss',
        lower: true,
        note: 'Loss adds three scores: up or down, beating the average stock, and the size of the move. Lower is better. A coin flip scores 0.693 on each of the first two. The baseline is what knowing nothing scored on the same days.',
        optionsNote: 'Loss adds up, for each hold that is on, the log loss of the chance each option makes money and the pinball loss of its gain. Lower is better, and the baseline beside it is a know-nothing model’s.',
        combinedNote: 'On Combined, loss is the average of the day’s 1, 5 and 20-day losses. Each adds three scores: up or down, beating the average stock, and the size of the move. Lower is better. The baseline is what knowing nothing scored on the same days.',
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
// what each night's 10 best picks are, for a task of stocks and one of options,
// as the top 10's notes say it, and a stock's on its 5 and 20-day holds (#300),
// which are sold days after they are bought
//
const TOP_STOCKS = 'the 10 stocks the model is surest will go up, bought at the 9:40 AM ask and sold at the 3:40 PM bid the same day';
const TOP_OPTIONS = 'the model’s 10 best options for the hold, bought at the 9:40 AM ask and sold at the 3:40 PM bid on the sell day';
const TOP_HELD = 'the 10 stocks the model is surest will go up, bought at the 9:40 AM ask on the next trading day and sold at the 3:40 PM bid on the sell day';
const AT_RANDOM = 'Higher is better, and the baseline is the average of everything it could have picked: what a random pick got.';

//
// the scores a format 3 listing adds (#279), of what a model's picks would have
// made:
//
//     profit_auc   an options model's: how well its chance ranks the options
//                  that made money above the ones that didn't. Only a task that
//                  trades options has it, `options`
//     top10_gain   the average gain of each night's top 10, as a share of what
//                  they cost: a fraction of a percent for a day's stock, so to two
//                  places of a percent
//     top10_wins   how many of each night's top 10 made money, a count of 10
//
// The top 10's two are every task's, each of its own picks, so models of tasks
// that both name one can be compared on it, `across` -- see compareBlocked. A
// stock's on its 5 and 20-day holds is bought and sold on other days, which its
// `heldNote` says (#300)
//
export const TRADE_SCORES = [
    {
        key: 'profit_auc',
        label: 'Profit AUC',
        lower: false,
        options: true,
        note: 'How well the chance ranks the options that made money above the ones that didn’t: 0.5 is a coin flip, and higher is better.',
    },
    {
        key: 'top10_gain',
        label: 'Top 10 gain',
        lower: false,
        share: true,
        places: 2,
        across: true,
        note: `The average gain of each night’s top 10: ${TOP_STOCKS}. ${AT_RANDOM}`,
        optionsNote: `The average gain of each night’s top 10: ${TOP_OPTIONS}. ${AT_RANDOM}`,
        heldNote: `The average gain of each night’s top 10: ${TOP_HELD}. ${AT_RANDOM}`,
    },
    {
        key: 'top10_wins',
        label: 'Top 10 wins',
        lower: false,
        count: true,
        across: true,
        note: `How many of each night’s top 10 made money: ${TOP_STOCKS}. ${AT_RANDOM}`,
        optionsNote: `How many of each night’s top 10 made money: ${TOP_OPTIONS}. ${AT_RANDOM}`,
        heldNote: `How many of each night’s top 10 made money: ${TOP_HELD}. ${AT_RANDOM}`,
    },
];

//
// every score the pages know, and so can offer, print and store a choice of
//
export const KNOWN_SCORES = SCORES.concat(TRADE_SCORES);

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
// how many of a model's scored days its score takes in, and how many it has to
// have before it is no longer New, where the listing does not say: before format
// 4, which gives it as `average_days` (#293) -- see averageDays
//
export const WINDOW = 20;

//
// how many of the newest days each night's attempt and the live version are
// scored on, held out of the attempt's training (#300): a model's page says so,
// and that those days have no 5 or 20-day results yet
//
export const HELD_OUT = 3;

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
// how many trading days an options model's picks are held (#279): each bought
// at 9:40 AM the trading day after they are picked, and sold at 3:40 PM this
// many trading days after that. Its track record has its scores for each, and
// the pages open on the 1-day hold's, which are the listing's.
//
// From format 5 a stock model's are held too (#300): bought at 9:40 AM on the
// next trading day, and sold at 3:40 PM that day on the 1-day hold, today's
// prediction, or 5 or 20 trading days later
//
export const HOLDS = [
    { days: 1, label: '1 day' },
    { days: 5, label: '5 days' },
    { days: 20, label: '20 days' },
];

export const DEFAULT_HOLD = 1;

//
// a stock model's three holds averaged, from format 5 on (#300): each of its
// scores the average of the day's 1, 5 and 20-day ones, in with the 20-day
// result. It has no days of its own, so it is kept by its name, as a hold is by
// its days, and picked from the same picker
//
export const COMBINED = 'combined';

export const COMBINED_HOLD = { days: COMBINED, label: 'Combined' };

//
// when a stock model's 5 and 20-day holds switch on, each at a Saturday's weekly
// retrain, and when each one's first result comes in if every trading day is
// built (#300), as the api's docs give them, with Combined's first in with the
// 20-day hold's. A model's page says so until its own results say otherwise
//
export const HOLD_SCHEDULE = {
    5: { on: '2026-10-31', first: '2026-11-11' },
    20: { on: '2026-11-21', first: '2026-12-24' },
    [COMBINED]: { on: null, first: '2026-12-24' },
};

//
// every hold a picker can offer, in its order
//
const ALL_HOLDS = HOLDS.concat([COMBINED_HOLD]);

//
// the scores Combined has (#300): the four. The top 10 has none, a 20-day
// gain and a 1-day gain not being the same kind of number
//
const COMBINED_SCORES = SCORES.map((score) => score.key);

/**
 * whether a value is a hold the pages know: 1, 5 or 20 days, or Combined.
 */
export function isHold(hold) {
    return ALL_HOLDS.some((each) => each.days === hold);
}

/**
 * the key a hold's scores are given under (#300): '5d', or 'combined' -- the
 * listing's `holds` and a track record's `hold_days` key them so.
 */
export function holdKey(hold) {
    return hold === COMBINED ? COMBINED : `${hold}d`;
}

/**
 * the column a score is in for a hold (#279): 'top10_gain_5d', or from format
 * 5 'loss_combined' (#300), or the score's own for no hold.
 */
export function columnOf(key, hold = null) {
    return hold ? `${key}_${holdKey(hold)}` : key;
}

/**
 * the holds a track record has columns for (#279): an options model's three,
 * and from format 5 a stock model's and Combined (#300). None for a stock
 * model's before then.
 */
export function holdsOf(rows) {
    const keys = Array.isArray(rows) && rows.length && rows[0].score ? Object.keys(rows[0].score) : [];

    return ALL_HOLDS.filter((hold) => keys.some((key) => key.endsWith(`_${holdKey(hold.days)}`)));
}

/**
 * the holds the listing gives a model's scores on, from format 5 on (#300) --
 * see worker/model/report.js -- or none for a listing before it.
 */
export function listedHolds(model) {
    return model && model.holds ? ALL_HOLDS.filter((hold) => model.holds[holdKey(hold.days)]) : [];
}

/**
 * the holds the listing gives any of `models`' scores on (#300), in a picker's
 * order: those /model's list of their task offers.
 */
export function holdsAmong(models) {
    return ALL_HOLDS.filter((hold) => models.some((model) => listedHolds(model).includes(hold)));
}

/**
 * the holds a task's pickers offer where the listing names none of its models'
 * (#311): an options task's three, and a stock task's three and Combined, each
 * grayed out until its first result comes in -- see emptyHolds.
 */
export function holdsFor(task) {
    return tradesOptions(task) ? HOLDS : ALL_HOLDS;
}

/**
 * a hold as the pages name it: '5-day hold', or 'combined' in a line of text
 * (#300) -- its picker's button is 'Combined'.
 */
export function holdName(hold) {
    return hold === COMBINED ? COMBINED : `${hold}-day hold`;
}

/**
 * a hold as its picker names it: '5 days', or 'Combined'.
 */
export function holdLabel(hold) {
    return (ALL_HOLDS.find((each) => each.days === hold) || { label: `${hold} days` }).label;
}

/**
 * a hold named after a score's name, where a label names it (#300): ', 5-day
 * hold' or ', combined', and nothing for no hold. /model's list leaves the
 * 1-day hold unnamed too, `quiet`, so it reads as it did before format 5 until
 * another hold is picked; a model's page names it, beside its picker.
 */
export function namedHold(hold, quiet = false) {
    return hold && !(quiet && hold === DEFAULT_HOLD) ? `, ${holdName(hold)}` : '';
}

/**
 * the scores of a task's that a hold has none of (#300): the top 10's on
 * Combined, which its picker offers disabled, and none on any other hold.
 */
export function heldOut(task, hold) {
    return hold === COMBINED ? scoresFor(task).filter((key) => !COMBINED_SCORES.includes(key)) : [];
}

/**
 * the score a page shows on a hold (#300): the one picked, or loss on Combined
 * where it is one of the top 10's, which Combined has none of. Only shown: the
 * one picked is kept, and comes back on another hold.
 */
export function scoreOnHold(score, hold) {
    return hold === COMBINED && !COMBINED_SCORES.includes(score) ? DEFAULT_SCORE : score;
}

/**
 * how many trading days after its prediction each of a hold's results comes in
 * (#300): an options model's a day after its sell day (#279), and a stock
 * model's on its sell day -- the next trading day for the 1-day hold, 6 for the
 * 5-day and 21 for the 20-day -- and Combined's with its 20-day result.
 */
export function resultDays(task, hold) {
    if (hold === COMBINED) {
        return resultDays(task, 20);
    }

    return tradesOptions(task) || hold !== DEFAULT_HOLD ? hold + 1 : 1;
}

/**
 * when each of a hold's results comes in, after its prediction (#300): 'the next
 * trading day', or '6 trading days after its prediction' -- or after `whose`,
 * 'the prediction', where a line names no one prediction.
 */
export function comesIn(task, hold, whose = 'its') {
    const days = resultDays(task, hold);

    return days === 1 ? 'the next trading day' : `${days} trading days after ${whose} prediction`;
}

/**
 * when a hold's results come in, as a line under its name says it on a model's
 * page (#300): 'Comes in 6 trading days after the prediction', or Combined's
 * 'Comes in with the day’s 20-day result'.
 */
export function comesInLine(task, hold) {
    return `Comes in ${hold === COMBINED ? 'with the day’s 20-day result' : comesIn(task, hold, 'the')}`;
}

/**
 * the same in fewer words, where a row names what it is (#300): 'the next
 * trading day', '6 trading days later', or Combined's 'with the 20-day result'.
 */
export function resultLag(task, hold) {
    const days = resultDays(task, hold);

    if (hold === COMBINED) {
        return 'with the 20-day result';
    }

    return days === 1 ? 'the next trading day' : `${days} trading days later`;
}

/**
 * one of a hold's results as a sentence names it (#300): '5-day result', or
 * 'combined score'.
 */
export function resultName(hold) {
    return hold === COMBINED ? 'combined score' : `${hold}-day result`;
}

/**
 * what a hold with no results yet shows in place of its figures and its chart
 * (#279, #300): 'No 5-day results yet: each one comes in 6 trading days after
 * its prediction.'
 */
export function noResultsYet(task, hold) {
    const when = hold === COMBINED ? `with its day’s 20-day result, ${comesIn(task, hold)}` : comesIn(task, hold);

    return `No ${resultName(hold)}s yet: each one comes in ${when}.`;
}

/**
 * a hold as a sentence puts it after 'on' (#279, #300): ' on the 5-day hold', or
 * ' on the combined score', and nothing for no hold.
 */
export function onThe(hold) {
    if (!hold) {
        return '';
    }

    return hold === COMBINED ? ' on the combined score' : ` on the ${holdName(hold)}`;
}

/**
 * what a stock model's hold is, and when its results come in, as the line
 * under its pickers says it (#300): '20-day hold: bought at 9:40 AM on the next
 * trading day and sold at 3:40 PM 20 trading days later. Each result comes in 21
 * trading days after its prediction, about a month.' The 5-day hold's says it
 * runs over the days an options model's 5-day hold does.
 */
export function holdLine(task, hold) {
    if (hold === COMBINED) {
        return 'Combined: the average of the 1, 5 and 20-day scores of the same prediction days, beside the same average of the baseline’s. It comes in with the 20-day result, so it runs about a month behind the 1-day hold.';
    }

    if (hold === DEFAULT_HOLD) {
        return `1-day hold: from 9:40 AM to 3:40 PM on the next trading day, as the model predicts today. Each result comes in ${comesIn(task, hold)}.`;
    }

    const days = hold === 5 ? ', the days the options models’ 5-day hold uses' : '';

    return `${holdName(hold)}: bought at 9:40 AM on the next trading day and sold at 3:40 PM ${hold} trading days later${days}. Each result comes in ${comesIn(task, hold)}${hold === 20 ? ', about a month' : ''}.`;
}

/**
 * what the hold a list of /model is on is, as the line under its pickers says
 * it (#300): a task of stocks' and a task of options' in their own words,
 * '5-day hold: sold at the 3:40 PM bid 5 trading days after the buy day.'
 */
export function listLine(task, hold) {
    if (tradesOptions(task)) {
        return hold === DEFAULT_HOLD
            ? '1-day hold: bought at the 9:40 AM ask on the next trading day and sold at the 3:40 PM bid the day after.'
            : `${holdName(hold)}: sold at the 3:40 PM bid ${hold} trading days after the buy day.`;
    }

    if (hold === COMBINED) {
        return 'Combined: the average of the 1, 5 and 20-day scores of the same prediction days, in with the 20-day result. The top 10 has none.';
    }

    return hold === DEFAULT_HOLD
        ? '1-day hold: from 9:40 AM to 3:40 PM on the next trading day, as the stock models predict today.'
        : `${holdName(hold)}: bought at 9:40 AM on the next trading day and sold at 3:40 PM ${hold} trading days later. Each result comes in ${comesIn(task, hold)}.`;
}

/**
 * the note after a Hold picker's name (#311): how long a task's options or
 * stocks are held, and while any of its holds is grayed out, `grayed`, why --
 * see emptyHolds. A task of stocks' says what Combined is too.
 */
export function holdNote(task, grayed = false) {
    const options = tradesOptions(task);

    return [
        `How long each ${options ? 'option' : 'stock'} is held before it’s sold.`,
        grayed ? 'A hold is grayed out until its first results come in.' : '',
        options ? '' : 'Combined is the average of the three.',
    ].filter(Boolean).join(' ');
}

/**
 * a model's scores on a hold (#300): the listing's `holds` entry's, `score`,
 * `baseline` and `days`, with `hold` the one they are of -- or, for no hold, or
 * one the listing gives none of, as a listing before format 5, its own scores
 * and scored days, of no hold.
 */
export function scoresOn(model, hold = null) {
    const held = hold && model.holds ? model.holds[holdKey(hold)] : null;

    return held
        ? { score: held.score, baseline: held.baseline, days: held.days, hold: hold }
        : { score: model.score, baseline: model.baseline, days: model.scored_days, hold: null };
}

/**
 * the holds of `holds` a model has no result on yet (#300), which a picker
 * offers grayed out until one comes in: on a hold the listing gives, one it has
 * scored no day on, and otherwise one its track record, `rows`, has no day on --
 * or every one while the record is on its way. Never the first, which a page
 * opens on.
 */
export function emptyHolds(model, rows, holds) {
    return holds.slice(1).map((each) => each.days).filter((days) => {
        const listed = model.holds ? model.holds[holdKey(days)] : null;

        if (listed) {
            return !listed.days;
        }

        return !Array.isArray(rows) || !rows.some((row) => scoreIn(row.score, columnOf(DEFAULT_SCORE, days)) !== null);
    });
}

/**
 * a model's scores on a hold in /model's list (#300): the listing's, as
 * scoresOn gives them, or where the listing gives none on a hold past the
 * first -- an options model's before format 5 -- its track record's, `rows`:
 * each score's average on the newest day the hold has a result in, the
 * baseline's beside it, and how many days the hold has scored, as the listing's
 * `holds` will have them. `pending` while the record is on its way, and none
 * where it could not be had or has no columns for the hold.
 */
export function scoresAt(model, hold, rows) {
    const on = scoresOn(model, hold);

    if (on.hold || !hold || hold === DEFAULT_HOLD) {
        return on;
    }

    if (rows === undefined) {
        return { score: null, baseline: null, days: 0, hold: hold, pending: true };
    }

    const scored = Array.isArray(rows) ? rows.filter((row) => scoreIn(row.score, columnOf(DEFAULT_SCORE, hold)) !== null) : [];
    const newest = scored.length ? scored[scored.length - 1] : null;
    const of = (field) => (newest
        ? Object.fromEntries(KNOWN_SCORES.map((each) => [each.key, scoreIn(newest[field], columnOf(each.key, hold))]))
        : null);

    return { score: of('average'), baseline: of('baseline_average'), days: scored.length, hold: hold };
}

/**
 * what a model's track record says of its days on a hold, under the record's
 * title (#300): that they are the predictions the site published (#320), and
 * when each day is scored -- 'The actual predictions the site published each
 * day, scored the next trading day', or on a longer hold once its sell day is in,
 * and that its newest days are not yet -- or Combined's average. For no hold,
 * once the day's prices are in.
 */
export function trackLine(task, hold) {
    if (!hold) {
        return 'The actual predictions the site published each day, scored once that day’s prices are in.';
    }

    if (hold === COMBINED) {
        return 'The average of each day’s 1, 5 and 20-day scores, in once its 20-day result is.';
    }

    if (resultDays(task, hold) === 1) {
        return 'The actual predictions the site published each day, scored the next trading day.';
    }

    return `The actual predictions the site published each day, scored once the ${holdName(hold)}’s sell day is in, ${resultLag(task, hold)}. The newest days aren’t in yet.`;
}

//
// a few holds' days in a line of text: '1 day', '1 and 5 days', '1, 5 and 20
// days', or nothing for none
//
function listDays(days) {
    if (!days.length) {
        return '';
    }

    const words = days.length === 1 ? String(days[0]) : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;

    return `${words} ${days.length === 1 && days[0] === 1 ? 'day' : 'days'}`;
}

//
// a stock model's hold that has yet to switch on, on `today`, by HOLD_SCHEDULE:
// never one with a day scored, which its model's results say is on
//
function notOnYet(model, hold, today) {
    const plan = HOLD_SCHEDULE[hold];

    return Boolean(plan && plan.on && today < plan.on && !scoresOn(model, hold).days);
}

/**
 * the holds a stock model predicts, as its Live version card's Predicts row says
 * it (#300): '1, 5 and 20 days', or while one has yet to switch on, when it does
 * -- '1 and 5 days; 20 days from the Nov 21 retrain'. `today` is New York's,
 * 'YYYY-MM-DD'. Nothing for a model the listing gives no holds.
 */
export function predictsLine(model, today) {
    const holds = listedHolds(model).map((hold) => hold.days).filter((days) => days !== COMBINED);
    const waiting = holds.filter((days) => notOnYet(model, days, today));

    return [listDays(holds.filter((days) => !waiting.includes(days)))]
        .concat(waiting.map((days) => `${days} days from the ${shortDay(HOLD_SCHEDULE[days].on)} retrain`))
        .filter(Boolean)
        .join('; ');
}

/**
 * the day a hold's first result came in (#300), from a model's track record,
 * `rows`: the day of the row that many rows after the first day scored on the
 * hold as its results take trading days to come in -- the record has a row for
 * each trading day the model predicted -- and that first day, `predicted`. The
 * 1-day hold's are the record's own columns. Null for a record not in, one with
 * no day scored on the hold, or none yet on the day its result came in.
 */
export function firstResult(rows, task, hold) {
    const column = hold === DEFAULT_HOLD ? DEFAULT_SCORE : columnOf(DEFAULT_SCORE, hold);
    const first = Array.isArray(rows) ? rows.findIndex((row) => scoreIn(row.score, column) !== null) : -1;
    const came = first < 0 ? null : rows[first + resultDays(task, hold)];

    return came ? { day: came.day, predicted: rows[first].day } : null;
}

/**
 * the days a hold's scores average over (#320), as Scores by hold says them under
 * each hold's count: the first and last of the latest `window` days of a model's
 * track record, `rows`, with a result on the hold -- the days the listing's
 * `holds` average -- 'Oct 12 to Oct 23', or one day's, 'Oct 12'. The 1-day hold's
 * are the record's own columns, as firstResult reads them. Nothing while the
 * record is on its way, where it could not be had, or where it has no day on the
 * hold.
 */
export function scoredSpan(rows, hold, window) {
    const column = !hold || hold === DEFAULT_HOLD ? DEFAULT_SCORE : columnOf(DEFAULT_SCORE, hold);
    const scored = Array.isArray(rows) ? rows.filter((row) => scoreIn(row.score, column) !== null).slice(-window) : [];

    if (!scored.length) {
        return '';
    }

    const first = scored[0].day;
    const last = scored[scored.length - 1].day;

    return first === last ? shortDay(first) : `${shortDay(first)} to ${shortDay(last)}`;
}

/**
 * the morning the version that went live on `since` ran (#320), as the attempts
 * name each night -- see nightName: `tested` of the night in `history` whose
 * `day` it is, or where there is none, as on /model, which has no history, the
 * day after it, as the worker's testedOn says a night with no `started`. Nothing
 * for no day.
 */
export function liveNight(since, history = null) {
    if (!since) {
        return '';
    }

    const night = Array.isArray(history) ? history.find((row) => row.day === since && row.tested) : null;

    return night ? night.tested : daysAfter(since, 1);
}

//
// the day `count` days after `day`, each 'YYYY-MM-DD'
//
function daysAfter(day, count) {
    const date = noonOf(day);

    date.setUTCDate(date.getUTCDate() + count);

    return date.toISOString().slice(0, 10);
}

//
// when a stock model's hold was first scored, or will be (#300) -- see whenRows
//
function firstLine(task, model, rows, hold, today) {
    const plan = HOLD_SCHEDULE[hold];

    if (scoresOn(model, hold).days) {
        const first = firstResult(rows, task, hold);
        const retrain = first && plan && plan.on && first.predicted >= plan.on && first.predicted < daysAfter(plan.on, 7);

        return first ? `First scored ${shortDay(first.day)}${retrain ? `, from the ${shortDay(plan.on)} retrain` : ''}` : '';
    }

    if (!plan || plan.first < today) {
        return '';
    }

    return notOnYet(model, hold, today)
        ? `Switches on at the ${shortDay(plan.on)} retrain; first scored ${shortDay(plan.first)}`
        : `First scored ${shortDay(plan.first)}`;
}

/**
 * when each of a stock model's holds' results come in (#300), as its page's last
 * card lists them: { key, name: '5 days', when: 'Comes in 6 trading days after
 * the prediction', first }, a row for each hold the listing gives it, and one
 * for Combined.
 *
 * `first` is when the hold was first scored, from its track record, `rows` --
 * 'First scored Nov 11, from the Oct 31 retrain', the retrain named where its
 * first day scored came in the week after it -- or while it has no result in,
 * when its first is due, as HOLD_SCHEDULE has it: 'Switches on at the Nov 21
 * retrain; first scored Dec 24'. Nothing where neither says: a record still on
 * its way, or a day due that has gone by.
 */
export function whenRows(task, model, rows, today) {
    return listedHolds(model).map((hold) => ({
        key: holdKey(hold.days),
        name: hold.label,
        when: comesInLine(task, hold.days),
        first: firstLine(task, model, rows, hold.days, today),
    }));
}

/**
 * the note under the take-down checks (#300): what 'not yet' means, and what a
 * check that reaches its limit does -- and while a stock model, `stock`, has a
 * hold yet to switch on, when it does: 'The 20-day hold switches on at the Nov 21
 * retrain.' A model with no holds says it of its checks alone.
 */
export function checksNote(model, today, stock = false) {
    const held = Array.isArray(model.behind) && model.behind.some((check) => check.hold);
    const waiting = stock ? listedHolds(model).filter((hold) => notOnYet(model, hold.days, today)) : [];

    return waiting
        .map((hold) => `The ${holdName(hold.days)} switches on at the ${shortDay(HOLD_SCHEDULE[hold.days].on)} retrain.`)
        .concat(held
            ? 'A check says “not yet” until its hold has the scored days it needs. A hold that reaches its limit takes the version down.'
            : 'A check says “not yet” until it has the scored days it needs. One that reaches its limit takes the version down.')
        .join(' ');
}

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

//
// a second pass training the new version again, on top of its bar (#318): a
// dark teal by day and a light one by night, each apart from the training under
// it and from the scoring's lighter top -- under each kind of colorblindness
// too -- and 7.5:1 and 10.3:1 on the page
//
const TOOK_AGAIN = { light: '#0b5f58', dark: '#7fdcc8' };

export const STATUSES = [
    { key: 'live', label: 'Live' },
    { key: 'new', label: 'New' },
    { key: 'down', label: 'Behind baseline' },
    { key: 'retired', label: 'Retired' },
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
    return KNOWN_SCORES.find((score) => score.key === key) || SCORES.find((score) => score.key === DEFAULT_SCORE);
}

/**
 * whether a key is a score the pages know (#279).
 */
export function isScore(key) {
    return KNOWN_SCORES.some((score) => score.key === key);
}

/**
 * the scores a task's models have, in the order its picker offers them (#279):
 * those the listing names that the pages know, or the four stock scores for a
 * task that names none, as every task before format 3. Loss, which every
 * listing gives, for one that names only scores the pages do not know.
 */
export function scoresFor(task) {
    if (!task || !Array.isArray(task.scores)) {
        return SCORES.map((score) => score.key);
    }

    const known = task.scores.filter(isScore);

    return known.length ? known : [DEFAULT_SCORE];
}

/**
 * whether a task's models trade options (#279): it names a score only an
 * options model has.
 */
export function tradesOptions(task) {
    return scoresFor(task).some((key) => scoreOf(key).options);
}

/**
 * what a score measures, for the models of `task` (#279): loss and the top 10's
 * mean something else for a task that trades options. On a stock model's `hold`
 * (#300), loss on Combined is an average of its holds' losses, and the top 10 on
 * its 5 and 20-day holds is sold days after it is bought.
 */
export function noteOf(key, task, hold = null) {
    const score = scoreOf(key);

    if (tradesOptions(task)) {
        return score.optionsNote || score.note;
    }

    if (hold === COMBINED && score.combinedNote) {
        return score.combinedNote;
    }

    return hold && hold !== DEFAULT_HOLD && score.heldNote ? score.heldNote : score.note;
}

/**
 * the score a task's list and pages show (#279): the one `scores` holds for it,
 * which the reader picked, where the task has it, and otherwise loss.
 */
export function chosenScore(scores, task) {
    const offered = scoresFor(task);
    const chosen = scores && task ? scores[task.id] : null;

    if (offered.includes(chosen)) {
        return chosen;
    }

    return offered.includes(DEFAULT_SCORE) ? DEFAULT_SCORE : offered[0];
}

/**
 * the scores models of every task in `tasks` can be compared on (#279): those
 * of what each one's picks would have made that every one of them names. None
 * for tasks before format 3, which name none of them.
 */
export function sharedScores(tasks) {
    return scoresFor(tasks[0]).filter((key) => scoreOf(key).across && tasks.every((task) => scoresFor(task).includes(key)));
}

function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * a score's value in a set of them, or null where the set has none (#279): a
 * set carries a format 3 score only where its report gave it.
 */
export function scoreIn(scores, key) {
    return scores && finite(scores[key]) ? scores[key] : null;
}

//
// how a score is printed: a share as a percentage, to its places or one, a
// count to one place, and the rest to three
//
function printOf(key) {
    const score = scoreOf(key);

    if (score.share) {
        return { scale: 100, places: score.places || 1, unit: '%', gap: ' pts' };
    }

    return { scale: 1, places: score.count ? 1 : 3, unit: '', gap: '' };
}

//
// a printed number below zero with a minus sign, as a signed tick has, and one
// that prints as zero without one
//
function signed(text) {
    return Number(text) === 0 ? text.replace('-', '') : text.replace('-', '−');
}

/**
 * a value as the pages print it: three places, a share as a percentage to one
 * -- the top 10's gain to two -- or a count to one, and a dash where there is
 * none.
 */
export function formatScore(value, key) {
    if (!finite(value)) {
        return '–';
    }

    const { scale, places, unit } = printOf(key);

    return `${signed((value * scale).toFixed(places))}${unit}`;
}

/**
 * how far apart two values are, unsigned: '0.034', or '1.2 pts' for a share.
 */
export function formatGap(value, key) {
    if (!finite(value)) {
        return '–';
    }

    const { scale, places, gap } = printOf(key);

    return `${(Math.abs(value) * scale).toFixed(places)}${gap}`;
}

/**
 * a value on an axis: as few places as it needs, up to three, or a share's
 * percentage to one.
 */
export function formatTick(value, key) {
    if (!finite(value)) {
        return '';
    }

    const { scale, places, unit } = printOf(key);

    return `${signed(String(Number((value * scale).toFixed(places))))}${unit}`;
}

/**
 * a difference on an axis, signed, where up is better: '+0.01', '−0.01',
 * '+1 pts', or '0'.
 */
export function formatSignedTick(value, key) {
    if (!finite(value)) {
        return '';
    }

    const { scale, places, gap } = printOf(key);
    const size = Number((Math.abs(value) * scale).toFixed(places));

    if (size === 0) {
        return '0';
    }

    return `${value > 0 ? '+' : '−'}${size}${gap}`;
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
 * the three parts of a track record's day's average loss (#265): each part's
 * average, `value`, the baseline's over the same days, `baseline`, and how the
 * part stands against it, `stands` -- better, worse or level, as loss is
 * compared, or null where the baseline has none. The newest day's are over the
 * same days as the listing's score, so the three add up to it.
 *
 * None for a day without all three, as in a track record without their columns:
 * two parts alone would not add up to the loss.
 *
 * On a `hold` (#300), the hold's own parts, over its own latest scored days, as
 * the listing's `holds` has its loss.
 *
 * Note: compared as the two are printed, since the page prints the word beside
 *       them. tables-gnn's size of the move was 0.26018 against the baseline's
 *       0.26065 over its first five days: less than half a thousandth apart,
 *       which standing calls level, and printed as 0.260 and 0.261.
 */
export function lossParts(row, hold = null) {
    const averageOf = (field, key) => (row && row[field] ? row[field][columnOf(key, hold)] : null);
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
 * whether /model's list shows loss's three parts in place of its sum (#283):
 * while Loss is picked, for a task of stocks. A total of three things read as
 * nothing a reader could name, and hid which of them a model beat the baseline
 * on. An options model's loss adds up other scores, hold by hold, and its list
 * shows the sum.
 */
export function showsParts(score, task) {
    return score === DEFAULT_SCORE && !tradesOptions(task);
}

/**
 * how many scored days a model's scores average, and how many it has to have
 * before it is no longer New (#293): the listing's `average_days`, which the
 * worker gives the listing and every model in it, or WINDOW for one without it.
 */
export function averageDays(source) {
    const days = source ? source.average_days : null;

    return Number.isInteger(days) && days >= 1 ? days : WINDOW;
}

/**
 * a model's status: Retired once it has stopped being trained, Behind baseline
 * while the trainer has its live version down for doing worse than the baseline
 * (#263), New while it has fewer scored days than its scores average (#293), and
 * Live otherwise.
 */
export function statusOf(model) {
    if (model.retired) {
        return 'retired';
    }

    if (model.down) {
        return 'down';
    }

    return model.scored_days < averageDays(model) ? 'new' : 'live';
}

/**
 * the status as a model's pill says it. New says how far it is through the days
 * it needs to be Live (#293), 'New · day 5 of 20', and is only 'New' before its
 * first day is scored.
 */
export function statusLabel(model) {
    const status = statusOf(model);

    if (status === 'new') {
        return model.scored_days ? `New · day ${model.scored_days} of ${averageDays(model)}` : 'New';
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
 * what a live version learned from, from format 4 on (#295), as the oldest and
 * newest of every day it read: 'Oct 5 – Oct 19', or 'Oct 5' for one day, and
 * nothing where the listing gives none, as one before format 4.
 *
 * Note: no count of its days (#315). The count was of the days it trained on,
 *       while the first and last days also take in the days it stopped on, so
 *       '7 days, Oct 5 to Oct 19' did not add up.
 */
export function trainedOn(live) {
    const days = live ? live.days : null;

    if (!days) {
        return '';
    }

    return days.first === days.last
        ? shortDay(days.first)
        : `${shortDay(days.first)} – ${shortDay(days.last)}`;
}

/**
 * the check of a live version's fine-tune, from the trainer's format 6 (#315),
 * in words: whether it passed, and how much better or worse than the tested
 * model it did on days neither trained on -- 'Passed, 0.002 better', 'Passed,
 * 0.003 worse, within the 0.005 allowed', 'Failed, 0.008 worse, past the 0.005
 * allowed', or 'Passed, level' where the gap prints as 0.000. Each gap to 3
 * places, as every loss gap prints, and nothing where the listing gives no check.
 */
export function fineTuneWords(fineTune) {
    if (!fineTune) {
        return '';
    }

    const verdict = fineTune.passed ? 'Passed' : 'Failed';
    const stands = standing(fineTune.by, 'loss');

    if (stands === 'level') {
        return `${verdict}, level`;
    }

    const gap = `${verdict}, ${formatGap(fineTune.by, 'loss')} ${stands}`;

    return stands === 'better'
        ? gap
        : `${gap}, ${fineTune.passed ? 'within' : 'past'} the ${formatGap(fineTune.slack, 'loss')} allowed`;
}

/**
 * when a live version was taken down, as its figure says it (#263): 'Taken down
 * Oct 19', the day held on one line where a narrow cell wraps the figure.
 */
export function takenDown(day) {
    return `Taken down ${shortDay(day).replace(' ', ' ')}`;
}

/**
 * why a live version was taken down, in words (#263).
 *
 * A check of its scores -- a take-down's `reason` of `worse`, and every one
 * before format 4 -- says which: 'worse than the baseline 5 scored days in a
 * row' for the check of each day on its own, and 'its 5-day average was worse
 * than the baseline’s 10 days in a row' for an average's. A count it does not
 * have is left out, and a check it cannot name is said without one: 'worse than
 * the baseline'.
 *
 * An options model's checks run on each hold, and say which (#279), and from
 * format 5 a stock model's do too (#300): 'its 5-day hold did worse than the
 * baseline 5 scored days in a row', and 'its 5-day hold’s 20-day average was
 * worse than the baseline’s 5 days in a row'.
 *
 * From format 4 a take-down that no check did says why (#295): 'it went live
 * without beating the baseline' for `not_ahead`, and 'its track record showed
 * nothing better than the baseline' for `track_record` -- from format 5, 'its
 * 20-day hold’s track record showed nothing better than the baseline, even on
 * the days this version predicted itself', where it names its hold (#300).
 * `not_ahead` never does: an attempt is judged on the 1-day hold.
 *
 * `down` is the listing's, or { days, in_a_row, hold } as a track record gives
 * the day whose score set it off.
 */
export function checkWords({ reason = 'worse', days, in_a_row: inARow, hold = null }) {
    if (reason === 'not_ahead') {
        return 'it went live without beating the baseline';
    }

    if (reason === 'track_record') {
        return hold
            ? `its ${holdName(hold)}’s track record showed nothing better than the baseline, even on the days this version predicted itself`
            : 'its track record showed nothing better than the baseline';
    }

    const count = finite(inARow)
        ? ` ${inARow} ${days === 1 ? 'scored ' : ''}${inARow === 1 ? 'day' : 'days'} in a row`
        : '';

    if (!finite(days)) {
        return hold ? `its ${holdName(hold)} did worse than the baseline${count}` : `worse than the baseline${count}`;
    }

    if (hold) {
        return days === 1
            ? `its ${holdName(hold)} did worse than the baseline${count}`
            : `its ${holdName(hold)}’s ${days}-day average was worse than the baseline’s${count}`;
    }

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

//
// the checks by the hold each is of, in the order they come (#279): one group
// of every check for a model with no holds
//
function byHold(behind) {
    const groups = [];

    behind.forEach((check) => {
        const hold = check.hold || null;
        const group = groups.find((each) => each.hold === hold);

        if (group) {
            group.checks.push(check);
        } else {
            groups.push({ hold: hold, checks: [check] });
        }
    });

    return groups;
}

/**
 * how close each of the trainer's checks is to taking a model's live version
 * down (#263), from the listing's `behind`, as a table, in the Live version card
 * and under a phone's boxes (#300) -- in place of a phone's line of them and a
 * wide screen's row for each (#267): a column for each check, `checks` --
 * { days, name: 'Each day' } -- and a row for each hold, an options model's
 * (#279) and from format 5 a stock model's, `rows` -- { key, hold, name: '5
 * days', counts: ['0 of 5', 'not yet'] } -- with how many scored days in a row
 * it has been worse for each column, 'not yet' while it has too few days to
 * say, or a dash where the hold has no such check. A model with no holds has
 * one row, named for none. Null for a listing that gives no checks, as one
 * before format 2.
 */
export function checksTable(behind) {
    if (!Array.isArray(behind) || !behind.length) {
        return null;
    }

    const days = behind.map((check) => check.days).filter((each, at, all) => all.indexOf(each) === at);

    return {
        checks: days.map((each) => {
            const name = checkName({ days: each });

            return { days: each, name: `${name.charAt(0).toUpperCase()}${name.slice(1)}` };
        }),
        rows: byHold(behind).map((group) => ({
            key: group.hold ? `hold-${group.hold}` : 'checks',
            hold: group.hold,
            name: group.hold ? holdLabel(group.hold) : '',
            counts: days.map((each) => {
                const check = group.checks.find((one) => one.days === each);

                return check ? checkCount(check) : '–';
            }),
        })),
    };
}

//
// the know-nothing baseline's dashes, on every chart and in every legend and
// panel: drawn solid, it read as a second model beside the live version
//
export const BASELINE_DASH = '5 4';

//
// the same on a model's own page's two charts, a longer dash for their longer
// lines (#300)
//
export const PAGE_DASH = '7 5';

//
// how much of its bar's color the scoring on top of an attempt's training takes:
// half, a lighter teal that still reads beside the training's (#300)
//
export const SCORING_OPACITY = 0.5;

/**
 * the colors every chart draws in, for `theme`: its text and muted gray, its
 * grid and its page, better and worse, the live version and the baseline, how
 * long an attempt took, and its second pass (#318).
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
        tookAgain: dark ? TOOK_AGAIN.dark : TOOK_AGAIN.light,
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
 * a day as an options model's picks name it (#290): 'Tue, Oct 20', with its
 * weekday, since the days they are made from, bought and sold are trading days.
 */
export function weekDay(day) {
    if (!day) {
        return '';
    }

    return noonOf(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * a day as a night of the attempts names it (#318), and the market day under
 * it: 'Tue Oct 27', its weekday before it with no comma, as the axis has room
 * for. Nothing where there is none.
 */
export function nightName(day) {
    if (!day) {
        return '';
    }

    return `${noonOf(day).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${shortDay(day)}`;
}

/**
 * today in New York, 'YYYY-MM-DD', where the trading days are kept (#290): a
 * pick's buy day has passed once today is after it there, wherever the reader is.
 */
export function newYorkToday(now = new Date()) {
    const parts = {};

    new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York' })
        .formatToParts(now)
        .forEach((part) => {
            parts[part.type] = part.value;
        });

    return `${parts.year}-${parts.month}-${parts.day}`;
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
 * when the newest of a history's nights was tested (#318), as the attempts'
 * card says it beside its title: 'Wed Oct 28, 5:39 AM ET'. Nothing for a
 * history with none, or whose newest night has no start.
 */
export function newestTest(rows) {
    const newest = Array.isArray(rows) && rows.length ? rows[rows.length - 1] : null;
    const at = newest ? formatStarted(newest.started) : '';

    return at ? `${nightName(newest.tested)}, ${at}` : '';
}

/**
 * how long a night's attempt took in all (#318): its first pass, the history's
 * `total_seconds`, and where it trained again, the second pass after it,
 * `trained_again_seconds`. None where the first pass has no time, as before the
 * trainer kept them, so a night with one pass reads as it always did.
 */
export function attemptSeconds(row) {
    const first = row ? row.total_seconds : null;

    if (!finite(first) || first < 0) {
        return null;
    }

    return finite(row.trained_again_seconds) && row.trained_again_seconds >= 0 ? first + row.trained_again_seconds : first;
}

/**
 * the note on a night's time where it trained again (#318), which says the time
 * is two passes: 'Two passes: 43 min 13 s for the new version’s training and
 * test, then 10 min 58 s training it again.' A second pass whose version did not
 * take over -- `trained_again` false: it failed its check, or ran out of time --
 * still ran, and counts, and the note says the first pass took over. Nothing for
 * a night with one pass.
 */
export function twoPasses(row) {
    if (attemptSeconds(row) === null || !finite(row.trained_again_seconds) || row.trained_again_seconds < 0) {
        return '';
    }

    const passes = `Two passes: ${formatDuration(row.total_seconds)} for the new version’s training and test, then ${formatDuration(row.trained_again_seconds)} training it again.`;

    return row.trained_again === false ? `${passes} The first pass took over.` : passes;
}

/**
 * the models in the order `sort` names, for the score on screen:
 *
 *     score    the best latest score first, which is the lowest loss
 *              and the highest of the rest. A model with none yet comes last
 *     name     by name
 *     went     the most attempts gone live first
 *     since    the live version that went live last first. A retired model's
 *              went live before it retired, and comes after every model still
 *              trained
 *
 * Ties are broken by name, so the order never depends on the listing's. On a
 * `hold` (#300), the scores are each model's on it -- see scoresOn -- or with
 * `records`, the track records by name, as /model's list has them -- see
 * scoresAt.
 */
export function sortModels(models, sort, key, hold = null, records = null) {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const scored = (model) => scoreIn((records ? scoresAt(model, hold, records[model.name]) : scoresOn(model, hold)).score, key);

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
 *
 * A model of another task can be ticked where `score`, the one compared on, is
 * of what each one's picks would have made and every task ticked names it
 * (#279): the top 10's, Top 10 gain or Top 10 wins. `tasks` are the listing's.
 */
export function compareBlocked(model, picked, score = DEFAULT_SCORE, tasks = []) {
    if (!picked.length || picked.some((each) => each.name === model.name)) {
        return null;
    }

    const ids = picked.map((each) => each.task).concat([model.task])
        .filter((id, at, all) => all.indexOf(id) === at);

    if (ids.length > 1 && !sharedScores(ids.map((id) => tasks.find((task) => task.id === id))).includes(score)) {
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
