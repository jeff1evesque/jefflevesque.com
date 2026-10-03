/**
 * stream-focus.test.jsx: one stream on its own, and the figures folded behind
 * the divider (#161).
 *
 * A stream's name, or '?item=' in the address, shows that stream on its own:
 * its name in the title with its controls, its figures in three boxes, a taller
 * graph, and a button over the title back to every stream (#167). Opening one is
 * a step in the browser's history, so the back button comes back. The figures
 * beside the rows start folded (#167), fold and drag, and the page keeps how
 * they were left.
 *
 * Note: get-data.js is mocked, so a request is only recorded, and every row
 *       waits on its report -- which is all this needs of the rows.
 *
 * Note: jest.config.js pins New York, which every local time below is read in.
 */

//
// signed out: the page asks the account api for the reader's subscriptions on
// mount, for the bells, and the api's session reader imports Amplify, which jest
// cannot load unmocked.
//
jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    listSubscriptions: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import React from 'react';
import { render, act, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import getData from '../../../import/general/get-data.js';
import StreamLayout from '../../../import/layout/stream/stream.jsx';
import StreamFocus, { shortCount, tickLabel } from '../../../import/layout/stream/stream-focus.jsx';
import { FIGURES_MIN } from '../../../import/layout/stream/stream-rows.jsx';
import { KEY, VERSION } from '../../../import/general/layout-preference.js';
import { STREAMS } from '../../../import/general/stream-id.js';
import { localInstant, pageWindow } from '../../../import/general/rolling-window.js';

function setup(address = '/stream') {
    window.history.replaceState({}, '', address);

    const held = React.createRef();
    const view = render(
        <MemoryRouter>
            <StreamLayout ref={held} />
        </MemoryRouter>
    );

    return { page: held.current, ...view };
}

function address() {
    return new URLSearchParams(window.location.search);
}

function focused() {
    const view = document.querySelector('.stream-focus');

    return view ? view.dataset.stream : null;
}

function rowNames() {
    return [...document.querySelectorAll('.stream-row .stream-row-title')]
        .map((title) => title.firstChild.textContent);
}

//
// a click on a stream's name, as a reader makes one. A plain click is the
// page's; the window listener keeps any other from jsdom, which cannot follow
// a link and says so as an error
//
function clickName(name) {
    const link = screen.getByRole('link', { name: name });
    const keep = (event) => event.preventDefault();

    window.addEventListener('click', keep);
    fireEvent.click(link);
    window.removeEventListener('click', keep);
}

//
// the browser's back or forward button: the address it lands on, and the
// event it sends
//
function land(path) {
    act(() => {
        window.history.replaceState({}, '', path);
        window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
    });
}

//
// the requests the page made for every stream since `from`, as their search
// parameters
//
function asked(from = 0) {
    return getData.mock.calls.slice(from).map((call) => new URL(String(call[1])).searchParams);
}

const kept = () => (JSON.parse(window.localStorage.getItem(KEY) || '{}').stream || {}).wide;
const keep = (wide) => window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, stream: { wide: wide } }));

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
});

afterAll(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
});


//
// a computed style whose scroll-margin-top is the one the phone's pinned header
// gives the element carrying `css_class` (#177) -- see '_navigation_anonymous.scss'.
// jsdom computes no stylesheet. Every other element, and every other property,
// is computed as jsdom would.
//
function pinnedMargin(css_class, margin = '78.4px') {
    const real = window.getComputedStyle;

    return jest.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
        const style = real.call(window, element, pseudo);

        if (!element.classList || !element.classList.contains(css_class)) {
            return style;
        }

        return new Proxy(style, {
            get: (target, key) => {
                if (key === 'scrollMarginTop') {
                    return margin;
                }

                const value = Reflect.get(target, key, target);

                return typeof value === 'function' ? value.bind(target) : value;
            },
        });
    });
}

