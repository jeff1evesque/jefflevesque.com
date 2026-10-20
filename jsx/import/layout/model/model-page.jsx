/**
 * model-page.jsx: /model/:model, one model on its own (#243).
 *
 * Under the model's name, its status and what it predicts: the score picker
 * /model shares -- see redux/container/model.jsx -- and three figures: when its
 * live version went live, how many of its nightly attempts did, and its 20-day
 * score beside the baseline's and where it stands among the models of its task.
 * The score's name carries a note on what it measures, and while Loss is picked,
 * the three scores it adds up are under it (#265). Then its two charts, each with
 * a table of its numbers:
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
import AttemptsChart from './attempts-chart.jsx';
import TrackChart from './track-chart.jsx';
import { AlarmBell, ScorePicker, StatusPill, modelsHeld } from './parts.jsx';
import { loadListing, loadReport } from './source.js';
import { listSubscriptions } from '../../general/account-api.js';
import {
    DEFAULT_SCORE,
    WINDOW,
    behindLine,
    betterBy,
    checkWords,
    formatGap,
    formatScore,
    liveKind,
    lossParts,
    scoreOf,
    shortDay,
    sortModels,
    standing,
    statusOf,
    takenDown,
} from './scores.js';

//
// what a model whose live version was taken down does until it goes live again
// (#263): a version goes live again only if it beats the baseline on the days it
// was tested on
//
const DOWN_LINE = 'Nothing predicts until a new version beats the baseline on the days it was tested on.';

//
// 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st
//
export function ordinal(place) {
    const teen = place % 100 >= 11 && place % 100 <= 13;
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[place % 10];

    return `${place}${!teen && suffix ? suffix : 'th'}`;
}

/**
 * where `model` stands among the models of its task on `score`: '2nd of 3
 * Next-day direction models', or '' where it is the only one, or has no score
 * to stand by.
 */
export function placeAmong(model, models, task, score) {
    const scored = models.filter((each) => (
        each.task === model.task && each.score && Number.isFinite(each.score[score])
    ));

    if (scored.length < 2 || !scored.includes(model)) {
        return '';
    }

    const place = sortModels(scored, 'score', score).indexOf(model) + 1;

    return `${ordinal(place)} of ${scored.length} ${task ? task.name : model.task} models`;
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
        score: PropTypes.string,
        onScore: PropTypes.func,
    }

    static defaultProps = {
        score: DEFAULT_SCORE,
        onScore: () => {},
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
    // the three figures over the charts
    //
    summary(model, task) {
        const { score } = this.props;
        const { history, listing, track } = this.state;
        const status = statusOf(model);
        const live = liveFigure(model);
        const value = model.score ? model.score[score] : null;
        const baseline = model.baseline ? model.baseline[score] : null;
        const gap = betterBy(value, baseline, score);
        const stands = standing(gap, score);
        const weekly = Array.isArray(history) ? history.filter((row) => row.kind === 'weekly') : [];
        const retrains = weekly.length ? `weekly retrains: ${weekly.filter((row) => row.went_live).length} of ${weekly.length}` : '';
        const went = `${model.attempts.went_live} of ${model.attempts.total}`;
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
        // each check is to taking a model down, for any model still trained (#263)
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
        // the three figures: a card each on a wide screen, and on a phone one
        // row of /stream's tinted boxes, a name over a value, with the line under
        // each card's value moved into its box's note -- three cards stacked
        // took a phone's whole first screen (#253). The parts of loss go under
        // the score's card, and on a phone under the boxes (#265)
        //
        return (
            <section className='model-summary' aria-label='Summary'>
                <div className='model-summary-cards'>
                    <div className='model-stat'>
                        <span className='model-stat-label'>Live version</span>
                        <span className='model-stat-value'>{live.value}</span>
                        <span className='model-stat-detail'>{live.detail}</span>
                        {down ? <span className='model-stat-detail'>{down}</span> : null}
                    </div>
                    <div className='model-stat'>
                        <span className='model-stat-label'>Attempts that went live</span>
                        <span className='model-stat-value'>{went}</span>
                        <span className='model-stat-detail'>{retrains || 'nightly attempts'}</span>
                    </div>
                    <div className='model-stat'>
                        <InfoNote note={scoreOf(score).note} className='model-stat-label model-noted'>{scoreName}</InfoNote>
                        <span className='model-stat-value'>{formatScore(value, score)}</span>
                        <span className={`model-stat-detail model-gap-${stands}`}>{against}</span>
                        {place ? <span className='model-stat-detail'>{place}</span> : null}
                        {behind ? <span className='model-stat-detail'>{behind}</span> : null}
                    </div>
                    {lossBy}
                </div>
                <div className='model-summary-boxes'>
                    <FigureBoxes
                        figures={[
                            {
                                key: 'live',
                                label: 'Live version',
                                note: [sentence(live.detail), down].filter(Boolean).join(' '),
                                value: live.value,
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
                                note: [scoreOf(score).note, sentence(against), sentence(place), behind].filter(Boolean).join(' '),
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
    // a report's chart, or a line saying why there is none
    //
    report(rows, what, chart) {
        if (rows === undefined) {
            return <p className='model-status'>{`Loading the ${what}…`}</p>;
        }

        if (rows === null) {
            return <p className='model-status model-status-empty'>{`The ${what} could not be loaded.`}</p>;
        }

        return chart();
    }

    body() {
        const { name, score, onScore } = this.props;
        const { listing, history, track, other, other_rows } = this.state;

        if (listing === undefined) {
            return <p className='model-status'>Loading the model&hellip;</p>;
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
        const others = listing.models
            .filter((each) => each.task === model.task && each.name !== model.name)
            .map((each) => each.name)
            .sort();

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
                    <ScorePicker score={score} onScore={onScore} />
                </div>
                {this.summary(model, task)}
                {this.report(history, 'nightly attempts', () => (history.length
                    ? <AttemptsChart rows={history} score={score} />
                    : <p className='model-status model-status-empty'>No nightly attempts yet.</p>))}
                {this.report(track, 'track record', () => (track.length
                    ? (
                        <TrackChart
                            name={model.name}
                            rows={track}
                            score={score}
                            others={others}
                            other={other}
                            otherRows={other_rows}
                            onOther={this.pickOther}
                            wentLive={Array.isArray(history) ? history.filter((row) => row.went_live).map((row) => row.day) : []}
                        />
                    ) : <p className='model-status model-status-empty'>No days scored yet.</p>))}
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
