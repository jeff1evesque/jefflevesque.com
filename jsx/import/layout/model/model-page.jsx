/**
 * model-page.jsx: /model/:model, one model on its own (#243).
 *
 * Under the model's name, its status and what it predicts: the score picker
 * /model shares -- see redux/container/model.jsx -- and three figures: when its
 * live version went live, how many of its nightly attempts did, and its 20-day
 * score beside the baseline's and where it stands among the models of its task.
 * Then its two charts, each with a table of its numbers:
 *
 *     attempts-chart.jsx   every nightly attempt against the live version, and
 *                          how far each beat or missed it
 *     track-chart.jsx      every day it predicted, with another model of its
 *                          task picked from a menu, and a tick on each night
 *                          a new version went live
 *
 * The listing says who the model is; its history and its track record are asked
 * for once the listing names it. A name the listing does not hold is a model
 * that does not exist, and the page says so rather than drawing nothing.
 *
 * Note: the model api is built after this page (#243). Until it answers, the
 *       page says it has no models to show, as /model does.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import AttemptsChart from './attempts-chart.jsx';
import TrackChart from './track-chart.jsx';
import { ScorePicker, StatusPill } from './parts.jsx';
import { loadListing, loadReport } from './source.js';
import {
    DEFAULT_SCORE,
    WINDOW,
    betterBy,
    formatGap,
    formatScore,
    liveKind,
    scoreOf,
    shortDay,
    sortModels,
    standing,
    statusOf,
} from './scores.js';

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
 * the live version, as the first figure says it: when it went live, and how.
 */
export function liveFigure(model) {
    if (statusOf(model) === 'retired') {
        return {
            value: `Retired ${shortDay(model.retired)}`,
            detail: model.live.since ? `its last version went live ${shortDay(model.live.since)}` : 'no longer trained',
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
        const { history, listing } = this.state;
        const live = liveFigure(model);
        const value = model.score ? model.score[score] : null;
        const baseline = model.baseline ? model.baseline[score] : null;
        const gap = betterBy(value, baseline, score);
        const stands = standing(gap, score);
        const weekly = Array.isArray(history) ? history.filter((row) => row.kind === 'weekly') : [];
        const place = placeAmong(model, listing.models, task, score);
        const scoreName = statusOf(model) === 'new'
            ? `${scoreOf(score).label}, ${model.scored_days} ${model.scored_days === 1 ? 'day' : 'days'} so far`
            : `${scoreOf(score).label}, last ${WINDOW} days`;

        let against = '';

        if (gap !== null) {
            against = stands === 'level'
                ? `level with the baseline, ${formatScore(baseline, score)}`
                : `${formatGap(gap, score)} ${stands} than the baseline, ${formatScore(baseline, score)}`;
        }

        return (
            <section className='model-summary' aria-label='Summary'>
                <div className='model-stat'>
                    <span className='model-stat-label'>Live version</span>
                    <span className='model-stat-value'>{live.value}</span>
                    <span className='model-stat-detail'>{live.detail}</span>
                </div>
                <div className='model-stat'>
                    <span className='model-stat-label'>Attempts that went live</span>
                    <span className='model-stat-value'>{`${model.attempts.went_live} of ${model.attempts.total}`}</span>
                    <span className='model-stat-detail'>
                        {weekly.length
                            ? `weekly retrains: ${weekly.filter((row) => row.went_live).length} of ${weekly.length}`
                            : 'nightly attempts'}
                    </span>
                </div>
                <div className='model-stat'>
                    <span className='model-stat-label'>{scoreName}</span>
                    <span className='model-stat-value'>{formatScore(value, score)}</span>
                    <span className={`model-stat-detail model-gap-${stands}`}>{against}</span>
                    {place ? <span className='model-stat-detail'>{place}</span> : null}
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
