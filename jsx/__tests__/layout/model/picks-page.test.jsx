/**
 * picks-page.test.jsx: /model/:model/picks, an options model's picks, for
 * signed-in readers (#290): the hold picker, the When card, how the hold's top 10
 * has done, the picks and a stock looked up, how to read them, and what the page
 * says where there are none to show.
 *
 * The model api is replaced at source.js, so each case says what the listing, the
 * track record and the picks answer, and the session at account-api.js. Today in
 * New York is held at 2026-10-21, the day the fixtures' picks are made from, unless
 * a case moves it -- see scores.js's newYorkToday.
 */

jest.mock('../../../import/layout/model/source.js', () => ({
    loadListing: jest.fn(),
    loadReport: jest.fn(),
    loadOptionPicks: jest.fn(),
    PICKS_SIGNED_OUT: 'signed-out',
    NO_PICKS: 'none',
    PICKS_FAILED: 'failed',
}));
jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    signedIn: jest.fn(),
}));
jest.mock('../../../import/layout/model/scores.js', () => ({
    ...jest.requireActual('../../../import/layout/model/scores.js'),
    newYorkToday: jest.fn(),
}));

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import PicksPageRoute, {
    PicksPage,
    PicksTable,
    READ,
    RecordCard,
    TITLE,
    WhenCard,
    gainWords,
    gapOf,
    holdsWith,
    optionWords,
    pastBuyDay,
    recordOf,
    tickerOf,
} from '../../../import/layout/model/picks-page.jsx';
import {
    NO_PICKS,
    PICKS_FAILED,
    PICKS_SIGNED_OUT,
    loadListing,
    loadOptionPicks,
    loadReport,
} from '../../../import/layout/model/source.js';
import { signedIn } from '../../../import/general/account-api.js';
import { newYorkToday } from '../../../import/layout/model/scores.js';
import {
    optionsListingOf,
    optionsModelOf,
    optionsTrackOf,
    picksOf,
    withAverageDays,
} from '../../../test-support/model-fixtures.js';

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });

    return { promise, resolve };
}

//
// what the api and the session answer: the listing, whether a reader is signed
// in, the model's track record, the night's picks, and a stock's by its symbol --
// none for a stock not in `stocks`
//
function answer({ listing = optionsListingOf(), reader = true, track = optionsTrackOf(30), picks = picksOf(), stocks = {} } = {}) {
    loadListing.mockResolvedValue(listing);
    signedIn.mockResolvedValue(reader);
    loadReport.mockResolvedValue(track);
    loadOptionPicks.mockImplementation((name, ticker) => Promise.resolve(ticker ? (stocks[ticker] || NO_PICKS) : picks));
}

async function open(name = 'pt-options', props = {}) {
    let view;

    await act(async () => {
        view = render(
            <MemoryRouter>
                <PicksPage name={name} {...props} />
            </MemoryRouter>
        );
    });

    return view;
}

//
// the table shown, as rows of its cells' text
//
function rowsShown() {
    const table = document.querySelector('.model-picks-table');

    return [...table.querySelectorAll('tbody tr')].map((row) => [...row.children].map((cell) => cell.textContent));
}

//
// a card of the two over the picks, by its name
//
function card(name) {
    return [...document.querySelectorAll('.model-stat')].find((each) => each.querySelector('.model-stat-label').textContent.startsWith(name));
}

async function lookUp(text) {
    const box = screen.getByRole('textbox', { name: 'Look up a stock' });

    await userEvent.clear(box);
    await userEvent.type(box, text);
    await act(async () => {
        fireEvent.submit(box.closest('form'));
    });
}

//
// a listing whose pt-options is `overrides` of itself, beside the stock models
//
function listingWith(overrides) {
    const listing = optionsListingOf();

    return {
        ...listing,
        models: listing.models.map((model) => (model.name === 'pt-options' ? { ...model, ...overrides } : model)),
    };
}

beforeEach(() => {
    loadListing.mockReset();
    loadReport.mockReset();
    loadOptionPicks.mockReset();
    signedIn.mockReset();
    newYorkToday.mockReset();
    newYorkToday.mockReturnValue('2026-10-21');
    window.localStorage.clear();
});

