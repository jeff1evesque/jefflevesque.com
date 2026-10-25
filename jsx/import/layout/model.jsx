/**
 * model.jsx: /model, every model trained each night and how it scores (#243).
 *
 * What the models predict, what they read, and how they're graded against the
 * baseline are on the docs' page on the models, which an icon leads to (#296):
 * /stream's docs icon, at the right end of the title's row. It took the place of
 * five sentences under the title, which a phone folded behind a 'More' (#287),
 * and from #300 it sits there on a computer too: the page has no sort menu, whose
 * row it shared, and each list is best score first.
 * One list per task -- what a model predicts -- beside a column of filters, by
 * task and by status, which folds to a rail as /graph's columns do and is a
 * folded band on a phone (#251). Every row carries the model's live version, how
 * many of its attempts went live, a trend line of its score, and last its latest
 * score against the know-nothing baseline, over as many scored days as the
 * listing's `average_days` (#293); see model/model-row.jsx. Each
 * list has a score picker of its own, of the scores its task has (#279), which
 * chooses what its rows and their trend lines show, and is shared with each of
 * its models' own pages -- see redux/container/model.jsx -- and each list is in
 * order of its score, best first. While Loss is picked, a list of stock models shows
 * loss's three parts in its place, each under its own name (#283). From #300 a
 * list is laid out as #300 lays it out: the task's name, its count and what
 * it predicts, its pickers, then its rows in a box, with no headings over them.
 *
 * From format 5, where the listing gives its models' scores on each hold, a
 * list has a hold picker beside its score picker (#300): 1, 5 and 20 days, and
 * Combined for a task of stocks. Its rows' scores, days, trend lines and parts
 * follow it, and it opens on 1 day, so the list reads as it did until another
 * is picked. Each list's hold is kept as its score is, but apart from a model
 * page's -- see redux/container/model.jsx.
 *
 * Ticking two or three models of one task draws their track records on one chart
 * over the lists, on the score its list shows; see model/compare-chart.jsx. A
 * model of another task can be ticked beside them only on a score of what each
 * one's picks would have made that both tasks name, the top 10's (#279), and the
 * chart then has a picker of those scores of its own. Neither can a fourth. The
 * address carries what is ticked, '?compare=a,b', so a comparison can be linked,
 * and the page reopens it -- one of models of different tasks on the first score
 * they share.
 *
 * Each row's bell leads to its model's alarm page, and rings for a reader who holds
 * the alarm (#255). The reader's subscriptions are asked for once, for every row, as
 * /stream asks for its own; signed out, or where they could not be had, every bell
 * is plain.
 *
 * Note: the listing says everything a row prints but its trend line, so the
 *       lists and the filters are drawn from it alone, and each row's
 *       track record fills its trend line in as it arrives.
 *
 * Note: the model api is built after this page (#243). Until it answers, the
 *       page says it has no models to show, rather than that something failed:
 *       for a reader, there are none.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ErrorBoundary } from 'react-error-boundary';
import Tooltip from '@mui/material/Tooltip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ErrorFallback from '../formatter/boundary-error.jsx';
import ModelRow from './model/model-row.jsx';
import CompareChart from './model/compare-chart.jsx';
import { FoldTitle, HoldPicker, ScorePicker, isPhone, modelsHeld, useFolds } from './model/parts.jsx';
import { PendingGroup, STAGGER } from './model/pending.jsx';
import { PendingBar } from './graph/pending.jsx';
import { readLayout, writeLayout } from '../general/layout-preference.js';
import { listSubscriptions } from '../general/account-api.js';
import { GUIDES } from '../general/api-url.js';
import { loadListing, loadReport } from './model/source.js';
import {
    STATUSES,
    averageDays,
    chosenScore,
    compareBlocked,
    emptyHolds,
    heldOut,
    holdNote,
    holdsAmong,
    holdsFor,
    listLine,
    recentDays,
    scoreOnHold,
    scoresFor,
    sharedScores,
    showsParts,
    sortModels,
    statusOf,
} from './model/scores.js';

//
// the tasks `models` predict, as the listing describes them, each once and in
// the order of the models: a task the listing does not describe, as itself
//
function tasksOf(models, tasks) {
    return models
        .map((model) => model.task)
        .filter((id, at, all) => all.indexOf(id) === at)
        .map((id) => tasks.find((task) => task.id === id) || { id: id, name: id });
}

/**
 * the comparison an address names -- '?compare=a,b' -- as the models it ticks,
 * each with the color slot it is drawn in: the first named the first color. A
 * name the listing does not hold is passed over, and so is one that could not be
 * ticked beside those before it: a fourth, or another task's on no score of what
 * each one's picks would have made that the tasks share (#279). `tasks` are the
 * listing's.
 *
 * Note: names are joined by commas, which no model's name holds.
 */
