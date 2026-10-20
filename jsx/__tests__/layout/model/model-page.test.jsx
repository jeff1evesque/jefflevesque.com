/**
 * model-page.test.jsx: /model/:model, one model on its own (#243).
 *
 * The api is replaced at source.js, so each case says what the listing and the
 * two reports answer, and when. The charts are drawn for real -- see
 * attempts-chart.test.jsx and track-chart.test.jsx for what is in them -- and
 * these cases are about the page round them: who the model is, its figures, and
 * what it says when there is nothing to draw.
 */

jest.mock('recharts', () => require('../../../test-support/model-fixtures.js').sizedRecharts());
jest.mock('../../../import/layout/model/source.js', () => ({
    loadListing: jest.fn(),
    loadReport: jest.fn(),
}));

//
// the reader's subscriptions, for the bell beside the name (#255). Signed out
// unless a case says otherwise -- and the api's session reader imports Amplify,
// which jest cannot load unmocked
//
jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(),
}));

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ModelPageRoute, { ModelPage, liveFigure, ordinal, placeAmong, sentence } from '../../../import/layout/model/model-page.jsx';
import { loadListing, loadReport } from '../../../import/layout/model/source.js';
import { listSubscriptions } from '../../../import/general/account-api.js';
import { TASKS, behindOf, downModelOf, historyOf, listingOf, modelOf, trackOf } from '../../../test-support/model-fixtures.js';

//
// a promise and the way to settle it, for an answer a case holds back
//
function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });

    return { promise, resolve };
}

function answer({ listing = listingOf(), history = historyOf(), track = trackOf() } = {}) {
    loadListing.mockResolvedValue(listing);
    loadReport.mockImplementation((name, kind) => Promise.resolve(kind === 'history' ? history : track));
}

async function open(name = 'pt-gnn', props = {}) {
    let view;

    await act(async () => {
        view = render(
            <MemoryRouter>
                <ModelPage name={name} {...props} />
            </MemoryRouter>
        );
    });

    return view;
}

beforeEach(() => {
    loadListing.mockReset();
    loadReport.mockReset();
    listSubscriptions.mockReset();
    listSubscriptions.mockResolvedValue(null);
    // the charts a case folds are kept, as a reader's are (#253)
    window.localStorage.clear();
});

