/**
 * home-page.test.jsx: the front page.
 *
 * Two things live here that are worth testing, and they are unrelated to each other:
 *
 *   - the content filter, which on a phone collapses into a Filter button and back,
 *     and which decides which of the two article listings are on screen
 *
 *   - componentDidUpdate, a ~90 line merge that joins the day's stock splits against
 *     the ticker list and reshapes the result for ArticleListing. It runs only when
 *     the chosen date changes, so it is invisible to a test that just renders.
 *
 * Note: GraphCluster and ArticleListing are mocked as probes. GraphCluster is a
 *       47k d3 simulation with its own suite, and rendering it here would make every
 *       assertion below depend on it.
 *
 * Note: get-data.js is mocked. The real one reaches the network, and the merge under
 *       test is defined entirely by what it returns.
 *
 * Note: react-datepicker is replaced by a button that fires its onChange with a
 *       fixed date. The real widget needs a calendar popup opened and a day clicked
 *       to produce the same single call.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: { currentSession: jest.fn().mockRejectedValue(new Error('no session')) },
}));

jest.mock('../../import/animation/graph-cluster.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid='graph-cluster' />,
}));

jest.mock('../../import/general/article-listing.jsx', () => ({
    __esModule: true,
    default: ({ title, list_article }) => (
        <div data-testid='listing' data-title={title} data-count={(list_article || []).length} />
    ),
}));

jest.mock('../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve([])),
}));

jest.mock('react-datepicker', () => ({
    __esModule: true,
    default: ({ onChange }) => (
        <button
            data-testid='date-picker'
            onClick={() => onChange(new Date('2026/09/10 12:00'))}
        >pick</button>
    ),
}));

import Auth from '@aws-amplify/auth';
import getData from '../../import/general/get-data.js';
import HomePage, { tradingDate } from '../../import/content/home-page.jsx';

//
// Note: async, and the render is awaited inside act(). componentDidMount fires three
//       getData promises and setStates when they resolve -- which is AFTER a
//       synchronous test body, so React warns that the update was not wrapped in
//       act() and setup.js turns that warning into a failure. Awaiting an async act
//       lets those microtasks settle while the component is still inside it.
//
async function setup() {
    const held = React.createRef();
    const dispatchLayout = jest.fn();
    let utils;

    await act(async () => {
        utils = render(<HomePage ref={held} dispatchLayout={dispatchLayout} />);
    });

    return { ...utils, page: held.current, dispatchLayout };
}

const listings = () => [...document.querySelectorAll('[data-testid="listing"]')]
    .map(n => n.getAttribute('data-title'));

const byText = (text) => [...document.querySelectorAll('button, h5')]
    .find(n => n.textContent.trim() === text);

//
// re-run componentDidUpdate by changing the date, with getData answering with the
// supplied split rows. Returns the remapped list the merge produced.
//
async function merge(page, split_rows, tickers = [], date = { dd: '10', mm: '09', yyyy: 2026 }) {
    getData.mockReturnValue(Promise.resolve(split_rows));

    await act(async () => {
        page.setState({ tickers, ...date });
    });

    return page.state.split_list;
}

beforeEach(() => {
    jest.clearAllMocks();
    getData.mockReturnValue(Promise.resolve([]));
});

describe('what the front page shows by default', () => {
    it('shows the knowledge-graph animation', async () => {
        const { getByTestId } = await setup();

        expect(getByTestId('graph-cluster')).toBeTruthy();
    });

    it('shows no article listings until summary is chosen', async () => {
        await setup();

        expect(listings()).toEqual([]);
    });

    it('offers the two presentation checkboxes', async () => {
        await setup();

        expect(document.body.textContent).toContain('StockMarket');
        expect(document.body.textContent).toContain('Summary');
    });

    it('tells redux to switch to the analysis layout on mount', async () => {
        const { dispatchLayout } = await setup();

        expect(dispatchLayout).toHaveBeenCalledTimes(1);
        expect(dispatchLayout.mock.calls[0][0]).toMatchObject({ layout: 'analysis' });
    });
});

describe('switching to the summary', () => {
    it('drops the animation', async () => {
        const { page } = await setup();

        act(() => {
            page.setDisplay('summary');
        });

        expect(document.querySelector('[data-testid="graph-cluster"]')).toBeNull();
    });

    it('shows both listings', async () => {
        const { page } = await setup();

        act(() => {
            page.setDisplay('summary');
        });

        expect(listings().sort()).toEqual(['Stock Split', 'Streams']);
    });

    it('is driven by the Summary checkbox', async () => {
        await setup();

        const summary = [...document.querySelectorAll('label')]
            .find(l => l.textContent.includes('Summary'))
            .querySelector('input');

        await userEvent.click(summary);

        expect(listings().length).toBe(2);
    });

    it('checks exactly one presentation box at a time', async () => {
        const { page } = await setup();

        act(() => {
            page.setDisplay('summary');
        });

        const checked = [...document.querySelectorAll('.checkbox-horizontal input')]
            .filter(i => i.checked);
        expect(checked).toHaveLength(1);
    });
});

describe('the content filter', () => {
    async function summary() {
        const utils = await setup();

        act(() => {
            utils.page.setDisplay('summary');
        });

        return utils;
    }

    it('offers a Filter button on a narrow viewport', async () => {
        await summary();

        expect(byText('Filter')).toBeTruthy();
    });

    it('collapses the page to the filter when Filter is pressed', async () => {
        //
        // the mobile flow: the listings are hidden so the filter has the screen to
        // itself, and the button becomes an Apply Filter.
        //
        await summary();

        await userEvent.click(byText('Filter'));

        expect(byText('Apply Filter')).toBeTruthy();
        expect(listings()).toEqual([]);
    });

    it('restores the listings when Apply Filter is pressed', async () => {
        await summary();

        await userEvent.click(byText('Filter'));
        await userEvent.click(byText('Apply Filter'));

        expect(listings().length).toBe(2);
        expect(byText('Filter')).toBeTruthy();
    });

    it('restores the listings when the exit cross is pressed', async () => {
        //
        // the exit and Apply Filter reset identical state -- there is no cancel, so
        // dismissing the sheet keeps whatever was ticked.
        //
        await summary();

        await userEvent.click(byText('Filter'));
        await userEvent.click(document.querySelector('.exit'));

        expect(listings().length).toBe(2);
    });

    it('labels the expanded filter as an editor', async () => {
        await summary();

        await userEvent.click(byText('Filter'));

        expect(byText('Edit Content Filter')).toBeTruthy();
    });

    it('uses the vertical default layout for the side column', async () => {
        await summary();

        expect(document.querySelector('.checkbox-vertical-default')).toBeTruthy();
    });

    it('uses the expanded layout once collapsed', async () => {
        await summary();

        await userEvent.click(byText('Filter'));

        expect(document.querySelector('.checkbox-vertical-expanded')).toBeTruthy();
    });
});

describe('the stream and split checkboxes', () => {
    async function summary() {
        const utils = await setup();

        act(() => {
            utils.page.setDisplay('summary');
        });

        return utils;
    }

    it('hides the Streams listing when Streams is unticked', async () => {
        const { page } = await summary();

        act(() => {
            page.toggleStockStream();
        });

        expect(listings()).toEqual(['Stock Split']);
    });

    it('hides the Stock Split listing when Stock Split is unticked', async () => {
        const { page } = await summary();

        act(() => {
            page.toggleStockSplit();
        });

        expect(listings()).toEqual(['Streams']);
    });

    it('hides both when both are unticked', async () => {
        const { page } = await summary();

        act(() => {
            page.toggleStockStream();
            page.toggleStockSplit();
        });

        expect(listings()).toEqual([]);
    });

    it('toggles back on', async () => {
        const { page } = await summary();

        act(() => {
            page.toggleStockStream();
        });
        act(() => {
            page.toggleStockStream();
        });

        expect(listings().length).toBe(2);
    });

    //
    // the cases above call the toggles directly, which says what they DO and nothing
    // about whether either checkbox reaches them. These click the boxes instead: a
    // handler wired to the wrong toggle, or to none, passes every test above.
    //
    describe('driven by the checkboxes themselves', () => {
        const boxFor = (text) => [...document.querySelectorAll('label')]
            .find(l => l.textContent.trim() === text)
            .querySelector('input');

        it('unticks the Streams listing away', async () => {
            await summary();

            await userEvent.click(boxFor('Streams'));

            expect(listings()).toEqual(['Stock Split']);
        });

        it('unticks the Stock Split listing away', async () => {
            await summary();

            await userEvent.click(boxFor('Stock Split'));

            expect(listings()).toEqual(['Streams']);
        });

        it('leaves the other listing alone', async () => {
            //
            // the two checkboxes sit side by side and their handlers differ by one
            // word, so a copy-paste between them would hide the wrong listing --
            // which the assertions above would not notice on their own.
            //
            await summary();

            await userEvent.click(boxFor('Streams'));
            await userEvent.click(boxFor('Streams'));

            expect(listings().sort()).toEqual(['Stock Split', 'Streams']);
        });
    });
});

describe('the presentation checkboxes', () => {
    const horizontalBox = (text) => [...document.querySelectorAll('.checkbox-horizontal label')]
        .find(l => l.textContent.includes(text))
        .querySelector('input');

    it('is driven back to the animation by the StockMarket checkbox', async () => {
        //
        // the return trip, which nothing covered: 'is driven by the Summary checkbox'
        // clicks one way only, and setDisplay is otherwise called directly.
        //
        const { page } = await setup();

        act(() => {
            page.setDisplay('summary');
        });

        await userEvent.click(horizontalBox('StockMarket'));

        expect(document.querySelector('[data-testid="graph-cluster"]')).toBeTruthy();
        expect(listings()).toEqual([]);
    });
});

describe('the session lookup', () => {
    it('logs a live session rather than doing anything with it', async () => {
        //
        // the resolve arm. It logs the session object and stops -- nothing on the page
        // reads it, so a signed-in visitor sees exactly what a signed-out one sees.
        //
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        Auth.currentSession.mockResolvedValueOnce({ token: 'live' });
        const { page } = await setup();

        await page.currentUser();
        await act(async () => {});

        expect(quiet).toHaveBeenCalledWith({ token: 'live' });

        quiet.mockRestore();
    });

    it('logs the rejection rather than surfacing it', async () => {
        //
        // 'currentUser' is called by nothing on this page -- it neither renders from
        // the session nor gates anything on it. Both arms only log, so an expired
        // session and a live one are indistinguishable to the caller, and the method
        // cannot reject: the catch swallows it.
        //
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { page } = await setup();

        await expect(page.currentUser()).resolves.toBeUndefined();
        await act(async () => {});

        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });
});

describe('the trading date the page asks for', () => {
    //
    // the stock-split csv is published per weekday, so a weekend has to be walked
    // back to the Friday before asking for a file that does not exist.
    //
    afterEach(() => {
        jest.useRealTimers();
    });

    //
    // Note: ONLY Date is faked. Faking the timers as well stalls React 18's
    //       scheduler -- it flushes committed work through a timer/MessageChannel
    //       callback, so with those faked and never advanced the render never
    //       commits and the ref stays null. Every other clock API is left real.
    //
    async function mountOn(when) {
        jest.useFakeTimers({
            doNotFake: [
                'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
                'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask',
                'requestAnimationFrame', 'cancelAnimationFrame',
                'requestIdleCallback', 'cancelIdleCallback',
                'performance', 'hrtime',
            ],
        });
        jest.setSystemTime(new Date(when));

        const held = React.createRef();

        await act(async () => {
            render(<HomePage ref={held} dispatchLayout={jest.fn()} />);
        });

        return held.current.state;
    }

    it('uses today on a weekday', async () => {
        expect((await mountOn('2026/08/05 12:00')).dd).toBe('05');
    });

    it('walks a Saturday back one day', async () => {
        expect((await mountOn('2026/08/08 12:00')).dd).toBe('07');
    });

    it('walks a Sunday back two days', async () => {
        expect((await mountOn('2026/08/09 12:00')).dd).toBe('07');
    });

    it('records the month and year alongside it', async () => {
        const state = await mountOn('2026/08/05 12:00');

        expect(state.mm).toBe('08');
        expect(state.yyyy).toBe(2026);
    });

    it('rolls back into the previous month on a Saturday the 1st', async () => {
        //
        // FIXED, in home-page.jsx. The walk-back subtracted from the day of the MONTH
        // rather than moving the date:
        //
        //     var dd = String(today.getDate() - 1).padStart(2, '0');
        //
        // so Saturday the 1st produced '00' and the page requested
        // '.../2026/08/00.csv'. It should have asked for the Friday before, which is in
        // July. The request 404d, the split listing stayed empty, and nothing said why
        // -- wrong at most a few times a year, which is why it survived.
        //
        const state = await mountOn('2026/08/01 12:00');

        expect(state.dd).toBe('31');
        expect(state.mm).toBe('07');
        expect(state.yyyy).toBe(2026);
    });

    it('rolls back two days, and across the month, on a Sunday the 1st', async () => {
        //
        // the same defect one worse: subtracting two from the 1st gave '-1', so the url
        // became '.../2026/11/-1.csv'. Friday before Sunday 1 November is 30 October.
        //
        const state = await mountOn('2026/11/01 12:00');

        expect(state.dd).toBe('30');
        expect(state.mm).toBe('10');
        expect(state.yyyy).toBe(2026);
    });

    it('rolls back across a year boundary', async () => {
        //
        // 1 January 2028 is a Saturday, so the trading day is 31 December 2027 -- the
        // case that needs the year to move as well as the month. setDate() handles both.
        //
        const state = await mountOn('2028/01/01 12:00');

        expect(state.dd).toBe('31');
        expect(state.mm).toBe('12');
        expect(state.yyyy).toBe(2027);
    });

    it('applies the same weekend walk-back when a date is picked', async () => {
        //
        // the picker repeats the constructor's logic rather than sharing it, so both
        // copies have to be checked -- and both carry the defect above.
        //
        const { page } = await setup();

        act(() => {
            page.setDisplay('summary');
        });

        await userEvent.click(document.querySelector('[data-testid="date-picker"]'));

        expect(page.state.dd).toBe('10');
        expect(page.state.mm).toBe('09');
        expect(page.state.yyyy).toBe(2026);
    });
});

describe('merging the day\'s splits with the ticker list', () => {
    const SPLIT = {
        ticker: 'AAPL',
        split_ratio: '4:1',
        split_date: '09/10/2026',
    };

    it('requests the split file only when the date changes', async () => {
        const { page } = await setup();
        getData.mockClear();

        await act(async () => {
            page.setState({ display: 'summary' });
        });

        expect(getData).not.toHaveBeenCalled();
    });

    it('requests the split file for the chosen date', async () => {
        const { page } = await setup();
        getData.mockClear();

        await merge(page, []);

        expect(getData).toHaveBeenCalled();
        expect(getData.mock.calls[0][0]).toBe('stock-split');
    });

    it('keeps a split whose date matches the chosen day', async () => {
        const { page } = await setup();

        const list = await merge(page, [SPLIT]);

        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('AAPL');
    });

    it('nulls out a split from another day', async () => {
        //
        // WORTH KNOWING: non-matching rows become null rather than being filtered, so
        // the array handed to ArticleListing is padded with holes. Every consumer has
        // to tolerate them.
        //
        const { page } = await setup();

        const list = await merge(page, [{ ...SPLIT, split_date: '09/11/2026' }]);

        expect(list).toEqual([null]);
    });

    it('de-duplicates repeated tickers, keeping the last', async () => {
        const { page } = await setup();

        const list = await merge(page, [
            { ...SPLIT, split_ratio: '2:1' },
            { ...SPLIT, split_ratio: '4:1' },
        ]);

        expect(list).toHaveLength(1);
        expect(list[0].detail.Ratio).toBe('4:1');
    });

    it('defaults an unmatched split to n/a sector and industry', async () => {
        //
        // a split with no entry in the ticker list still has to render, so the two
        // columns ArticleListing shows are filled in rather than left undefined.
        //
        const { page } = await setup();

        const [entry] = await merge(page, [SPLIT]);

        expect(entry.detail.Sector).toBe('n/a');
        expect(entry.detail.Industry).toBe('n/a');
    });

    it('marks an unmatched split as belonging to no stream', async () => {
        //
        // the stream is only claimed when both columns are known, because the link it
        // builds points at a data page keyed on them.
        //
        const { page } = await setup();

        const [entry] = await merge(page, [SPLIT]);

        expect(entry.detail.Stream).toBe('none');
    });

    it('takes sector and industry from a matching ticker', async () => {
        const { page } = await setup();

        const [entry] = await merge(page, [SPLIT], [
            { Symbol: 'AAPL', Sector: 'Technology', Industry: 'Computers', Name: 'Apple Inc' },
        ]);

        expect(entry.detail.Sector).toBe('Technology');
        expect(entry.detail.Industry).toBe('Computers');
        expect(entry.detail.Stream).toBe('StockMarket');
    });

    it('builds a link carrying every detail the data page needs', async () => {
        const { page } = await setup();

        const [entry] = await merge(page, [SPLIT], [
            { Symbol: 'AAPL', Sector: 'Technology', Industry: 'Computers' },
        ]);

        expect(entry.link).toContain('item=StockMarket');
        expect(entry.link).toContain('sector=Technology');
        expect(entry.link).toContain('symbol=AAPL');
        expect(entry.link).toContain('ratio=4:1');
    });

    it('ignores a ticker with no split that day', async () => {
        //
        // the join requires a split_ratio, so a ticker on the list with nothing
        // splitting is dropped rather than rendered as an empty row.
        //
        const { page } = await setup();

        const list = await merge(page, [], [{ Symbol: 'MSFT', Sector: 'Tech', Industry: 'SW' }]);

        expect(list).toEqual([]);
    });

    it('passes the merged list to the listing component', async () => {
        const { page } = await setup();

        await merge(page, [SPLIT]);
        act(() => {
            page.setDisplay('summary');
        });

        const split = [...document.querySelectorAll('[data-testid="listing"]')]
            .find(n => n.getAttribute('data-title') === 'Stock Split');
        expect(split.getAttribute('data-count')).toBe('1');
    });

    it('survives a split row with no ticker at all', async () => {
        const { page } = await setup();

        const list = await merge(page, [{ split_ratio: '2:1', split_date: '09/10/2026' }]);

        expect(Array.isArray(list)).toBe(true);
    });
});

describe('the ticker and split load on mount', () => {
    //
    // componentDidMount fires three requests -- nasdaq tickers, custom tickers and the
    // day's splits -- and merges the answers in a single Promise.all callback. The mock
    // answers all three identically, so each row carries both a 'Symbol' (how the ticker
    // lists key) and a 'ticker' (how the split list keys), which lets one fixture drive
    // every branch of the merge.
    //
    function row(overrides = {}) {
        const today = tradingDate(new Date());

        return {
            Symbol: 'AAPL',
            ticker: 'AAPL',
            Name: 'Apple Inc',
            Sector: 'Technology',
            Industry: 'Computers',
            split_ratio: '4:1',
            split_date: `${today.mm}/${today.dd}/${today.yyyy}`,
            ...overrides,
        };
    }

    async function mountWith(rows) {
        getData.mockReturnValue(Promise.resolve(rows));
        return setup();
    }

    //
    // answer per REQUEST TYPE, so the ticker lists and the split list can differ. With one
    // shared answer every split row is also a ticker row, which means the merge always
    // takes the intersection branch and the exclusion branch -- the one that fills in the
    // n/a defaults -- is unreachable.
    //
    async function mountWithLists(tickerRows, splitRows) {
        getData.mockImplementation((type) => Promise.resolve(
            type === 'stock-split' ? splitRows : tickerRows
        ));
        return setup();
    }

    it('marks the ticker load complete', async () => {
        //
        // the only promise flag the page keeps: the others resolve well before a visitor
        // switches presentation, so this is the one the render waits on.
        //
        const { page } = await mountWith([row()]);

        expect(page.state.promise_list_ticker_complete).toBe(true);
    });

    it('requests the nasdaq, custom and split lists', async () => {
        await mountWith([row()]);

        const types = getData.mock.calls.map(c => c[0]);
        expect(types).toContain('ticker-nasdaq');
        expect(types).toContain('ticker-custom');
        expect(types).toContain('stock-split');
    });

    it('de-duplicates the two ticker lists into one', async () => {
        //
        // the nasdaq and custom lists overlap, and both are concatenated before the
        // reduce -- so without the dedup a symbol on both would be listed twice.
        //
        const { page } = await mountWith([row(), row({ Symbol: 'MSFT', ticker: 'MSFT' })]);

        expect(page.state.tickers.map(v => v.Symbol).sort()).toEqual(['AAPL', 'MSFT']);
    });

    it('trims the values it keeps', async () => {
        //
        // the csv arrives padded, and these values are rendered and compared against
        // split tickers -- ' AAPL' would match nothing.
        //
        const { page } = await mountWith([row({ Symbol: ' AAPL ', ticker: ' AAPL ' })]);

        expect(page.state.tickers[0].Symbol).toBe('AAPL');
    });

    it('joins a split against its ticker, taking sector and industry', async () => {
        const { page } = await mountWith([row()]);

        const [entry] = page.state.split_list.filter(Boolean);
        expect(entry.detail.Sector).toBe('Technology');
        expect(entry.detail.Industry).toBe('Computers');
        expect(entry.detail.Stream).toBe('StockMarket');
    });

    it('names the entry by its symbol and carries the ratio', async () => {
        const { page } = await mountWith([row()]);

        const [entry] = page.state.split_list.filter(Boolean);
        expect(entry.name).toBe('AAPL');
        expect(entry.detail.Ratio).toBe('4:1');
    });

    it('builds a deep link into the data page', async () => {
        const { page } = await mountWith([row()]);

        const [entry] = page.state.split_list.filter(Boolean);
        expect(entry.link).toContain('item=StockMarket');
        expect(entry.link).toContain('symbol=AAPL');
    });

    it('drops the Name column from a joined entry', async () => {
        //
        // the listing shows the symbol, and the company name would crowd the row -- so
        // the join strips it rather than the renderer having to.
        //
        const { page } = await mountWith([row()]);

        const [entry] = page.state.split_list.filter(Boolean);
        expect(entry.detail.Name).toBeUndefined();
    });

    it('nulls a split from a different day', async () => {
        //
        // the merge maps rather than filters, so a non-matching row becomes null and the
        // array handed to ArticleListing is padded with holes.
        //
        const { page } = await mountWith([row({ split_date: '01/02/1999' })]);

        expect(page.state.split_list).toEqual([null]);
    });

    it('defaults an unmatched split to n/a and no stream', async () => {
        //
        // a split with no entry in the ticker lists still has to render, so both columns
        // are filled in -- and the stream is only claimed when both are known, because
        // the link it builds is keyed on them.
        //
        const today = tradingDate(new Date());
        const { page } = await mountWithLists([row()], [{
            ticker: 'ZZZZ',
            split_ratio: '2:1',
            split_date: `${today.mm}/${today.dd}/${today.yyyy}`,
        }]);

        const unmatched = page.state.split_list.filter(Boolean).find(v => v.name === 'ZZZZ');
        expect(unmatched.detail.Sector).toBe('n/a');
        expect(unmatched.detail.Industry).toBe('n/a');
        expect(unmatched.detail.Stream).toBe('none');
    });

    it('copies the ticker into Symbol for an unmatched split', async () => {
        //
        // the listing renders 'name', which the remap reads from Symbol -- so a split
        // arriving with only a 'ticker' needs it copied across or the row is nameless.
        //
        const today = tradingDate(new Date());
        const { page } = await mountWithLists([row()], [{
            ticker: 'ZZZZ',
            split_ratio: '2:1',
            split_date: `${today.mm}/${today.dd}/${today.yyyy}`,
        }]);

        expect(page.state.split_list.filter(Boolean).map(v => v.name)).toContain('ZZZZ');
    });

    it('survives every request answering with nothing', async () => {
        //
        // the state after a total api outage: the reduces run over empty arrays and the
        // page still completes its load rather than hanging on the flag.
        //
        const { page } = await mountWith([]);

        expect(page.state.promise_list_ticker_complete).toBe(true);
        expect(page.state.tickers).toEqual([]);
        expect(page.state.split_list).toEqual([]);
    });

    it('hands the merged splits to the listing', async () => {
        const { page } = await mountWith([row()]);

        act(() => {
            page.setDisplay('summary');
        });

        const split = [...document.querySelectorAll('[data-testid="listing"]')]
            .find(n => n.getAttribute('data-title') === 'Stock Split');
        expect(Number(split.getAttribute('data-count'))).toBeGreaterThan(0);
    });
});
