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

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ModelPageRoute, { ModelPage, liveFigure, ordinal, placeAmong } from '../../../import/layout/model/model-page.jsx';
import { loadListing, loadReport } from '../../../import/layout/model/source.js';
import { TASKS, historyOf, listingOf, modelOf, trackOf } from '../../../test-support/model-fixtures.js';

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
        expect(screen.getByText('Predicts next-day direction. A graph model of the market')).toBeInTheDocument();
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

describe('the summary', () => {
    function stat(label) {
        return within(screen.getByRole('region', { name: 'Summary' })).getByText(label).closest('.model-stat');
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
