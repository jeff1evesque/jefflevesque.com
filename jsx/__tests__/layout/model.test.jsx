/**
 * model.test.jsx: /model, every model and how it scores (#243).
 *
 * The page lists the models from the model api's listing, one list per task,
 * under filters by task and status, a score picker and a sort, and compares two
 * or three models of one task on a chart over the lists. What is compared is
 * kept in the address, '?compare=a,b', so a comparison can be linked.
 *
 * The api is replaced at source.js, so each case says what the listing answers.
 * Recharts is drawn for real, in a container given a size -- see sizedRecharts
 * in test-support/model-fixtures.js. A row and the comparison have tests of
 * their own, under layout/model/; these cases are about the page round them.
 */

jest.mock('recharts', () => require('../../test-support/model-fixtures.js').sizedRecharts());
jest.mock('../../import/layout/model/source.js', () => ({
    loadListing: jest.fn(),
    loadReport: jest.fn(),
}));

//
// the reader's subscriptions, for the bells (#255). Signed out unless a case says
// otherwise -- and the api's session reader imports Amplify, which jest cannot load
// unmocked
//
jest.mock('../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(),
}));

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ModelLayout, { linkedCompare, writeCompare } from '../../import/layout/model.jsx';
import { loadListing, loadReport } from '../../import/layout/model/source.js';
import { listSubscriptions } from '../../import/general/account-api.js';
import { COMPARE_COLORS, SCORES } from '../../import/layout/model/scores.js';
import { readLayout, writeLayout } from '../../import/general/layout-preference.js';
import { behindOf, downModelOf, listingOf, modelOf, phoneScreen, trackOf, wideScreen } from '../../test-support/model-fixtures.js';

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });

    return { promise, resolve };
}

function answer(listing = listingOf(), records = () => trackOf(5)) {
    loadListing.mockResolvedValue(listing);
    loadReport.mockImplementation((name) => Promise.resolve(records(name)));
}

async function open(props = {}) {
    const ref = React.createRef();
    let view;

    await act(async () => {
        view = render(
            <MemoryRouter>
                <ModelLayout ref={ref} {...props} />
            </MemoryRouter>
        );
    });

    return { ...view, ref };
}

//
// the address the page was opened at
//
function at(address) {
    window.history.replaceState(null, '', address);
}

function group(name) {
    return screen.getByRole('region', { name: name });
}

//
// the models a list names, in its order: the links of their names, and not the
// bells beside them (#255)
//
function namesIn(name) {
    return within(screen.getByRole('list', { name: `${name} models` }))
        .getAllByRole('link')
        .filter((link) => link.classList.contains('model-name'))
        .map((link) => link.textContent);
}

function box(name) {
    return screen.getByRole('checkbox', { name: `Compare ${name}` });
}

beforeEach(() => {
    loadListing.mockReset();
    loadReport.mockReset();
    listSubscriptions.mockReset();
    listSubscriptions.mockResolvedValue(null);
    at('/model');
    // the filters' fold and width are kept, as a reader's are (#253)
    window.localStorage.clear();
});

