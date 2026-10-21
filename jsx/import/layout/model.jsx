/**
 * model.jsx: /model, every model trained each night and how it scores (#243).
 *
 * Under its title, two sentences say what the models are for, what they read
 * and what they predict, linking the knowledge graph and the data it is built
 * from (#251). One list per task -- what a model predicts -- beside a column of
 * filters, by task and by status, which folds to a rail as /graph's columns do
 * and is a folded band on a phone (#251). Every row carries the
 * model's latest 20-day score against the know-nothing baseline, and a trend
 * line of it; see model/model-row.jsx. The score picker chooses which of the four
 * scores the rows, their trend lines and the comparison show, and is shared with
 * each model's own page -- see redux/container/model.jsx -- and a sort menu
 * orders every list alike. The heading over the score's column carries a note on
 * what the score measures (#265).
 *
 * Ticking two or three models of one task draws their track records on one chart
 * over the lists; see model/compare-chart.jsx. A model of another task cannot be
 * ticked beside them, and neither can a fourth. The address carries what is
 * ticked, '?compare=a,b', so a comparison can be linked, and the page reopens it.
 *
 * Each row's bell leads to its model's alarm page, and rings for a reader who holds
 * the alarm (#255). The reader's subscriptions are asked for once, for every row, as
 * /stream asks for its own; signed out, or where they could not be had, every bell
 * is plain.
 *
 * Note: the listing says everything a row prints but its trend line, so the
 *       lists, the filters and the sort are drawn from it alone, and each row's
 *       track record fills its trend line in as it arrives.
 *
 * Note: the model api is built after this page (#243). Until it answers, the
 *       page says it has no models to show, rather than that something failed:
 *       for a reader, there are none.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ErrorFallback from '../formatter/boundary-error.jsx';
import InfoNote from '../general/info-note.jsx';
import ModelRow from './model/model-row.jsx';
import CompareChart from './model/compare-chart.jsx';
import { ScorePicker, isPhone, modelsHeld } from './model/parts.jsx';
import { PendingGroup, STAGGER } from './model/pending.jsx';
import { PendingBar } from './graph/pending.jsx';
import { readLayout, writeLayout } from '../general/layout-preference.js';
import { listSubscriptions } from '../general/account-api.js';
import { loadListing, loadReport } from './model/source.js';
import {
    DEFAULT_SCORE,
    SORTS,
    STATUSES,
    TREND_DAYS,
    compareBlocked,
    recentDays,
    scoreOf,
    sortModels,
    statusOf,
} from './model/scores.js';

/**
 * the comparison an address names -- '?compare=a,b' -- as the models it ticks,
 * each with the color slot it is drawn in: the first named the first color. A
 * name the listing does not hold is passed over, and so is one that could not be
 * ticked beside those before it: another task's, or a fourth.
 *
 * Note: names are joined by commas, which no model's name holds.
 */
export function linkedCompare(search, models) {
    const asked = (new URLSearchParams(search).get('compare') || '').split(',').map((name) => name.trim());
    const ticked = [];

    asked.forEach((name) => {
        const model = models.find((each) => each.name === name);

        if (model && !ticked.includes(model) && !compareBlocked(model, ticked)) {
            ticked.push(model);
        }
    });

    return ticked.map((model, slot) => ({ name: model.name, slot: slot }));
}

/**
 * the address with the comparison in it: the names ticked, in the order of
 * their colors, or no '?compare=' where none is. Put in place of the address
 * rather than pushed, so the back button leaves the page rather than unticking
 * one box at a time, as /stream's window is. Anything else the address carries
 * is kept, and an address that already says it is left as it is.
 *
 * Note: the commas are written as commas. URLSearchParams escapes them, and
 *       '?compare=a%2Cb' is the same address, harder to read.
 */
export function writeCompare(names) {
    const params = new URLSearchParams(window.location.search);

    if (names.length) {
        params.set('compare', names.join(','));
    } else {
        params.delete('compare');
    }

    const search = params.toString().replace(/%2C/gi, ',');
    const address = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;

    if (address !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.replaceState(window.history.state, '', address);
    }
}

//
// how the filters' column is kept between visits -- see layout-preference.js --
// apart on a phone and a wide screen, as /graph keeps its columns
//
const LAYOUT = 'model';

//
// how wide the filters' column may be dragged, in px against the site's 14px
// rem: from 10rem to 22rem, room for a longer task's name than this page has
// yet, against the 14rem it opens at. A drag that goes FILTERS_FOLD past the
// narrowest folds the column into its rail, as /graph's columns fold
//
const FILTERS_MIN = 140;
const FILTERS_MAX = 308;
const FILTERS_FOLD = 48;