describe('a stream opened from its name', () => {
    it('is shown on its own, in place of the rows', () => {
        setup();

        clickName('SEC Filings');

        expect(focused()).toBe('sec');
        expect(rowNames()).toEqual([]);
    });

    it('takes the title, with its controls beside it, and its schedule under it', () => {
        setup();

        clickName('S&P 500');

        const intro = document.querySelector('.stream-rows-intro');

        expect(within(intro).getByRole('heading')).toHaveTextContent('S&P 500');
        expect(within(intro).getByRole('button', { name: 'Triggers for S&P 500' })).toBeInTheDocument();
        expect(within(intro).getByRole('link', { name: 'Alarms for S&P 500' }))
            .toHaveAttribute('href', '/stream/stock-market/alarm');
        expect(intro.querySelector('span').textContent)
            .toBe('weekdays, every 20 min · Last 20 Days, one bar per day');
    });

    it('is a step in the browser\'s history, which keeps the window', () => {
        setup('/stream?rate=hour');

        const depth = window.history.length;

        clickName('Bureau of Labor Statistics');

        expect(window.history.length).toBe(depth + 1);
        expect(address().get('item')).toBe('bls');
        expect(address().get('rate')).toBe('hour');
    });

    it('asks for nothing again: every stream was asked for already', () => {
        setup();

        const before = getData.mock.calls.length;

        clickName('SEC Filings');

        expect(getData.mock.calls.length).toBe(before);
    });

    it('links each name to the address that opens it, at the window on screen', () => {
        const { page } = setup();

        act(() => {
            page.chooseWindow('Day', pageWindow('Day', null, -1));
        });

        const href = new URL(screen.getByRole('link', { name: 'SEC Filings' }).getAttribute('href'), 'http://localhost');

        expect(href.searchParams.get('item')).toBe('sec');
        expect(href.searchParams.get('rate')).toBe('day');
        expect(href.searchParams.get('end')).toBe(localInstant(page.state.end));
    });

    it('opens nothing again for the stream already shown', () => {
        const { page } = setup('/stream?item=sec');
        const depth = window.history.length;

        act(() => {
            page.openStream('sec');
        });

        expect(window.history.length).toBe(depth);
    });

    it('brings the page\'s top back into sight when it was scrolled out of it', () => {
        const { page } = setup();
        const box = document.querySelector('.stream-layout');

        box.scrollIntoView = jest.fn();
        box.getBoundingClientRect = () => ({ top: -300, bottom: 400, left: 0, right: 0, width: 0, height: 700 });

        act(() => {
            page.openStream('sec');
        });

        expect(box.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    });

    it('leaves the scroll alone when the page\'s top is in sight', () => {
        const { page } = setup();
        const box = document.querySelector('.stream-layout');

        box.scrollIntoView = jest.fn();

        act(() => {
            page.openStream('sec');
        });

        expect(box.scrollIntoView).not.toHaveBeenCalled();
    });

    it('brings the page\'s top down from under a phone\'s pinned header (#177)', () => {
        const { page } = setup();
        const box = document.querySelector('.stream-layout');
        const style = pinnedMargin('stream-layout');

        box.scrollIntoView = jest.fn();
        box.getBoundingClientRect = () => ({ top: 40, bottom: 740, left: 0, right: 0, width: 0, height: 700 });

        act(() => {
            page.openStream('sec');
        });

        expect(box.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });

        style.mockRestore();
    });

    it('leaves the scroll alone when the page\'s top is in sight below a pinned header', () => {
        const { page } = setup();
        const box = document.querySelector('.stream-layout');
        const style = pinnedMargin('stream-layout');

        box.scrollIntoView = jest.fn();
        box.getBoundingClientRect = () => ({ top: 120, bottom: 820, left: 0, right: 0, width: 0, height: 700 });

        act(() => {
            page.openStream('sec');
        });

        expect(box.scrollIntoView).not.toHaveBeenCalled();

        style.mockRestore();
    });
});

describe('a stream the address names', () => {
    it('is shown on its own from the start', () => {
        setup('/stream?item=us-national-weather');

        expect(focused()).toBe('us-national-weather');
        expect(screen.getByRole('heading', { name: 'US Weather Alerts' })).toBeInTheDocument();
    });

    it('is not shown when the address names no stream', () => {
        setup('/stream?item=nothing');

        expect(focused()).toBeNull();
        expect(rowNames()).toHaveLength(STREAMS.length);
    });

    it('lists only its own request under This request', () => {
        setup('/stream?item=sec');

        fireEvent.click(screen.getByRole('button', { name: 'This request' }));

        const items = screen.getAllByRole('menuitem');

        expect(items.map((item) => item.textContent)).toEqual(['SEC Filings']);
        expect(new URL(items[0].getAttribute('href')).searchParams.get('Stream')).toBe('sec');
    });

    it('has no sort, since there is one stream to show', () => {
        setup('/stream?item=sec');

        expect(screen.queryByRole('button', { name: /^Sort: / })).toBeNull();
        expect(screen.getByRole('combobox', { name: 'Rate' })).toHaveValue('Day');
    });
});

