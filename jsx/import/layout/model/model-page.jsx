/**
 * model-page.jsx: /model/:model, one model on its own (#243).
 *
 * Under the model's name, its status and what it predicts: the score picker
 * /model shares -- see redux/container/model.jsx -- and three figures: when its
 * live version went live, how many of its nightly attempts did, and its score,
 * over the listing's `average_days` (#293), beside the baseline's and where it
 * stands among the models of its task.
 * The score's name carries a note on what it measures, and while Loss is picked,
 * the three scores it adds up are under it (#265). On a wide screen, each figure
 * has rows of what it is made of: how the live version came to be live and how
 * close it is to being taken down, how the attempts went, and where the score
 * stands (#267). Then its two charts, each with a table of its numbers:
 *
 *     attempts-chart.jsx   every nightly attempt against the live version, and
 *                          how far each beat or missed it
 *     track-chart.jsx      every day it predicted, with another model of its
 *                          task picked from a menu, a tick on each night a new
 *                          version went live, and one on each day whose score
 *                          took the live version down
 *
 * The trainer takes a live version down when it keeps doing worse than the
 * know-nothing baseline (#263), and from format 4 when it went live without
 * beating the baseline, or its track record showed nothing better (#295). The
 * first figure then says when, and why, and that nothing predicts until a new
 * version beats the baseline; and under the score, how many days in a row each
 * check has been worse, for any model that has not retired. A listing before
 * format 2 says neither, and the figures are as they were. From format 4 the
 * first figure's rows say what the live version trained on too.
 *
 * The score picker offers the scores the model's task has (#279). An options
 * model's page has a hold picker beside it, which the track record follows --
 * the attempts are scored on the plain scores, which decide what goes live --
 * and its checks say which hold each is of. Its picks are on a page of their
 * own, for signed-in readers, and nothing here shows or asks for them: see
 * picks-page.jsx (#290). On a score of what each model's picks would have made,
 * the track record's menu offers the models of other tasks too.
 *
 * From format 5 a stock model's page has one too (#300): its 1, 5 and 20-day
 * holds, and Combined, their average, with a line under the pickers saying what
 * the hold is and when its results come in. Wherever the listing gives a model's
 * scores on each hold, the score card follows the hold as the track record does
 * -- its figure, its line, its parts -- and only the attempts stay on the 1-day
 * hold, as the trainer judges them. Combined has no top 10: its picker's two are
 * disabled, and a top 10 picked before shows as loss there. A stock model's
 * scores on every hold are in a table under the cards, the hold picked shaded,
 * or on a phone the score picked on every hold.
 *
 * Every take-down check is a table, a row for each hold, and every "better" and
 * "worse" than the baseline carries the list's arrow (#300).
 *
 * The page is laid out as #300 lays it out: its parts 22px apart, a stock model
 * with holds closing on when each hold's results come in, and its Live version
 * card saying which holds it predicts. Every titled section folds, and stays
 * folded on the next visit -- see parts.jsx's useFolds.
 *
 * The listing says who the model is; its history and its track record are asked
 * for once the listing names it. A name the listing does not hold is a model
 * that does not exist, and the page says so rather than drawing nothing.
 *
 * Beside the name, its bell leads to its alarm page, and rings for a reader who
 * holds the alarm (#255); a retired model has none. See parts.jsx's AlarmBell.
 *
 * Note: the model api is built after this page (#243). Until it answers, the
 *       page says it has no models to show, as /model does.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import FigureBoxes from '../../general/figure-boxes.jsx';
import InfoNote from '../../general/info-note.jsx';
import AttemptsChart, { HEIGHT as ATTEMPTS_HEIGHT, TITLE as ATTEMPTS_TITLE } from './attempts-chart.jsx';
import TrackChart, { HEIGHT as TRACK_HEIGHT, TITLE as TRACK_TITLE, TrackNone, trackTitle } from './track-chart.jsx';
import { AlarmBell, FoldTitle, HoldPicker, ScorePicker, StatusPill, gapWords, modelsHeld, partGap, useFolds } from './parts.jsx';
import { loadListing, loadReport } from './source.js';
import { PendingChart, PendingLines, PendingPicker, PendingSummary, STAGGER } from './pending.jsx';
import { PendingBar } from '../graph/pending.jsx';
import { listSubscriptions } from '../../general/account-api.js';
import {
    COMBINED,
    DEFAULT_HOLD,
    DEFAULT_SCORE,
    HELD_OUT,
    averageDays,
    betterBy,
    checkWords,
    checksNote,
    checksTable,
    chosenScore,
    columnOf,
    comesInLine,
    emptyHolds,
    fineTuneWords,
    formatDuration,
    formatScore,
    formatStarted,
    heldOut,
    holdLabel,
    holdLine,
    holdNote,
    holdsFor,
    holdsOf,
    listedHolds,
    lossParts,
    namedHold,
    newYorkToday,
    noResultsYet,
    noteOf,
    predictsLine,
    resultLag,
    scoreIn,
    scoreOf,
    scoreOnHold,
    scoresFor,
    scoresOn,
    shortDay,
    sortModels,
    standing,
    statusOf,
    takenDown,
    trackLine,
    tradesOptions,
    trainedOn,
    whenRows,
} from './scores.js';

//
// what a model whose live version was taken down does until it goes live again
// (#263): a version goes live again only if it beats the baseline on the days it
// was tested on
//
const DOWN_LINE = 'Nothing predicts until a new version beats the baseline on the days it was tested on.';

//
// the name of the Live version card's row, and of a phone's line under the
// boxes, saying whether the live version's fine-tune passed the trainer's check
// (#315)
//
const FINE_TUNE = 'Fine-tune check';

//
// each chart's card, as its placeholder draws it while its report is on its way
// (#274): the card's title and the chart's height -- see pending.jsx
//
const ATTEMPTS_CARD = { title: ATTEMPTS_TITLE, height: ATTEMPTS_HEIGHT };
const TRACK_CARD = { title: TRACK_TITLE, height: TRACK_HEIGHT };

//
// 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st
//
export function ordinal(place) {
    const teen = place % 100 >= 11 && place % 100 <= 13;
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[place % 10];

    return `${place}${!teen && suffix ? suffix : 'th'}`;
}

/**
 * where `model` stands among the models of its task on `score`, best first, in
 * two parts: { rank: '2nd of 3', among: 'Next-day direction models' }, or null
 * where it is the only one, or has no score to stand by. On a `hold` (#300), on
 * each model's scores on it -- see scores.js's scoresOn.
 */