export function linkedCompare(search, models, tasks = []) {
    const asked = (new URLSearchParams(search).get('compare') || '').split(',').map((name) => name.trim());
    const ticked = [];

    asked.forEach((name) => {
        const model = models.find((each) => each.name === name);

        if (!model || ticked.includes(model)) {
            return;
        }

        const [shared] = sharedScores(tasksOf(ticked.concat([model]), tasks));

        if (!compareBlocked(model, ticked, shared, tasks)) {
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

/**
 * the docs' page on the models (#296), as /stream links its api's docs: the page
 * icon in the docs links' gray, named in its tooltip and to a screen reader, and
 * opened in a new tab, so the lists stay as the reader arranged them. `size` is
 * mui's, 'medium' at the end of the title's row, as it sits beside a title of
 * the menu's size on every screen since the sort menu's row went (#300), and at
 * the end of the lists' first line -- see Lead.
 */
export function DocsLink({ size }) {
    return (
        <Tooltip title='How the models work'>
            <a
                className='api-link'
                href={GUIDES.models}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='How the models work'
            >
                <DescriptionOutlinedIcon fontSize={size} />
            </a>
        </Tooltip>
    );
}

DocsLink.propTypes = {
    size: PropTypes.oneOf(['medium', 'large']).isRequired,
};

/**
 * the lists' first line (#306): how to start a comparison, and the docs' link at
 * its right end, which the stylesheet shows on a computer while the filters are
 * open, where the title's row stands over them and this line beside it.
 * Everywhere else the title's row shows its own, and a line with no hint, over a
 * drawn comparison, shows nothing -- see '.model-lead' in '_model.scss'.
 */
export function Lead({ hint = null }) {
    return (
        <div className='model-lead'>
            {hint ? <p className='model-hint'>{hint}</p> : null}
            <div className='api-links model-lead-docs'>
                <DocsLink size='medium' />
            </div>
        </div>
    );
}

Lead.propTypes = {
    hint: PropTypes.string,
};

/**
 * one task's list (#279), under the task's name and how many models it has (#300):
 * the name folds the list away and opens it again, as a model's page's sections
 * fold, kept between visits -- see parts.jsx's useFolds. Folded, the name and the
 * count stay, and what the task predicts, its pickers and its rows go.
 */
export function TaskGroup({ task, index, count, children }) {
    const [folds, toggle] = useFolds('model-list');
    const folded = Boolean(folds[task.id]);

    return (
        <section className='model-group' aria-labelledby={`model-group-${index}`}>
            <div className='model-group-head'>
                <FoldTitle as='h5' id={`model-group-${index}`} title={task.name} folded={folded} onFold={() => toggle(task.id)} />
                <span className='model-group-count'>{`${count} ${count === 1 ? 'model' : 'models'}`}</span>
                {task.description && !folded ? <p className='model-group-detail'>{task.description}</p> : null}
            </div>
            {folded ? null : children}
        </section>
    );
}

TaskGroup.propTypes = {
    task: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        description: PropTypes.string,
    }).isRequired,
    index: PropTypes.number.isRequired,
    count: PropTypes.number.isRequired,
    children: PropTypes.node.isRequired,
};

class ModelLayout extends Component {
    static propTypes = {
        //
        // the score shown for each task, by its id, and the way to choose
        // another for a task (#279): the store's, shared with each model's own
        // page -- see redux/container/model.jsx. A task with none shows loss
        //
        scores: PropTypes.objectOf(PropTypes.string),
        onScore: PropTypes.func,
        //
        // the hold each task's list is on, by its id, and the way to choose
        // another (#300): the store's, kept apart from a model page's. A task
        // with none is on 1 day
        //
        holds: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
        onHold: PropTypes.func,
    }

    static defaultProps = {
        scores: {},
        onScore: () => {},
        holds: {},
        onHold: () => {},
    }

    constructor(props) {
        super(props);

        const phone = isPhone();
        const kept = readLayout(LAYOUT, phone ? 'narrow' : 'wide');

        this.state = {
            // the listing: undefined while it is on its way, null where it
            // could not be had, and { tasks, models, average_days } once it
            // is in
            listing: undefined,
            // each model's track record by name, once it is in: its rows, or
            // null where it could not be had. A name not here is on its way
            records: {},
            // the tasks and statuses unticked in the filters
            hidden_tasks: [],
            hidden_statuses: [],
            // the models ticked to compare, each with its color slot, in the
            // order of the slots
            picked: [],
            // the score models of more than one task are compared on, which
            // the comparison's own picker chooses (#279), and none while they
            // are of one task, whose list's score they are compared on
            compare_score: null,
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

            const picked = listing ? linkedCompare(window.location.search, listing.models, listing.tasks) : [];
            const tasks = listing
                ? tasksOf(picked.map((each) => listing.models.find((model) => model.name === each.name)), listing.tasks)
                : [];

            this.setState({ listing: listing, picked: picked, compare_score: tasks.length > 1 ? sharedScores(tasks)[0] : null }, () => {
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
    // open, and the width it was dragged to. The intro's fold is no longer kept
    // (#296): there is no intro to fold
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

    //
    // a model's track record, averaged over the listing's days (#293): asked
    // for once the listing is in
    //
    loadRecord(name) {
        loadReport(name, 'track-record', averageDays(this.state.listing)).then((rows) => {
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

    //
    // the score a task's list shows (#279): the one the reader picked for its
    // task, and loss until they do -- and on Combined, loss in place of a top
    // 10's, which Combined has none of (#300)
    //
    scoreFor(task) {
        return scoreOnHold(chosenScore(this.props.scores, task), this.holdFor(task).hold);
    }

    //
    // the holds a task's list offers, from format 5 on (#300): those the
    // listing gives any of its models' scores on -- and before then, the task's
    // own (#311): an options task's three, whose scores each row reads from its
    // model's track record, as the model's own page does (#279), and a stock
    // task's three and Combined. And the one it is on: the one picked for the
    // task, where it is offered, and the first otherwise, 1 day. A hold none of
    // its models has a result on yet, `empty`, is offered grayed out until one
    // comes in -- see scores.js's emptyHolds
    //
    holdFor(task) {
        const models = this.state.listing.models.filter((model) => model.task === task.id);
        const listed = holdsAmong(models);
        const holds = listed.length ? listed : holdsFor(task);
        const empty = holds.slice(1).map((each) => each.days).filter((days) => (
            models.every((model) => emptyHolds(model, this.state.records[model.name], holds).includes(days))
        ));
        const picked = this.props.holds[task.id];
        const offered = holds.some((each) => each.days === picked) && !empty.includes(picked);

        return { holds: holds, hold: offered ? picked : holds[0].days, empty: empty };
    }

    //
    // the score the models ticked are compared on: their list's, while they are
    // of one task, and the comparison's own once they are of more (#279). None
    // while none is ticked
    //
    comparedScore(chosen) {
        const tasks = tasksOf(chosen, this.state.listing.tasks);

        if (!tasks.length) {
            return null;
        }

        return tasks.length > 1 ? this.state.compare_score : this.scoreFor(tasks[0]);
    }

    /**
     * a model ticked or unticked for the comparison.
     *
     * A model ticked takes the first color no other ticked model holds, and
     * keeps it while it stays ticked, so unticking one leaves the others as they
     * were drawn. One that cannot be ticked -- see compareBlocked -- is left as
     * it is: its box is disabled, and says why.
     *
     * A model of another task ticked on a score of what each one's picks would
     * have made is compared on that score, by the comparison's own picker, until
     * the models ticked are of one task again (#279).
     */
    pick(model) {
        const { listing, picked } = this.state;
        const chosen = this.chosen();
        const score = this.comparedScore(chosen);
        let next;

        if (picked.some((each) => each.name === model.name)) {
            next = picked.filter((each) => each.name !== model.name);
        } else {
            if (compareBlocked(model, chosen, score, listing.tasks)) {
                return;
            }

            const used = picked.map((each) => each.slot);
            let slot = 0;

            while (used.includes(slot)) {
                slot += 1;
            }

            next = picked.concat([{ name: model.name, slot: slot }]).sort((a, b) => a.slot - b.slot);
        }

        const across = tasksOf(next.map((each) => listing.models.find((one) => one.name === each.name)), listing.tasks).length > 1;

        this.setState(
            { picked: next, compare_score: across ? score : null },
            () => writeCompare(next.map((each) => each.name)),
        );
    }

    clear() {
        this.setState({ picked: [], compare_score: null }, () => writeCompare([]));
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
    // with a bar where the band says how many models it shows (#274).
    //
    // Note: the bar is sized by the stylesheet rather than by PendingBar's
    //       width, so it runs down a wide screen's folded rail as the count's
    //       words do -- see '.model-filters-summary' in '_model.scss'
    //
    filters() {
        const { listing, filters_open, filters_width } = this.state;
        const toggle = this.toggleFilters;
        let summary = <span className='graph-pending-bar' />;

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
    // then, how to start one -- each on or under the lists' first line (#306)
    //
    comparison() {
        const { listing, picked, records } = this.state;
        const chosen = this.chosen();

        if (chosen.length >= 2) {
            const tasks = tasksOf(chosen, listing.tasks);

            //
            // each model on the hold its list is on (#300)
            //
            const holdOf = (model) => this.holdFor(tasks.find((task) => task.id === model.task)).hold;

            return (
                <>
                    <Lead />
                    <CompareChart
                        picks={chosen.map((model, at) => ({ model: model, slot: picked[at].slot, hold: holdOf(model) }))}
                        records={records}
                        score={this.comparedScore(chosen)}
                        task={tasks[0]}
                        tasks={tasks}
                        onScore={tasks.length > 1 ? (score) => this.setState({ compare_score: score }) : null}
                        onClear={this.clear}
                    />
                </>
            );
        }

        const hint = chosen.length
            ? `Tick one or two more ${listing.tasks.find((task) => task.id === chosen[0].task).name} models to compare them with ${chosen[0].name}.`
            : HINT;

        return <Lead hint={hint} />;
    }

    //
    // one list per task the filters leave, each sorted, and none for a task
    // they leave no model of. Each under a score picker of its own, of the
    // scores its task has (#279)
    //
    groups(shown) {
        const { listing, records, picked, subscribed } = this.state;
        const { onScore, onHold } = this.props;
        const chosen = this.chosen();
        const compared = this.comparedScore(chosen);

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

            const { holds, hold, empty } = this.holdFor(task);
            const score = this.scoreFor(task);
            const parts = showsParts(score, task);

            //
            // a list as #300 lays it out: the task's name over what it predicts,
            // its pickers, a line saying what the hold picked is, and its rows in
            // a box of their own, with no headings over them -- each row's figures
            // say what they are
            //
            return (
                <TaskGroup key={task.id} task={task} index={index} count={models.length}>
                    <div className='model-controls model-group-controls'>
                        <ScorePicker
                            score={score}
                            onScore={(key) => onScore(task.id, key)}
                            offered={scoresFor(task)}
                            disabled={heldOut(task, hold)}
                        />
                        <HoldPicker hold={hold} onHold={(key) => onHold(task.id, key)} holds={holds} disabled={empty} note={holdNote(task, empty.length > 0)} />
                    </div>
                    <p className='model-hold-line'>{listLine(task, hold)}</p>
                    <div className={parts ? 'model-list model-list-parts' : 'model-list'}>
                        <div role='list' aria-label={`${task.name} models`}>
                            {sortModels(models, 'score', score, hold, records).map((model) => {
                                const tick = picked.find((each) => each.name === model.name);

                                return (
                                    <ModelRow
                                        key={model.name}
                                        model={model}
                                        task={task}
                                        score={score}
                                        hold={hold}
                                        rows={records[model.name]}
                                        axis={axis}
                                        picked={tick ? tick.slot : null}
                                        blocked={compareBlocked(model, chosen, compared, listing.tasks)}
                                        onPick={this.pick}
                                        held={subscribed.includes(model.name)}
                                        parts={parts}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </TaskGroup>
            );
        });
    }

    //
    // the page under its title: a line saying why there is nothing to show, or
    // the filters beside the comparison and the lists
    //
    body() {
        const { listing } = this.state;

        //
        // while the listing is on its way, the page's own shape (#274): the
        // filters, how to start a comparison, and the list with bars where its
        // figures will be -- see model/pending.jsx
        //
        if (listing === undefined) {
            return (
                <div className='model-columns'>
                    {this.filters()}
                    <div className='model-main'>
                        <p className='visually-hidden' role='status'>Loading the models&hellip;</p>
                        <Lead hint={HINT} />
                        <PendingGroup />
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
                            <div className='api-links model-heading-docs'>
                                <DocsLink size='medium' />
                            </div>
                        </div>
                    </div>
                    {this.body()}
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default ModelLayout;