describe('the way back to every stream', () => {
    it('is the All streams button over the title, on every screen (#167)', () => {
        setup('/stream?item=sec');

        const depth = window.history.length;
        const back = screen.getByRole('button', { name: 'All streams' });

        expect(back).toHaveClass('stream-back');
        expect(document.querySelector('.stream-rows-bar').firstElementChild).toBe(back);

        fireEvent.click(back);

        expect(focused()).toBeNull();
        expect(rowNames()).toHaveLength(STREAMS.length);
        expect(address().get('item')).toBeNull();
        expect(window.history.length).toBe(depth + 1);
    });

    it('keeps the rate the stream was shown at', () => {
        setup('/stream?item=sec&rate=hour');

        fireEvent.click(screen.getByRole('button', { name: 'All streams' }));

        expect(focused()).toBeNull();
        expect(address().get('item')).toBeNull();
        expect(address().get('rate')).toBe('hour');
    });

    it('is no longer a rail beside the graph (#167)', () => {
        setup('/stream?item=sec');

        expect(screen.queryByRole('button', { name: 'Show all streams' })).toBeNull();
        expect(document.querySelector('.stream-focus-rail')).toBeNull();
    });

    it('is not drawn while every stream is showing', () => {
        setup('/stream');

        expect(screen.queryByRole('button', { name: 'All streams' })).toBeNull();
    });

    it('is the back button', () => {
        setup('/stream');

        clickName('SEC Filings');
        land('/stream');

        expect(focused()).toBeNull();
    });

    it('goes nowhere when every stream is already showing', () => {
        const { page } = setup('/stream');
        const depth = window.history.length;

        act(() => {
            page.showAll();
        });

        expect(window.history.length).toBe(depth);
    });
});