//
// how to start a comparison, over the lists until a model is ticked, and while
// the listing is on its way
//
const HINT = 'Tick two or three models that predict the same thing to compare them.';

class ModelLayout extends Component {
    static propTypes = {
        //
        // the score shown, and the way to choose another: the store's, shared
        // with each model's own page -- see redux/container/model.jsx
        //
        score: PropTypes.string,
        onScore: PropTypes.func,
    }

    static defaultProps = {
        score: DEFAULT_SCORE,
        onScore: () => {},
    }

    constructor(props) {
        super(props);

        const phone = isPhone();
        const kept = readLayout(LAYOUT, phone ? 'narrow' : 'wide');

        this.state = {
            // the listing: undefined while it is on its way, null where it
            // could not be had, and { tasks, models } once it is in
            listing: undefined,
            // each model's track record by name, once it is in: its rows, or
            // null where it could not be had. A name not here is on its way
            records: {},
            // the tasks and statuses unticked in the filters
            hidden_tasks: [],
            hidden_statuses: [],
            sort: 'score',
            // the models ticked to compare, each with its color slot, in the
            // order of the slots
            picked: [],
            // the names of the models whose alarms the reader holds, which ring
            // their bells: none until the subscriptions arrive, and none signed
            // out -- see loadSubscriptions
            subscribed: [],
            // whether the filters' column is open, and how wide it was dragged:
            // as this browser kept them, and otherwise open on a wide screen at
            // its own width, and folded on a phone until its band is tapped
            filters_open: phone ? kept.fold.filters === false : kept.fold.filters !== true,
            filters_width: kept.size.filters >= FILTERS_MIN && kept.size.filters <= FILTERS_MAX ? kept.size.filters : null,
        };

        this.pick = this.pick.bind(this);
        this.clear = this.clear.bind(this);
        this.toggleFilters = this.toggleFilters.bind(this);
        this.startDrag = this.startDrag.bind(this);
        this.onDrag = this.onDrag.bind(this);
        this.releaseDrag = this.releaseDrag.bind(this);
        this.toggleFilter = this.toggleFilter.bind(this);
        this.loadRecord = this.loadRecord.bind(this);
        this.loadSubscriptions = this.loadSubscriptions.bind(this);
    }

    componentDidMount() {
        this.alive = true;

        loadListing().then((listing) => {
            if (!this.alive) {
                return;
            }

            const picked = listing ? linkedCompare(window.location.search, listing.models) : [];

            this.setState({ listing: listing, picked: picked }, () => {
                if (!listing) {
                    return;
                }

                writeCompare(picked.map((each) => each.name));
                listing.models.forEach((model) => this.loadRecord(model.name));
            });
        });

        this.loadSubscriptions();
    }

    //
    // which models' alarms the reader holds, for the bells, asked once for every
    // row. Signed out, or asking a service that could not answer, every bell stays
    // plain: a bell that cannot say anything says nothing, as on /stream
    //
    loadSubscriptions() {
        listSubscriptions()
            .then((subscriptions) => {
                if (this.alive) {
                    this.setState({ subscribed: modelsHeld(subscriptions) });
                }
            })
            .catch((error) => {
                console.log(`Error (account api): the subscriptions could not be listed, ${error.message}`);
            });
    }

    componentWillUnmount() {
        this.alive = false;
        this.endDrag();
    }

    //
    // how the filters' column is arranged, kept for the next visit: folded or
    // open, and the width it was dragged to
    //
    saveLayout() {
        const { filters_open, filters_width } = this.state;

        writeLayout(LAYOUT, isPhone() ? 'narrow' : 'wide', {
            fold: { filters: !filters_open },
            size: filters_width ? { filters: filters_width } : {},
        });
    }

    toggleFilters() {
        this.setState((state) => ({ filters_open: !state.filters_open }), () => this.saveLayout());
    }

    //
    // the strip on the column's edge dragged: the column follows the pointer
    // between its narrowest and widest, and folds into its rail once dragged
    // well past the narrowest. Kept when the pointer comes up, rather than on
    // each of the hundred moves before it -- see graph.jsx's releaseDrag
    //
    startDrag(event) {
        if (event.button !== 0) {
            return;
        }

        this.drag = { from: event.clientX, start: event.currentTarget.parentNode.offsetWidth };
        window.addEventListener('pointermove', this.onDrag);
        window.addEventListener('pointerup', this.releaseDrag);
        event.preventDefault();
    }