export function rankAmong(model, models, task, score, hold = null) {
    const scored = models.filter((each) => (
        each.task === model.task && scoreIn(scoresOn(each, hold).score, score) !== null
    ));

    if (scored.length < 2 || !scored.includes(model)) {
        return null;
    }

    const place = sortModels(scored, 'score', score, hold).indexOf(model) + 1;

    return { rank: `${ordinal(place)} of ${scored.length}`, among: `${task ? task.name : model.task} models` };
}

/**
 * the same as one line, as a phone's note says it: '2nd of 3 Next-day direction
 * models', or ''.
 */
export function placeAmong(model, models, task, score, hold = null) {
    const place = rankAmong(model, models, task, score, hold);

    return place ? `${place.rank} ${place.among}` : '';
}

/**
 * the live version, as the first figure says it: when it went live, and that it
 * is the model's first -- or, for one the trainer took down, when, and the check
 * that did it (#263). A version an update or a retrain made says no more than
 * when: 'nightly update' and 'weekly retrain' are the trainer's words, and meant
 * nothing to a reader (#315).
 */
export function liveFigure(model) {
    const status = statusOf(model);

    if (status === 'retired') {
        return {
            value: `Retired ${shortDay(model.retired)}`,
            detail: model.live.since ? `its last version went live ${shortDay(model.live.since)}` : 'no longer trained',
        };
    }

    if (status === 'down') {
        return {
            value: takenDown(model.down.since),
            detail: checkWords(model.down),
        };
    }

    if (model.live.kind === 'first' || !model.live.kind) {
        return {
            value: shortDay(model.live.since) || '–',
            detail: 'its first version, not yet beaten',
        };
    }

    return {
        value: shortDay(model.live.since) || '–',
        detail: '',
    };
}

//
// a figure's line as a sentence of its note, where a phone has no room for the
// line under the figure: 'its first version, not yet beaten' as 'Its first
// version, not yet beaten.', and nothing for no line
//
export function sentence(line) {
    return line ? `${line.charAt(0).toUpperCase()}${line.slice(1)}.` : '';
}

/**
 * the line under the Live version card's figure on a wide screen (#267): as
 * liveFigure says it, for a first version or a retired model -- or, for one taken
 * down, why: 'Its 5-day hold did worse than the baseline 5 scored days in a
 * row.' The card says what happens next on a line of its own, in gray. None for
 * a version an update or a retrain made (#315).
 */
export function liveLine(model) {
    if (statusOf(model) === 'down') {
        return sentence(checkWords(model.down));
    }

    return liveFigure(model).detail;
}

/**
 * the Live version card's rows on a wide screen (#267), each { key, name, value }:
 *
 *     Predicts                            the holds a stock model predicts, from
 *                                         format 5 (#300), `predicts` -- see
 *                                         scores.js's predictsLine
 *     Trained on                          what the live version learned from, from
 *                                         format 4 (#295), as its first and last
 *                                         days: 'Oct 5 – Oct 19' -- see
 *                                         scores.js's trainedOn
 *     Fine-tune check                     whether its fine-tune on its held-out
 *                                         days passed the trainer's check, and by
 *                                         how much, from format 6 (#315): 'Passed,
 *                                         0.002 better' -- see scores.js's
 *                                         fineTuneWords
 *
 * No Predicts for a model without holds. No Trained on where the listing says
 * nothing of it, as before format 4, and no Fine-tune check where it gives no
 * check, as before format 6. The checks come after the rows, as a table (#300)
 * -- see ChecksTable.
 *
 * Note: #315 took out two rows. 'Beat the version it replaced by', a gap in
 *       loss over 3 held-out days too small to mean anything; and 'First
 *       predicted', the model's first day, which beside the live version's read
 *       as if that version had predicted before it went live.
 */
export function liveRows(model, predicts = '') {
    const rows = [];
    const trained = trainedOn(model.live);
    const checked = fineTuneWords(model.live && model.live.fine_tune);

    if (predicts) {
        rows.push({ key: 'predicts', name: 'Predicts', value: predicts });
    }

    if (trained) {
        rows.push({ key: 'trained', name: 'Trained on', value: trained });
    }

    if (checked) {
        rows.push({ key: 'fine-tune', name: FINE_TUNE, value: checked });
    }

    return rows;
}

/**
 * the take-down checks of a model still trained, as a table (#300) -- see
 * scores.js's checksTable -- or null for a retired one, or a listing that gives
 * none, as before format 2.
 */
export function checksOf(model) {
    return statusOf(model) === 'retired' ? null : checksTable(model.behind);
}

//
// the line under the Attempts card's figure on a wide screen (#267): what its
// count is of (#300)
//
export const ATTEMPTS_LINE = 'of every nightly update and weekly retrain';