describe('the back and forward buttons', () => {
    it('open a stream again going forward', () => {
        setup('/stream');

        land('/stream?item=bls');

        expect(focused()).toBe('bls');
    });

    it('ask for the window the address they land on names', () => {
        setup('/stream?item=sec');

        const from = getData.mock.calls.length;

        land('/stream?item=sec&rate=hour');

        expect(asked(from).map((params) => params.get('Interval'))).toEqual(STREAMS.map(() => 'hour'));
        expect(screen.getByRole('button', { name: 'Hour' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('ask for nothing again when the window is the one on screen', () => {
        setup('/stream?item=sec');

        const from = getData.mock.calls.length;

        land('/stream');

        expect(getData.mock.calls.length).toBe(from);
    });

    it('leave the address as they found it', () => {
        setup('/stream?item=sec');

        land('/stream?item=sec&rate=hour');

        expect(window.location.search).toBe('?item=sec&rate=hour');
    });

    it('leave an address on another page to that page', () => {
        setup('/stream?item=sec');

        land('/data?item=bls');

        expect(focused()).toBe('sec');
    });

    it('are no longer listened for once the page has gone', () => {
        const { page, unmount } = setup('/stream?item=sec');
        const spy = jest.spyOn(page, 'setState');

        unmount();
        land('/stream');

        expect(spy).not.toHaveBeenCalled();
    });
});

describe('the line of controls', () => {
    it('takes a rate from the phone\'s menu, as from the buttons', () => {
        setup('/stream?item=sec');

        const from = getData.mock.calls.length;

        fireEvent.change(screen.getByRole('combobox', { name: 'Rate' }), { target: { value: 'Hour' } });

        expect(screen.getByRole('button', { name: 'Hour' })).toHaveAttribute('aria-pressed', 'true');
        expect(address().get('rate')).toBe('hour');
        expect(address().get('item')).toBe('sec');
        expect(asked(from).map((params) => params.get('Interval'))).toEqual(STREAMS.map(() => 'hour'));
    });

    it('closes This request once a request is chosen, or the menu is let go', () => {
        setup('/stream?item=sec');

        const keep = (event) => event.preventDefault();

        fireEvent.click(screen.getByRole('button', { name: 'This request' }));

        window.addEventListener('click', keep);
        fireEvent.click(screen.getByRole('menuitem', { name: 'SEC Filings' }));
        window.removeEventListener('click', keep);

        expect(screen.getByRole('button', { name: 'This request' })).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(screen.getByRole('button', { name: 'This request' }));
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

        expect(screen.getByRole('button', { name: 'This request' })).toHaveAttribute('aria-expanded', 'false');
    });
});

describe('a stream on its own, as the page draws it', () => {
    it('opens a bar into its interval, and stays on its own', () => {
        setup('/stream?item=bls');

        fireEvent.click(document.querySelector('.stream-focus .stream-bar-slot'));

        expect(focused()).toBe('bls');
        expect(address().get('rate')).toBe('hour');
    });

    it('opens nothing from a minute\'s bar', () => {
        setup('/stream?item=bls&rate=minute');

        expect(document.querySelector('.stream-focus .stream-row-bars')).not.toHaveClass('stream-row-bars-open');
    });

    it('says it is loading, as its row would', () => {
        setup('/stream?item=bls');

        expect(document.querySelector('.stream-focus .stream-row-status')).toHaveTextContent('Loading');
    });

    it('names the window\'s first interval and its last over the graph', () => {
        setup('/stream?item=bls');

        expect(document.querySelector('.stream-focus-axis').textContent).toMatch(/Now$/);
    });
});

describe('the figures beside the rows, folded and dragged', () => {
    it('start folded when this browser kept nothing (#167)', () => {
        const { page } = setup();

        expect(page.state.figures_folded).toBe(true);
        expect(document.querySelector('.stream-rows')).toHaveClass('stream-rows-folded');
        expect(screen.getByRole('button', { name: 'Show Health, Coverage and Total Records' })).toBeInTheDocument();
    });

    it('fold from the arrow, and are kept folded for the next visit', () => {
        keep({ fold: { figures: false }, size: {} });

        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Fold Health, Coverage and Total Records' }));

        expect(document.querySelector('.stream-rows')).toHaveClass('stream-rows-folded');
        expect(kept()).toEqual({ fold: { figures: true }, size: {} });
    });

    it('open from the rail, and are kept open', () => {
        keep({ fold: { figures: true }, size: {} });

        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Show Health, Coverage and Total Records' }));

        expect(document.querySelector('.stream-rows')).not.toHaveClass('stream-rows-folded');
        expect(kept().fold).toEqual({ figures: false });
    });

    it('open as the reader left them', () => {
        keep({ fold: { figures: false }, size: { figures: 300 } });

        setup();

        expect(document.querySelector('.stream-rows').style.getPropertyValue('--stream-figures')).toBe('300px');
    });

    it('drop a kept width narrower than a drag would stop at', () => {
        keep({ fold: {}, size: { figures: FIGURES_MIN - 1 } });

        const { page } = setup();

        expect(page.state.figures_width).toBeNull();
    });

    it('keep a width only once the pointer is up', () => {
        keep({ fold: { figures: false }, size: {} });

        const { page } = setup();

        act(() => {
            page.resizeFigures(300, false);
        });

        expect(page.state.figures_width).toBe(300);
        expect(kept()).toEqual({ fold: { figures: false }, size: {} });

        act(() => {
            page.resizeFigures(310, true);
        });

        expect(kept()).toEqual({ fold: { figures: false }, size: { figures: 310 } });
    });

    it('let the width go when a drag folds them, and keep it when the arrow does', () => {
        const { page } = setup();

        act(() => {
            page.resizeFigures(300, true);
        });
        act(() => {
            page.foldFigures(true);
        });

        expect(page.state.figures_width).toBe(300);

        act(() => {
            page.foldFigures(false);
        });
        act(() => {
            page.foldFigures(true, true);
        });

        expect(page.state.figures_width).toBeNull();
        expect(kept()).toEqual({ fold: { figures: true }, size: {} });
    });
});

describe('StreamFocus on its own', () => {
    const at = (d) => new Date(2026, 8, d);

    function row(overrides = {}) {
        return {
            stream: 'sec',
            name: 'SEC Filings',
            status: 'done',
            retry: () => {},
            bars: Array.from({ length: 20 }, (_, i) => ({
                start: at(11 + i),
                kind: 'reported',
                records: 10 + i,
                failed: 0,
                health: 1,
            })),
            figures: { health: '100.00%', coverage: '95.00%', total: '4,214,080' },
            ...overrides,
        };
    }

    function draw(props = {}) {
        return render(<StreamFocus row={row()} rate='day' first='Sep 11' last='Now' {...props} />);
    }

    it('puts its figures in three boxes, a label over each value', () => {
        draw();

        const boxes = [...document.querySelectorAll('.stream-focus-figure')];

        //
        // the label as a wide screen reads it: the long form, where a phone
        // has a shorter one beside it
        //
        const label = (box) => (
            box.querySelector('.stream-focus-figure-label .stream-focus-long')
            || box.querySelector('.stream-focus-figure-label')
        ).textContent;

        expect(boxes.map(label)).toEqual(['Health', 'Coverage', 'Total Records']);
        expect(boxes.map((box) => box.querySelector('.stream-focus-figure-value').firstChild.textContent))
            .toEqual(['100.00%', '95.00%', '4,214,080']);
    });

    it('draws a shorter label and count for a phone beside the full ones', () => {
        draw();

        const total = document.querySelectorAll('.stream-focus-figure')[2];

        expect(total.querySelector('.stream-focus-figure-label .stream-focus-short')).toHaveTextContent('Records');
        expect(total.querySelector('.stream-focus-figure-value .stream-focus-short')).toHaveTextContent('4.2M');
    });

    it('draws a bar for every interval, and dates under every few', () => {
        draw();

        expect(document.querySelectorAll('.stream-focus .stream-bar-slot')).toHaveLength(20);
        expect([...document.querySelectorAll('.stream-focus-ticks span')].map((tick) => tick.textContent)
            .filter(Boolean)).toEqual(['Sep 11', 'Sep 15', 'Sep 19', 'Sep 23', 'Sep 27']);
    });

    it('sets its dates closer together under a dense graph', () => {
        const many = Array.from({ length: 60 }, (_, i) => ({ start: new Date(2026, 8, 30, 14, i), kind: 'off' }));

        render(<StreamFocus row={row({ bars: many })} rate='minute' first='2 PM' last='Now' />);

        expect(document.querySelector('.stream-focus-ticks')).toHaveClass('stream-focus-ticks-dense');
        expect([...document.querySelectorAll('.stream-focus-ticks span')].map((tick) => tick.textContent)
            .filter(Boolean)).toEqual(['2:00 PM', '2:10 PM', '2:20 PM', '2:30 PM', '2:40 PM', '2:50 PM']);
    });

    it('says what a bar holds when it is pointed at', () => {
        draw();

        fireEvent.mouseEnter(document.querySelectorAll('.stream-focus .stream-bar-slot')[1]);

        expect(document.querySelector('.stream-rows-readout').textContent).toBe('SEC Filings, Sat, Sep 1211 records');
    });

    it('opens a bar through the page', () => {
        const onOpen = jest.fn();

        draw({ onOpen: onOpen });
        fireEvent.click(document.querySelectorAll('.stream-focus .stream-bar-slot')[3]);

        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ records: 13 }));
    });

    it('draws no way back of its own: the page\'s button over the title is it (#167)', () => {
        draw();

        expect(screen.queryByRole('button', { name: 'Show all streams' })).toBeNull();
        expect(document.querySelector('.stream-focus-rail')).toBeNull();
    });

    it('brings up a popup by a bar a mouse points at, as a row does (#167)', () => {
        draw({ onOpen: () => {} });

        fireEvent(document.querySelectorAll('.stream-focus .stream-bar-slot')[1], Object.assign(
            new MouseEvent('pointerover', { bubbles: true, relatedTarget: document.body }),
            { pointerType: 'mouse' }
        ));

        const tip = document.querySelector('.stream-focus .stream-bar-tip');

        expect(tip.querySelector('.stream-bar-tip-when')).toHaveTextContent('Sat, Sep 12');
        expect(tip.querySelector('.stream-bar-tip-what')).toHaveTextContent('11 records');
        expect(tip.querySelector('.stream-bar-tip-hint')).toHaveTextContent('Click to see its hours');
    });

    it('carries the color key, and the line that describes a bar', () => {
        draw();

        expect(document.querySelector('.stream-focus .stream-rows-legend')).toHaveTextContent('Not scheduled');
        expect(document.querySelector('.stream-focus .stream-rows-readout'))
            .toHaveTextContent('Point at a bar, or tap it, to see what it holds.');
    });

    it('says it could not load, with a button that asks again', () => {
        const retry = jest.fn();

        render(<StreamFocus row={row({ status: 'failed', retry: retry })} rate='day' />);
        fireEvent.click(screen.getByRole('button', { name: 'Retry SEC Filings' }));

        expect(retry).toHaveBeenCalledTimes(1);
    });
});

describe('a count, shortened for a phone', () => {
    it.each([
        ['136,963,495', '137M'],
        ['4,214,080', '4.2M'],
        ['152,816', '152.8K'],
        ['282', '282'],
    ])('%s reads %s', (figure, short) => {
        expect(shortCount(figure)).toBe(short);
    });

    it('leaves a stand-in for a count as it is', () => {
        expect(shortCount('n/a')).toBe('n/a');
    });
});

describe('a date under the graph', () => {
    const when = new Date(2026, 8, 14, 16, 5);

    it.each([
        ['Month', 'Sep'],
        ['Day', 'Sep 14'],
        ['Hour', '4 PM'],
        ['Minute', '4:05 PM'],
    ])('at the %s rate reads %s', (rate, label) => {
        expect(tickLabel(when, rate)).toBe(label);
    });
});