describe('signed out', () => {
    it('says the picks are for signed-in readers, with the ways to sign in and up, and asks for nothing', async () => {
        answer({ reader: false });
        await open();

        const message = screen.getByRole('region', { name: 'Sign in to see the picks' });

        expect(message).toHaveTextContent('An options model’s picks are for signed-in readers. Sign in or Sign up.');
        expect(within(message).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
        expect(within(message).getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
        expect(loadOptionPicks).not.toHaveBeenCalled();
        expect(loadReport).not.toHaveBeenCalled();
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('keeps the heading, the model\'s status and what the page is', async () => {
        answer({ reader: false });
        await open();

        expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
        expect(document.querySelector('.model-heading .model-pill')).toHaveTextContent('Live');
        expect(document.querySelector('.model-lede')).toHaveTextContent(
            'The 10 S&P 500 options pt-options rates best for each hold, and how its picks have done so far.',
        );
    });

    it('is the view of a session the api no longer takes', async () => {
        answer({ picks: PICKS_SIGNED_OUT });
        await open();

        expect(screen.getByRole('region', { name: 'Sign in to see the picks' })).toBeInTheDocument();
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('is the view, too, when a stock looked up is answered signed out', async () => {
        answer();
        loadOptionPicks.mockImplementation((name, ticker) => Promise.resolve(ticker ? PICKS_SIGNED_OUT : picksOf()));
        await open();

        await lookUp('AAPL');

        expect(screen.getByRole('region', { name: 'Sign in to see the picks' })).toBeInTheDocument();
    });
});

describe('signed in', () => {
    it('asks for the night\'s picks by the model\'s name and no stock, and its track record', async () => {
        answer();
        await open();

        expect(loadOptionPicks).toHaveBeenCalledTimes(1);
        expect(loadOptionPicks).toHaveBeenCalledWith('pt-options');
        expect(loadReport).toHaveBeenCalledWith('pt-options', 'track-record', 20);
    });

    it('leads back to the model\'s page, under the heading and its status', async () => {
        answer();
        await open();

        expect(screen.getByRole('link', { name: '‹ pt-options' })).toHaveAttribute('href', '/model/pt-options');
        expect(screen.getByRole('heading', { level: 4, name: TITLE })).toBeInTheDocument();
    });

    it('offers the holds that have picks, the first picked, and hands a hold picked up', async () => {
        const onHold = jest.fn();

        answer();
        await open('pt-options', { onHold: onHold });

        const picker = screen.getByRole('group', { name: 'Hold' });

        expect(within(picker).getAllByRole('button').map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days']);
        expect(within(picker).getByRole('button', { name: '1 day' })).toHaveAttribute('aria-pressed', 'true');

        await userEvent.click(within(picker).getByRole('button', { name: '20 days' }));

        expect(onHold).toHaveBeenCalledWith(20);
    });

    it('takes a hold picked as nothing to do where it is handed no way to pick one', async () => {
        answer();
        await open();

        await userEvent.click(screen.getByRole('button', { name: '5 days' }));

        expect(screen.getByRole('table', { name: 'Top 10, held 1 day' })).toBeInTheDocument();
    });

    it('offers only the holds that have picks, and the first of them where the hold picked has none', async () => {
        answer({ picks: picksOf([5, 20], 3) });
        await open('pt-options', { hold: 1 });

        expect(within(screen.getByRole('group', { name: 'Hold' })).getAllByRole('button').map((button) => button.textContent))
            .toEqual(['5 days', '20 days']);
        expect(screen.getByRole('table', { name: 'Top 10, held 5 days' })).toBeInTheDocument();
        expect(rowsShown()).toHaveLength(3);
    });

    it('says when the hold\'s picks are made from, bought and sold', async () => {
        answer();
        await open();

        const when = card('When');
        const lines = [...when.querySelectorAll('.model-picks-when-row')].map((row) => [...row.children].map((cell) => cell.textContent));

        expect(lines).toEqual([
            ['From', 'Wed, Oct 21', 'that day’s data'],
            ['Buy', 'Thu, Oct 22', 'at 9:40 AM, at the ask'],
            ['Sell', 'Fri, Oct 23', 'at 3:40 PM, at the bid'],
        ]);
    });

    it('follows the hold picked: its sell day, its record and its picks', async () => {
        answer();
        await open('pt-options', { hold: 20 });

        expect(card('When').querySelectorAll('.model-picks-when-day')[2]).toHaveTextContent('Thu, Nov 19');
        expect(card('How its top 10 has done')).toHaveTextContent('How its top 10 has done, held 20 days');
        expect(screen.getByRole('table', { name: 'Top 10, held 20 days' })).toBeInTheDocument();
    });

    it('shows how the hold\'s top 10 has done over its last 20 scored days, beside a random pick', async () => {
        answer();
        await open();

        const record = card('How its top 10 has done');
        const figures = [...record.querySelectorAll('.model-picks-figure')].map((figure) => figure.textContent);

        expect(figures).toEqual(['+3.1%average gain · a random pick −4.0%', '6.3 of 10made money · a random pick 5.6']);
        expect(record.querySelectorAll('.model-picks-strip-day')).toHaveLength(20);
        expect(record.querySelector('.model-picks-strip-frame').style.getPropertyValue('--days')).toBe('20');
        expect(record.querySelector('.model-picks-strip-key')).toHaveTextContent('the last 20 of 30 scored days');
        expect(within(record).getByRole('img')).toHaveAccessibleName('Each scored day’s top 10 gain, Sep 15 to Oct 12, beside a random pick’s');
    });

    it('counts a hold\'s scored days so far while it has fewer than 20, and says when a hold has none yet', async () => {
        answer();
        const view = await open('pt-options', { hold: 20 });

        expect(card('How its top 10 has done').querySelectorAll('.model-picks-strip-day')).toHaveLength(11);
        expect(card('How its top 10 has done').querySelector('.model-picks-strip-frame').style.getPropertyValue('--days')).toBe('11');
        expect(card('How its top 10 has done').querySelector('.model-picks-strip-key')).toHaveTextContent('11 days scored so far');

        view.unmount();
        answer({ track: optionsTrackOf(10) });
        await open('pt-options', { hold: 20 });

        expect(card('How its top 10 has done')).toHaveTextContent(
            'None yetA pick held 20 days is scored once it’s sold, 21 trading days after the day it was made.',
        );
        expect(card('How its top 10 has done').querySelector('.model-picks-strip')).toBeNull();
    });

    it('takes in as many of the hold\'s scored days as the listing\'s average_days, from format 4 (#293)', async () => {
        answer({ listing: withAverageDays(optionsListingOf(), 25) });
        await open();

        const record = card('How its top 10 has done');

        expect(loadReport).toHaveBeenCalledWith('pt-options', 'track-record', 25);
        expect(record.querySelectorAll('.model-picks-strip-day')).toHaveLength(25);
        expect(record.querySelector('.model-picks-strip-key')).toHaveTextContent('the last 25 of 30 scored days');
    });

    it('counts the hold\'s scored days so far while it has fewer than the listing\'s average_days (#293)', async () => {
        answer({ listing: withAverageDays(optionsListingOf(), 30) });
        await open();

        const record = card('How its top 10 has done');

        expect(record.querySelectorAll('.model-picks-strip-day')).toHaveLength(30);
        expect(record.querySelector('.model-picks-strip-key')).toHaveTextContent('30 days scored so far');
    });

    it('takes in the listing\'s days on the page of a model taken down too (#293)', async () => {
        answer({ listing: withAverageDays(listingWith({ down: { since: '2026-10-16', days: 1, in_a_row: 5, hold: 1 } }), 10) });
        await open();

        expect(card('How its top 10 has done').querySelector('.model-picks-strip-key')).toHaveTextContent('the last 10 of 30 scored days');
    });

    it('waits on the record as bars, and says so where it could not be had', async () => {
        answer();
        loadReport.mockReturnValue(new Promise(() => {}));
        const view = await open();

        expect(card('How its top 10 has done').querySelectorAll('.graph-pending-bar')).toHaveLength(2);

        view.unmount();
        answer({ track: null });
        await open();

        expect(card('How its top 10 has done')).toHaveTextContent('Its record could not be loaded.');
    });

    it('lists the hold\'s top 10, best first, under how they are ranked, and over the line that they are guesses', async () => {
        answer();
        await open();

        const picks = screen.getByRole('region', { name: 'Top 10, held 1 day' });
        const headings = within(picks).getAllByRole('columnheader').map((cell) => cell.textContent);

        expect(headings).toEqual([
            '#',
            'Stock',
            'Option strike, expiry',
            'Bid / ask last quote',
            'Chance it makes money the model’s, the usual, the gap',
            'Gain guess low · middle · high',
        ]);
        expect(rowsShown().map((row) => row[0])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
        expect(rowsShown()[0]).toEqual(['1', 'AAPL', 'Call $200 · Nov 20', '$4.10 / $4.35', '62.0% usual 48.0% +14.0', '−35.0% · +12.0% · +80.0%']);
        expect(rowsShown()[2][2]).toBe('Put $210 · Nov 20');
        expect(picks.querySelector('.model-card-sub')).toHaveTextContent(
            'Ranked by how far each option’s chance of making money is above the usual chance for options like it.',
        );
        expect(picks.querySelector('.model-picks-foot')).toHaveTextContent('The model’s guesses, not trading advice.');
    });

    it('folds "How to read these picks", open at first, and keeps it folded for the next visit', async () => {
        answer();
        const view = await open();

        const fold = screen.getByRole('button', { name: 'How to read these picks' });
        const entries = () => [...document.querySelectorAll('.model-picks-read-item')].map((item) => item.firstChild.textContent);

        expect(fold).toHaveAttribute('aria-expanded', 'true');
        expect(entries()).toEqual(READ.map((entry) => entry.name));

        await userEvent.click(fold);

        expect(fold).toHaveAttribute('aria-expanded', 'false');
        expect(entries()).toEqual([]);

        view.unmount();
        await open();

        expect(screen.getByRole('button', { name: 'How to read these picks' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('says how to read the chance, the usual, the gain guess and the record, and that none of it is advice', () => {
        expect(READ.map((entry) => entry.name)).toEqual(['Chance', 'Usual', 'Gain guess', 'How it has done', 'Not advice']);
        expect(READ[1].text).toMatch(/The gap between the two ranks the picks\.$/);
        expect(READ[2].text).toMatch(/It expects 1 in 10 to do worse than low, and 1 in 10 to do better than high\.$/);
        expect(READ[4].text).toBe('These are a model’s guesses, published to show how well it predicts. Nothing here is a recommendation to buy or sell anything.');
    });
});

describe('a stock looked up', () => {
    it('is asked for by its symbol, in capitals, BRK/B as BRK.B', async () => {
        answer({ stocks: { 'BRK.B': picksOf([1, 5], 4, 'BRK.B') } });
        await open();

        await lookUp(' brk/b ');

        expect(loadOptionPicks).toHaveBeenLastCalledWith('pt-options', 'BRK.B');
        expect(screen.getByRole('textbox', { name: 'Look up a stock' })).toHaveValue('BRK.B');
    });

    it('takes the top 10\'s place, its options for the hold picked under the stock\'s name, with Clear', async () => {
        answer({ stocks: { 'BRK.B': picksOf([1, 5], 4, 'BRK.B') } });
        await open();

        await lookUp('BRK.B');

        expect(screen.getByRole('heading', { name: 'BRK.B’s options, held 1 day' })).toBeInTheDocument();
        expect(rowsShown().map((row) => row[1])).toEqual(['BRK.B', 'BRK.B', 'BRK.B', 'BRK.B']);
        expect(screen.getByRole('table', { name: 'BRK.B’s options, held 1 day' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    it('says the stock is loading while its options are on their way', async () => {
        const stock = deferred();

        answer();
        loadOptionPicks.mockImplementation((name, ticker) => (ticker ? stock.promise : Promise.resolve(picksOf())));
        await open();

        await lookUp('AAPL');

        expect(screen.getByRole('status')).toHaveTextContent('Loading AAPL’s options…');

        await act(async () => stock.resolve(picksOf([1], 1, 'AAPL')));

        expect(rowsShown()).toHaveLength(1);
    });

    it('says so where the stock has no picks, none for the hold picked, or they could not be read', async () => {
        answer({ stocks: { MSFT: picksOf([1], 2, 'MSFT') } });
        const view = await open('pt-options', { hold: 5 });

        await lookUp('ZZZZ');
        expect(screen.getByText('No picks for ZZZZ.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).toBeNull();

        await lookUp('MSFT');
        expect(screen.getByText('No picks for MSFT held 5 days.')).toBeInTheDocument();

        view.unmount();
        answer();
        loadOptionPicks.mockImplementation((name, ticker) => Promise.resolve(ticker ? PICKS_FAILED : picksOf()));
        await open();

        await lookUp('AAPL');
        expect(screen.getByText('AAPL’s options could not be read. Try again in a few minutes.')).toBeInTheDocument();
    });

    it('is cleared by its button, which puts the top 10 back, and empties the box', async () => {
        answer({ stocks: { AAPL: picksOf([1], 2, 'AAPL') } });
        await open();

        await lookUp('AAPL');
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(screen.getByRole('heading', { name: 'Top 10, held 1 day' })).toBeInTheDocument();
        expect(rowsShown()).toHaveLength(10);
        expect(screen.getByRole('textbox', { name: 'Look up a stock' })).toHaveValue('');
        expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    });

    it('is cleared too by looking up nothing', async () => {
        answer({ stocks: { AAPL: picksOf([1], 2, 'AAPL') } });
        await open();

        await lookUp('AAPL');
        await userEvent.clear(screen.getByRole('textbox', { name: 'Look up a stock' }));
        await act(async () => {
            fireEvent.submit(screen.getByRole('search'));
        });

        expect(screen.getByRole('heading', { name: 'Top 10, held 1 day' })).toBeInTheDocument();
    });

    it('lets go of one that lands after another stock was asked for, or after the page has gone', async () => {
        const slow = deferred();

        answer();
        loadOptionPicks.mockImplementation((name, ticker) => {
            if (ticker === 'AAPL') {
                return slow.promise;
            }

            return Promise.resolve(ticker ? picksOf([1], 2, ticker) : picksOf());
        });
        const view = await open();

        await lookUp('AAPL');
        await lookUp('MSFT');
        await act(async () => slow.resolve(picksOf([1], 5, 'AAPL')));

        expect(screen.getByRole('heading', { name: 'MSFT’s options, held 1 day' })).toBeInTheDocument();
        expect(rowsShown().map((row) => row[1])).toEqual(['MSFT', 'MSFT']);

        const late = deferred();

        loadOptionPicks.mockReturnValue(late.promise);
        await lookUp('NVDA');
        view.unmount();
        await act(async () => late.resolve(picksOf([1], 1, 'NVDA')));

        expect(document.querySelector('.model-picks')).toBeNull();
    });
});

describe('where there are no picks to show', () => {
    it('waits as the page\'s placeholder while the listing or the picks are on their way', async () => {
        loadListing.mockReturnValue(new Promise(() => {}));
        signedIn.mockResolvedValue(true);
        const view = await open();

        expect(screen.getByRole('status')).toHaveTextContent('Loading the picks…');
        expect(document.querySelector('.model-picks-pending')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByRole('link', { name: '‹ pt-options' })).toHaveAttribute('href', '/model/pt-options');

        view.unmount();
        answer();
        loadOptionPicks.mockReturnValue(new Promise(() => {}));
        await open();

        expect(document.querySelectorAll('.model-picks-pending-rows .graph-pending-bar')).toHaveLength(10);
        expect(document.querySelector('.model-heading .model-pill')).toHaveTextContent('Live');
    });

    it('says a model taken down has no picks, and why, over its record, and asks for none', async () => {
        answer({ listing: listingWith({ down: { since: '2026-10-16', days: 1, in_a_row: 5, hold: 1 } }) });
        await open();

        expect(screen.getByRole('region', { name: 'No picks while pt-options is down' })).toHaveTextContent(
            'pt-options was taken down on Oct 16: the 1-day hold did worse than the baseline 5 scored days in a row. It makes no picks until a new version beats the baseline on the days it was tested on.',
        );
        expect(card('How its top 10 has done')).toHaveClass('model-picks-record-wide');
        expect(within(screen.getByRole('group', { name: 'Hold' })).getAllByRole('button')).toHaveLength(3);
        expect(loadOptionPicks).not.toHaveBeenCalled();
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('says why a model was taken down where no check did it, from format 4 (#295)', async () => {
        answer({ listing: listingWith({ down: { since: '2026-10-23', reason: 'not_ahead', days: null, in_a_row: null } }) });
        await open();

        expect(screen.getByRole('region', { name: 'No picks while pt-options is down' })).toHaveTextContent(
            'pt-options was taken down on Oct 23: it went live without beating the baseline. It makes no picks until a new version beats the baseline on the days it was tested on.',
        );
        expect(loadOptionPicks).not.toHaveBeenCalled();
    });

    it('offers no hold to a model taken down until its track record says which it has', async () => {
        answer({ listing: listingWith({ down: { since: '2026-10-16', days: 1, in_a_row: 5, hold: 1 } }) });
        loadReport.mockReturnValue(new Promise(() => {}));
        await open();

        expect(screen.queryByRole('group', { name: 'Hold' })).toBeNull();
    });

    it('says a retired model makes no picks, and asks for nothing', async () => {
        answer({ listing: listingWith({ retired: '2026-10-19' }) });
        await open();

        expect(screen.getByRole('region', { name: 'No picks' })).toHaveTextContent(
            'pt-options retired Oct 19. It is no longer trained, so it makes no picks.',
        );
        expect(loadOptionPicks).not.toHaveBeenCalled();
        expect(loadReport).not.toHaveBeenCalled();
    });

    it('says there are none yet where the api has none', async () => {
        answer({ picks: NO_PICKS });
        await open();

        expect(screen.getByRole('region', { name: 'No picks yet' })).toHaveTextContent(
            'pt-options hasn’t published any picks yet. Its first come the night after its first version goes live.',
        );
    });

    it('says the picks could not be read', async () => {
        answer({ picks: PICKS_FAILED });
        await open();

        expect(screen.getByText('The picks could not be read. Try again in a few minutes.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('says the picks are older than their buy day once it has passed in New York, and not before', async () => {
        answer();
        newYorkToday.mockReturnValue('2026-10-22');
        const view = await open();

        expect(document.querySelector('.model-picks-older')).toBeNull();

        view.unmount();
        newYorkToday.mockReturnValue('2026-10-23');
        await open();

        expect(document.querySelector('.model-picks-older')).toHaveTextContent(
            'These picks were made from the data of Wed, Oct 21, to buy on Thu, Oct 22. That day has passed, and pt-options hasn’t published newer ones yet.',
        );
    });

    it('says there are no models where the listing could not be had', async () => {
        answer({ listing: null });
        await open();

        expect(screen.getByText('No models to show yet.')).toBeInTheDocument();
    });

    it('says a name that is no model\'s is not found, and leads back to every model', async () => {
        answer();
        await open('no-such-model');

        expect(screen.getByRole('heading', { name: 'Model not found' })).toBeInTheDocument();
        expect(screen.getByText('There is no model named “no-such-model”.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ All models' })).toHaveAttribute('href', '/model');
        expect(loadOptionPicks).not.toHaveBeenCalled();
    });

    it('says a model of a task the listing does not describe picks no options', async () => {
        const listing = optionsListingOf();

        answer({ listing: { ...listing, tasks: listing.tasks.filter((task) => task.id !== 'option-picks') } });
        await open();

        expect(screen.getByRole('heading', { name: 'No picks' })).toBeInTheDocument();
        expect(loadOptionPicks).not.toHaveBeenCalled();
    });

    it('says a stock model picks no options, and leads back to its page', async () => {
        answer();
        await open('pt-gnn');

        expect(screen.getByRole('heading', { name: 'No picks' })).toBeInTheDocument();
        expect(screen.getByText('pt-gnn doesn’t pick options. Only an options model has picks.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ pt-gnn' })).toHaveAttribute('href', '/model/pt-gnn');
        expect(loadOptionPicks).not.toHaveBeenCalled();
    });

    it('lets go of what lands after the page has gone', async () => {
        const listing = deferred();
        const session = deferred();

        loadListing.mockReturnValue(listing.promise);
        signedIn.mockReturnValue(session.promise);
        const view = await open();

        view.unmount();
        await act(async () => {
            listing.resolve(optionsListingOf());
            session.resolve(true);
        });

        expect(loadOptionPicks).not.toHaveBeenCalled();

        const picks = deferred();
        const track = deferred();

        answer();
        loadOptionPicks.mockReturnValue(picks.promise);
        loadReport.mockReturnValue(track.promise);
        const again = await open();

        again.unmount();
        await act(async () => {
            picks.resolve(picksOf());
            track.resolve(optionsTrackOf(5));
        });

        expect(document.querySelector('.model-picks')).toBeNull();
    });
});

describe('the route', () => {
    it('reads the model\'s name from the address', async () => {
        answer();

        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/model/pt-options/picks']}>
                    <Routes>
                        <Route path='/model/:model/picks' element={<PicksPageRoute />} />
                    </Routes>
                </MemoryRouter>
            );
        });

        expect(loadOptionPicks).toHaveBeenCalledWith('pt-options');
        expect(screen.getByRole('table', { name: 'Top 10, held 1 day' })).toBeInTheDocument();
    });
});

describe('the table', () => {
    //
    // one row, its cells' parts by class
    //
    function only(pick) {
        render(<PicksTable label='Picks' rows={[pick]} />);

        return document.querySelector('.model-picks-table tbody tr');
    }

    const width = (element) => parseFloat(element.style.width);
    const left = (element) => parseFloat(element.style.left);

    it('draws the chance as a bar, gray up to the usual chance and green from there to the model\'s', () => {
        const [pick] = picksOf([1], 1);
        const row = only(pick);

        expect(width(row.querySelector('.model-pick-bar-usual'))).toBeCloseTo(48, 5);
        expect(left(row.querySelector('.model-pick-bar-gap'))).toBeCloseTo(48, 5);
        expect(width(row.querySelector('.model-pick-bar-gap'))).toBeCloseTo(14, 5);
        expect(row.querySelector('.model-pick-bar-gap')).toHaveClass('model-pick-above');
        expect(row.querySelector('.model-pick-gap')).toHaveClass('model-pick-above');
    });

    it('draws a chance under the usual one in red, from the model\'s up to the usual', () => {
        const [pick] = picksOf([1], 1);
        const row = only({ ...pick, chance: 0.4 });

        expect(row.querySelector('.model-pick-gap')).toHaveTextContent('−8.0');
        expect(row.querySelector('.model-pick-gap')).toHaveClass('model-pick-below');
        expect(width(row.querySelector('.model-pick-bar-usual'))).toBeCloseTo(40, 5);
        expect(left(row.querySelector('.model-pick-bar-gap'))).toBeCloseTo(40, 5);
        expect(width(row.querySelector('.model-pick-bar-gap'))).toBeCloseTo(8, 5);
        expect(row.querySelector('.model-pick-bar-gap')).toHaveClass('model-pick-below');
    });

    it('draws the gain guess as a line on the rows\' scale, red below zero and green above, a dot at the middle', () => {
        const [pick] = picksOf([1], 1);
        const row = only(pick);
        const at = (value) => ((value + 0.35) / 1.15) * 100;

        expect(left(row.querySelector('.model-pick-zero'))).toBeCloseTo(at(0), 5);
        expect(left(row.querySelector('.model-pick-span.model-pick-below'))).toBeCloseTo(0, 5);
        expect(width(row.querySelector('.model-pick-span.model-pick-below'))).toBeCloseTo(at(0), 5);
        expect(left(row.querySelector('.model-pick-span.model-pick-above'))).toBeCloseTo(at(0), 5);
        expect(width(row.querySelector('.model-pick-span.model-pick-above'))).toBeCloseTo(100 - at(0), 5);
        expect(left(row.querySelector('.model-pick-mid'))).toBeCloseTo(at(0.12), 5);
        expect(row.querySelector('.model-pick-middle')).toHaveTextContent('+12.0%');
    });

    it('draws a gain guess wholly above zero, or wholly below, in its one color', () => {
        const [pick] = picksOf([1], 1);

        const up = only({ ...pick, gain_low: 0.05, gain_middle: 0.1, gain_high: 0.2 });

        expect(up.querySelector('.model-pick-span.model-pick-below')).toBeNull();
        expect(left(up.querySelector('.model-pick-span.model-pick-above'))).toBeCloseTo(25, 5);

        document.body.innerHTML = '';

        const down = only({ ...pick, gain_low: -0.4, gain_middle: -0.2, gain_high: -0.1 });

        expect(down.querySelector('.model-pick-span.model-pick-above')).toBeNull();
        expect(width(down.querySelector('.model-pick-span.model-pick-below'))).toBeCloseTo(75, 5);
    });

    it('prints a figure the picks have none of as a dash, draws no bar or line for it, and a gain that rounds to nothing unsigned', () => {
        const [pick] = picksOf([1], 1);
        const row = only({ ...pick, last_bid: null, chance: null, gain_low: null, gain_middle: 0.0001, expiry: null });

        expect([...row.children].map((cell) => cell.textContent).slice(2)).toEqual([
            'Call $200',
            '– / $4.35',
            '– usual 48.0%',
            '– · 0.0% · +80.0%',
        ]);
        expect(row.querySelector('.model-pick-bar')).toBeNull();
        expect(row.querySelector('.model-pick-range')).toBeNull();
    });

    it('draws no line for a pick with no gain guess at all', () => {
        const [pick] = picksOf([1], 1);
        const row = only({ ...pick, gain_low: null, gain_middle: null, gain_high: null });

        expect(row.querySelector('.model-pick-gain')).toHaveTextContent('– · – · –');
        expect(row.querySelector('.model-pick-range')).toBeNull();
    });

    it('draws no dot where the middle is missing', () => {
        const [pick] = picksOf([1], 1);
        const row = only({ ...pick, gain_middle: null });

        expect(row.querySelector('.model-pick-range')).not.toBeNull();
        expect(row.querySelector('.model-pick-mid')).toBeNull();
    });

    it('names an option\'s contract under the pointer, and nothing where the picks give none', () => {
        const [pick] = picksOf([1], 1);

        render(<PicksTable label='Picks' rows={[pick, { ...pick, rank: 2, contract: '' }]} />);

        const options = [...document.querySelectorAll('td.model-pick-option > span:first-child')];

        expect(options[0]).toHaveAttribute('title', 'AAPL  261120C00200000');
        expect(options[1]).not.toHaveAttribute('title');
    });

    it('names the chance and the gain guess by their headings, for a phone\'s card to show over them', () => {
        const [pick] = picksOf([1], 1);
        const row = only(pick);

        expect(row.querySelector('.model-pick-chance')).toHaveAttribute('data-label', 'Chance it makes money');
        expect(row.querySelector('.model-pick-gain')).toHaveAttribute('data-label', 'Gain guess');
    });
});

describe('the cards', () => {
    it('print a day the When card has none of as a dash', () => {
        const [pick] = picksOf([1], 1);

        render(<WhenCard rows={[{ ...pick, buy_on: null }]} />);

        expect(document.querySelectorAll('.model-picks-when-day')[1]).toHaveTextContent('–');
    });

    it('name a hold the pages do not know by its days', () => {
        render(<RecordCard track={[]} hold={3} />);

        expect(document.querySelector('.model-stat-label')).toHaveTextContent('How its top 10 has done, held 3 days');
    });

    it('draw a day the record has no random pick for with no line, a loss as a bar down, and one day with no last day', () => {
        const track = [{
            day: '2026-10-06',
            score: { top10_gain_1d: -0.02, top10_wins_1d: null },
            baseline: { top10_gain_1d: null, top10_wins_1d: null },
        }];

        render(<RecordCard track={track} hold={1} />);

        const day = document.querySelector('.model-picks-strip-day');

        expect(day.querySelector('.model-picks-strip-random')).toBeNull();
        expect(day.querySelector('.model-picks-strip-bar')).toHaveClass('model-picks-strip-down');
        expect(day).toHaveAttribute('title', 'Oct 6: its top 10 −2.0%, a random pick –');
        expect(document.querySelectorAll('.model-picks-strip-axis > span')).toHaveLength(1);
        expect(document.querySelector('.model-picks-strip-key')).toHaveTextContent('1 day scored so far');
        expect(document.querySelectorAll('.model-picks-figure')[1]).toHaveTextContent('– of 10made money · a random pick –');
    });

    it('name a day\'s wins under the pointer', () => {
        render(<RecordCard track={optionsTrackOf(2)} hold={1} />);

        expect(document.querySelector('.model-picks-strip-day')).toHaveAttribute(
            'title',
            'Sep 1: its top 10 +3.0%, a random pick −4.0%, 6.3 of 10 made money',
        );
    });
});

describe('the words', () => {
    it('take a stock\'s symbol as the api does, in capitals, and a share class after a dot', () => {
        expect(tickerOf(' brk/b ')).toBe('BRK.B');
        expect(tickerOf('aapl')).toBe('AAPL');
        expect(tickerOf(null)).toBe('');
    });

    it('say an option as a call or a put and its strike, its expiry beside it', () => {
        expect(optionWords({ call_put: 'call', strike: 230 })).toBe('Call $230');
        expect(optionWords({ call_put: 'put', strike: 232.5 })).toBe('Put $232.50');
        expect(optionWords({ call_put: 'c', strike: 355 })).toBe('Call $355');
        expect(optionWords({ call_put: 'p', strike: 180 })).toBe('Put $180');
        expect(optionWords({ call_put: '', strike: null })).toBe('');
        expect(optionWords({ call_put: 'straddle', strike: 10 })).toBe('straddle $10');
    });

    it('find the holds picks have, in the holds\' order', () => {
        expect(holdsWith(picksOf([20, 1], 1)).map((hold) => hold.days)).toEqual([1, 20]);
        expect(holdsWith(null)).toEqual([]);
    });

    it('take the gap between a chance and the usual one, or none where either is missing', () => {
        expect(gapOf({ chance: 0.62, usual_chance: 0.48 })).toBeCloseTo(0.14, 10);
        expect(gapOf({ chance: null, usual_chance: 0.48 })).toBeNull();
    });

    it('print a gain signed, to a tenth of a percent', () => {
        expect(gainWords(0.123)).toBe('+12.3%');
        expect(gainWords(-0.35)).toBe('−35.0%');
        expect(gainWords(0.0001)).toBe('0.0%');
        expect(gainWords(null)).toBe('–');
    });

    it('find a hold\'s record over its last 20 scored days, and none for a hold with none', () => {
        const record = recordOf(optionsTrackOf(30), 5);

        expect(record.scored).toBe(26);
        expect(record.days).toHaveLength(20);
        expect(record.days[0].day).toBe(optionsTrackOf(30)[6].day);
        expect(record.random_gain).toBeCloseTo(-0.04, 10);
        expect(recordOf(optionsTrackOf(10), 20)).toBeNull();
        expect(recordOf(null, 1)).toBeNull();
    });

    it('find a hold\'s record over as many of its last scored days as they are asked to (#293)', () => {
        const record = recordOf(optionsTrackOf(30), 5, 10);

        expect(record.scored).toBe(26);
        expect(record.count).toBe(10);
        expect(record.days).toHaveLength(10);
        expect(record.days[0].day).toBe(optionsTrackOf(30)[16].day);
        expect(recordOf(optionsTrackOf(30), 5).count).toBe(20);
        expect(recordOf(optionsTrackOf(30), 1, 40).days).toHaveLength(30);
    });

    it('call a buy day past once today in New York is after it', () => {
        newYorkToday.mockReturnValue('2026-10-23');

        expect(pastBuyDay('2026-10-22')).toBe(true);
        expect(pastBuyDay('2026-10-23')).toBe(false);
        expect(pastBuyDay(null)).toBe(false);
    });
});

describe('every options model', () => {
    it('has a picks page of its own, whatever its name', async () => {
        const listing = optionsListingOf();

        listing.models.push(optionsModelOf({ name: 'tables-options' }));
        answer({ listing: listing });
        await open('tables-options');

        expect(loadOptionPicks).toHaveBeenCalledWith('tables-options');
        expect(screen.getByRole('link', { name: '‹ tables-options' })).toHaveAttribute('href', '/model/tables-options');
    });
});