//
// the note at the Attempts card's foot for a stock model with holds (#300): why
// its attempts are judged on the 1-day hold, and how its longer holds are judged
//
export const ATTEMPTS_NOTE = `Each night’s attempt is tested on the newest ${HELD_OUT} days, which don’t have 5 or 20-day results yet. The longer holds are judged on their real scored days, by the take-down checks.`;

/**
 * the Attempts card's rows on a wide screen (#267), as liveRows gives them: how
 * many nightly updates and weekly retrains went live, of how many, '3 of 7 went
 * live' -- a kind with no attempts has no row -- then the newest night, 'Oct 19,
 * went live' (#300), when it started and how long it took, where the history has
 * its times, and its loss on the held-out days beside the live version's, which
 * is what decided it. Last, for a model with holds, `held`, that attempts are
 * judged on the 1-day hold. None where there is no history.
 */
export function attemptRows(history, held = false) {
    if (!Array.isArray(history) || !history.length) {
        return [];
    }

    const rows = [];

    [['nightly', 'Nightly updates'], ['weekly', 'Weekly retrains']].forEach(([kind, name]) => {
        const nights = history.filter((row) => row.kind === kind);

        if (nights.length) {
            rows.push({ key: kind, name: name, value: `${nights.filter((row) => row.went_live).length} of ${nights.length} went live` });
        }
    });

    const last = history[history.length - 1];
    const attempt = scoreIn(last.attempt, 'loss');
    const live = scoreIn(last.live, 'loss');
    const more = [
        { key: 'started', name: 'Started', value: formatStarted(last.started) },
        { key: 'took', name: 'Took', value: formatDuration(last.total_seconds) },
        {
            key: 'loss',
            name: 'Its held-out loss',
            value: attempt === null ? '' : `${formatScore(attempt, 'loss')}${live === null ? '' : `, live ${formatScore(live, 'loss')}`}`,
        },
    ];

    return rows.concat(
        [{ key: 'last', name: 'Last attempt', value: `${shortDay(last.day)}, ${last.went_live ? 'went live' : 'kept back'}` }],
        more.filter((row) => row.value),
        held ? [{ key: 'judged', name: 'Judged on', value: 'the 1-day hold' }] : [],
    );
}

/**
 * a card's rows on a wide screen, under a thin rule (#267), drawn as loss's parts
 * are: a name at the left and its value at the right. `children` come after the
 * rows, at the card's foot (#300): the Live version card's checks, the score
 * card's parts, and the Attempts card's note. Nothing, not even the rule, where
 * there are neither.
 */
export function CardRows({ rows, children = null }) {
    if (!rows.length && !children) {
        return null;
    }

    return (
        <div className='model-stat-body'>
            {rows.length
                ? (
                    <ul className='model-stat-rows'>
                        {rows.map((row) => (
                            <li key={row.key} className='model-stat-row'>
                                <span className='model-stat-row-name'>{row.name}</span>
                                <span className='model-stat-row-value'>{row.value}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}
            {children}
        </div>
    );
}

CardRows.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
    })).isRequired,
    children: PropTypes.node,
};

/**
 * the three scores loss adds up (#265), under the score's figure while Loss is
 * picked: each part's average, and how far it stands from the baseline's, after
 * the list's arrow (#300) -- 'Up or down 0.723 ▼ 0.010 worse'.
 *
 * `parts` are lossParts' of the track record's newest day, over the same days as
 * the figure, so the three add up to it.
 */
export function LossParts({ parts }) {
    return (
        <ul className='model-parts' aria-label='Loss, part by part'>
            {parts.map((part) => (
                <li key={part.key} className='model-part'>
                    <span className='model-part-name'>{part.label}</span>
                    <span className='model-part-figures'>
                        <span className='model-part-value'>{formatScore(part.value, 'loss')}</span>
                        {part.stands ? <span className={`model-part-gap model-gap-${part.stands}`}>{partGap(part)}</span> : null}
                    </span>
                </li>
            ))}
        </ul>
    );
}

LossParts.propTypes = {
    parts: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        baseline: PropTypes.number,
        stands: PropTypes.oneOf(['better', 'worse', 'level']),
    })).isRequired,
};

/**
 * how close each of the trainer's checks is to taking the live version down, as
 * a small table (#300): a column for each check, each day and each average, and
 * a row for each hold, each cell how many scored days in a row the hold has been
 * worse than the baseline on the check, '4 of 5', or 'not yet' where the check
 * does not have its days. A model with no holds has one row, under the checks'
 * names alone. In the Live version card on a wide screen, and under the boxes on
 * a phone, which it fits.
 *
 * `table` is checksOf's.
 */
