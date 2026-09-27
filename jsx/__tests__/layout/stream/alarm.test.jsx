/**
 * alarm.test.jsx: the per-stream ingest alarm page ('/stream/:stream/alarm').
 *
 * The page is reached by a stream's id -- 'stock-market', 'stock-split', 'bls',
 * 'sec', 'us-national-weather' -- and compares it as it is. It used to rename
 * three streams for itself, and labeled two of its pages with the new name:
 * 'Download raw stock-market ingest performance metrics'. A url naming a stream
 * by a name it used to go by is replaced before this page mounts, so the cases
 * that go through the route do so the way main-route.jsx wires it.
 *
 * Note: 'general/account-api.js' is mocked. It is the network boundary for the
 *       alarms and the reader's subscriptions, and each call is pending by default
 *       -- so a case that does not care sees the page as it first draws, and a case
 *       that does answers the calls it is about and waits for the page to follow.
 *       The module itself has its own suite.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    signedIn: jest.fn(),
    listSubscriptions: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    streamAlarms: jest.fn(),
}));

import {
    signedIn,
    listSubscriptions,
    subscribe,
    unsubscribe,
    streamAlarms,
} from '../../../import/general/account-api.js';
import { TERMS_VERSION } from '../../../import/general/notice-terms.jsx';
import StreamAlarm from '../../../import/layout/stream/alarm.jsx';
import CanonicalStream from '../../../import/route/canonical-stream.jsx';
import { STREAMS } from '../../../import/general/stream-id.js';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { colors_dark } from '../../../import/general/colors.js';

//
// alarm.jsx builds the archive list as an array of <a> elements carrying no key
// -- the key sits on the ListItemButton INSIDE each anchor, which is not the
// array element -- so every successful render emits React's missing-key warning.
// setup.js turns a stray console.error into a failure, so it is captured here
// and checked against that one known message: a NEW console error still fails
// the test rather than being swallowed with it. The warning itself is pinned in
// 'the archive list' below.
//
const MISSING_KEY = 'Each child in a list should have a unique "key" prop';

function renderAlarm(stream) {
    //
    // the page renders BreadCrumbs, which reads window.location.pathname rather
    // than router context, so the browser url has to be moved along with the
    // MemoryRouter entry or the trail comes out empty.
    //
    window.history.pushState({}, '', `/stream/${stream}/alarm`);

    const trap = console.error;
    const seen = [];
    console.error = (...args) => seen.push(String(args[0]));

    let result;
    try {
        result = render(
            <MemoryRouter initialEntries={[`/stream/${stream}/alarm`]}>
                <Routes>
                    <Route path='/stream/:stream/alarm' element={<StreamAlarm />} />
                </Routes>
            </MemoryRouter>
        );
    } finally {
        console.error = trap;
    }

    const unexpected = seen.filter(message => !message.includes(MISSING_KEY));
    if (unexpected.length) {
        throw new Error(`unexpected console.error:\n  ${unexpected.join('\n  ')}`);
    }

    return { ...result, warnings: seen };
}

//
// the crashing cases unmount the tree, and React reports the failure through
// console.error before rethrowing. Nothing is asserted about that output, so it
// is dropped wholesale here and the thrown error is what gets examined.
//
function crashFrom(stream) {
    const trap = console.error;
    console.error = () => {};

    try {
        render(
            <MemoryRouter initialEntries={[`/stream/${stream}/alarm`]}>
                <Routes>
                    <Route path='/stream/:stream/alarm' element={<StreamAlarm />} />
                </Routes>
            </MemoryRouter>
        );
        return null;
    } catch (error) {
        return error;
    } finally {
        console.error = trap;
    }
}

//
// a call to the account api that never answers: the default, so the page stays as
// it first draws
//
const pending = () => new Promise(() => {});

beforeEach(() => {
    jest.clearAllMocks();
    signedIn.mockImplementation(pending);
    listSubscriptions.mockImplementation(pending);
    streamAlarms.mockImplementation(pending);
    subscribe.mockImplementation(pending);
    unsubscribe.mockImplementation(pending);
});

afterEach(() => {
    window.history.pushState({}, '', '/');
});

describe('every stream id the application links to', () => {
    //
    // exactly the ids layout/stream/stream.jsx puts in the url. There is no
    // sixth stream; this is the complete set of links to this page.
    //
    // These once CRASHED. The archive column read a `download_prefix` that no
    // branch assigned for a capitalized id, `.split()` threw inside the same
    // render() that would have created this page's ErrorBoundary -- so the
    // boundary never mounted, the error escaped to the one in layout/page.jsx,
    // and the whole site went down, navigation included.
    //
    // The column no longer reads a prefix at all: it asks what the stream
    // publishes, and offers nothing when the answer is nothing. A stream it does
    // not recognize is the same case as one that publishes nothing, which is why
    // an unknown id renders too.
    //
    it.each(STREAMS)('/stream/%s/alarm renders', (stream) => {
        expect(crashFrom(stream)).toBeNull();
    });

    it('renders for a stream that does not exist', () => {
        //
        // indistinguishable from a stream that has published nothing, and it
        // should be: a stream with no archive is a stream with no archive.
        //
        expect(crashFrom('no-such-stream')).toBeNull();
    });

    it('shows the archive heading rather than taking the page down', () => {
        //
        // the old failure replaced the ENTIRE page. This asserts the opposite
        // of what it used to: the page is here.
        //
        renderAlarm('stock-market');

        expect(screen.getByText('Latest Archive')).toBeInTheDocument();
    });
});

describe('a url naming its stream by a name it used to go by', () => {
    //
    // the /stream page linked 'StockMarket', 'StockMarketStockSplit' and
    // 'USNationalWeather', and those urls are in bookmarks. Each still loads,
    // at the url naming the stream by its id, and is the same page.
    //
    function renderRoute(path) {
        let location;

        const Where = () => {
            location = useLocation();
            return null;
        };

        render(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route
                        path='/stream/:stream/alarm'
                        element={<CanonicalStream><StreamAlarm /><Where /></CanonicalStream>}
                    />
                </Routes>
            </MemoryRouter>
        );

        return () => location.pathname;
    }

    it.each([
        ['StockMarket', 'stock-market', 'S&P 500'],
        ['stockmarket', 'stock-market', 'S&P 500'],
        ['StockMarketStockSplit', 'stock-split', 'Stock Splits'],
        ['USNationalWeather', 'us-national-weather', 'US Weather Alerts'],
        ['BLS', 'bls', 'Bureau of Labor Statistics'],
    ])('/stream/%s/alarm ends on /stream/%s/alarm, and is that page', (name, id, label) => {
        const pathname = renderRoute(`/stream/${name}/alarm`);

        expect(pathname()).toBe(`/stream/${id}/alarm`);
        expect(screen.getByText(new RegExp(`To subscribe to ${label} ingest alarms`)))
            .toBeInTheDocument();
    });
});

describe('the page body', () => {
    it.each(STREAMS)('%s renders the alarm header', (stream) => {
        renderAlarm(stream);

        expect(screen.getByRole('heading', { name: 'Ingest Alarms' })).toBeInTheDocument();
    });

    it('shows the archive column and the terms notice', () => {
        renderAlarm('bls');

        expect(screen.getByRole('heading', { name: /Latest Archive/ })).toBeInTheDocument();
        expect(screen.getByText(/you must accept the terms and conditions/)).toBeInTheDocument();
    });

    it('renders the breadcrumb trail from the url', () => {
        renderAlarm('bls');

        const crumbs = within(screen.getByRole('navigation', { name: 'breadcrumb' }))
            .getAllByRole('listitem');

        expect(crumbs.map(c => c.textContent)).toEqual(['stream', 'bls', 'alarm']);
    });

    it('describes the ingest schedule for the stream', () => {
        renderAlarm('bls');

        expect(screen.getByText(/runs every 1 hour \(everyday\)/)).toBeInTheDocument();
        expect(screen.getByText(/U.S. Bureau of Labor Statistics/)).toBeInTheDocument();
    });

    it.each([
        ['stock-market', /between 9:30am through 4:30pm EDT/],
        ['stock-split', /daily at 12am EDT/],
        ['us-national-weather', /every 5 minutes \(everyday\)/],
        ['bls', /every 1 hour \(everyday\)/],
        ['sec', /every 1 hour \(everyday\)/],
    ])('%s states its own ingest interval', (stream, interval) => {
        renderAlarm(stream);

        expect(screen.getByText(interval)).toBeInTheDocument();
    });

    it('offers both workflow explanations', () => {
        renderAlarm('bls');

        expect(screen.getByText('Basic Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Workflow')).toBeInTheDocument();
    });
});

describe('what an alarm is', () => {
    //
    // a stream gone quiet: no new records for longer than its usual gap, and back
    // once they arrive -- as the account api watches for, and as its page and the
    // reader's guide say. The page said an alarm fired when a window's records fell
    // below a threshold, which is not what is watched for.
    //
    const text = () => document.body.textContent.replace(/\s+/g, ' ');

    it('is a stream with no new records for longer than its usual gap', () => {
        renderAlarm('bls');

        expect(text()).toContain(
            'A stream goes into alarm when it has had no new records for longer than its usual gap, '
            + 'and recovers when records arrive again.'
        );
        expect(text()).toContain('you get an email when it goes into alarm, and one when it recovers');
    });

    it('is no longer a count of records falling below a threshold', () => {
        renderAlarm('bls');

        expect(text()).not.toMatch(/fall below (a )?threshold/);
        expect(text()).not.toContain('late-2024');
    });

    it('is what the basic workflow follows, and the aggregate one is not offered yet', () => {
        renderAlarm('bls');

        expect(text()).toContain('no new records for longer than its usual gap (T), you get notified (N)');
        expect(text()).toContain('The aggregate workflow, not offered yet');
    });

    it('is explained under Alarm Integration, not the trigger pages\' heading', () => {
        renderAlarm('bls');

        expect(screen.getByText('Alarm Integration')).toBeInTheDocument();
        expect(screen.queryByText('Trigger Integration')).toBeNull();
    });
});

describe('naming the stream', () => {
    //
    // by its label, in every sentence the page says it in. The page renamed
    // three streams for itself and looked the new name up in stream-name.js,
    // which knew two of them by another name -- so the S&P 500 page offered to
    // 'Download raw stock-market ingest performance metrics', and the weather
    // page said 'us-national-weather' where it meant 'US Weather Alerts'.
    //
    const LABELS = [
        ['stock-market', 'S&P 500'],
        ['stock-split', 'Stock Splits'],
        ['bls', 'Bureau of Labor Statistics'],
        ['sec', 'SEC Filings'],
        ['us-national-weather', 'US Weather Alerts'],
    ];

    it.each(LABELS)('%s is %s in the terms notice and the summary', (stream, label) => {
        renderAlarm(stream);

        expect(screen.getByText(new RegExp(`To subscribe to ${label} ingest alarms`))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`The ${label} ingest stream runs`))).toBeInTheDocument();
    });

    it.each(LABELS)('%s is %s in the archive\'s download tooltip', async (stream, label) => {
        renderAlarm(stream);

        await userEvent.hover(document.querySelector('.help-icon'));

        expect(await screen.findByRole('tooltip'))
            .toHaveTextContent(`Download raw ${label} ingest performance metrics`);
    });

    it.each(['stock-market', 'us-national-weather'])('never says %s, outside the url trail', (stream) => {
        //
        // the trail prints the url, so it is the one place the id belongs. It
        // is taken out before looking.
        //
        renderAlarm(stream);

        const trail = screen.getByRole('navigation', { name: 'breadcrumb' }).textContent;

        expect(trail).toContain(stream);
        expect(document.body.textContent.replace(trail, '')).not.toContain(stream);
    });
});

describe('the alarm count', () => {
    //
    // counted from the account api's list of the stream's alarms, which is also
    // what a signed-in reader's switches are drawn from -- so the two cannot
    // disagree. It used to be worked out on the page, from a datalake request made
    // for nothing else: one per source, one per ticker, and three for stock splits,
    // none of which anybody could subscribe to.
    //
    const count = () => document.querySelector('.title-count');

    it('asks for the alarms of the stream the url names', () => {
        renderAlarm('bls');

        expect(streamAlarms).toHaveBeenCalledWith('bls');
    });

    it('is left off until the list has arrived', () => {
        renderAlarm('bls');

        expect(count()).toBeNull();
    });

    it.each([
        ['stock-market', 1],
        ['stock-split', 1],
        ['bls', 2],
    ])('%s counts the %i alarms its list holds', async (stream, many) => {
        streamAlarms.mockResolvedValue(
            Array.from({ length: many }, (unused, index) => ({ id: `alarm-${index}`, name: `Alarm ${index}` }))
        );

        renderAlarm(stream);

        await waitFor(() => expect(count()).toHaveTextContent(String(many)));
    });

    it('is left off when the list could not be had, rather than guessed', async () => {
        streamAlarms.mockRejectedValue(new Error('no such stream'));

        renderAlarm('bls');

        await waitFor(() => expect(streamAlarms).toHaveBeenCalled());
        await waitFor(() => expect(count()).toBeNull());
    });

    it('asks the datalake nothing', () => {
        //
        // the distribution was asked for only to count tickers, and the count now
        // comes from the list. The archive column still asks for its listing, but
        // only when it is opened.
        //
        const fetcher = jest.spyOn(global, 'fetch');

        renderAlarm('stock-market');

        expect(fetcher).not.toHaveBeenCalled();
        fetcher.mockRestore();
    });
});

const BLS_ALARMS = [{ id: 'ingest', name: 'Bureau of Labor Statistics ingest' }];
const HELD = { stream: 'bls', alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: TERMS_VERSION };

//
// the page for a signed-in reader, once their subscriptions and the stream's
// alarms have both arrived
//
async function renderSignedIn({ held = [], alarms = BLS_ALARMS } = {}) {
    signedIn.mockResolvedValue(true);
    listSubscriptions.mockResolvedValue(held);
    streamAlarms.mockResolvedValue(alarms);

    renderAlarm('bls');

    await screen.findByLabelText('Bureau of Labor Statistics ingest');
    await waitFor(() => expect(listSubscriptions).toHaveBeenCalled());
}

const alarmSwitch = () => screen.getByLabelText('Bureau of Labor Statistics ingest');
const acceptBox = () => screen.getByRole('checkbox', { name: 'I accept the terms and conditions' });

describe('signed out', () => {
    it('is asked to sign in to subscribe, with no switches', async () => {
        signedIn.mockResolvedValue(false);
        streamAlarms.mockResolvedValue(BLS_ALARMS);

        renderAlarm('bls');

        await waitFor(() => expect(document.querySelector('.title-count')).toHaveTextContent('1'));

        expect(screen.getByText(/You need to login to subscribe to ingest alarms/)).toBeInTheDocument();
        expect(screen.queryByLabelText('Bureau of Labor Statistics ingest')).toBeNull();
        expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('asks for no subscriptions', async () => {
        signedIn.mockResolvedValue(false);

        renderAlarm('bls');

        await waitFor(() => expect(signedIn).toHaveBeenCalled());
        expect(listSubscriptions).not.toHaveBeenCalled();
    });
});

describe('signed in', () => {
    it('is offered the terms to accept, in place of the way to sign in', async () => {
        await renderSignedIn();

        expect(acceptBox()).not.toBeChecked();
        expect(screen.queryByText(/You need to login/)).toBeNull();
    });

    it('lists the stream\'s alarms, each with a switch', async () => {
        await renderSignedIn();

        expect(alarmSwitch()).toHaveAttribute('type', 'checkbox');
        expect(alarmSwitch()).not.toBeChecked();
    });

    it('shows an alarm the reader holds switched on', async () => {
        await renderSignedIn({ held: [HELD] });

        await waitFor(() => expect(alarmSwitch()).toBeChecked());
    });

    it('does not take a subscription to another stream for this one\'s', async () => {
        await renderSignedIn({ held: [{ ...HELD, stream: 'sec' }] });

        expect(alarmSwitch()).not.toBeChecked();
    });

    it('lets no switch be turned on before the terms are accepted', async () => {
        await renderSignedIn();

        expect(alarmSwitch()).toBeDisabled();
        expect(screen.getByText(/Accept the terms and conditions above/)).toBeInTheDocument();

        fireEvent.click(alarmSwitch());

        expect(subscribe).not.toHaveBeenCalled();
    });

    it('lets a held one be turned off before the terms are accepted', async () => {
        unsubscribe.mockResolvedValue(true);

        await renderSignedIn({ held: [HELD] });
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        await waitFor(() => expect(alarmSwitch()).not.toBeChecked());
        expect(unsubscribe).toHaveBeenCalledWith('bls', 'ingest');
    });

    it('subscribes once the terms are accepted, sending their version', async () => {
        subscribe.mockResolvedValue(HELD);

        await renderSignedIn();

        fireEvent.click(acceptBox());
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        await waitFor(() => expect(alarmSwitch()).toBeChecked());
        expect(subscribe).toHaveBeenCalledWith('bls', 'ingest', TERMS_VERSION);
    });

    it('moves a switch only once the api has answered', async () => {
        await renderSignedIn();

        fireEvent.click(acceptBox());
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        await waitFor(() => expect(alarmSwitch()).toBeDisabled());
        expect(alarmSwitch()).not.toBeChecked();
    });

    it('says what the api said when it refuses, and leaves the switch where it was', async () => {
        subscribe.mockRejectedValue(new Error('verify your email address to subscribe'));

        await renderSignedIn();

        fireEvent.click(acceptBox());
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        expect(await screen.findByRole('alert')).toHaveTextContent('verify your email address to subscribe');
        expect(alarmSwitch()).not.toBeChecked();
        expect(alarmSwitch()).toBeEnabled();
        expect(screen.queryByRole('link', { name: 'Verify it in Account Settings' })).toBeNull();
    });

    describe('refused for an address that is not verified', () => {
        //
        // a subscribe's only 403: alarms go by email, and the reader's address is not
        // verified yet. The page says so, and links to where they verify it -- the
        // email section of Account Settings, by the name the header's own link uses.
        //
        const refusal = (status = 403) => Object.assign(new Error('email address not verified'), { status: status });
        const settingsLink = () => screen.queryByRole('link', { name: 'Verify it in Account Settings' });

        async function turnOn() {
            fireEvent.click(acceptBox());
            await waitFor(() => expect(alarmSwitch()).toBeEnabled());

            fireEvent.click(alarmSwitch());
        }

        afterEach(() => {
            sessionStorage.removeItem('username');
            jest.restoreAllMocks();
        });

        it('says so, and links to the email section of Account Settings', async () => {
            sessionStorage.setItem('username', 'reader');
            subscribe.mockRejectedValue(refusal());

            await renderSignedIn();
            await turnOn();

            expect(await screen.findByRole('alert')).toHaveTextContent('Your email address isn\'t verified yet');
            expect(settingsLink()).toHaveAttribute('href', '/reader/settings#email');
            expect(alarmSwitch()).not.toBeChecked();
        });

        it.each([
            ['no name in session storage', () => {}],
            ['session storage refused', () => jest.spyOn(Object.getPrototypeOf(sessionStorage), 'getItem')
                .mockImplementation(() => {
                    throw new Error('blocked');
                })],
        ])('links by "account" with %s', async (_, storage) => {
            subscribe.mockRejectedValue(refusal());

            await renderSignedIn();

            storage();
            await turnOn();

            expect(await screen.findByRole('link', { name: 'Verify it in Account Settings' }))
                .toHaveAttribute('href', '/account/settings#email');
        });

        it('turns the alarm on once the address has been verified', async () => {
            subscribe.mockRejectedValueOnce(refusal()).mockResolvedValueOnce(HELD);

            await renderSignedIn();
            await turnOn();

            await screen.findByRole('alert');
            await waitFor(() => expect(alarmSwitch()).toBeEnabled());

            fireEvent.click(alarmSwitch());

            await waitFor(() => expect(alarmSwitch()).toBeChecked());
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('says what the api said for any other refusal, with no link', async () => {
            subscribe.mockRejectedValue(refusal(503));

            await renderSignedIn();
            await turnOn();

            expect(await screen.findByRole('alert')).toHaveTextContent('email address not verified');
            expect(settingsLink()).toBeNull();
        });

        it('does not take a refused unsubscribe for an address to verify', async () => {
            unsubscribe.mockRejectedValue(refusal());

            await renderSignedIn({ held: [HELD] });
            await waitFor(() => expect(alarmSwitch()).toBeEnabled());

            fireEvent.click(alarmSwitch());

            expect(await screen.findByRole('alert')).toHaveTextContent('email address not verified');
            expect(settingsLink()).toBeNull();
            expect(alarmSwitch()).toBeChecked();
        });
    });

    it('is shown the signed-out view once the session has ended', async () => {
        //
        // null from the api is a 401: not an error, a reader who has to sign in again
        //
        subscribe.mockResolvedValue(null);

        await renderSignedIn();

        fireEvent.click(acceptBox());
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        expect(await screen.findByText(/You need to login to subscribe/)).toBeInTheDocument();
        expect(screen.queryByLabelText('Bureau of Labor Statistics ingest')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('is shown the signed-out view when the subscriptions come back signed out', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockResolvedValue(null);
        streamAlarms.mockResolvedValue(BLS_ALARMS);

        renderAlarm('bls');

        await waitFor(() => expect(listSubscriptions).toHaveBeenCalled());
        expect(await screen.findByText(/You need to login to subscribe/)).toBeInTheDocument();
    });

    it('holds every switch still, and says why, when the subscriptions could not be had', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockRejectedValue(new Error('busy, try again'));
        streamAlarms.mockResolvedValue(BLS_ALARMS);

        renderAlarm('bls');

        expect(await screen.findByRole('alert')).toHaveTextContent('busy, try again');
        expect(alarmSwitch()).toBeDisabled();
    });

    it('says the alarms could not be listed when the list fails', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockResolvedValue([]);
        streamAlarms.mockRejectedValue(new Error('no such stream'));

        renderAlarm('bls');

        expect(await screen.findByText('The alarms could not be listed right now.')).toBeInTheDocument();
    });
});

describe('the archive list', () => {
    //
    // the list is the performance api's listing, asked once, on expansion. It
    // used to be a HEAD per guessed file -- up to 33 per stream -- judged by
    // content type, because the site answers a missing path with its own shell
    // and a 200, and the anchors carry `download`. Nothing listed can be that
    // shell, so nothing here judges a content type any more.
    //
    const ORIGIN = 'https://www.jefflevesque.com/artifact/performance/ingest';
    const LISTING_URL = 'https://api.jefflevesque.com/v1/public/performance/archive';

    const yearly = (stream, folder, years) => years.map((year) => ({
        stream,
        period: String(year),
        id: `${stream}/${year}`,
        url: `${ORIGIN}/${folder}/${year}.csv`,
    }));

    const monthly = (stream, folder, months) => months.map((period) => ({
        stream,
        period,
        id: `${stream}/${period.replace('-', '/')}`,
        url: `${ORIGIN}/${folder}/${period.replace('-', '/')}.csv`,
    }));

    //
    // the api's shape, and the three things the guessing got wrong: two streams
    // filed under a folder that is not their name, and 'bls', named but empty.
    //
    // Note: named the way the api names streams today -- 'stockmarket',
    //       'usnationalweather' -- which is not the id this page is reached by.
    //       RENAMED below is the same listing once the api names them by id.
    //
    const LISTING = {
        streams: ['bls', 'sec', 'stockmarket', 'stockmarketstocksplit', 'usnationalweather'],
        archives: [
            ...monthly('sec', 'article/sec', ['2024-12', '2025-09']),
            ...yearly('stockmarket', 'stock-market', [2023, 2024, 2025, 2026]),
            ...yearly('stockmarketstocksplit', 'stock-split', [2023, 2024, 2025, 2026]),
            ...monthly('usnationalweather', 'article/weather', ['2025-06', '2025-07']),
        ],
    };

    const RENAMED = {
        streams: STREAMS,
        archives: [
            ...monthly('sec', 'article/sec', ['2024-12', '2025-09']),
            ...yearly('stock-market', 'stock-market', [2023, 2024, 2025, 2026]),
            ...yearly('stock-split', 'stock-split', [2023, 2024, 2025, 2026]),
            ...monthly('us-national-weather', 'article/weather', ['2025-06', '2025-07']),
        ],
    };

    function answering(listing = LISTING) {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ report: listing }),
        }));

        return global.fetch;
    }

    function archiveToggle() {
        //
        // the collapsed row is the only ListItemButton rendered before expansion
        //
        return document.querySelector('.left-column .MuiListItemButton-root');
    }

    const offered = () => [...document.querySelectorAll('.left-column a[download]')]
        .map((a) => a.textContent);

    async function expand() {
        await userEvent.click(archiveToggle());
        // the listing lands after the click, so let it settle
        await act(async () => {});
    }

    afterEach(() => {
        delete global.fetch;
    });

    it('is collapsed until it is clicked', () => {
        answering();
        renderAlarm('sec');

        expect(screen.queryByText('09/2025.csv')).not.toBeInTheDocument();
    });

    it('asks nothing until a reader expands it', () => {
        const fetcher = answering();
        renderAlarm('bls');

        expect(fetcher).not.toHaveBeenCalled();
    });

    it('asks the listing once, with a plain GET -- no HEAD per file', async () => {
        const fetcher = answering();
        renderAlarm('bls');

        await expand();

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(String(fetcher.mock.calls[0][0])).toBe(LISTING_URL);
        expect(fetcher.mock.calls[0][1]).toBeUndefined();
    });

    it('offers exactly the files the listing names for the stream, newest first', async () => {
        answering();
        renderAlarm('sec');

        await expand();

        expect(offered()).toEqual(['09/2025.csv', '12/2024.csv']);
    });

    it('links each file where the listing says it is served', async () => {
        //
        // the site's own origin, so `download` saves the file. A link to the
        // api's redirect would be cross-origin, and a browser ignores
        // `download` on one.
        //
        answering();
        renderAlarm('sec');

        await expand();

        expect([...document.querySelectorAll('.left-column a[download]')].map((a) => a.getAttribute('href')))
            .toEqual([`${ORIGIN}/article/sec/2025/09.csv`, `${ORIGIN}/article/sec/2024/12.csv`]);
    });

    it.each([
        ['stock-market', 'stock-market'],
        ['stock-split', 'stock-split'],
    ])('offers %s a file a year from 2023, filed under %s', async (stream, dataset) => {
        //
        // both stock market streams once said 'Nothing published yet', because
        // the page guessed their folder from their stream id. The listing names
        // the stream by its id and the file by its real url.
        //
        answering();
        renderAlarm(stream);

        await expand();

        expect(offered()).toEqual(['2026.csv', '2025.csv', '2024.csv', '2023.csv']);
        [...document.querySelectorAll('.left-column a[download]')].forEach((anchor) => {
            expect(anchor.getAttribute('href')).toContain(`/ingest/${dataset}/`);
        });
    });

    it.each([
        ['stock-market', ['2026.csv', '2025.csv', '2024.csv', '2023.csv']],
        ['stock-split', ['2026.csv', '2025.csv', '2024.csv', '2023.csv']],
        ['us-national-weather', ['07/2025.csv', '06/2025.csv']],
    ])('offers %s the same files whichever name the listing gives it', async (stream, files) => {
        //
        // the page and the api did not have to rename their streams together.
        // The listing named this stream 'usnationalweather' while the page moved
        // to 'us-national-weather', and it names it by the id once the api
        // moves too; the column matches both by the stream's id.
        //
        answering(LISTING);
        const before = renderAlarm(stream);

        await expand();
        expect(offered()).toEqual(files);

        before.unmount();
        answering(RENAMED);
        renderAlarm(stream);

        await expand();
        expect(offered()).toEqual(files);
    });

    it('says "Checking..." while the listing is on its way', async () => {
        //
        // an empty list used to stand for both "asked" and "nothing published",
        // so for as long as the answer was in flight the row said the second.
        //
        let release;
        global.fetch = jest.fn(() => new Promise((resolve) => {
            release = resolve;
        }));
        renderAlarm('sec');

        await userEvent.click(archiveToggle());

        expect(screen.getByText('Checking...')).toBeInTheDocument();
        expect(screen.queryByText('Nothing published yet')).not.toBeInTheDocument();

        await act(async () => {
            release({ ok: true, status: 200, json: () => Promise.resolve({ report: LISTING }) });
        });

        expect(offered()).toEqual(['09/2025.csv', '12/2024.csv']);
    });

    it('says "Nothing published yet" for a stream the listing names with no files', async () => {
        answering();
        renderAlarm('bls');

        await expand();

        expect(offered()).toEqual([]);
        expect(screen.getByText('Nothing published yet')).toBeInTheDocument();
    });

    it.each([
        ['the request fails outright', () => Promise.reject(new Error('offline'))],
        ['the api answers with an error', () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) })],
    ])('says it could not ask when %s, rather than that nothing was published', async (_, answer) => {
        global.fetch = jest.fn(answer);
        renderAlarm('sec');

        await expand();

        expect(screen.getByText('Archive unavailable right now')).toBeInTheDocument();
        expect(screen.queryByText('Nothing published yet')).not.toBeInTheDocument();
    });

    it('asks again on the next expansion after a failure', async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.reject(new Error('offline')))
            .mockImplementation(() => Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ report: LISTING }),
            }));
        renderAlarm('sec');

        await expand();
        expect(screen.getByText('Archive unavailable right now')).toBeInTheDocument();

        await expand();
        await expand();

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(offered()).toEqual(['09/2025.csv', '12/2024.csv']);
    });

    it('offers nothing for a stream the listing does not know', async () => {
        answering();
        renderAlarm('no-such-stream');

        await expand();

        expect(offered()).toEqual([]);
        expect(screen.getByText('Nothing published yet')).toBeInTheDocument();
    });

    it('collapses again on a second click', async () => {
        answering();
        renderAlarm('sec');

        await expand();
        expect(offered().length).toBeGreaterThan(0);

        await expand();

        expect(offered()).toEqual([]);
    });

    it('asks once, not again on every expansion', async () => {
        const fetcher = answering();
        renderAlarm('sec');

        await expand();
        await expand();
        await expand();

        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['bls', 'Bureau of Labor Statistics'],
        ['sec', 'SEC Filings'],
        ['stock-market', 'S&P 500'],
        ['stock-split', 'Stock Splits'],
        ['us-national-weather', 'US Weather Alerts'],
    ])('labels the %s row with its name, not its id', (stream, label) => {
        //
        // stream-name.js exists to keep identifiers out of the page and carries
        // the reasoning for each of these. This column printed the raw id.
        //
        answering();
        renderAlarm(stream);

        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('puts the react key on the anchor it repeats', async () => {
        answering();
        renderAlarm('sec');

        await expand();

        const anchors = [...document.querySelectorAll('.left-column a[download]')];
        expect(anchors.length).toBeGreaterThan(0);
        anchors.forEach((anchor) => {
            expect(anchor.querySelector('.MuiListItemButton-root')).toBeInTheDocument();
        });
    });
});


describe('the archive help tooltip', () => {
    it('is offered on a desktop viewport', () => {
        renderAlarm('bls');

        expect(document.querySelector('.help-icon')).toBeInTheDocument();
    });

    it('darkens while the pointer is over it', async () => {
        //
        // the only hover-driven state on the page: tool_tip_color moves between
        // #777 and #333.
        //
        renderAlarm('bls');

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: '#777' });

        await userEvent.hover(document.querySelector('.help-icon'));

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: '#333' });
    });

    it('returns to its resting color when the pointer leaves', async () => {
        renderAlarm('bls');

        await userEvent.hover(document.querySelector('.help-icon'));
        await userEvent.unhover(document.querySelector('.help-icon'));

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: '#777' });
    });

    it('is drawn in the dark page\'s grays on a dark page', async () => {
        //
        // the page's muted gray and its body text, which on a dark page are the
        // light ones -- see themeColors
        //
        window.history.pushState({}, '', '/stream/bls/alarm');

        render(
            <ThemeModeContext.Provider value={{ theme: 'dark', toggle: () => {} }}>
                <MemoryRouter initialEntries={['/stream/bls/alarm']}>
                    <Routes>
                        <Route path='/stream/:stream/alarm' element={<StreamAlarm />} />
                    </Routes>
                </MemoryRouter>
            </ThemeModeContext.Provider>
        );

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: colors_dark['gray-6'] });

        await userEvent.hover(document.querySelector('.help-icon'));

        expect(document.querySelector('.help-icon')).toHaveStyle({ color: colors_dark['gray-7'] });
    });
});
