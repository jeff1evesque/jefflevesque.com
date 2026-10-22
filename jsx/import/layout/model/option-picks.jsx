/**
 * option-picks.jsx: an options model's picks, on its own page (#279).
 *
 * Each night an options model ranks every S&P 500 option for each hold, and the
 * api serves the top 10 of each hold, and each stock's options best first, up to
 * 100 for each hold -- see source.js's loadOptionPicks. The card shows tonight's
 * top 10, a table for each hold behind a tab of its own for each hold that has
 * picks, and a box that looks a stock up: its options take the table's place,
 * until Clear puts the top 10 back. BRK/B is looked up as BRK.B, as the api
 * names a share class.
 *
 * Each row is a pick: its rank, the stock, the option -- call or put, its strike
 * and the day it expires -- the day it would be bought at 9:40 AM and the day
 * it would be sold at 3:40 PM, its last bid and ask, the model's chance it makes
 * money beside the usual chance for options like it, and the gain it guesses,
 * low, middle and high. The line under the title says which day they were made
 * from, and the one under the table how they are ranked, and that they are not
 * advice. On a phone each row is a card, as /model's rows are -- see
 * '_model.scss'.
 *
 * Note: named for the options' picks. `picks` is the compare chart's word for
 *       the models ticked, and /model picks a model to tick.
 */

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { loadOptionPicks } from './source.js';
import { PendingPicks } from './pending.jsx';
import { HOLDS, longDay, shortDay } from './scores.js';

//
// the card's title while it shows the top 10, and its placeholder's while they
// are on their way -- see pending.jsx
//
export const TITLE = 'Tonight’s top 10';

//
// what the line under the table says of every pick, whichever are shown
//
const FOOT = 'The model’s guesses, ranked by how far each option’s chance is above the usual chance for options like it. Not trading advice.';

/**
 * a stock's symbol as the api takes it, from what a reader typed: in capitals,
 * and a share class after a dot, BRK.B, where it is often written BRK/B.
 */
export function tickerOf(text) {
    return String(text || '').trim().toUpperCase().replace('/', '.');
}

//
// a price in dollars, to the cent; a strike in whole dollars where it is whole
//
function dollars(value, cents = true) {
    if (!Number.isFinite(value)) {
        return '–';
    }

    return `$${cents || !Number.isInteger(value) ? value.toFixed(2) : String(value)}`;
}

//
// a chance as a percent, and a gain as one signed, to a tenth: '62.4%', '+12.0%'
// and '−35.0%'
//
function percent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '–';
}

function gain(value) {
    if (!Number.isFinite(value)) {
        return '–';
    }

    const printed = (Math.abs(value) * 100).toFixed(1);

    if (Number(printed) === 0) {
        return `${printed}%`;
    }

    return `${value > 0 ? '+' : '−'}${printed}%`;
}

/**
 * the option a pick is, as its row says it: 'Call $230, Nov 20'.
 */
export function optionWords(pick) {
    const kind = { call: 'Call', put: 'Put' }[pick.call_put] || pick.call_put;

    return [kind, dollars(pick.strike, false)].filter((part) => part && part !== '–').join(' ')
        + (pick.expiry ? `, ${shortDay(pick.expiry)}` : '');
}

/**
 * the holds `rows` have picks for, in the order of HOLDS.
 */
export function holdsWith(rows) {
    return HOLDS.filter((hold) => (rows || []).some((row) => row.hold === hold.days));
}

//
// the table's columns: each a key, its heading, and its cell for a pick. A
// phone's card names each cell after the first three by its heading
//
const COLUMNS = [
    { key: 'rank', label: 'Rank', cell: (pick) => pick.rank },
    { key: 'stock', label: 'Stock', cell: (pick) => pick.ticker },
    { key: 'option', label: 'Option', cell: (pick) => <span title={pick.contract || undefined}>{optionWords(pick)}</span> },
    { key: 'buy', label: 'Buy at 9:40 AM', cell: (pick) => shortDay(pick.buy_on) || '–' },
    { key: 'sell', label: 'Sell at 3:40 PM', cell: (pick) => shortDay(pick.sell_on) || '–' },
    { key: 'quote', label: 'Last bid / ask', cell: (pick) => `${dollars(pick.last_bid)} / ${dollars(pick.last_ask)}` },
    {
        key: 'chance',
        label: 'Chance',
        cell: (pick) => (
            <span className='model-pick-figures'>
                <span className='model-pick-value'>{percent(pick.chance)}</span>
                {' '}
                <span className='model-pick-usual'>{`usual ${percent(pick.usual_chance)}`}</span>
            </span>
        ),
    },
    { key: 'gain', label: 'Gain: low, middle, high', cell: (pick) => [pick.gain_low, pick.gain_middle, pick.gain_high].map(gain).join(' · ') },
];

/**
 * one hold's picks, best first, as a table, and on a phone a card for each.
 */