    onDrag(event) {
        const wanted = this.drag.start + (event.clientX - this.drag.from);

        if (wanted < FILTERS_MIN - FILTERS_FOLD) {
            this.endDrag();
            this.setState({ filters_open: false, filters_width: null }, () => this.saveLayout());

            return;
        }

        this.setState({ filters_width: Math.min(Math.max(wanted, FILTERS_MIN), FILTERS_MAX) });
    }

    endDrag() {
        window.removeEventListener('pointermove', this.onDrag);
        window.removeEventListener('pointerup', this.releaseDrag);
        this.drag = null;
    }

    releaseDrag() {
        this.endDrag();
        this.saveLayout();
    }

    loadRecord(name) {
        loadReport(name, 'track-record').then((rows) => {
            if (this.alive) {
                this.setState((state) => ({ records: { ...state.records, [name]: rows } }));
            }
        });
    }

    //
    // the models ticked, as the listing holds them
    //
    chosen() {
        const { listing, picked } = this.state;

        return picked.map((each) => listing.models.find((model) => model.name === each.name));
    }

    /**
     * a model ticked or unticked for the comparison.
     *
     * A model ticked takes the first color no other ticked model holds, and
     * keeps it while it stays ticked, so unticking one leaves the others as they
     * were drawn. One that cannot be ticked -- see compareBlocked -- is left as
     * it is: its box is disabled, and says why.
     */
    pick(model) {
        const { picked } = this.state;
        let next;

        if (picked.some((each) => each.name === model.name)) {
            next = picked.filter((each) => each.name !== model.name);
        } else {
            if (compareBlocked(model, this.chosen())) {
                return;
            }

            const used = picked.map((each) => each.slot);
            let slot = 0;

            while (used.includes(slot)) {
                slot += 1;
            }

            next = picked.concat([{ name: model.name, slot: slot }]).sort((a, b) => a.slot - b.slot);
        }

        this.setState({ picked: next }, () => writeCompare(next.map((each) => each.name)));
    }

    clear() {
        this.setState({ picked: [] }, () => writeCompare([]));
    }

    toggleFilter(list, value) {
        this.setState((state) => ({
            [list]: state[list].includes(value)
                ? state[list].filter((each) => each !== value)
                : state[list].concat([value]),
        }));
    }

    //
    // the filters: what a model predicts, and its status, each a row that is
    // pressed while its models are shown, with how many models it holds. In a
    // column that folds to a rail as /graph's do, by its heading or the arrow
    // on its edge, and a band over the lists on a phone. While the listing is
    // on its way, the same column, open or folded as this browser kept it,
    // with a bar where the band says how many models it shows (#274)
    //
    filters() {
        const { listing, filters_open, filters_width } = this.state;
        const toggle = this.toggleFilters;
        let summary = <PendingBar width='4.5rem' />;

        if (listing) {
            const shown = this.shown().length;
            const all = listing.models.length;

            summary = shown === all ? `${all} models` : `${shown} of ${all} models`;
        }

        return (
            <aside
                className={`model-filters ${filters_open ? 'model-filters-open' : 'model-filters-closed'}`}
                style={filters_open && filters_width ? { '--model-filters-width': `${filters_width}px` } : undefined}
                aria-label='Filters'
            >
                <h6 className='model-filters-heading'>
                    <button
                        type='button'
                        className='model-filters-toggle'
                        aria-expanded={filters_open}
                        aria-controls='model-filter-sets'
                        onClick={toggle}
                    >
                        <span className='model-filters-title'>Filters</span>
                        {filters_open ? null : <span className='model-filters-summary'>{summary}</span>}
                    </button>
                </h6>
                {listing ? this.filterSets() : this.pendingFilters()}
                {filters_open
                    ? (
                        <>
                            <div className='model-filters-grip' aria-hidden='true' onPointerDown={this.startDrag} />
                            <button type='button' className='model-filters-fold' aria-label='Collapse the filters' onClick={toggle}>
                                <ChevronLeftIcon fontSize='inherit' />
                            </button>
                        </>
                    ) : null}
            </aside>
        );
    }