describe('the bells (#255)', () => {
    //
    // one on every row whose model can still go live, leading to its alarm page,
    // and ringing for a reader who holds its alarm -- from one ask of the reader's
    // subscriptions, for every row, as /stream asks
    //
    const LIVE = { alarm: 'live', since: '2026-10-18T12:00:00Z', terms: '2026-10' };
    const bellOf = (name) => document.querySelector(`a[href="/model/${name}/alarm"] svg`);

    it('gives every model that has not retired a plain bell, for a reader signed out', async () => {
        answer();
        await open();

        ['pt-gnn', 'tables', 'fresh'].forEach((name) => {
            expect(bellOf(name)).toHaveAttribute('data-testid', 'NotificationsIcon');
        });
        expect(document.querySelector('a[href="/model/beater/alarm"]')).toBeNull();
    });

    it('rings the bell of a model whose alarm the reader holds, and no other', async () => {
        listSubscriptions.mockResolvedValue([{ model: 'tables', ...LIVE }]);
        answer();
        await open();

        expect(screen.getByRole('link', { name: 'Alarm for tables: subscribed' })).toHaveAttribute('href', '/model/tables/alarm');
        expect(bellOf('tables')).toHaveAttribute('data-testid', 'NotificationsActiveIcon');
        expect(bellOf('pt-gnn')).toHaveAttribute('data-testid', 'NotificationsIcon');
        expect(bellOf('fresh')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('lights no bell for a stream\'s alarm, even one sharing a model\'s name', async () => {
        listSubscriptions.mockResolvedValue([{ stream: 'pt-gnn', alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: '2026-09' }]);
        answer();
        await open();

        expect(bellOf('pt-gnn')).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('asks for the subscriptions once, for the whole list', async () => {
        answer();
        await open();

        expect(listSubscriptions).toHaveBeenCalledTimes(1);
        expect(screen.getAllByRole('link', { name: /^Alarm for / })).toHaveLength(3);
    });

    it('leaves every bell plain when the subscriptions could not be listed', async () => {
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        listSubscriptions.mockRejectedValue(new Error('busy, try again'));
        answer();
        await open();

        expect(quiet).toHaveBeenCalledWith(expect.stringContaining('busy, try again'));
        expect(bellOf('pt-gnn')).toHaveAttribute('data-testid', 'NotificationsIcon');

        quiet.mockRestore();
    });

    it('lets the subscriptions go when they land after the page has', async () => {
        const late = deferred();

        listSubscriptions.mockReturnValue(late.promise);
        answer();

        const { unmount } = await open();

        unmount();

        await act(async () => late.resolve([{ model: 'pt-gnn', ...LIVE }]));

        expect(document.querySelector('a[href="/model/pt-gnn/alarm"]')).toBeNull();
    });
});

describe('linkedCompare', () => {
    const { models } = listingOf();

    it('reads the models an address compares, each in the color slot of its place', () => {
        expect(linkedCompare('?compare=tables,pt-gnn', models)).toEqual([
            { name: 'tables', slot: 0 },
            { name: 'pt-gnn', slot: 1 },
        ]);
    });

    it('passes over a name the listing does not hold, one named twice, another task\'s, and a fourth', () => {
        const four = models.concat([modelOf({ name: 'fourth' })]);

        expect(linkedCompare('?compare=nope,pt-gnn,pt-gnn,beater, tables ,fresh,fourth', four).map((each) => each.name))
            .toEqual(['pt-gnn', 'tables', 'fresh']);
    });

    it('compares nothing where the address says nothing', () => {
        expect(linkedCompare('', models)).toEqual([]);
        expect(linkedCompare('?compare=', models)).toEqual([]);
    });
});

describe('writeCompare', () => {
    it('puts the comparison in the address, its commas as commas, in place of it rather than after it', () => {
        const length = window.history.length;

        writeCompare(['pt-gnn', 'tables']);

        expect(window.location.search).toBe('?compare=pt-gnn,tables');
        expect(window.history.length).toBe(length);
    });

    it('keeps whatever else the address holds', () => {
        at('/model?x=1#top');

        writeCompare(['pt-gnn']);

        expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/model?x=1&compare=pt-gnn#top');
    });

    it('takes the comparison out where nothing is compared', () => {
        at('/model?compare=pt-gnn,tables');

        writeCompare([]);

        expect(window.location.search).toBe('');
    });

    it('leaves an address that already says it alone', () => {
        at('/model?compare=pt-gnn,tables');

        const replace = jest.spyOn(window.history, 'replaceState');

        writeCompare(['pt-gnn', 'tables']);

        expect(replace).not.toHaveBeenCalled();
        replace.mockRestore();
    });
});

describe('the page before the listing', () => {
    it('titles itself "Models", and says it is loading', async () => {
        loadListing.mockReturnValue(new Promise(() => {}));

        await open();

        expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
        expect(screen.getByText('Loading the models…')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent(/^$/);
    });

    it('says there are no models to show yet, and counts none, where the listing could not be had', async () => {
        answer(null);

        await open();

        expect(screen.getByText('No models to show yet.')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('0');
        expect(loadReport).not.toHaveBeenCalled();
    });

    it('says no models have been published yet for an empty listing', async () => {
        answer({ tasks: [], models: [] });

        await open();

        expect(screen.getByText('No models have been published yet.')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('0');
    });

    it('sets nothing once it has gone, whenever the listing or a record lands', async () => {
        const listing = deferred();

        loadListing.mockReturnValue(listing.promise);

        const first = await open();

        first.unmount();
        await act(async () => listing.resolve(listingOf()));
        expect(loadReport).not.toHaveBeenCalled();

        const record = deferred();

        loadListing.mockResolvedValue(listingOf());
        loadReport.mockReturnValue(record.promise);

        const second = await open();

        second.unmount();
        await act(async () => record.resolve(trackOf()));
        expect(loadReport).toHaveBeenCalledTimes(4);
    });
});

describe('the lists', () => {
    it('lists every model, one list per task, and counts them', async () => {
        answer();

        await open();

        expect(document.querySelector('.model-count')).toHaveTextContent('4');
        expect(within(group('Next-day direction')).getByText('3 models')).toBeInTheDocument();
        expect(within(group('Beat the average')).getByText('1 model')).toBeInTheDocument();
        expect(within(group('Next-day direction')).getByText('Up or down, scored the next day.')).toBeInTheDocument();
    });

    it('leaves out a task\'s line under its name where the listing has none', async () => {
        const listing = listingOf();

        listing.tasks[1].description = '';
        answer(listing);

        await open();

        expect(group('Beat the average').querySelector('.model-group-detail')).toBeNull();
    });

    it('asks for each model\'s track record, for its trend line', async () => {
        answer();

        await open();

        expect(loadReport.mock.calls.map((call) => call.join(' '))).toEqual([
            'pt-gnn track-record', 'tables track-record', 'fresh track-record', 'beater track-record',
        ]);
    });

    it('draws a trend line once a record is in, and passes over one that could not be had', async () => {
        answer(listingOf(), (name) => (name === 'tables' ? null : trackOf(5)));

        await open();

        expect(screen.getByRole('img', { name: 'pt-gnn\'s 20-day Loss, over the last 60 days' })).toBeInTheDocument();
        expect(group('Next-day direction').querySelector('.model-trend-none')).toHaveAttribute('title', 'Could not be loaded');
    });

    it('sorts by the best score to start with', async () => {
        answer();

        await open();

        expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables', 'fresh']);
    });

    it('sorts by what the sort menu says', async () => {
        answer();
        await open();

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'name');
        expect(namesIn('Next-day direction')).toEqual(['fresh', 'pt-gnn', 'tables']);

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'went');
        expect(namesIn('Next-day direction')).toEqual(['tables', 'pt-gnn', 'fresh']);
    });

    it('heads the score\'s column with the score picked, and sorts by it', async () => {
        answer();

        await open({ score: 'acc_up' });

        expect(group('Next-day direction').querySelector('.model-list-head')).toHaveTextContent('Up/down accuracy, last 20 days');
        expect(namesIn('Next-day direction')).toEqual(['tables', 'pt-gnn', 'fresh']);
    });

    it('heads every column in a row\'s order, the bell\'s third with no name, after Model (#259)', async () => {
        answer();

        await open();

        const headings = [...group('Next-day direction').querySelector('.model-list-head').children]
            .map((heading) => heading.textContent);

        expect(headings).toEqual(['Compare', 'Model', '', 'Loss, last 20 days', 'Last 60 days', 'Live version', 'Went live']);
    });

    it('gives the score\'s heading the note of the score picked (#265)', async () => {
        answer();

        await open({ score: 'auc_beats' });

        const heading = group('Next-day direction').querySelector('.model-list-head').children[3];

        expect(heading).toHaveTextContent('Beat-the-average AUC, last 20 days');
        expect(heading).toHaveAccessibleDescription(SCORES.find((score) => score.key === 'auc_beats').note);
        expect(heading.querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
    });

    it('lets the keyboard reach the score\'s heading, which a screen reader is shown, and hides the rest (#265)', async () => {
        //
        // something the keyboard can reach can't sit in a part of the page hidden
        // from a screen reader, so the score's heading alone is not hidden
        //
        answer();

        await open();

        const head = group('Next-day direction').querySelector('.model-list-head');
        const [compare, model, bell, score, trend, live, went] = [...head.children];

        expect(head).not.toHaveAttribute('aria-hidden');
        expect(score).toHaveAttribute('tabindex', '0');
        expect(score).not.toHaveAttribute('aria-hidden');
        [compare, model, bell, trend, live, went].forEach((heading) => expect(heading).toHaveAttribute('aria-hidden', 'true'));

        await userEvent.hover(score);

        expect(await screen.findByRole('tooltip')).toHaveTextContent(SCORES[0].note);
    });

    it('hands the score picked up, for both pages to show', async () => {
        const onScore = jest.fn();

        answer();
        await open({ onScore: onScore });

        await userEvent.click(screen.getByRole('button', { name: 'Beat-the-average AUC' }));

        expect(onScore).toHaveBeenCalledWith('auc_beats');
    });
});

describe('the title', () => {
    it('says what the models are for, what they read and what they predict, linking the graph and the data (#251)', async () => {
        answer();
        await open();

        const lede = document.querySelector('.model-lede');

        expect(lede).toHaveTextContent(
            'Each night these models read the day’s knowledge graph, built from the data this site collects, and predict '
            + 'how each S&P 500 stock will move the next trading day. Once that day’s prices are in, every prediction is '
            + 'graded against a guess that knows nothing, to show whether the data can predict the market at all.'
        );
        expect(within(lede).getByRole('link', { name: 'knowledge graph' })).toHaveAttribute('href', '/graph');
        expect(within(lede).getByRole('link', { name: 'data this site collects' })).toHaveAttribute('href', '/stream');
    });
});

describe('the filters', () => {
    afterEach(wideScreen);

    //
    // the filters' column, and the button that is its heading, named as it is
    // while the column is open
    //
    function filters() {
        return screen.getByRole('complementary', { name: 'Filters' });
    }

    it('offer every task and every status as a row, pressed while its models are shown, with how many it holds', async () => {
        answer();
        await open();

        const rows = within(filters()).getAllByRole('button', { pressed: true });

        expect(rows.map((row) => row.textContent)).toEqual(['Next-day direction3', 'Beat the average1', 'Live2', 'New1', 'Retired1']);
        expect(within(filters()).queryByRole('checkbox')).toBeNull();
        expect(within(filters()).getByRole('region', { name: 'What it predicts' })).toBeInTheDocument();
        expect(within(filters()).getByRole('region', { name: 'Status' })).toBeInTheDocument();
    });

    it('hide a task\'s list when its row is pressed, and show it again when it is pressed again (#251)', async () => {
        answer();
        await open();

        const row = screen.getByRole('button', { name: 'Beat the average 1' });

        await userEvent.click(row);

        expect(row).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByRole('region', { name: 'Beat the average' })).toBeNull();
        expect(document.querySelector('.model-count')).toHaveTextContent('3 of 4');

        await userEvent.click(row);

        expect(row).toHaveAttribute('aria-pressed', 'true');
        expect(group('Beat the average')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('4');
    });

    it('hide the models of a status when its row is pressed', async () => {
        answer();
        await open();

        await userEvent.click(screen.getByRole('button', { name: 'New 1' }));

        expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables']);
    });

    it('offer Behind baseline once the listing carries the trainer\'s checks, count a model taken down, and hide it when pressed (#263)', async () => {
        const { models } = listingOf();

        answer(listingOf([...models.map((model) => ({ ...model, behind: behindOf() })), downModelOf()]));
        await open();

        const statuses = within(within(filters()).getByRole('region', { name: 'Status' })).getAllByRole('button');

        expect(statuses.map((row) => row.textContent)).toEqual(['Live2', 'New1', 'Behind baseline1', 'Retired1']);
        expect(namesIn('Next-day direction')).toContain('lagging');

        await userEvent.click(screen.getByRole('button', { name: 'Behind baseline 1' }));

        expect(namesIn('Next-day direction')).toEqual(['pt-gnn', 'tables', 'fresh']);
        expect(document.querySelector('.model-count')).toHaveTextContent('4 of 5');
    });

    it('leave Behind baseline out of a listing before format 2, which can take no model down (#263)', async () => {
        answer();
        await open();

        expect(within(filters()).queryByRole('button', { name: /^Behind baseline/ })).toBeNull();
    });

    it('say so when they leave no model', async () => {
        answer();
        await open();

        await userEvent.click(screen.getByRole('button', { name: 'Next-day direction 3' }));
        await userEvent.click(screen.getByRole('button', { name: 'Beat the average 1' }));

        expect(screen.getByText('No model matches these filters.')).toBeInTheDocument();
        expect(document.querySelector('.model-count')).toHaveTextContent('0 of 4');
    });

    it('open on a wide screen, and fold to a rail by the arrow on its edge or by its heading (#251)', async () => {
        answer();
        await open();

        const heading = within(filters()).getByRole('button', { name: 'Filters' });

        expect(filters()).toHaveClass('model-filters-open');
        expect(heading).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(within(filters()).getByRole('button', { name: 'Collapse the filters' }));

        expect(filters()).toHaveClass('model-filters-closed');
        expect(heading).toHaveAttribute('aria-expanded', 'false');
        expect(within(filters()).queryByRole('button', { name: 'Collapse the filters' })).toBeNull();

        await userEvent.click(heading);

        expect(filters()).toHaveClass('model-filters-open');
        expect(heading).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(heading);

        expect(filters()).toHaveClass('model-filters-closed');
    });

    it('say while folded how many models they show, and how many of them where some are hidden', async () => {
        answer();
        await open();

        const heading = within(filters()).getByRole('button', { name: 'Filters' });

        expect(heading.querySelector('.model-filters-summary')).toBeNull();

        await userEvent.click(heading);

        expect(heading.querySelector('.model-filters-summary')).toHaveTextContent(/^4 models$/);

        await userEvent.click(heading);
        await userEvent.click(screen.getByRole('button', { name: 'New 1' }));
        await userEvent.click(heading);

        expect(heading.querySelector('.model-filters-summary')).toHaveTextContent(/^3 of 4 models$/);
    });

    it('start folded on a phone, as a band that opens when it is tapped', async () => {
        phoneScreen();
        answer();
        await open();

        const heading = within(filters()).getByRole('button', { name: 'Filters 4 models' });

        expect(filters()).toHaveClass('model-filters-closed');
        expect(heading).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(heading);

        expect(filters()).toHaveClass('model-filters-open');
    });
});

describe('the filters, dragged and kept (#253)', () => {
    afterEach(wideScreen);

    function filters() {
        return screen.getByRole('complementary', { name: 'Filters' });
    }

    const grip = () => filters().querySelector('.model-filters-grip');
    const width = () => filters().style.getPropertyValue('--model-filters-width');

    //
    // jsdom implements no PointerEvent, so testing-library cannot carry clientX
    // on one. A MouseEvent of the same type can -- see graph.test.jsx
    //
    function pointer(type, target, init = {}) {
        fireEvent(target, new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
    }

    //
    // the column at its own 14rem, as a wide screen lays it out and jsdom does
    // not
    //
    function sized(px = 196) {
        Object.defineProperty(filters(), 'offsetWidth', { value: px, configurable: true });
    }

    async function dragFrom(x) {
        answer();
        const view = await open();

        sized();
        pointer('pointerdown', grip(), { clientX: x, button: 0 });

        return view;
    }

    it('draw a strip on the open column\'s edge to drag it by, and none while it is folded', async () => {
        answer();
        await open();

        expect(grip()).toHaveAttribute('aria-hidden', 'true');

        await userEvent.click(within(filters()).getByRole('button', { name: 'Collapse the filters' }));

        expect(grip()).toBeNull();
    });

    it('follow a drag wider or narrower, and keep the width once the pointer comes up', async () => {
        await dragFrom(300);

        pointer('pointermove', window, { clientX: 384 });

        expect(width()).toBe('280px');
        expect(readLayout('model', 'wide').size).toEqual({});

        pointer('pointerup', window);

        expect(readLayout('model', 'wide')).toEqual({ fold: { filters: false }, size: { filters: 280 } });
    });

    it('stop at 10rem and at 22rem', async () => {
        await dragFrom(300);

        pointer('pointermove', window, { clientX: 600 });
        expect(width()).toBe('308px');

        pointer('pointermove', window, { clientX: 250 });
        expect(width()).toBe('146px');

        pointer('pointermove', window, { clientX: 196 });
        expect(width()).toBe('140px');
        expect(filters()).toHaveClass('model-filters-open');

        pointer('pointerup', window);

        expect(readLayout('model', 'wide').size).toEqual({ filters: 140 });
    });

    it('fold into the rail once dragged more than 48px past 10rem, keep the fold, and follow the pointer no further', async () => {
        await dragFrom(300);

        pointer('pointermove', window, { clientX: 195 });

        expect(filters()).toHaveClass('model-filters-closed');
        expect(readLayout('model', 'wide')).toEqual({ fold: { filters: true }, size: {} });

        pointer('pointermove', window, { clientX: 600 });

        expect(filters()).toHaveClass('model-filters-closed');
    });

    it('start no drag from a button other than the main one', async () => {
        await dragFrom(300);
        pointer('pointerup', window);

        pointer('pointerdown', grip(), { clientX: 300, button: 2 });
        pointer('pointermove', window, { clientX: 384 });

        expect(width()).toBe('');
    });

    it('stop following the pointer when the page goes mid-drag', async () => {
        const removed = jest.spyOn(window, 'removeEventListener');
        const { unmount } = await dragFrom(300);

        unmount();

        expect(removed).toHaveBeenCalledWith('pointermove', expect.any(Function));
        expect(removed).toHaveBeenCalledWith('pointerup', expect.any(Function));

        removed.mockRestore();
    });

    it('open at the width this browser kept, and at their own where it kept one outside 10rem to 22rem', async () => {
        writeLayout('model', 'wide', { fold: {}, size: { filters: 280 } });
        answer();

        const { unmount } = await open();

        expect(width()).toBe('280px');

        unmount();
        writeLayout('model', 'wide', { fold: {}, size: { filters: 400 } });
        answer();
        await open();

        expect(width()).toBe('');
        expect(filters()).toHaveClass('model-filters-open');
    });

    it('keep a fold by the arrow or the heading, and open folded on the next visit', async () => {
        answer();

        const { unmount } = await open();

        await userEvent.click(within(filters()).getByRole('button', { name: 'Collapse the filters' }));

        expect(readLayout('model', 'wide').fold).toEqual({ filters: true });

        unmount();
        answer();
        await open();

        expect(filters()).toHaveClass('model-filters-closed');

        await userEvent.click(within(filters()).getByRole('button', { name: /^Filters/ }));

        expect(readLayout('model', 'wide').fold).toEqual({ filters: false });
    });

    it('keep a phone\'s band opened or folded, apart from a wide screen\'s column', async () => {
        phoneScreen();
        answer();

        const { unmount } = await open();

        await userEvent.click(within(filters()).getByRole('button', { name: 'Filters 4 models' }));

        expect(readLayout('model', 'narrow').fold).toEqual({ filters: false });
        expect(readLayout('model', 'wide').fold).toEqual({});

        unmount();
        answer();
        await open();

        expect(filters()).toHaveClass('model-filters-open');
    });
});

describe('compare', () => {
    it('says how to start one, then how to finish it', async () => {
        answer();
        await open();

        expect(screen.getByText('Tick two or three models that predict the same thing to compare them.')).toBeInTheDocument();

        await userEvent.click(box('pt-gnn'));

        expect(screen.getByText('Tick one or two more Next-day direction models to compare them with pt-gnn.')).toBeInTheDocument();
    });

    it('draws the comparison once two of one task are ticked, and writes it in the address', async () => {
        answer();
        await open();

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));

        expect(screen.getByRole('heading', { name: 'Comparing pt-gnn and tables' })).toBeInTheDocument();
        expect(window.location.search).toBe('?compare=pt-gnn,tables');
    });

    it('lets no model of another task be ticked beside them, and says why', async () => {
        answer();
        await open();

        await userEvent.click(box('pt-gnn'));

        expect(box('beater')).toBeDisabled();
        expect(box('tables')).toBeEnabled();
    });

    it('lets no fourth be ticked', async () => {
        const listing = listingOf();

        listing.models.push(modelOf({ name: 'fourth' }));
        answer(listing);
        await open();

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));
        await userEvent.click(box('fresh'));

        expect(box('fourth')).toBeDisabled();
        expect(screen.getByRole('heading', { name: 'Comparing pt-gnn, tables and fresh' })).toBeInTheDocument();
    });

    it('turns down a model that cannot be ticked, however it is asked', async () => {
        answer();
        const { ref } = await open();

        await userEvent.click(box('pt-gnn'));
        act(() => ref.current.pick(listingOf().models[3]));

        expect(ref.current.state.picked.map((each) => each.name)).toEqual(['pt-gnn']);
    });

    it('keeps each model\'s color while it stays ticked, and gives a freed one to the next ticked', async () => {
        answer();
        const { container } = await open();
        const swatch = (name) => box(name).closest('.model-row').querySelector('.model-swatch');

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));
        await userEvent.click(box('fresh'));

        expect(swatch('fresh')).toHaveStyle({ backgroundColor: COMPARE_COLORS[2] });

        await userEvent.click(box('pt-gnn'));

        expect(swatch('tables')).toHaveStyle({ backgroundColor: COMPARE_COLORS[1] });
        expect(swatch('fresh')).toHaveStyle({ backgroundColor: COMPARE_COLORS[2] });
        expect(swatch('pt-gnn')).toBeNull();
        expect(window.location.search).toBe('?compare=tables,fresh');

        await userEvent.click(box('pt-gnn'));

        expect(swatch('pt-gnn')).toHaveStyle({ backgroundColor: COMPARE_COLORS[0] });
        expect(window.location.search).toBe('?compare=pt-gnn,tables,fresh');

        const lines = [...container.querySelectorAll('.model-compare .recharts-line-curve')].map((line) => line.getAttribute('stroke'));

        expect(lines).toEqual(expect.arrayContaining(COMPARE_COLORS));
    });

    it('is cleared from its button, and from the address', async () => {
        answer();
        await open();

        await userEvent.click(box('pt-gnn'));
        await userEvent.click(box('tables'));
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(screen.queryByRole('heading', { name: /^Comparing/ })).toBeNull();
        expect(box('pt-gnn')).not.toBeChecked();
        expect(window.location.search).toBe('');
    });

    it('reopens from an address that names one', async () => {
        at('/model?compare=tables,pt-gnn');
        answer();

        await open();

        expect(screen.getByRole('heading', { name: 'Comparing tables and pt-gnn' })).toBeInTheDocument();
        expect(box('tables')).toBeChecked();
        expect(box('pt-gnn')).toBeChecked();
    });

    it('rewrites an address that names what cannot be compared as what it does compare', async () => {
        at('/model?compare=pt-gnn,nope,beater');
        answer();

        await open();

        expect(window.location.search).toBe('?compare=pt-gnn');
    });
});