export function PicksTable({ label, rows }) {
    return (
        <table className='model-picks-table' aria-label={label}>
            <thead>
                <tr>
                    {COLUMNS.map((column) => (
                        <th key={column.key} scope='col' className={`model-pick-${column.key}`}>{column.label}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((pick) => (
                    <tr key={`${pick.hold}-${pick.rank}`}>
                        {COLUMNS.map((column) => (
                            <td key={column.key} className={`model-pick-${column.key}`} data-label={column.label}>
                                <span className='model-pick-cell'>{column.cell(pick)}</span>
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

PicksTable.propTypes = {
    label: PropTypes.string.isRequired,
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function OptionPicks({ name }) {
    //
    // tonight's top 10: undefined while on their way, null where they could not
    // be had, and their rows once they are in
    //
    const [top, setTop] = useState(undefined);

    //
    // a stock looked up, { ticker, rows }, its rows as the top 10's are, or none
    //
    const [lookup, setLookup] = useState(null);

    //
    // the box's words, and the hold whose tab was picked: the first with picks
    // until one is
    //
    const [text, setText] = useState('');
    const [hold, setHold] = useState(null);

    //
    // whether the card is still up, and the stock last asked for, so an answer
    // that lands after the card has gone, or after another stock was asked for,
    // is let go
    //
    const alive = useRef(true);
    const asked = useRef(null);

    useEffect(() => {
        alive.current = true;

        loadOptionPicks(name).then((rows) => {
            if (alive.current) {
                setTop(rows);
            }
        });

        return () => {
            alive.current = false;
        };
    }, [name]);

    const clear = () => {
        asked.current = null;
        setLookup(null);
        setText('');
    };

    const look = (event) => {
        event.preventDefault();

        const ticker = tickerOf(text);

        if (!ticker) {
            clear();
            return;
        }

        asked.current = ticker;
        setText(ticker);
        setLookup({ ticker: ticker, rows: undefined });

        loadOptionPicks(name, ticker).then((rows) => {
            if (alive.current && asked.current === ticker) {
                setLookup({ ticker: ticker, rows: rows });
            }
        });
    };

    if (top === undefined && !lookup) {
        return <PendingPicks title={TITLE} />;
    }

    const rows = lookup ? lookup.rows : top;
    const title = lookup ? `${lookup.ticker}’s options` : TITLE;
    const holds = holdsWith(rows);
    const shown = holds.find((each) => each.days === hold) || holds[0];

    //
    // the arrow keys move along the tabs, and Home and End to either end, as a
    // row of tabs answers them; the one moved to is picked and takes the focus
    //
    const tabKey = (event) => {
        const at = holds.indexOf(shown);
        const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: holds.length - 1 }[event.key];

        if (to === undefined) {
            return;
        }

        const next = holds[(to + holds.length) % holds.length];

        event.preventDefault();
        setHold(next.days);
        document.getElementById(`model-picks-tab-${next.days}`).focus();
    };

    //
    // what the card says in place of a table: the stock on its way, a stock or
    // a night with no picks
    //
    let empty = null;

    if (lookup && rows === undefined) {
        empty = <p className='model-status' role='status'>{`Loading ${lookup.ticker}’s options…`}</p>;
    } else if (lookup && !holds.length) {
        empty = <p className='model-status model-status-empty'>{`No picks for ${lookup.ticker}.`}</p>;
    } else if (!holds.length) {
        empty = <p className='model-status model-status-empty'>No picks to show yet.</p>;
    }

    return (
        <section className='model-card model-picks' aria-labelledby='model-picks-title'>
            <div className='model-card-head'>
                <div className='model-card-title'>
                    <div className='model-picks-name'>
                        <h5 id='model-picks-title'>{title}</h5>
                        {lookup ? <button type='button' className='model-clear' onClick={clear}>Clear</button> : null}
                    </div>
                    <form className='model-picks-lookup' role='search' aria-label='Look up a stock' onSubmit={look}>
                        <label className='model-picks-label'>
                            <span className='model-control-label'>Look up a stock</span>
                            <input
                                type='text'
                                value={text}
                                placeholder='AAPL'
                                autoCapitalize='characters'
                                autoComplete='off'
                                spellCheck={false}
                                onChange={(event) => setText(event.target.value)}
                            />
                        </label>
                        <button type='submit' className='model-score'>Look up</button>
                    </form>
                </div>
                {holds.length ? <p className='model-card-sub'>{`Made from the data of ${longDay(rows[0].day)}.`}</p> : null}
            </div>
            {empty || (
                <>
                    <div className='model-picks-tabs' role='tablist' aria-label='Hold'>
                        {holds.map((each) => (
                            <button
                                key={each.days}
                                type='button'
                                role='tab'
                                id={`model-picks-tab-${each.days}`}
                                className='model-score'
                                aria-selected={each === shown}
                                aria-controls='model-picks-panel'
                                tabIndex={each === shown ? 0 : -1}
                                onClick={() => setHold(each.days)}
                                onKeyDown={tabKey}
                            >
                                {each.label}
                            </button>
                        ))}
                    </div>
                    <div className='model-picks-panel' role='tabpanel' id='model-picks-panel' aria-labelledby={`model-picks-tab-${shown.days}`}>
                        <PicksTable
                            label={`${title}, held ${shown.label}`}
                            rows={rows.filter((row) => row.hold === shown.days)}
                        />
                    </div>
                    <p className='model-picks-foot'>{FOOT}</p>
                </>
            )}
        </section>
    );
}

OptionPicks.propTypes = {
    //
    // the model whose picks are shown, as the listing names it
    //
    name: PropTypes.string.isRequired,
};

export default OptionPicks;
