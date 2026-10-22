/**
 * model-page.jsx: /model/:model, one model on its own (#243).
 *
 * Under the model's name, its status and what it predicts: the score picker
 * /model shares -- see redux/container/model.jsx -- and three figures: when its
 * live version went live, how many of its nightly attempts did, and its 20-day
 * score beside the baseline's and where it stands among the models of its task.
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
 * know-nothing baseline (#263). The first figure then says when, and which check
 * did it, and that nothing predicts until a new version beats the baseline; and
 * under the score, how many days in a row each check has been worse, for any
 * model that has not retired. A listing before format 2 says neither, and the
 * figures are as they were.
 *
 * The score picker offers the scores the model's task has (#279). An options
 * model's page has a hold picker beside it, which the track record follows --
 * the attempts are scored on the plain scores, which decide what goes live --
 * its checks say which hold each is of, and after the charts are its picks: see
 * option-picks.jsx. On a score of what each model's picks would have made, the
 * track record's menu offers the models of other tasks too.
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
import TrackChart, { HEIGHT as TRACK_HEIGHT, TITLE as TRACK_TITLE } from './track-chart.jsx';
import OptionPicks from './option-picks.jsx';
import { AlarmBell, HoldPicker, ScorePicker, StatusPill, modelsHeld } from './parts.jsx';
import { loadListing, loadReport } from './source.js';
import { PendingChart, PendingLines, PendingPicker, PendingSummary, STAGGER } from './pending.jsx';
import { PendingBar } from '../graph/pending.jsx';
import { listSubscriptions } from '../../general/account-api.js';
import {
    DEFAULT_HOLD,
    DEFAULT_SCORE,
    HOLDS,
    WINDOW,
    behindLine,
    behindRows,
    betterBy,
    checkWords,
    chosenScore,
    columnOf,
    formatDuration,
    formatGap,
    formatScore,
    formatStarted,
    holdsOf,
    liveKind,
    lossParts,
    noteOf,
    scoreIn,
    scoreOf,
    scoresFor,
    shortDay,
    sortModels,
    standing,
    statusOf,
    takenDown,
    tradesOptions,
} from './scores.js';

//
// what a model whose live version was taken down does until it goes live again
// (#263): a version goes live again only if it beats the baseline on the days it
// was tested on
//
const DOWN_LINE = 'Nothing predicts until a new version beats the baseline on the days it was tested on.';

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
 * where it is the only one, or has no score to stand by.
 */
export function rankAmong(model, models, task, score) {
    const scored = models.filter((each) => (
        each.task === model.task && each.score && Number.isFinite(each.score[score])
    ));

    if (scored.length < 2 || !scored.includes(model)) {
        return null;
    }

    const place = sortModels(scored, 'score', score).indexOf(model) + 1;

    return { rank: `${ordinal(place)} of ${scored.length}`, among: `${task ? task.name : model.task} models` };
}

/**
 * the same as one line, as a phone's note says it: '2nd of 3 Next-day direction
 * models', or ''.
 */
export function placeAmong(model, models, task, score) {
    const place = rankAmong(model, models, task, score);

    return place ? `${place.rank} ${place.among}` : '';
}

/**
 * the live version, as the first figure says it: when it went live, and how --
 * or, for one the trainer took down, when, and the check that did it (#263).
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
        detail: `went live after a ${liveKind(model.live.kind)}`,
    };
}

//
// a figure's line as a sentence of its note, where a phone has no room for the
// line under the figure: 'went live after a weekly retrain' as 'Went live after
// a weekly retrain.', and nothing for no line
//
export function sentence(line) {
    return line ? `${line.charAt(0).toUpperCase()}${line.slice(1)}.` : '';
}

//
// what a model whose live version was taken down does until it goes live again,
// under its figure on a wide screen (#267). Its rows show the check that took it
// down, so the line says only what happens next
//
const DOWN_SHORT = 'Nothing predicts until a version beats the baseline.';

/**
 * the line under the Live version card's figure on a wide screen (#267): how the
 * live version came to be live, as liveFigure says it, or for one taken down,
 * what happens until a version beats the baseline.
 */