export function ChecksTable({ table }) {
    const holds = table.rows.some((row) => row.hold);

    return (
        <table className='model-checks'>
            <caption>Days in a row worse than the baseline</caption>
            <thead>
                <tr>
                    {holds ? <th scope='col' className='model-checks-hold'>Hold</th> : null}
                    {table.checks.map((check) => <th key={check.days} scope='col'>{check.name}</th>)}
                </tr>
            </thead>
            <tbody>
                {table.rows.map((row) => (
                    <tr key={row.key}>
                        {holds ? <th scope='row'>{row.name}</th> : null}
                        {row.counts.map((count, at) => (
                            <td key={table.checks[at].days} className={/ of /.test(count) ? null : 'model-checks-none'}>{count}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

ChecksTable.propTypes = {
    table: PropTypes.shape({
        checks: PropTypes.arrayOf(PropTypes.shape({
            days: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
        })).isRequired,
        rows: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string.isRequired,
            hold: PropTypes.number,
            name: PropTypes.string.isRequired,
            counts: PropTypes.arrayOf(PropTypes.string).isRequired,
        })).isRequired,
    }).isRequired,
};

/**
 * the checks' table and the note under it (#300): what 'not yet' means, and what
 * a check that reaches its limit does -- see scores.js's checksNote.
 */
export function Checks({ table, note }) {
    return (
        <div className='model-checks-block'>
            <ChecksTable table={table} />
            <p className='model-checks-note'>{note}</p>
        </div>
    );
}

Checks.propTypes = {
    table: ChecksTable.propTypes.table,
    note: PropTypes.string.isRequired,
};

//
// a score's figure on a hold, and how it stands against the baseline's in the
// fewest words, '▲ 0.012 better', as a cell of the Scores by hold table and a
// line of a phone's list hold them (#300). A top 10's on Combined, which has
// none, says so
//
function heldFigure(task, on, key) {
    if (heldOut(task, on.hold).includes(key)) {
        return { value: '–', gap: <span className='model-gap model-gap-level'>no combined score</span> };
    }

    const value = scoreIn(on.score, key);
    const gap = betterBy(value, scoreIn(on.baseline, key), key);

    return {
        value: formatScore(value, key),
        gap: <span className={`model-gap model-gap-${standing(gap, key)}`}>{gapWords(gap, key, '', 'level with baseline')}</span>,
    };
}

//
// how many days a hold has scored, and how many of them its figures take in
// (#300): 'last 20 of 34 scored days', '14 scored days so far', or none yet
//
function scoredDays(days, window) {
    if (!days) {
        return 'no scored days yet';
    }

    return days >= window ? `last ${window} of ${days} scored days` : `${days} scored ${days === 1 ? 'day' : 'days'} so far`;
}

//
// the Scores by hold card's title, which folds it (#300): 'Scores by hold' on a
// wide screen, and on a phone the score picked, 'Loss by hold'
//
function HoldsTitle({ label, folded, onFold }) {
    return (
        <FoldTitle
            as='h5'
            id='model-holds-title'
            title={(
                <>
                    <span className='model-holds-wide'>Scores by hold</span>
                    <span className='model-holds-phone'>{`${label} by hold`}</span>
                </>
            )}
            folded={folded}
            onFold={onFold}
        />
    );
}

HoldsTitle.propTypes = {
    label: PropTypes.string.isRequired,
    folded: PropTypes.bool.isRequired,
    onFold: PropTypes.func.isRequired,
};

//
// what the Scores by hold table holds, under its title (#300): each hold's
// scores over its own latest days, beside the baseline's, what Combined is, and
// why it has no top 10 where the task has one
//
function holdsAbout(task, holds, window) {
    const combined = holds.some((each) => each.days === COMBINED);

    return [
        `Each hold’s scores over its own latest ${window} scored days, beside the baseline’s on the same days.`,
        combined ? 'Combined is the average of the 1, 5 and 20-day scores of the same prediction days, so it comes in with the 20-day result.' : '',
        combined && heldOut(task, COMBINED).length ? 'The top 10 has no combined score: a 20-day gain and a 1-day gain aren’t the same kind of number.' : '',
    ].filter(Boolean).join(' ');
}

/**
 * a model's scores on each of its holds (#300), a stock model's or from #315 an
 * options model's, under the summary: a row for each hold, and a stock model's
 * one for Combined, saying how many days it has scored and when its results
 * come in, and a column for each of its task's scores, each
 * cell the hold's average and how it stands against the baseline's. All from the
 * listing's `holds`, as the score card's figure is. The hold picked is shaded.
 *
 * On a phone, '<score> by hold' in its place: the score picked, on every hold, a
 * line each, so nothing runs past the screen's edge. Both are drawn, each under
 * a line of its own saying what it holds, and the stylesheet shows the one that
 * fits -- see '_model.scss'.
 *
 * Its title folds it away and opens it again, as every section of the page
 * does, kept between visits -- see parts.jsx's useFolds.
 */
export function HoldsTable({ model, task, score, hold }) {
    const holds = listedHolds(model);
    const keys = scoresFor(task);
    const shown = scoreOnHold(score, hold);
    const window = averageDays(model);
    const [folds, toggle] = useFolds('model-page');

    if (folds.holds) {
        return (
            <section className='model-card model-by-hold' aria-labelledby='model-holds-title'>
                <div className='model-card-head'>
                    <HoldsTitle label={scoreOf(shown).label} folded onFold={() => toggle('holds')} />
                </div>
            </section>
        );
    }

    return (
        <section className='model-card model-by-hold' aria-labelledby='model-holds-title'>
            <div className='model-card-head'>
                <HoldsTitle label={scoreOf(shown).label} folded={false} onFold={() => toggle('holds')} />
                <p className='model-card-sub model-holds-wide'>{holdsAbout(task, holds, window)}</p>
                <p className='model-card-sub model-holds-phone'>
                    {`Each over its hold’s own latest ${window} scored days. Pick another score above to see it on every hold.`}
                </p>
            </div>
            <div className='model-holds-wide model-holds-box'>
                <table className='model-holds-table'>
                    <thead>
                        <tr>
                            <th scope='col'>Hold</th>
                            {keys.map((key) => <th key={key} scope='col'>{scoreOf(key).label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {holds.map((each) => {
                            const on = scoresOn(model, each.days);

                            return (
                                <tr key={each.label} className={each.days === hold ? 'model-holds-picked' : null}>
                                    <th scope='row'>
                                        <span className='model-holds-name'>{each.label}</span>
                                        <span className='model-holds-about'>{scoredDays(on.days, window)}</span>
                                        <span className='model-holds-about'>{comesInLine(task, each.days)}</span>
                                    </th>
                                    {keys.map((key) => {
                                        const figure = heldFigure(task, on, key);

                                        return (
                                            <td key={key}>
                                                <span className='model-holds-value'>{figure.value}</span>
                                                {figure.gap}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <ul className='model-holds-phone model-holds-list' aria-label={`${scoreOf(shown).label} by hold`}>
                {holds.map((each) => {
                    const on = scoresOn(model, each.days);
                    const figure = heldFigure(task, on, shown);

                    return (
                        <li key={each.label} className={each.days === hold ? 'model-holds-picked' : null}>
                            <span className='model-holds-name'>{each.label}</span>
                            <span className='model-holds-value'>{figure.value}</span>
                            <span className='model-holds-about'>{scoredDays(on.days, window)}</span>
                            {figure.gap}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

HoldsTable.propTypes = {
    model: PropTypes.shape({
        holds: PropTypes.object.isRequired,
    }).isRequired,
    task: PropTypes.shape({
        id: PropTypes.string.isRequired,
        scores: PropTypes.arrayOf(PropTypes.string),
    }),
    score: PropTypes.string.isRequired,
    hold: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])]),
};

/**
 * when each of a stock model's holds' results come in (#300), the page's last
 * card: a box for each hold and for Combined, its name over when each of its
 * results comes in and when it was first scored -- see scores.js's whenRows.
 * Its title folds it, as every section of the page does.
 */
export function WhenCard({ rows }) {
    const [folds, toggle] = useFolds('model-page');

    return (
        <section className='model-card model-when' aria-labelledby='model-when-title'>
            <div className='model-card-head'>
                <FoldTitle
                    as='h5'
                    id='model-when-title'
                    title='When results come in'
                    folded={Boolean(folds.when)}
                    onFold={() => toggle('when')}
                />
            </div>
            {folds.when
                ? null
                : (
                    <ul className='model-when-list'>
                        {rows.map((row) => (
                            <li key={row.key} className='model-when-item'>
                                <span className='model-when-name'>{row.name}</span>
                                <span className='model-when-lag'>{row.when}</span>
                                {row.first ? <span className='model-when-first'>{row.first}</span> : null}
                            </li>
                        ))}
                    </ul>
                )}
        </section>
    );
}

WhenCard.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        when: PropTypes.string.isRequired,
        first: PropTypes.string.isRequired,
    })).isRequired,
};

class ModelPage extends Component {
    static propTypes = {
        //
        // the model's name, as the address holds it
        //
        name: PropTypes.string.isRequired,
        //
        // the score shown for each task, and the way to choose another for one,
        // as /model's lists are (#279), and the hold the page is on, and the way
        // to choose another: 1, 5 or 20 days, or from format 5 Combined (#300),
        // which a page without it reads as 1 day -- the store's, see
        // redux/container/model.jsx
        //
        scores: PropTypes.objectOf(PropTypes.string),
        onScore: PropTypes.func,
        hold: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])]),
        onHold: PropTypes.func,
    }

    static defaultProps = {
        scores: {},
        onScore: () => {},
        hold: DEFAULT_HOLD,
        onHold: () => {},
    }

    constructor(props) {
        super(props);

        this.state = {
            // as /model's: undefined while on its way, null where it could not
            // be had, and { tasks, models } once it is in
            listing: undefined,
            // the model's two reports: undefined while on the way, null where
            // they could not be had, and their rows once they are in
            history: undefined,
            track: undefined,
            // the other model the track record is drawn beside, and its
            // record, as the others are
            other: null,
            other_rows: undefined,
            // whether the reader holds the model's alarm, which rings its bell:
            // not until their subscriptions arrive, and never signed out
            held: false,
        };

        this.pickOther = this.pickOther.bind(this);
    }

    componentDidMount() {
        this.alive = true;

        loadListing().then((listing) => {
            if (!this.alive) {
                return;
            }

            this.setState({ listing: listing });

            if (listing && this.model(listing)) {
                const days = averageDays(this.model(listing));

                ['history', 'track'].forEach((field) => {
                    loadReport(this.props.name, field === 'track' ? 'track-record' : field, days).then((rows) => {
                        if (this.alive) {
                            this.setState({ [field]: rows });
                        }
                    });
                });
            }
        });

        //
        // whether the reader holds the model's alarm, for its bell: asked once, as
        // /model asks. Signed out, or where the list could not be had, it is plain
        //
        listSubscriptions()
            .then((subscriptions) => {
                if (this.alive) {
                    this.setState({ held: modelsHeld(subscriptions).includes(this.props.name) });
                }
            })
            .catch((error) => {
                console.log(`Error (account api): the subscriptions could not be listed, ${error.message}`);
            });
    }

    componentWillUnmount() {
        this.alive = false;
    }

    model(listing = this.state.listing) {
        return listing ? listing.models.find((each) => each.name === this.props.name) || null : null;
    }

    //
    // another model picked from the track record's menu, or none. Its record is
    // asked for each time it is picked, and one that lands after another was
    // picked is let go
    //
    pickOther(name) {
        this.setState({ other: name, other_rows: undefined });

        if (!name) {
            return;
        }

        loadReport(name, 'track-record', averageDays(this.state.listing)).then((rows) => {
            if (this.alive && this.state.other === name) {
                this.setState({ other_rows: rows });
            }
        });
    }

    //
    // the three figures over the charts, on `score` and `hold`
    //
    summary(model, task, score, hold) {
        const { history, listing, track } = this.state;
        const status = statusOf(model);
        const live = liveFigure(model);
        const line = liveLine(model);

        //
        // the score card's figure on the hold, where the listing gives the
        // model's scores on each, from format 5 on (#300), and otherwise the
        // listing's own -- see scores.js's scoresOn. A hold with no day scored
        // yet has none, and says when its first result comes in
        //
        const on = scoresOn(model, hold);
        const value = scoreIn(on.score, score);
        const baseline = scoreIn(on.baseline, score);
        const gap = betterBy(value, baseline, score);
        const stands = standing(gap, score);
        const waiting = Boolean(on.hold) && !on.days;
        const weekly = Array.isArray(history) ? history.filter((row) => row.kind === 'weekly') : [];
        const retrains = weekly.length ? `weekly retrains: ${weekly.filter((row) => row.went_live).length} of ${weekly.length}` : '';
        const went = `${model.attempts.went_live} of ${model.attempts.total}`;
        const rank = rankAmong(model, listing.models, task, score, on.hold);
        const place = placeAmong(model, listing.models, task, score, on.hold);

        //
        // so far, for a model with fewer scored days than its scores average
        // (#293): a new one, or one taken down before it had them (#263), or a
        // hold that came on after the model did, by its own days (#300). The
        // name names the hold, but for the 1-day hold, whose scores are the
        // listing's own
        //
        const days = averageDays(model);
        const named = `${scoreOf(score).label}${namedHold(on.hold)}`;
        let scoreName = `${named}, last ${days} days`;

        if (waiting) {
            scoreName = named;
        } else if (status !== 'retired' && on.days < days) {
            scoreName = `${named}, ${on.days} ${on.days === 1 ? 'day' : 'days'} so far`;
        }

        //
        // what a model taken down does until it goes live again (#263), as a
        // phone's note says it, and the take-down checks of any model still
        // trained, as a table (#300)
        //
        const down = status === 'down' ? DOWN_LINE : '';
        const checks = checksOf(model);

        //
        // what the live version trained on, from format 4 (#295), and whether its
        // fine-tune passed the trainer's check, from format 6 (#315), as a phone's
        // lines under the boxes say them. A wide screen's card says them in its
        // rows
        //
        const trained = trainedOn(model.live);
        const checked = fineTuneWords(model.live.fine_tune);

        //
        // how the score stands against the baseline's, after the list's arrow
        // (#300): '▲ 0.012 better than baseline, 1.650'
        //
        let against = '';

        if (waiting) {
            against = noResultsYet(task, on.hold);
        } else if (gap !== null) {
            against = <>{gapWords(gap, score)}{`, ${formatScore(baseline, score)}`}</>;
        }

        //
        // the three scores loss adds up, while Loss is picked (#265), from the
        // track record's newest day, on the hold (#300): none while the track
        // record is on its way, where it could not be had, and where it has no
        // columns for them
        //
        const parts = score === 'loss' && Array.isArray(track) && track.length ? lossParts(track[track.length - 1], on.hold) : [];
        const lossBy = parts.length ? <LossParts parts={parts} /> : null;

        //
        // the score card's rows on a wide screen: its place among its task's
        // models, and on a hold, how many days the hold has scored and when each
        // of its results comes in (#300). The parts of loss go at the card's
        // foot under a heading of their own, as the other cards head theirs
        // (#272) -- the place ran straight into them
        //
        const scoreRows = (rank ? [{ key: 'place', name: `Among ${rank.among}`, value: rank.rank }] : [])
            .concat(on.hold
                ? [
                    { key: 'days', name: 'Scored days on this hold', value: on.days ? String(on.days) : 'none yet' },
                    { key: 'in', name: 'Each result comes in', value: resultLag(task, on.hold) },
                ] : []);

        //
        // whether attempts are said to be judged on the 1-day hold, and why --
        // see held -- and for a stock model the listing gives holds, which it
        // predicts, and when one yet to switch on does (#300)
        //
        const held = this.held(model, task);
        const stock = !tradesOptions(task) && listedHolds(model).length > 0;
        const today = newYorkToday();
        const note = checksNote(model, today, stock);

        //
        // a taken-down model's live box on a phone: 'Taken down' its name and the
        // day its value, where 'Taken down Oct 19' wrapped onto three lines
        // against the box's side and made the three boxes twice as tall (#272)
        //
        const downBox = status === 'down' ? { short: 'Taken down', shortValue: shortDay(model.down.since) } : {};

        //
        // the three figures: a card each on a wide screen, and on a phone one
        // row of /stream's tinted boxes, a name over a value, with the line under
        // each card's value moved into its box's note -- three cards stacked
        // took a phone's whole first screen (#253).
        //
        // On a wide screen each card is a top part, its name, its figure and one
        // line, then its rows under a thin rule, as the parts of loss are drawn,
        // which had read cleanly where the cards' sentences ran together (#267).
        // The parts go in the score's card, under its place among its task's
        // models.
        //
        // On a phone, under the boxes, in this order (#300): the score's line,
        // the parts (#265), why the live version was taken down, the checks, and
        // what it trained on
        //
        return (
            <section className='model-summary' aria-label='Summary'>
                <div className='model-summary-cards'>
                    <div className='model-stat'>
                        <div className='model-stat-head'>
                            <span className='model-stat-label'>Live version</span>
                            <span className='model-stat-value'>{live.value}</span>
                            {line ? <span className='model-stat-detail'>{line}</span> : null}
                            {down ? <span className='model-stat-down'>{down}</span> : null}
                        </div>
                        <CardRows rows={liveRows(model, stock ? predictsLine(model, today) : '')}>
                            {checks ? <Checks table={checks} note={note} /> : null}
                        </CardRows>
                    </div>
                    <div className='model-stat'>
                        <div className='model-stat-head'>
                            <span className='model-stat-label'>Attempts that went live</span>
                            <span className='model-stat-value'>{went}</span>
                            <span className='model-stat-detail'>{ATTEMPTS_LINE}</span>
                        </div>
                        <CardRows rows={attemptRows(history, held)}>
                            {held && Array.isArray(history) && history.length ? <p className='model-stat-note'>{ATTEMPTS_NOTE}</p> : null}
                        </CardRows>
                    </div>
                    <div className='model-stat'>
                        <div className='model-stat-head'>
                            <InfoNote note={noteOf(score, task, on.hold)} className='model-stat-label model-noted'>{scoreName}</InfoNote>
                            <span className='model-stat-value'>{formatScore(value, score)}</span>
                            <span className={`model-stat-detail model-gap-${stands}`}>{against}</span>
                        </div>
                        <CardRows rows={scoreRows}>
                            {lossBy
                                ? (
                                    <div className='model-stat-group'>
                                        <span className='model-stat-group-head'>Loss, part by part</span>
                                        {lossBy}
                                    </div>
                                ) : null}
                        </CardRows>
                    </div>
                </div>
                <div className='model-summary-boxes'>
                    <FigureBoxes
                        figures={[
                            {
                                key: 'live',
                                label: 'Live version',
                                note: sentence(live.detail),
                                value: live.value,
                                ...downBox,
                            },
                            {
                                key: 'went',
                                label: 'Attempts that went live',
                                short: 'Went live',
                                note: [
                                    'Of every nightly attempt, how many went live and replaced the live version.',
                                    sentence(retrains),
                                ].filter(Boolean).join(' '),
                                value: went,
                                tone: 'total',
                            },
                            {
                                key: 'score',
                                label: scoreName,
                                short: on.hold ? `${scoreOf(score).label}, ${holdLabel(on.hold).toLowerCase()}` : scoreOf(score).label,
                                note: [noteOf(score, task, on.hold), sentence(place)].filter(Boolean).join(' '),
                                value: formatScore(value, score),
                                tone: { better: 'good', worse: 'bad' }[stands],
                            },
                        ]}
                    />
                    <div className='model-summary-details'>
                        <p className={`model-score-line model-gap-${stands}`}>
                            {waiting ? against : <>{`${scoreName}: `}{against || formatScore(value, score)}</>}
                        </p>
                        {lossBy}
                        {status === 'down' ? <p className='model-down-line'>{`${sentence(checkWords(model.down))} ${down}`}</p> : null}
                        {checks ? <Checks table={checks} note={note} /> : null}
                        {trained
                            ? (
                                <p className='model-trained-line'>
                                    <span className='model-trained-name'>Trained on</span>
                                    <span className='model-trained-value'>{trained}</span>
                                </p>
                            ) : null}
                        {checked
                            ? (
                                <p className='model-trained-line model-fine-tune-line'>
                                    <span className='model-trained-name'>{FINE_TUNE}</span>
                                    <span className='model-trained-value'>{checked}</span>
                                </p>
                            ) : null}
                    </div>
                </div>
            </section>
        );
    }

    //
    // a report's chart, or a line saying why there is none. While the report is
    // on its way, its card's placeholder, `card` (#274), and for a screen reader
    // the line that used to be drawn
    //
    report(rows, what, card, chart) {
        if (rows === undefined) {
            return (
                <>
                    <p className='visually-hidden' role='status'>{`Loading the ${what}…`}</p>
                    <PendingChart {...card} />
                </>
            );
        }

        if (rows === null) {
            return <p className='model-status model-status-empty'>{`The ${what} could not be loaded.`}</p>;
        }

        return chart();
    }

    //
    // whether a model's attempts are said to be judged on the 1-day hold: a
    // stock model with holds (#300), whose held-out days have no longer results
    // yet. An options model's are judged on its loss, which adds up every hold
    // that is on
    //
    held(model, task) {
        return !tradesOptions(task) && Boolean(listedHolds(model).length || holdsOf(this.state.track).length);
    }

    //
    // the holds the page offers, and the one it is on now: the hold picked,
    // where it is offered, and the first otherwise -- as Combined, kept from a
    // stock model's page, is on an options model's (#300). Every model has some
    // (#311).
    //
    // Those the listing gives the model's scores on, from format 5 on (#300),
    // so the picker is there while the track record is on its way. Otherwise
    // those its track record has columns for (#279), and where it has none --
    // on its way, could not be had, or a stock model's before format 5 -- its
    // task's own (#311), so the picker is always there and does not arrive
    // after the page has.
    //
    // A hold with no result yet, `empty`, is offered grayed out until one comes
    // in, and the page stays on the first (#300) -- see scores.js's emptyHolds
    //
    holds(model, task) {
        const { track } = this.state;
        const listed = listedHolds(model);
        let holds = listed;

        if (!listed.length) {
            const columns = holdsOf(track);

            holds = columns.length ? columns : holdsFor(task);
        }

        const empty = emptyHolds(model, track, holds);
        const hold = holds.some((each) => each.days === this.props.hold) && !empty.includes(this.props.hold) ? this.props.hold : null;

        return { holds: holds, hold: hold || holds[0].days, empty: empty };
    }

    //
    // the models the track record's menu offers, by name: the others of its
    // task, and on a score of what each one's picks would have made, the models
    // of other tasks that name it, after them (#279)
    //
    others(model, score) {
        const { listing } = this.state;
        const named = (models) => models.map((each) => each.name).sort();

        return named(listing.models.filter((each) => each.task === model.task && each.name !== model.name))
            .concat(scoreOf(score).across
                ? named(listing.models.filter((each) => (
                    each.task !== model.task && scoresFor(listing.tasks.find((task) => task.id === each.task)).includes(score)
                )))
                : []);
    }

    //
    // the track record's chart, or a line saying why there is none: no day
    // scored yet, or none on the hold picked (#279) -- an options model's
    // results are in a trading day after its sell day, and a stock model's on
    // it (#300), said in the card in place of its chart. The chart is on the
    // hold where the record has its columns
    //
    trackRecord(model, task, score, holds) {
        const { history, track, other, other_rows } = this.state;
        const hold = holdsOf(track).some((each) => each.days === holds.hold) ? holds.hold : null;

        if (!track.length) {
            return <p className='model-status model-status-empty'>No days scored yet.</p>;
        }

        if (hold && !track.some((row) => scoreIn(row.score, columnOf(score, hold)) !== null)) {
            return <TrackNone title={trackTitle(score, hold)} message={noResultsYet(task, hold)} />;
        }

        //
        // the other model picked, while the menu still offers it: on another
        // score, another task's no longer is
        //
        const others = this.others(model, score);
        const offered = others.includes(other) ? other : null;

        return (
            <TrackChart
                name={model.name}
                rows={track}
                score={score}
                days={averageDays(model)}
                hold={hold}
                about={trackLine(task, hold)}
                others={others}
                other={offered}
                otherRows={offered ? other_rows : undefined}
                onOther={this.pickOther}
                wentLive={Array.isArray(history) ? history.filter((row) => row.went_live).map((row) => row.day) : []}
            />
        );
    }

    body() {
        const { name, scores, onScore, onHold } = this.props;
        const { listing, history, track } = this.state;

        //
        // while the listing is on its way, the page's own shape (#274): the
        // model's name, which the address holds, the score picker's name over
        // bars, as which scores it offers is its task's (#279), and bars where
        // its figures and its line will be -- see pending.jsx
        //
        if (listing === undefined) {
            return (
                <>
                    <p className='visually-hidden' role='status'>Loading the model&hellip;</p>
                    <div className='model-intro'>
                        <div className='model-heading'>
                            <h4>{name}</h4>
                            <PendingBar width='5.5rem' />
                        </div>
                        <span className='model-lede' aria-hidden='true'>
                            <PendingLines widths={['36rem', '22rem']} delay={STAGGER} />
                        </span>
                    </div>
                    <div className='model-controls'>
                        <PendingPicker />
                    </div>
                    <PendingSummary score={DEFAULT_SCORE} />
                    <PendingChart {...ATTEMPTS_CARD} />
                    <PendingChart {...TRACK_CARD} />
                </>
            );
        }

        if (listing === null) {
            return <p className='model-status model-status-empty'>No models to show yet.</p>;
        }

        const model = this.model();

        if (!model) {
            return (
                <div className='model-missing' role='status'>
                    <h4>Model not found</h4>
                    <p className='model-status'>{`There is no model named “${name}”.`}</p>
                </div>
            );
        }

        const task = listing.tasks.find((each) => each.id === model.task);
        const holds = this.holds(model, task);

        //
        // the score picked for the task, shown as loss on Combined where it is
        // one of the top 10's, which Combined has none of, and kept for another
        // hold (#300). A stock model says what its hold is under the pickers,
        // and shows its scores on each under the cards
        //
        const score = scoreOnHold(chosenScore(scores, task || { id: model.task }), holds.hold);
        const stock = !tradesOptions(task);

        //
        // a model the listing gives holds: its scores on each (#300), an options
        // model's too (#315), and last, for a stock model, when each one's
        // results come in
        //
        const listed = listedHolds(model).length > 0;

        return (
            <>
                <div className='model-intro'>
                    <div className='model-heading'>
                        <h4>{model.name}</h4>
                        <StatusPill model={model} />
                        <AlarmBell model={model} held={this.state.held} />
                    </div>
                    <span className='model-lede'>
                        {[
                            task ? task.description || `Predicts ${task.name.charAt(0).toLowerCase()}${task.name.slice(1)}.` : '',
                            model.description,
                        ].filter(Boolean).join(' ')}
                    </span>
                </div>
                <div className='model-controls'>
                    <ScorePicker
                        score={score}
                        onScore={(key) => onScore(model.task, key)}
                        offered={scoresFor(task)}
                        disabled={heldOut(task, holds.hold)}
                    />
                    <HoldPicker hold={holds.hold} onHold={onHold} holds={holds.holds} disabled={holds.empty} note={holdNote(task, holds.empty.length > 0)} />
                </div>
                {stock ? <p className='model-hold-line'>{holdLine(task, holds.hold)}</p> : null}
                {this.summary(model, task, score, holds.hold)}
                {listed ? <HoldsTable model={model} task={task} score={score} hold={holds.hold} /> : null}
                {this.report(history, 'nightly attempts', ATTEMPTS_CARD, () => (history.length
                    ? <AttemptsChart rows={history} score={score} held={this.held(model, task)} />
                    : <p className='model-status model-status-empty'>No nightly attempts yet.</p>))}
                {this.report(track, 'track record', TRACK_CARD, () => this.trackRecord(model, task, score, holds))}
                {stock && listed ? <WhenCard rows={whenRows(task, model, track, newYorkToday())} /> : null}
            </>
        );
    }

    render() {
        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container model-layout model-page'>
                    <Link className='model-back' to='/model'>&lsaquo; All models</Link>
                    {this.body()}
                </div>
            </ErrorBoundary>
        );
    }
}

//
// the name is read from the address here, since react-router's hooks cannot
// be called from a class, as graph.jsx does it. Keyed by the name, so moving
// from one model's page to another's starts the page over rather than leaving
// the first one's charts up under the second one's name
//
export default function ModelPageRoute(props) {
    const { model } = useParams();

    return <ModelPage key={model} {...props} name={model} />;
}

export { ModelPage };
