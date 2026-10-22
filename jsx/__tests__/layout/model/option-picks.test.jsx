/**
 * option-picks.test.jsx: an options model's picks, on its own page (#279):
 * tonight's top 10 for each hold behind a tab of its own, a stock looked up by
 * its symbol, and what the card says where there are none.
 *
 * The api is replaced at source.js, so each case says what the picks answer,
 * and when. model-page.test.jsx covers which models' pages hold the card.
 */

jest.mock('../../../import/layout/model/source.js', () => ({
    loadOptionPicks: jest.fn(),
}));

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OptionPicks, { PicksTable, TITLE, holdsWith, optionWords, tickerOf } from '../../../import/layout/model/option-picks.jsx';
import { loadOptionPicks } from '../../../import/layout/model/source.js';
import { picksOf } from '../../../test-support/model-fixtures.js';

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });

    return { promise, resolve };
}

//
// what the picks answer: tonight's top 10, `top`, and a stock's options by its
// symbol, `stocks`, none for a stock not in it
//
function answer(top = picksOf(), stocks = {}) {
    loadOptionPicks.mockImplementation((name, ticker) => Promise.resolve(ticker ? (stocks[ticker] || null) : top));
}

async function open(name = 'pt-options') {
    let view;

    await act(async () => {
        view = render(<OptionPicks name={name} />);
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

async function lookUp(text) {
    const box = screen.getByRole('textbox', { name: 'Look up a stock' });

    await userEvent.clear(box);
    await userEvent.type(box, text);
    await act(async () => {
        fireEvent.submit(box.closest('form'));
    });
}

beforeEach(() => {
    loadOptionPicks.mockReset();
});

describe('tonight\'s top 10', () => {
    it('are asked for by the model\'s name, and no stock', async () => {
        answer();
        await open();

        expect(loadOptionPicks).toHaveBeenCalledTimes(1);
        expect(loadOptionPicks).toHaveBeenCalledWith('pt-options');
    });

    it('are a card under its title, saying which day they were made from', async () => {
        answer();
        await open();

        expect(screen.getByRole('region', { name: TITLE })).toHaveClass('model-card', 'model-picks');
        expect(screen.getByRole('heading', { name: 'Tonight’s top 10' })).toBeInTheDocument();
        expect(screen.getByText('Made from the data of Wed, Oct 21, 2026.')).toBeInTheDocument();
    });

    it('show the first hold\'s ten, best first, behind a tab for each hold that has picks', async () => {
        answer();
        await open();

        const tabs = within(screen.getByRole('tablist', { name: 'Hold' })).getAllByRole('tab');

        expect(tabs.map((tab) => tab.textContent)).toEqual(['1 day', '5 days', '20 days']);
        expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
        expect(rowsShown().map((row) => row[0])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[0].id);
        expect(screen.getByRole('table', { name: 'Tonight’s top 10, held 1 day' })).toBeInTheDocument();
    });

    it('say each pick\'s stock, its option, when it is bought and sold, its quotes, its chance beside the usual, and its gains', async () => {
        answer();
        await open();

        const headings = within(document.querySelector('.model-picks-table')).getAllByRole('columnheader').map((cell) => cell.textContent);

        expect(headings).toEqual(['Rank', 'Stock', 'Option', 'Buy at 9:40 AM', 'Sell at 3:40 PM', 'Last bid / ask', 'Chance', 'Gain: low, middle, high']);
        expect(rowsShown()[0]).toEqual(['1', 'AAPL', 'Call $200, Nov 20', 'Oct 22', 'Oct 23', '$4.10 / $4.35', '62.0% usual 48.0%', '−35.0% · +12.0% · +80.0%']);
        expect(rowsShown()[2][2]).toBe('Put $210, Nov 20');
    });

    it('show another hold\'s picks when its tab is picked', async () => {
        answer();
        await open();

        await userEvent.click(screen.getByRole('tab', { name: '20 days' }));

        expect(screen.getByRole('tab', { name: '20 days' })).toHaveAttribute('aria-selected', 'true');
        expect(rowsShown()[0][4]).toBe('Nov 19');
        expect(screen.getByRole('table', { name: 'Tonight’s top 10, held 20 days' })).toBeInTheDocument();
    });

    it('move along the tabs by the arrow keys, Home and End, the focus with them', async () => {
        answer();
        await open();

        const tab = (name) => screen.getByRole('tab', { name: name });

        tab('1 day').focus();
        fireEvent.keyDown(tab('1 day'), { key: 'ArrowRight' });

        expect(tab('5 days')).toHaveAttribute('aria-selected', 'true');
        expect(tab('5 days')).toHaveFocus();
        expect(tab('5 days')).toHaveAttribute('tabindex', '0');
        expect(tab('1 day')).toHaveAttribute('tabindex', '-1');

        fireEvent.keyDown(tab('5 days'), { key: 'End' });
        expect(tab('20 days')).toHaveFocus();

        fireEvent.keyDown(tab('20 days'), { key: 'ArrowRight' });
        expect(tab('1 day')).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(tab('1 day'), { key: 'ArrowLeft' });
        expect(tab('20 days')).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(tab('20 days'), { key: 'Home' });
        expect(tab('1 day')).toHaveFocus();

        fireEvent.keyDown(tab('1 day'), { key: 'a' });
        expect(tab('1 day')).toHaveAttribute('aria-selected', 'true');
    });

    it('offer tabs only for the holds that have picks', async () => {
        answer(picksOf([5, 20], 3));
        await open();

        expect(within(screen.getByRole('tablist')).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['5 days', '20 days']);
        expect(rowsShown()).toHaveLength(3);
    });

    it('say under the table how they are ranked, and that they are not advice', async () => {
        answer();
        await open();

        expect(document.querySelector('.model-picks-foot')).toHaveTextContent(
            'The model’s guesses, ranked by how far each option’s chance is above the usual chance for options like it. Not trading advice.',
        );
    });

    it('wait as the card\'s placeholder, under its title, while they are on their way', async () => {
        loadOptionPicks.mockReturnValue(new Promise(() => {}));
        await open();

        expect(document.querySelector('.model-picks')).toHaveAttribute('aria-hidden', 'true');
        expect(document.querySelector('.model-picks h5')).toHaveTextContent(TITLE);
        expect(document.querySelector('.model-picks-table')).toBeNull();
    });

    it('say there are none to show yet where they could not be had, and still let a stock be looked up', async () => {
        answer(null, { AAPL: picksOf([1], 2, 'AAPL') });
        await open();

        expect(screen.getByText('No picks to show yet.')).toBeInTheDocument();
        expect(screen.queryByRole('tablist')).toBeNull();
        expect(document.querySelector('.model-card-sub')).toBeNull();

        await lookUp('aapl');

        expect(rowsShown()).toHaveLength(2);
    });

    it('are let go when they land after the card has gone', async () => {
        const late = deferred();

        loadOptionPicks.mockReturnValue(late.promise);

        const { unmount } = await open();

        unmount();
        await act(async () => late.resolve(picksOf()));

        expect(document.querySelector('.model-picks')).toBeNull();
    });
});

describe('a stock looked up', () => {
    it('is asked for by its symbol, in capitals, BRK/B as BRK.B', async () => {
        answer(picksOf(), { 'BRK.B': picksOf([1, 5], 4, 'BRK.B') });
        await open();

        await lookUp(' brk/b ');

        expect(loadOptionPicks).toHaveBeenLastCalledWith('pt-options', 'BRK.B');
        expect(screen.getByRole('textbox', { name: 'Look up a stock' })).toHaveValue('BRK.B');
    });

    it('takes the table\'s place, its options for each hold under the stock\'s name, best first', async () => {
        answer(picksOf(), { 'BRK.B': picksOf([1, 5], 4, 'BRK.B') });
        await open();

        await lookUp('BRK.B');

        expect(screen.getByRole('heading', { name: 'BRK.B’s options' })).toBeInTheDocument();
        expect(within(screen.getByRole('tablist')).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['1 day', '5 days']);
        expect(rowsShown().map((row) => row[1])).toEqual(['BRK.B', 'BRK.B', 'BRK.B', 'BRK.B']);
        expect(screen.getByRole('table', { name: 'BRK.B’s options, held 1 day' })).toBeInTheDocument();
    });

    it('keeps the tab picked where the stock has picks for its hold', async () => {
        answer(picksOf(), { MSFT: picksOf([1, 5], 2, 'MSFT') });
        await open();

        await userEvent.click(screen.getByRole('tab', { name: '5 days' }));
        await lookUp('MSFT');

        expect(screen.getByRole('tab', { name: '5 days' })).toHaveAttribute('aria-selected', 'true');
    });

    it('says the stock is loading while its options are on their way', async () => {
        const stock = deferred();

        loadOptionPicks.mockImplementation((name, ticker) => (ticker ? stock.promise : Promise.resolve(picksOf())));
        await open();

        await lookUp('AAPL');

        expect(screen.getByRole('status')).toHaveTextContent('Loading AAPL’s options…');

        await act(async () => stock.resolve(picksOf([1], 1, 'AAPL')));

        expect(rowsShown()).toHaveLength(1);
    });

    it('says so where the stock has no picks', async () => {
        answer();
        await open();

        await lookUp('ZZZZ');

        expect(screen.getByText('No picks for ZZZZ.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.getByRole('heading', { name: 'ZZZZ’s options' })).toBeInTheDocument();
    });

    it('is cleared by its button, which puts tonight\'s top 10 back, and empties the box', async () => {
        answer(picksOf(), { AAPL: picksOf([1], 2, 'AAPL') });
        await open();

        await lookUp('AAPL');
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(screen.getByRole('heading', { name: 'Tonight’s top 10' })).toBeInTheDocument();
        expect(rowsShown()).toHaveLength(10);
        expect(screen.getByRole('textbox', { name: 'Look up a stock' })).toHaveValue('');
        expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    });

    it('is cleared too by looking up nothing', async () => {
        answer(picksOf(), { AAPL: picksOf([1], 2, 'AAPL') });
        await open();

        await lookUp('AAPL');
        await userEvent.clear(screen.getByRole('textbox', { name: 'Look up a stock' }));
        await act(async () => {
            fireEvent.submit(screen.getByRole('search'));
        });

        expect(screen.getByRole('heading', { name: 'Tonight’s top 10' })).toBeInTheDocument();
    });

    it('lets go of one that lands after another stock was asked for', async () => {
        const slow = deferred();

        loadOptionPicks.mockImplementation((name, ticker) => {
            if (ticker === 'AAPL') {
                return slow.promise;
            }

            return Promise.resolve(ticker ? picksOf([1], 2, ticker) : picksOf());
        });
        await open();

        await lookUp('AAPL');
        await lookUp('MSFT');
        await act(async () => slow.resolve(picksOf([1], 5, 'AAPL')));

        expect(screen.getByRole('heading', { name: 'MSFT’s options' })).toBeInTheDocument();
        expect(rowsShown().map((row) => row[1])).toEqual(['MSFT', 'MSFT']);
    });
});

describe('on a phone, a card each', () => {
    it('names each cell by its column\'s heading, for a card to show beside it', async () => {
        answer();
        await open();

        const [first] = document.querySelectorAll('.model-picks-table tbody tr');

        expect([...first.children].map((cell) => [cell.className, cell.getAttribute('data-label')])).toEqual([
            ['model-pick-rank', 'Rank'],
            ['model-pick-stock', 'Stock'],
            ['model-pick-option', 'Option'],
            ['model-pick-buy', 'Buy at 9:40 AM'],
            ['model-pick-sell', 'Sell at 3:40 PM'],
            ['model-pick-quote', 'Last bid / ask'],
            ['model-pick-chance', 'Chance'],
            ['model-pick-gain', 'Gain: low, middle, high'],
        ]);
    });
});

describe('the words', () => {
    it('take a stock\'s symbol as the api does, in capitals, and a share class after a dot', () => {
        expect(tickerOf(' brk/b ')).toBe('BRK.B');
        expect(tickerOf('aapl')).toBe('AAPL');
        expect(tickerOf(null)).toBe('');
    });

    it('say an option as a call or a put, its strike and the day it expires', () => {
        expect(optionWords({ call_put: 'call', strike: 230, expiry: '2026-11-20' })).toBe('Call $230, Nov 20');
        expect(optionWords({ call_put: 'put', strike: 232.5, expiry: '2026-11-20' })).toBe('Put $232.50, Nov 20');
        expect(optionWords({ call_put: '', strike: null, expiry: null })).toBe('');
        expect(optionWords({ call_put: 'straddle', strike: 10, expiry: null })).toBe('straddle $10');
    });

    it('find the holds picks have, in the holds\' order', () => {
        expect(holdsWith(picksOf([20, 1], 1)).map((hold) => hold.days)).toEqual([1, 20]);
        expect(holdsWith(null)).toEqual([]);
    });

    it('print a figure the picks have none of as a dash, and a gain that rounds to nothing unsigned', () => {
        const [pick] = picksOf([1], 1);

        render(<PicksTable label='Picks' rows={[{ ...pick, last_bid: null, chance: null, gain_low: null, gain_middle: 0.0001, buy_on: null, sell_on: null }]} />);

        expect(rowsShown()[0].slice(3)).toEqual(['–', '–', '– / $4.35', '– usual 48.0%', '– · 0.0% · +80.0%']);
    });

    it('name an option\'s contract under the pointer, and nothing where the picks give none', () => {
        const [pick] = picksOf([1], 1);

        render(<PicksTable label='Picks' rows={[pick, { ...pick, rank: 2, contract: '' }]} />);

        const options = [...document.querySelectorAll('td.model-pick-option > .model-pick-cell > span')];

        expect(options[0]).toHaveAttribute('title', 'AAPL  261120C00200000');
        expect(options[1]).not.toHaveAttribute('title');
    });
});