export function liveLine(model) {
    return statusOf(model) === 'down' ? DOWN_SHORT : liveFigure(model).detail;
}

/**
 * the Live version card's rows on a wide screen (#267), each { key, name, value },
 * or a heading { key, name, head: true } over the rows after it:
 *
 *     Beat the version it replaced by     how much lower its loss was than the
 *                                         version before it, on the night it went
 *                                         live: loss, which decides what goes
 *                                         live, whatever score is picked
 *     First predicted                     the listing's `started`
 *     Days in a row worse than the        a heading over a row per check -- see
 *     baseline                            behindRows
 *
 * No first row for a first version, one taken down, a retired model, a night the
 * history does not hold, or a version that only matched the one before it. No
 * checks for a retired model, or a listing that gives none, as before format 2.
 */
export function liveRows(model, history) {
    const status = statusOf(model);
    const rows = [];

    if ((status === 'live' || status === 'new') && model.live.kind && model.live.kind !== 'first' && Array.isArray(history)) {
        const night = history.find((row) => row.day === model.live.since && row.went_live);
        const gap = night ? betterBy(night.attempt.loss, night.live.loss, 'loss') : null;

        if (standing(gap, 'loss') === 'better') {
            rows.push({ key: 'beat', name: 'Beat the version it replaced by', value: formatGap(gap, 'loss') });
        }
    }

    if (model.started) {
        rows.push({ key: 'started', name: 'First predicted', value: shortDay(model.started) });
    }

    const checks = status === 'retired' ? [] : behindRows(model.behind);

    return checks.length
        ? rows.concat([{ key: 'checks', name: 'Days in a row worse than the baseline', head: true }], checks)
        : rows;
}

/**
 * the line under the Attempts card's figure on a wide screen (#267): how far
 * back its count goes, 'every attempt since Oct 9', the history's first night --
 * or 'nightly attempts' where there is no history to say.
 */
export function attemptsLine(history) {
    return Array.isArray(history) && history.length ? `every attempt since ${shortDay(history[0].day)}` : 'nightly attempts';
}

/**
 * the Attempts card's rows on a wide screen (#267), as liveRows gives them: how
 * many nightly updates and weekly retrains went live, of how many -- a kind with
 * no attempts has no row -- then the newest night, under 'Last attempt, Oct 19':
 * whether it went live, and when it started and how long it took, where the
 * history has its times. None where there is no history.
 */
export function attemptRows(history) {
    if (!Array.isArray(history) || !history.length) {
        return [];
    }

    const rows = [];

    [['nightly', 'Nightly updates'], ['weekly', 'Weekly retrains']].forEach(([kind, name]) => {
        const nights = history.filter((row) => row.kind === kind);

        if (nights.length) {
            rows.push({ key: kind, name: name, value: `${nights.filter((row) => row.went_live).length} of ${nights.length}` });
        }
    });

    const last = history[history.length - 1];
    const times = [
        { key: 'started', name: 'Started', value: formatStarted(last.started) },
        { key: 'took', name: 'Took', value: formatDuration(last.total_seconds) },
    ];

    return rows.concat(
        [
            { key: 'last', name: `Last attempt, ${shortDay(last.day)}`, head: true },
            { key: 'result', name: 'Result', value: last.went_live ? 'went live' : 'kept back' },
        ],
        times.filter((row) => row.value),
    );
}