    //
    // the two sets of filters the column holds once the listing is in
    //
    filterSets() {
        const { listing, hidden_tasks, hidden_statuses } = this.state;
        const { models, tasks } = listing;

        //
        // Behind baseline is offered once the listing carries the trainer's
        // checks, from format 2 on (#263). A listing before then can say of no
        // model that its live version was taken down, and its filters are as
        // they were
        //
        const checked = models.some((model) => model.down || (Array.isArray(model.behind) && model.behind.length));
        const statuses = STATUSES.filter((status) => status.key !== 'down' || checked);

        const row = (key, name, count, on, flip) => (
            <li key={key}>
                <button type='button' className='model-filter' aria-pressed={on} onClick={flip}>
                    <span className='model-filter-box' aria-hidden='true' />
                    <span className='model-filter-name'>{name}</span>
                    <span className='model-filter-count'>{count}</span>
                </button>
            </li>
        );

        return (
            <div className='model-filter-sets' id='model-filter-sets'>
                <section className='model-filter-set' aria-label='What it predicts'>
                    <h6>What it predicts</h6>
                    <ul>
                        {tasks.map((task) => row(
                            task.id,
                            task.name,
                            models.filter((model) => model.task === task.id).length,
                            !hidden_tasks.includes(task.id),
                            () => this.toggleFilter('hidden_tasks', task.id),
                        ))}
                    </ul>
                </section>
                <section className='model-filter-set' aria-label='Status'>
                    <h6>Status</h6>
                    <ul>
                        {statuses.map((status) => row(
                            status.key,
                            status.label,
                            models.filter((model) => statusOf(model) === status.key).length,
                            !hidden_statuses.includes(status.key),
                            () => this.toggleFilter('hidden_statuses', status.key),
                        ))}
                    </ul>
                </section>
            </div>
        );
    }

    //
    // the two sets before the listing names its tasks (#274): each set's
    // heading, a bar for the task, and a row for each status, whose names never
    // change, with a bar for its count. Laid out as the rows are, though not
    // yet controls, so hidden from a screen reader -- see '.model-filter-pending'
    //
    pendingFilters() {
        const row = (key, name, at) => (
            <li key={key}>
                <span className='model-filter model-filter-pending'>
                    <span className='model-filter-box' />
                    <span className='model-filter-name'>{name}</span>
                    <span className='model-filter-count'><PendingBar width='0.6rem' delay={at * STAGGER} /></span>
                </span>
            </li>
        );

        return (
            <div className='model-filter-sets' id='model-filter-sets' aria-hidden='true'>
                <section className='model-filter-set'>
                    <h6>What it predicts</h6>
                    <ul>{row('task', <PendingBar width='6rem' />, 0)}</ul>
                </section>
                <section className='model-filter-set'>
                    <h6>Status</h6>
                    <ul>{STATUSES.map((status, at) => row(status.key, status.label, at + 1))}</ul>
                </section>
            </div>
        );
    }

    //
    // over the lists: the comparison, once two models are ticked, and until
    // then, how to start one
    //
    comparison() {
        const { listing, picked, records } = this.state;
        const chosen = this.chosen();

        if (chosen.length >= 2) {
            return (
                <CompareChart
                    picks={chosen.map((model, at) => ({ model: model, slot: picked[at].slot }))}
                    records={records}
                    score={this.props.score}
                    task={listing.tasks.find((task) => task.id === chosen[0].task)}
                    onClear={this.clear}
                />
            );
        }

        const hint = chosen.length
            ? `Tick one or two more ${listing.tasks.find((task) => task.id === chosen[0].task).name} models to compare them with ${chosen[0].name}.`
            : HINT;

        return <p className='model-hint'>{hint}</p>;
    }