describe('the bell beside the name (#255)', () => {
    const LIVE = { alarm: 'live', since: '2026-10-18T12:00:00Z', terms: '2026-10' };
    const bell = () => document.querySelector('.model-heading a[href$="/alarm"]');

    it('is plain for a reader signed out, and leads to the model\'s alarm page', async () => {
        answer();
        await open('pt-gnn');

        expect(bell()).toHaveAttribute('href', '/model/pt-gnn/alarm');
        expect(bell()).toHaveAccessibleName('Alarm for pt-gnn');
        expect(bell().querySelector('svg')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('rings in green for a reader who holds the model\'s alarm', async () => {
        listSubscriptions.mockResolvedValue([{ model: 'pt-gnn', ...LIVE }]);
        answer();
        await open('pt-gnn');

        expect(bell()).toHaveAccessibleName('Alarm for pt-gnn: subscribed');
        expect(bell().querySelector('svg')).toHaveClass('subscribed');
    });

    it('stays plain for a reader who holds another model\'s alarm, or a stream\'s of its name', async () => {
        listSubscriptions.mockResolvedValue([
            { model: 'tables', ...LIVE },
            { stream: 'pt-gnn', alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: '2026-09' },
        ]);
        answer();
        await open('pt-gnn');

        expect(bell().querySelector('svg')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('is not drawn for a retired model', async () => {
        listSubscriptions.mockResolvedValue([{ model: 'beater', ...LIVE }]);
        answer();
        await open('beater');

        expect(screen.getByRole('heading', { name: 'beater' })).toBeInTheDocument();
        expect(bell()).toBeNull();
    });

    it('asks for the subscriptions once', async () => {
        answer();
        await open('pt-gnn');

        expect(listSubscriptions).toHaveBeenCalledTimes(1);
    });

    it('stays plain when the subscriptions could not be listed', async () => {
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        listSubscriptions.mockRejectedValue(new Error('busy, try again'));
        answer();
        await open('pt-gnn');

        expect(quiet).toHaveBeenCalledWith(expect.stringContaining('busy, try again'));
        expect(bell().querySelector('svg')).toHaveAttribute('data-testid', 'NotificationsIcon');

        quiet.mockRestore();
    });

    it('lets the subscriptions go when they land after the page has', async () => {
        const late = deferred();

        listSubscriptions.mockReturnValue(late.promise);
        answer();

        const { unmount } = await open('pt-gnn');

        unmount();

        await act(async () => late.resolve([{ model: 'pt-gnn', ...LIVE }]));

        expect(bell()).toBeNull();
    });
});

describe('ordinal', () => {
    it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [102, '102nd'], [111, '111th']])(
        '%i is %s', (place, said) => {
            expect(ordinal(place)).toBe(said);
        },
    );
});

describe('placeAmong', () => {
    const { models } = listingOf();
    const task = TASKS[0];

    it('says where a model stands among the scored models of its task', () => {
        expect(placeAmong(models[0], models, task, 'loss')).toBe('1st of 3 Next-day direction models');
        expect(placeAmong(models[2], models, task, 'loss')).toBe('3rd of 3 Next-day direction models');
        expect(placeAmong(models[1], models, task, 'acc_up')).toBe('1st of 3 Next-day direction models');
    });

    it('names the task by its id where the listing does not describe it', () => {
        expect(placeAmong(models[0], models, undefined, 'loss')).toBe('1st of 3 direction models');
    });

    it('says nothing for the only model of its task, or one with no score', () => {
        const unscored = { ...models[0], score: null };

        expect(placeAmong(models[3], models, TASKS[1], 'loss')).toBe('');
        expect(placeAmong(unscored, [unscored, models[1], models[2]], task, 'loss')).toBe('');
    });
});

describe('liveFigure', () => {
    it('says when the live version went live, and after what', () => {
        expect(liveFigure(modelOf())).toEqual({ value: 'Oct 9', detail: 'went live after a nightly update' });
        expect(liveFigure(modelOf({ live: { since: '2026-10-12', kind: 'weekly' } })).detail).toBe('went live after a weekly retrain');
    });

    it('says a first version has not been beaten yet', () => {
        expect(liveFigure(modelOf({ live: { since: '2026-10-05', kind: 'first' } }))).toEqual({ value: 'Oct 5', detail: 'its first version, not yet beaten' });
        expect(liveFigure(modelOf({ live: { since: null, kind: null } }))).toEqual({ value: '–', detail: 'its first version, not yet beaten' });
        expect(liveFigure(modelOf({ live: { since: null, kind: 'nightly' } })).value).toBe('–');
    });

    it('says when a retired model retired, and when its last version went live', () => {
        expect(liveFigure(modelOf({ retired: '2026-10-02' }))).toEqual({ value: 'Retired Oct 2', detail: 'its last version went live Oct 9' });
        expect(liveFigure(modelOf({ retired: '2026-10-02', live: { since: null, kind: null } })).detail).toBe('no longer trained');
    });

    it('says when a live version was taken down, and the check of each day on its own that did it (#263)', () => {
        expect(liveFigure(downModelOf())).toEqual({ value: 'Taken down Oct 19', detail: 'worse than the baseline 5 scored days in a row' });
    });

    it('says an average\'s check as an average\'s (#263)', () => {
        expect(liveFigure(downModelOf({ down: { since: '2026-10-19', days: 5, in_a_row: 10 } })).detail)
            .toBe('its 5-day average was worse than the baseline’s 10 days in a row');
    });
});

describe('before there is a model to show', () => {
    it('says it is loading while the listing is on its way', async () => {
        loadListing.mockReturnValue(new Promise(() => {}));

        await open();

        expect(screen.getByText('Loading the model…')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ All models' })).toHaveAttribute('href', '/model');
    });

    it('says there are no models to show yet where the listing could not be had', async () => {
        answer({ listing: null });

        await open();

        expect(screen.getByText('No models to show yet.')).toBeInTheDocument();
        expect(loadReport).not.toHaveBeenCalled();
    });

    it('says a name the listing does not hold is not a model, and asks for no report of it', async () => {
        answer();

        await open('no-such-model');

        expect(screen.getByRole('heading', { name: 'Model not found' })).toBeInTheDocument();
        expect(screen.getByText('There is no model named “no-such-model”.')).toBeInTheDocument();
        expect(loadReport).not.toHaveBeenCalled();
    });

    it('sets nothing once it has gone, whenever the listing lands', async () => {
        const listing = deferred();

        loadListing.mockReturnValue(listing.promise);

        const { unmount } = await open();

        unmount();
        await act(async () => listing.resolve(listingOf()));

        expect(loadReport).not.toHaveBeenCalled();
    });

    it('sets nothing once it has gone, whenever a report lands', async () => {
        const history = deferred();

        loadListing.mockResolvedValue(listingOf());
        loadReport.mockReturnValue(history.promise);

        const { unmount } = await open();

        unmount();
        await act(async () => history.resolve(historyOf()));

        expect(loadReport).toHaveBeenCalledTimes(2);
    });
});

describe('the model', () => {
    it('names it, its status, what it predicts and what it is', async () => {
        answer();

        await open();

        expect(screen.getByRole('heading', { name: 'pt-gnn' })).toBeInTheDocument();
        expect(screen.getByText('Live')).toHaveClass('model-pill');
        expect(screen.getByText('Up or down, scored the next day. A graph model of the market')).toBeInTheDocument();
    });

    it('says what its task predicts in its task\'s own sentence, and falls back to the task\'s name without one (#251)', async () => {
        const listing = listingOf();

        listing.tasks[0].description = '';
        answer({ listing: listing });

        await open();

        expect(document.querySelector('.model-lede')).toHaveTextContent(/^Predicts next-day direction\. A graph model of the market$/);
    });

    it('leaves out what is not there: a task the listing does not describe, or no description', async () => {
        answer({ listing: { tasks: [], models: [modelOf({ description: '' })] } });

        await open();

        expect(document.querySelector('.model-lede')).toHaveTextContent(/^$/);
    });

    it('asks for both of its reports', async () => {
        answer();

        await open();

        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'history');
        expect(loadReport).toHaveBeenCalledWith('pt-gnn', 'track-record');
    });

    it('draws its two charts once both are in', async () => {
        answer();

        await open();

        expect(screen.getByRole('heading', { name: 'Each attempt against the live version' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Track record' })).toBeInTheDocument();
    });
});

describe('sentence', () => {
    it('makes a figure\'s line a sentence of its note: capitalized, with a full stop (#253)', () => {
        expect(sentence('went live after a weekly retrain')).toBe('Went live after a weekly retrain.');
        expect(sentence('0.060 better than the baseline, 1.660')).toBe('0.060 better than the baseline, 1.660.');
    });

    it('says nothing for no line', () => {
        expect(sentence('')).toBe('');
        expect(sentence(null)).toBe('');
    });
});

describe('the summary', () => {
    //
    // a wide screen's card. A phone's boxes say the same figures again, and the
    // stylesheet shows one or the other -- see 'the summary, on a phone'
    //
    function stat(label) {
        const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

        return within(cards).getByText(label).closest('.model-stat');
    }

    it('says when the live version went live, and how many attempts did', async () => {
        answer({ history: historyOf(4, { 1: { kind: 'weekly', went_live: true }, 3: { kind: 'weekly' } }) });

        await open();

        expect(stat('Live version')).toHaveTextContent('Oct 9went live after a nightly update');
        expect(stat('Attempts that went live')).toHaveTextContent('4 of 30weekly retrains: 1 of 2');
    });

    it('says "nightly attempts" under the count where there are no weekly retrains, or no history', async () => {
        answer({ history: null });

        await open();

        expect(stat('Attempts that went live')).toHaveTextContent('nightly attempts');
    });

    it('gives the 20-day score beside the baseline and where it stands in its task', async () => {
        answer();

        await open();

        expect(stat('Loss, last 20 days')).toHaveTextContent('1.600');
        expect(stat('Loss, last 20 days')).toHaveTextContent('0.060 better than the baseline, 1.660');
        expect(stat('Loss, last 20 days')).toHaveTextContent('1st of 3 Next-day direction models');
    });

    it('follows the score picked', async () => {
        answer();

        await open('pt-gnn', { score: 'acc_up' });

        expect(stat('Up/down accuracy, last 20 days')).toHaveTextContent('54.0%');
        expect(stat('Up/down accuracy, last 20 days')).toHaveTextContent('2.0 pts better than the baseline, 52.0%');
        expect(stat('Up/down accuracy, last 20 days')).toHaveTextContent('2nd of 3');
    });

    it('says how many days a new model\'s score is over', async () => {
        answer();

        await open('fresh');

        expect(stat('Loss, 6 days so far')).toBeInTheDocument();
        expect(stat('Live version')).toHaveTextContent('its first version, not yet beaten');
    });

    it('says a single day, as a day', async () => {
        answer({ listing: listingOf([modelOf({ scored_days: 1 })]) });

        await open();

        expect(stat('Loss, 1 day so far')).toBeInTheDocument();
    });

    it('calls a score level with the baseline where the two print alike', async () => {
        answer({ listing: listingOf([modelOf({ baseline: { loss: 1.6001, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } })]) });

        await open();

        expect(stat('Loss, last 20 days')).toHaveTextContent('level with the baseline, 1.600');
    });

    it('prints a dash, and nothing beside it, for a model with no score yet', async () => {
        answer({ listing: listingOf([modelOf({ score: null, baseline: null })]) });

        await open();

        expect(stat('Loss, last 20 days').querySelector('.model-stat-value')).toHaveTextContent('–');
        expect(stat('Loss, last 20 days').querySelectorAll('.model-stat-detail')).toHaveLength(1);
    });
});

describe('a live version taken down for doing worse than the baseline (#263)', () => {
    const DOWN_LINE = 'Nothing predicts until a new version beats the baseline on the days it was tested on.';
    const BEHIND = 'Days in a row worse than the baseline: each day 4 of 5, 5-day average 0 of 10, 20-day average not yet.';

    //
    // a wide screen's card, as 'the summary' reads one, and a phone's box
    //
    function stat(label) {
        const cards = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-cards');

        return within(cards).getByText(label).closest('.model-stat');
    }

    function noteOf(at) {
        const row = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-boxes');

        return row.querySelectorAll('.stream-focus-figure-label')[at];
    }

    it('says Behind baseline beside the name', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(document.querySelector('.model-heading .model-pill')).toHaveTextContent('Behind baseline');
        expect(document.querySelector('.model-heading .model-pill')).toHaveClass('model-pill-down');
    });

    it('says when it was taken down, the check that did it, and that nothing predicts until a new version beats the baseline', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        const details = [...stat('Live version').querySelectorAll('.model-stat-detail')].map((line) => line.textContent);

        expect(stat('Live version').querySelector('.model-stat-value')).toHaveTextContent('Taken down Oct 19');
        expect(details).toEqual(['worse than the baseline 5 scored days in a row', DOWN_LINE]);
        expect(noteOf(0)).toHaveAccessibleDescription(`Worse than the baseline 5 scored days in a row. ${DOWN_LINE}`);
    });

    it('words an average\'s check as an average\'s', async () => {
        answer({ listing: listingOf([downModelOf({ down: { since: '2026-10-19', days: 20, in_a_row: 5 } })]) });
        await open('lagging');

        expect(stat('Live version')).toHaveTextContent('its 20-day average was worse than the baseline’s 5 days in a row');
    });

    it('says how many days in a row each check has been worse, under the score', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(stat('Loss, last 20 days')).toHaveTextContent(
            'Days in a row worse than the baseline: each day 5 of 5, 5-day average 1 of 10, 20-day average not yet.',
        );
    });

    it('says so of a model still live too, which shows how close it is, and nothing of being taken down', async () => {
        answer({ listing: listingOf([modelOf({ behind: behindOf() })]) });
        await open();

        expect(stat('Loss, last 20 days').lastChild).toHaveTextContent(BEHIND);
        expect(noteOf(2)).toHaveAccessibleDescription(`0.060 better than the baseline, 1.660. ${BEHIND}`);
        expect(stat('Live version')).toHaveTextContent(/^Live versionOct 9went live after a nightly update$/);
        expect(screen.queryByText(DOWN_LINE)).toBeNull();
    });

    it('says none of it for a retired model, or where the listing gives no checks, as one before format 2', async () => {
        answer({ listing: listingOf([modelOf({ retired: '2026-10-02', behind: behindOf() }), modelOf({ name: 'older' })]) });

        const { unmount } = await open();

        expect(screen.queryByText(/^Days in a row worse/)).toBeNull();

        unmount();
        await open('older');

        expect(screen.queryByText(/^Days in a row worse/)).toBeNull();
        expect(screen.queryByText(DOWN_LINE)).toBeNull();
    });

    it('names its score so far where it was taken down before its 20th scored day', async () => {
        answer({ listing: listingOf([downModelOf({ scored_days: 7 })]) });
        await open('lagging');

        expect(stat('Loss, 7 days so far')).toBeInTheDocument();
    });

    it('keeps its bell, since a new version can still go live', async () => {
        answer({ listing: listingOf([downModelOf()]) });
        await open('lagging');

        expect(document.querySelector('.model-heading a[href$="/alarm"]')).toHaveAttribute('href', '/model/lagging/alarm');
    });
});

describe('the summary, on a phone', () => {
    const RETRAINS = { 1: { kind: 'weekly', went_live: true }, 3: { kind: 'weekly' } };
    const WENT = 'Of every nightly attempt, how many scored a loss no higher than the live version’s and replaced it.';

    //
    // the row of boxes a phone shows in place of the cards (#253)
    //
    function boxes() {
        const row = screen.getByRole('region', { name: 'Summary' }).querySelector('.model-summary-boxes');

        return [...row.querySelectorAll('.stream-focus-figure')];
    }

    //
    // a box's name as a phone shows it: its shorter one, where it has one
    //
    function named(box) {
        const label = box.querySelector('.stream-focus-figure-label');

        return (label.querySelector('.stream-focus-short') || label).textContent;
    }

    const values = () => boxes().map((box) => box.querySelector('.stream-focus-figure-value'));
    const notes = () => boxes().map((box) => box.querySelector('.stream-focus-figure-label'));

    it('draws the three figures as one row of boxes, a name over a value', async () => {
        answer({ history: historyOf(4, RETRAINS) });

        await open();

        expect(boxes()).toHaveLength(3);
        expect(boxes().map(named)).toEqual(['Live version', 'Went live', 'Loss']);
        expect(values().map((value) => value.textContent)).toEqual(['Oct 9', '4 of 30', '1.600']);
    });

    it('keeps the cards\' names for the screens with room for them', async () => {
        answer();

        await open();

        expect(boxes()[1].querySelector('.stream-focus-long')).toHaveTextContent('Attempts that went live');
        expect(boxes()[2].querySelector('.stream-focus-long')).toHaveTextContent('Loss, last 20 days');
    });

    it('moves the line under each card\'s value into its box\'s note, as a sentence', async () => {
        answer({ history: historyOf(4, RETRAINS) });

        await open();

        expect(notes()[0]).toHaveAccessibleDescription('Went live after a nightly update.');
        expect(notes()[1]).toHaveAccessibleDescription(`${WENT} Weekly retrains: 1 of 2.`);
        expect(notes()[2]).toHaveAccessibleDescription('0.060 better than the baseline, 1.660. 1st of 3 Next-day direction models.');
    });

    it('says only what going live is where there are no weekly retrains, or no history', async () => {
        answer({ history: null });

        await open();

        expect(notes()[1]).toHaveAccessibleDescription(WENT);
    });

    it('says what the score is where there is nothing to say beside it', async () => {
        answer({ listing: listingOf([modelOf({ score: null, baseline: null })]) });

        await open();

        expect(values()[2]).toHaveTextContent('–');
        expect(notes()[2]).toHaveAccessibleDescription('The model’s loss.');
    });

    it('colors the attempts blue, and the score green where it beats the baseline', async () => {
        answer();

        await open();

        expect(values()[0].className).toBe('stream-focus-figure-value');
        expect(values()[1]).toHaveClass('stream-focus-figure-total');
        expect(values()[2]).toHaveClass('stream-focus-figure-good');
    });

    it('colors the score red where the baseline beats it, and leaves it uncolored where the two are level', async () => {
        answer({ listing: listingOf([modelOf({ baseline: { loss: 1.5, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } })]) });

        const { unmount } = await open();

        expect(values()[2]).toHaveClass('stream-focus-figure-bad');

        unmount();
        answer({ listing: listingOf([modelOf({ baseline: { loss: 1.6001, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } })]) });

        await open();

        expect(values()[2].className).toBe('stream-focus-figure-value');
    });
});

describe('the score picker', () => {
    it('hands the score picked up, for both pages to show', async () => {
        const onScore = jest.fn();

        answer();
        await open('pt-gnn', { onScore: onScore });

        await userEvent.click(screen.getByRole('button', { name: 'Up/down AUC' }));

        expect(onScore).toHaveBeenCalledWith('auc_up');
    });

    it('shows the score it is handed as picked', async () => {
        answer();

        await open('pt-gnn', { score: 'auc_beats' });

        expect(screen.getByRole('button', { name: 'Beat-the-average AUC' })).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('a report that is not in', () => {
    it('says each is loading while it is on its way', async () => {
        loadListing.mockResolvedValue(listingOf());
        loadReport.mockReturnValue(new Promise(() => {}));

        await open();

        expect(screen.getByText('Loading the nightly attempts…')).toBeInTheDocument();
        expect(screen.getByText('Loading the track record…')).toBeInTheDocument();
    });

    it('says each could not be loaded where it could not be had', async () => {
        answer({ history: null, track: null });

        await open();

        expect(screen.getByText('The nightly attempts could not be loaded.')).toBeInTheDocument();
        expect(screen.getByText('The track record could not be loaded.')).toBeInTheDocument();
    });

    it('says each has nothing in it yet where it is empty', async () => {
        answer({ history: [], track: [] });

        await open();

        expect(screen.getByText('No nightly attempts yet.')).toBeInTheDocument();
        expect(screen.getByText('No days scored yet.')).toBeInTheDocument();
    });
});

describe('another model beside the track record', () => {
    const legendOfTrack = () => within(screen.getByRole('region', { name: 'Track record' })).getByRole('list', { name: 'Legend' });

    it('is asked for when it is picked, and drawn once it is in', async () => {
        answer();
        await open();

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with' }), 'tables');

        expect(loadReport).toHaveBeenLastCalledWith('tables', 'track-record');
        expect(within(legendOfTrack()).getByText('tables')).toHaveClass('model-legend-name');
    });

    it('offers the other models of its task only, by name', async () => {
        answer();
        await open();

        expect(within(screen.getByRole('combobox', { name: 'Compare with' })).getAllByRole('option').map((option) => option.textContent))
            .toEqual(['No other model', 'fresh', 'tables']);
    });

    it('lets go of one that lands after another was picked', async () => {
        const slow = deferred();

        answer();
        await open();

        loadReport.mockImplementation((name) => (name === 'tables' ? slow.promise : Promise.resolve(trackOf())));

        const menu = screen.getByRole('combobox', { name: 'Compare with' });

        await userEvent.selectOptions(menu, 'tables');
        await userEvent.selectOptions(menu, 'fresh');
        await act(async () => slow.resolve(null));

        expect(screen.queryByText('The track record of tables could not be loaded.')).toBeNull();
        expect(within(legendOfTrack()).getByText('fresh')).toBeInTheDocument();
    });

    it('asks for nothing when none is picked', async () => {
        answer();
        await open();

        const menu = screen.getByRole('combobox', { name: 'Compare with' });

        await userEvent.selectOptions(menu, 'tables');
        loadReport.mockClear();
        await userEvent.selectOptions(menu, '');

        expect(loadReport).not.toHaveBeenCalled();
    });
});

describe('the went-live ticks', () => {
    it('mark the track record on each night the history says a version went live', async () => {
        answer({
            history: historyOf(3, { 0: { day: '2026-09-02', went_live: true }, 2: { day: '2026-09-04', went_live: true } }),
            track: trackOf(5),
        });

        const { container } = await open();

        expect(container.querySelectorAll('.model-track .model-went-live')).toHaveLength(2);
    });

    it('mark nothing while the history is not in', async () => {
        answer({ history: null });

        const { container } = await open();

        expect(container.querySelector('.model-went-live')).toBeNull();
    });
});

describe('the route', () => {
    it('reads the model\'s name from the address', async () => {
        answer();

        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/model/tables']}>
                    <Routes>
                        <Route path='/model/:model' element={<ModelPageRoute />} />
                    </Routes>
                </MemoryRouter>
            );
        });

        expect(screen.getByRole('heading', { name: 'tables' })).toBeInTheDocument();
        expect(loadReport).toHaveBeenCalledWith('tables', 'history');
    });
});