/**
 * a card's rows on a wide screen, under a thin rule (#267), drawn as loss's parts
 * are: a name at the left and its value at the right, and a heading in gray over
 * the rows after it. `children` come after the rows: the Loss card's parts.
 * Nothing, not even the rule, where there are neither.
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
                            <li key={row.key} className={row.head ? 'model-stat-row model-stat-row-head' : 'model-stat-row'}>
                                <span className='model-stat-row-name'>{row.name}</span>
                                {row.head ? null : <span className='model-stat-row-value'>{row.value}</span>}
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
        value: PropTypes.string,
        head: PropTypes.bool,
    })).isRequired,
    children: PropTypes.node,
};

//
// how a part of loss stands against the baseline's, in words before the
// baseline's figure, as the score's card says its own: 'worse than baseline'
//
const PART_STANDS = {
    better: 'better than baseline',
    worse: 'worse than baseline',
    level: 'level with baseline',
};

/**
 * the three scores loss adds up (#265), under the score's figure while Loss is
 * picked: each part's 20-day average, and how it stands against the baseline's
 * beside the baseline's own -- 'Up or down 0.723 worse than baseline 0.713'.
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
                        {part.stands
                            ? (
                                <span className={`model-part-baseline model-gap-${part.stands}`}>
                                    {`${PART_STANDS[part.stands]} ${formatScore(part.baseline, 'loss')}`}
                                </span>
                            ) : null}
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

class ModelPage extends Component {
    static propTypes = {
        //
        // the model's name, as the address holds it
        //
        name: PropTypes.string.isRequired,
        //
        // the score shown for each task, and the way to choose another for one,
        // as /model's lists are (#279), and the hold an options model's track
        // record is drawn on, and the way to choose another -- the store's, see
        // redux/container/model.jsx
        //
        scores: PropTypes.objectOf(PropTypes.string),
        onScore: PropTypes.func,
        hold: PropTypes.number,
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
                ['history', 'track'].forEach((field) => {
                    loadReport(this.props.name, field === 'track' ? 'track-record' : field).then((rows) => {
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

        loadReport(name, 'track-record').then((rows) => {
            if (this.alive && this.state.other === name) {
                this.setState({ other_rows: rows });
            }
        });
    }

    //
    // the three figures over the charts, on `score`
    //
    summary(model, task, score) {
        const { history, listing, track } = this.state;
        const status = statusOf(model);
        const live = liveFigure(model);
        const value = scoreIn(model.score, score);
        const baseline = scoreIn(model.baseline, score);
        const gap = betterBy(value, baseline, score);
        const stands = standing(gap, score);
        const weekly = Array.isArray(history) ? history.filter((row) => row.kind === 'weekly') : [];
        const retrains = weekly.length ? `weekly retrains: ${weekly.filter((row) => row.went_live).length} of ${weekly.length}` : '';
        const went = `${model.attempts.went_live} of ${model.attempts.total}`;
        const rank = rankAmong(model, listing.models, task, score);
        const place = placeAmong(model, listing.models, task, score);

        //
        // so far, for a model with fewer than 20 scored days: a new one, or one
        // taken down before it had them (#263)
        //
        const scoreName = status !== 'retired' && model.scored_days < WINDOW
            ? `${scoreOf(score).label}, ${model.scored_days} ${model.scored_days === 1 ? 'day' : 'days'} so far`
            : `${scoreOf(score).label}, last ${WINDOW} days`;

        //
        // what a model taken down does until it goes live again, and how close
        // each check is to taking a model down, for any model still trained
        // (#263), as a phone's notes say them. A wide screen's cards say them in
        // their rows (#267)
        //
        const down = status === 'down' ? DOWN_LINE : '';
        const behind = status === 'retired' ? '' : behindLine(model.behind);

        let against = '';

        if (gap !== null) {
            against = stands === 'level'
                ? `level with the baseline, ${formatScore(baseline, score)}`
                : `${formatGap(gap, score)} ${stands} than the baseline, ${formatScore(baseline, score)}`;
        }

        //
        // the three scores loss adds up, while Loss is picked (#265), from the
        // track record's newest day: none while the track record is on its way,
        // where it could not be had, and where it has no columns for them
        //
        const parts = score === 'loss' && Array.isArray(track) && track.length ? lossParts(track[track.length - 1]) : [];
        const lossBy = parts.length ? <LossParts parts={parts} /> : null;

        //
        // the score card's rows on a wide screen: its place among its task's
        // models, then a heading over the parts of loss, as the other two cards
        // head theirs (#272) -- the place ran straight into them
        //
        const scoreRows = (rank ? [{ key: 'place', name: `Among ${rank.among}`, value: rank.rank }] : [])
            .concat(parts.length ? [{ key: 'parts', name: 'Loss, part by part', head: true }] : []);

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
        // models; on a phone they go under the boxes (#265)
        //
        return (
            <section className='model-summary' aria-label='Summary'>
                <div className='model-summary-cards'>
                    <div className='model-stat'>
                        <div className='model-stat-head'>
                            <span className='model-stat-label'>Live version</span>
                            <span className='model-stat-value'>{live.value}</span>
                            <span className='model-stat-detail'>{liveLine(model)}</span>
                        </div>
                        <CardRows rows={liveRows(model, history)} />
                    </div>
                    <div className='model-stat'>
                        <div className='model-stat-head'>
                            <span className='model-stat-label'>Attempts that went live</span>
                            <span className='model-stat-value'>{went}</span>
                            <span className='model-stat-detail'>{attemptsLine(history)}</span>
                        </div>
                        <CardRows rows={attemptRows(history)} />
                    </div>
                    <div className='model-stat'>
                        <div className='model-stat-head'>
                            <InfoNote note={noteOf(score, task)} className='model-stat-label model-noted'>{scoreName}</InfoNote>
                            <span className='model-stat-value'>{formatScore(value, score)}</span>
                            <span className={`model-stat-detail model-gap-${stands}`}>{against}</span>
                        </div>
                        <CardRows rows={scoreRows}>{lossBy}</CardRows>
                    </div>
                </div>
                <div className='model-summary-boxes'>
                    <FigureBoxes
                        figures={[
                            {
                                key: 'live',
                                label: 'Live version',
                                note: [sentence(live.detail), down].filter(Boolean).join(' '),
                                value: live.value,
                                ...downBox,
                            },
                            {
                                key: 'went',
                                label: 'Attempts that went live',
                                short: 'Went live',
                                note: [
                                    'Of every nightly attempt, how many scored a loss no higher than the live version’s and replaced it.',
                                    sentence(retrains),
                                ].filter(Boolean).join(' '),
                                value: went,
                                tone: 'total',
                            },
                            {
                                key: 'score',
                                label: scoreName,
                                short: scoreOf(score).label,
                                note: [noteOf(score, task), sentence(against), sentence(place), behind].filter(Boolean).join(' '),
                                value: formatScore(value, score),
                                tone: { better: 'good', worse: 'bad' }[stands],
                            },
                        ]}
                    />
                    {lossBy}
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
    // the holds an options model's track record is drawn on (#279), and the one
    // it is drawn on now: the hold picked, where the record has it, and its
    // first otherwise. While the record is on its way, the three, for a task
    // that trades options, so the picker does not arrive after the page has;
    // and none for a model with no holds
    //
    holds(task) {
        const { track } = this.state;
        const holds = track === undefined && tradesOptions(task) ? HOLDS : holdsOf(track);
        const hold = holds.some((each) => each.days === this.props.hold) ? this.props.hold : null;

        return { holds: holds, hold: hold || (holds.length ? holds[0].days : null) };
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
    // scored yet, or none on the hold picked (#279) -- each of its results is
    // in a trading day after its sell day
    //
    trackRecord(model, score, holds) {
        const { history, track, other, other_rows } = this.state;
        const hold = holdsOf(track).length ? holds.hold : null;

        if (!track.length) {
            return <p className='model-status model-status-empty'>No days scored yet.</p>;
        }

        if (hold && !track.some((row) => scoreIn(row.score, columnOf(score, hold)) !== null)) {
            return (
                <p className='model-status model-status-empty'>
                    {`No ${hold}-day results yet: each one comes in ${hold + 1} trading days after its prediction.`}
                </p>
            );
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
                hold={hold}
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
        const score = chosenScore(scores, task || { id: model.task });
        const holds = this.holds(task);

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
                    <ScorePicker score={score} onScore={(key) => onScore(model.task, key)} offered={scoresFor(task)} />
                    {holds.holds.length ? <HoldPicker hold={holds.hold} onHold={onHold} holds={holds.holds} /> : null}
                </div>
                {this.summary(model, task, score)}
                {this.report(history, 'nightly attempts', ATTEMPTS_CARD, () => (history.length
                    ? <AttemptsChart rows={history} score={score} />
                    : <p className='model-status model-status-empty'>No nightly attempts yet.</p>))}
                {this.report(track, 'track record', TRACK_CARD, () => this.trackRecord(model, score, holds))}
                {tradesOptions(task) ? <OptionPicks name={model.name} /> : null}
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