    //
    // one list per task the filters leave, each sorted, and none for a task
    // they leave no model of
    //
    groups(shown) {
        const { listing, records, picked, subscribed } = this.state;
        const { score } = this.props;
        const chosen = this.chosen();

        //
        // the axis every row's trend line is drawn on: the last 60 days any of
        // the track records in so far holds
        //
        const held = {};

        Object.keys(records).forEach((name) => {
            if (records[name]) {
                held[name] = records[name];
            }
        });

        const axis = recentDays(held);

        return listing.tasks.map((task, index) => {
            const models = shown.filter((model) => model.task === task.id);

            if (!models.length) {
                return null;
            }

            //
            // the headings over the columns are hidden from a screen reader, as
            // a row's own cells say what they hold -- all but the score's, whose
            // note can be focused: what is hidden from a screen reader must hold
            // nothing the keyboard can reach (#265)
            //
            return (
                <section key={task.id} className='model-group' aria-labelledby={`model-group-${index}`}>
                    <div className='model-group-head'>
                        <h5 id={`model-group-${index}`}>{task.name}</h5>
                        {task.description ? <span className='model-group-detail'>{task.description}</span> : null}
                        <span className='model-group-count'>{`${models.length} ${models.length === 1 ? 'model' : 'models'}`}</span>
                    </div>
                    <div className='model-list'>
                        <div className='model-list-head'>
                            <span aria-hidden='true'>Compare</span>
                            <span aria-hidden='true'>Model</span>
                            <span aria-hidden='true' />
                            <InfoNote note={scoreOf(score).note} className='model-noted'>
                                {`${scoreOf(score).label}, last 20 days`}
                            </InfoNote>
                            <span aria-hidden='true'>{`Last ${TREND_DAYS} days`}</span>
                            <span aria-hidden='true'>Live version</span>
                            <span aria-hidden='true'>Went live</span>
                        </div>
                        <div role='list' aria-label={`${task.name} models`}>
                            {sortModels(models, this.state.sort, score).map((model) => {
                                const tick = picked.find((each) => each.name === model.name);

                                return (
                                    <ModelRow
                                        key={model.name}
                                        model={model}
                                        score={score}
                                        rows={records[model.name]}
                                        axis={axis}
                                        picked={tick ? tick.slot : null}
                                        blocked={compareBlocked(model, chosen)}
                                        onPick={this.pick}
                                        held={subscribed.includes(model.name)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </section>
            );
        });
    }

    //
    // the score picker and the sort, which need nothing from the listing, so
    // they are drawn while it is on its way as well
    //
    controls() {
        return (
            <div className='model-controls'>
                <ScorePicker score={this.props.score} onScore={this.props.onScore} />
                <label className='model-sort'>
                    <span className='model-control-label' aria-hidden='true'>Sort</span>
                    <select
                        aria-label='Sort'
                        value={this.state.sort}
                        onChange={(event) => this.setState({ sort: event.target.value })}
                    >
                        {SORTS.map((each) => (
                            <option key={each.key} value={each.key}>{each.label}</option>
                        ))}
                    </select>
                </label>
            </div>
        );
    }

    //
    // the page under its title: a line saying why there is nothing to show, or
    // the filters beside the controls, the comparison and the lists
    //
    body() {
        const { listing } = this.state;

        //
        // while the listing is on its way, the page's own shape (#274): the
        // filters, the controls, and the list with bars where its figures will
        // be -- see model/pending.jsx
        //
        if (listing === undefined) {
            return (
                <div className='model-columns'>
                    {this.filters()}
                    <div className='model-main'>
                        <p className='visually-hidden' role='status'>Loading the models&hellip;</p>
                        {this.controls()}
                        <p className='model-hint'>{HINT}</p>
                        <PendingGroup score={this.props.score} />
                    </div>
                </div>
            );
        }

        if (listing === null) {
            return <p className='model-status model-status-empty'>No models to show yet.</p>;
        }

        if (!listing.models.length) {
            return <p className='model-status model-status-empty'>No models have been published yet.</p>;
        }

        const shown = this.shown();

        return (
            <div className='model-columns'>
                {this.filters()}
                <div className='model-main'>
                    {this.controls()}
                    {this.comparison()}
                    {this.groups(shown)}
                    {shown.length ? null : <p className='model-status'>No model matches these filters.</p>}
                </div>
            </div>
        );
    }

    //
    // the models the filters leave
    //
    shown() {
        const { listing, hidden_tasks, hidden_statuses } = this.state;

        return listing.models.filter((model) => (
            !hidden_tasks.includes(model.task) && !hidden_statuses.includes(statusOf(model))
        ));
    }

    render() {
        const { listing } = this.state;
        let count = '';

        if (listing === null || (listing && !listing.models.length)) {
            count = '0';
        } else if (listing) {
            const shown = this.shown().length;

            count = shown === listing.models.length ? String(shown) : `${shown} of ${listing.models.length}`;
        }

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container model-layout'>
                    <div className='model-intro'>
                        <div className='model-heading'>
                            <h4>Models</h4>
                            <span className='model-count'>{listing === undefined ? <PendingBar width='1rem' /> : count}</span>
                        </div>
                        <span className='model-lede'>
                            {'Each night these models read the day’s '}
                            <Link to='/graph'>knowledge graph</Link>
                            {', built from the '}
                            <Link to='/stream'>data this site collects</Link>
                            {', and predict how each S&P 500 stock will move the next trading day. Once that day’s prices are in, every prediction is graded against a guess that knows nothing, to show whether the data can predict the market at all.'}
                        </span>
                    </div>
                    {this.body()}
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default ModelLayout;
