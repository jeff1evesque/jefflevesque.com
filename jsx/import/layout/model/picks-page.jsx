/**
 * picks-page.jsx: /model/:model/picks, an options model's picks, for signed-in
 * readers (#290).
 *
 * Each night an options model ranks every S&P 500 option for each hold, by how far
 * its chance of making money is above the usual chance for options like it, and the
 * model api serves each hold's top 10, and each stock's options best first, to a
 * signed-in reader alone -- see source.js's loadOptionPicks. Under the model's name,
 * which leads back to its page, and a heading:
 *
 *     the hold picker     the holds that have picks, which everything under it
 *                         follows. The store's, so the model's page opens its track
 *                         record on the hold picked here -- see
 *                         redux/container/model.jsx
 *     When                the day of the data the picks were made from, the day
 *                         they are bought at 9:40 AM and the hold's sell day at
 *                         3:40 PM, which every pick of a hold shares
 *     its record          how the hold's top 10 has done over its last scored
 *                         days, as many as the listing's `average_days` (#293),
 *                         beside a random pick, from the track record
 *     the picks           the hold's top 10, or a stock looked up, as a table, and
 *                         on a phone a card each -- see '_model.scss'
 *     how to read them    a section that folds by its title, kept per browser
 *
 * Where there are no picks to show, it says why: signed out, the way to sign in,
 * and nothing is asked for; a model taken down, why, and its record; a retired
 * model, that it is; none yet; and picks that could not be read. While they are on
 * their way, gray bars stand where they will be. Picks whose buy day has passed in
 * New York carry a line saying so.
 *
 * Note: who the model is comes from the model api's listing, as on its own page. A
 *       name the listing does not hold says so, as does a model that picks no
 *       options.
 *
 * Note: the picks are shown to a signed-in reader alone, and the model's own page
 *       shows none (#290). Its record is the track record's, which is public, but
 *       it is drawn here only beside the picks it grades.
 */

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import { signedIn } from '../../general/account-api.js';
import { FoldTitle, HoldPicker, StatusPill, useFolds } from './parts.jsx';
import { PendingPicks, PendingRecord } from './pending.jsx';
import { PendingBar } from '../graph/pending.jsx';
import { NO_PICKS, PICKS_FAILED, PICKS_SIGNED_OUT, loadListing, loadOptionPicks, loadReport } from './source.js';
import {
    DEFAULT_HOLD,
    HOLDS,
    WINDOW,
    averageDays,
    checkWords,
    columnOf,
    holdsOf,
    newYorkToday,
    scoreIn,
    shortDay,
    statusOf,
    tradesOptions,
    weekDay,
} from './scores.js';

//
// the page's heading, whatever model's picks it shows
//
export const TITLE = 'Option Picks';

//
// the line under the table, how the picks are ranked over it, and the line under
// the heading, for `name`
//
const FOOT = 'The model’s guesses, not trading advice.';

const RANKED = 'Ranked by how far each option’s chance of making money is above the usual chance for options like it.';

function lede(name) {
    return `The 10 S&P 500 options ${name} rates best for each hold, and how its picks have done so far.`;
}

//
// the surface the page keeps its folded section under -- see parts.jsx's useFolds
//
const FOLDS = 'model-picks';

//
// what "How to read these picks" says, a name and its words each
//
export const READ = [
    {
        key: 'chance',
        name: 'Chance',
        text: 'The model’s chance the option makes money: bought at the ask at 9:40 AM on the buy day, and sold at the bid at 3:40 PM on the sell day.',
    },
    {
        key: 'usual',
        name: 'Usual',
        text: 'How often options like it made money on the days the model learned from: the same hold, call or put, a similar delta and a similar time to expiry. The gap between the two ranks the picks.',
    },
    {
        key: 'gain',
        name: 'Gain guess',
        text: 'What the model guesses the option makes, as a share of what it cost. Middle is its central guess. It expects 1 in 10 to do worse than low, and 1 in 10 to do better than high.',
    },
    {
        key: 'record',
        name: 'How it has done',
        text: 'For each day scored so far, the average gain of that day’s top 10 for this hold, beside what a random pick from all of that day’s options made.',
    },
    {
        key: 'advice',
        name: 'Not advice',
        text: 'These are a model’s guesses, published to show how well it predicts. Nothing here is a recommendation to buy or sell anything.',
    },
];

//
// how tall the record's bars may stand above its zero, or hang below it, in px:
// the tallest of a hold's days, its own or a random pick's, reaches it
//
const HALF = 28;

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
// a chance as a percent, to a tenth: '62.4%'
//
function percent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '–';
}

//
// a share signed, as a percent to a tenth, '+12.0%' and '−35.0%', or `unit`-less
// as points, '+18.1': unsigned where it prints as nothing
//
function signed(value, unit = '%') {
    const printed = (Math.abs(value) * 100).toFixed(1);

    if (Number(printed) === 0) {
        return `${printed}${unit}`;
    }

    return `${value > 0 ? '+' : '−'}${printed}${unit}`;
}

/**
 * a gain, or a top 10's average gain, as the page prints it: a percent to a
 * tenth, signed, or a dash where there is none.
 */
export function gainWords(value) {
    return Number.isFinite(value) ? signed(value) : '–';
}

/**
 * how far the model's chance an option makes money is above the usual chance for
 * options like it, which ranks the picks: a share, below zero where it is under
 * it, or null where either is missing.
 */
export function gapOf(pick) {
    return Number.isFinite(pick.chance) && Number.isFinite(pick.usual_chance) ? pick.chance - pick.usual_chance : null;
}

/**
 * the option a pick is, as its row says it: 'Call $230'. Its expiry goes beside
 * it.
 *
 * Note: the csv names a call 'C' and a put 'P', which the worker lowercases, so
 *       'c' and 'p' are read as 'call' and 'put' are
 */
export function optionWords(pick) {
    const kind = { call: 'Call', c: 'Call', put: 'Put', p: 'Put' }[pick.call_put] || pick.call_put;

    return [kind, dollars(pick.strike, false)].filter((part) => part && part !== '–').join(' ');
}

/**
 * the holds `rows` have picks for, in the order of HOLDS.
 */
export function holdsWith(rows) {
    return HOLDS.filter((hold) => (Array.isArray(rows) ? rows : []).some((row) => row.hold === hold.days));
}

//
// a hold's name, '5 days'
//
function holdLabel(days) {
    return (HOLDS.find((hold) => hold.days === days) || { label: `${days} days` }).label;
}

//
// the average of `values` that are numbers, or null where none is
//
function meanOf(values) {
    const numbers = values.filter((value) => value !== null);

    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}

/**
 * how a hold's top 10 has done (#290), from a track record: the hold's last
 * `count` scored days, the listing's `average_days` (#293) -- each a day that has
 * its top 10's gain -- each day's gain, how many of the 10 made money, and a
 * random pick's gain, and over those days the top 10's average gain and wins,
 * each beside a random pick's: the baseline's, the average of everything the
 * model could have picked. `scored` is how many days the hold has scored in all,
 * and `count` how many the record takes in at most. Null for a hold with none
 * scored yet.
 */
export function recordOf(track, hold, count = WINDOW) {
    const gain = columnOf('top10_gain', hold);
    const wins = columnOf('top10_wins', hold);
    const scored = (Array.isArray(track) ? track : []).filter((row) => scoreIn(row.score, gain) !== null);

    if (!scored.length) {
        return null;
    }

    const days = scored.slice(-count);

    return {
        scored: scored.length,
        count: count,
        days: days.map((row) => ({
            day: row.day,
            gain: scoreIn(row.score, gain),
            wins: scoreIn(row.score, wins),
            random: scoreIn(row.baseline, gain),
        })),
        gain: meanOf(days.map((row) => scoreIn(row.score, gain))),
        wins: meanOf(days.map((row) => scoreIn(row.score, wins))),
        random_gain: meanOf(days.map((row) => scoreIn(row.baseline, gain))),
        random_wins: meanOf(days.map((row) => scoreIn(row.baseline, wins))),
    };
}

//
// how many of the 10 made money, to a tenth: '5.3'
//
function winsWords(value) {
    return Number.isFinite(value) ? value.toFixed(1) : '–';
}

/**
 * whether picks bought on `buyOn` were to be bought before today in New York, so
 * newer ones are due and have not come.
 */
export function pastBuyDay(buyOn, now = new Date()) {
    return Boolean(buyOn) && buyOn < newYorkToday(now);
}

/**
 * one hold's picks, best first, as a table, and on a phone a card each:
 *
 *     #                        the rank
 *     Stock
 *     Option                   call or put and its strike, then its expiry, with
 *                              the contract's name under the pointer
 *     Bid / ask                its last quote
 *     Chance it makes money    the model's chance, the usual chance, and the gap
 *                              in points, over a bar: gray up to the lower of the
 *                              two, then the gap, green where the model's is above
 *                              the usual and red where it is under
 *     Gain guess               low, middle and high, over a line from low to high
 *                              on the rows' own scale, red below zero and green
 *                              above, with a dot at the middle
 *
 * A phone's card names the chance and the gain by their headings -- see
 * '_model.scss'.
 */
export function PicksTable({ label, rows }) {
    const lows = rows.map((pick) => pick.gain_low).filter(Number.isFinite);
    const highs = rows.map((pick) => pick.gain_high).filter(Number.isFinite);
    const low = Math.min(0, ...lows);
    const span = Math.max(0, ...highs) - low || 1;
    const at = (value) => ((value - low) / span) * 100;

    return (
        <div className='model-picks-scroll'>
            <table className='model-picks-table' aria-label={label}>
                <thead>
                    <tr>
                        <th scope='col' className='model-pick-rank'>#</th>
                        <th scope='col' className='model-pick-stock'>Stock</th>
                        <th scope='col' className='model-pick-option'>
                            Option <span className='model-pick-sub'>strike, expiry</span>
                        </th>
                        <th scope='col' className='model-pick-quote'>
                            Bid / ask <span className='model-pick-sub'>last quote</span>
                        </th>
                        <th scope='col' className='model-pick-chance'>
                            Chance it makes money <span className='model-pick-sub'>the model’s, the usual, the gap</span>
                        </th>
                        <th scope='col' className='model-pick-gain'>
                            Gain guess <span className='model-pick-sub'>low · middle · high</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((pick) => (
                        <PickRow key={`${pick.hold}-${pick.rank}`} pick={pick} at={at} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

PicksTable.propTypes = {
    label: PropTypes.string.isRequired,
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function PickRow({ pick, at }) {
    const gap = gapOf(pick);
    const side = gap !== null && gap < 0 ? 'below' : 'above';
    const low = pick.gain_low;
    const high = pick.gain_high;
    const ranged = Number.isFinite(low) && Number.isFinite(high) && low <= high;

    return (
        <tr>
            <td className='model-pick-rank'>{pick.rank}</td>
            <td className='model-pick-stock'>{pick.ticker}</td>
            <td className='model-pick-option'>
                <span title={pick.contract || undefined}>{optionWords(pick)}</span>
                {pick.expiry ? <span className='model-pick-expiry'>{` · ${shortDay(pick.expiry)}`}</span> : null}
            </td>
            <td className='model-pick-quote'>{`${dollars(pick.last_bid)} / ${dollars(pick.last_ask)}`}</td>
            <td className='model-pick-chance' data-label='Chance it makes money'>
                <span className='model-pick-figures'>
                    <span className='model-pick-value'>{percent(pick.chance)}</span>
                    {' '}
                    <span className='model-pick-usual'>{`usual ${percent(pick.usual_chance)}`}</span>
                    {gap === null ? null : ' '}
                    {gap === null ? null : <span className={`model-pick-gap model-pick-${side}`}>{signed(gap, '')}</span>}
                </span>
                {gap === null
                    ? null
                    : (
                        <span className='model-pick-bar' aria-hidden='true'>
                            <span
                                className='model-pick-bar-usual'
                                style={{ width: `${Math.min(pick.chance, pick.usual_chance) * 100}%` }}
                            />
                            <span
                                className={`model-pick-bar-gap model-pick-${side}`}
                                style={{
                                    left: `${Math.min(pick.chance, pick.usual_chance) * 100}%`,
                                    width: `${Math.abs(gap) * 100}%`,
                                }}
                            />
                        </span>
                    )}
            </td>
            <td className='model-pick-gain' data-label='Gain guess'>
                <span className='model-pick-gains'>
                    {gainWords(low)}
                    {' · '}
                    <span className='model-pick-middle'>{gainWords(pick.gain_middle)}</span>
                    {' · '}
                    {gainWords(high)}
                </span>
                {ranged
                    ? (
                        <span className='model-pick-range' aria-hidden='true'>
                            <span className='model-pick-zero' style={{ left: `${at(0)}%` }} />
                            {low < 0
                                ? (
                                    <span
                                        className='model-pick-span model-pick-below'
                                        style={{ left: `${at(low)}%`, width: `${at(Math.min(high, 0)) - at(low)}%` }}
                                    />
                                ) : null}
                            {high > 0
                                ? (
                                    <span
                                        className='model-pick-span model-pick-above'
                                        style={{ left: `${at(Math.max(low, 0))}%`, width: `${at(high) - at(Math.max(low, 0))}%` }}
                                    />
                                ) : null}
                            {Number.isFinite(pick.gain_middle)
                                ? <span className='model-pick-mid' style={{ left: `${at(pick.gain_middle)}%` }} />
                                : null}
                        </span>
                    ) : null}
            </td>
        </tr>
    );
}

PickRow.propTypes = {
    pick: PropTypes.object.isRequired,
    at: PropTypes.func.isRequired,
};

/**
 * the When card (#290): the day of the data `rows` were made from, the day they
 * are bought at 9:40 AM, at the ask, and the day they are sold at 3:40 PM, at the
 * bid. Every pick of a hold shares them, so the first row says them for all.
 */
export function WhenCard({ rows }) {
    const [first] = rows;
    const lines = [
        { key: 'from', name: 'From', day: first.day, time: 'that day’s data' },
        { key: 'buy', name: 'Buy', day: first.buy_on, time: 'at 9:40 AM, at the ask' },
        { key: 'sell', name: 'Sell', day: first.sell_on, time: 'at 3:40 PM, at the bid' },
    ];

    return (
        <div className='model-stat model-picks-when'>
            <div className='model-stat-head'>
                <span className='model-stat-label'>When</span>
                <div className='model-picks-when-rows'>
                    {lines.map((line) => (
                        <div key={line.key} className='model-picks-when-row'>
                            <span className='model-picks-when-name'>{line.name}</span>
                            <span className='model-picks-when-day'>{weekDay(line.day) || '–'}</span>
                            <span className='model-picks-when-time'>{line.time}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

WhenCard.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/**
 * a hold's record as bars (#290): a bar for each scored day, up from zero in
 * green for a gain and down in red for a loss, with a random pick's as a dashed
 * line across it, all on one scale, the hold's tallest reaching HALF. Under them
 * the first and last day, and what each mark is.
 */
function RecordBars({ record }) {
    const extent = Math.max(0.0001, ...record.days
        .flatMap((day) => [day.gain, day.random])
        .filter(Number.isFinite)
        .map(Math.abs));
    const above = (value) => (value / extent) * HALF;
    const first = record.days[0].day;
    const last = record.days[record.days.length - 1].day;
    const count = record.scored > record.count
        ? `the last ${record.count} of ${record.scored} scored days`
        : `${record.scored} ${record.scored === 1 ? 'day' : 'days'} scored so far`;

    return (
        <div className='model-picks-record-bars'>
            <div className='model-picks-strip-frame' style={{ '--days': record.days.length }}>
                <div
                    className='model-picks-strip'
                    role='img'
                    aria-label={`Each scored day’s top 10 gain, ${shortDay(first)} to ${shortDay(last)}, beside a random pick’s`}
                >
                    <span className='model-picks-strip-zero' />
                    {record.days.map((day) => {
                        const height = Math.abs(above(day.gain));

                        return (
                            <span
                                key={day.day}
                                className='model-picks-strip-day'
                                title={[
                                    `${shortDay(day.day)}: its top 10 ${gainWords(day.gain)}`,
                                    `a random pick ${gainWords(day.random)}`,
                                    Number.isFinite(day.wins) ? `${day.wins} of 10 made money` : '',
                                ].filter(Boolean).join(', ')}
                            >
                                <span
                                    className={`model-picks-strip-bar model-picks-strip-${day.gain < 0 ? 'down' : 'up'}`}
                                    style={{ top: `${day.gain < 0 ? HALF : HALF - height}px`, height: `${height}px` }}
                                />
                                {Number.isFinite(day.random)
                                    ? <span className='model-picks-strip-random' style={{ top: `${HALF - above(day.random)}px` }} />
                                    : null}
                            </span>
                        );
                    })}
                </div>
                <div className='model-picks-strip-axis' aria-hidden='true'>
                    <span>{shortDay(first)}</span>
                    {record.days.length > 1 ? <span>{shortDay(last)}</span> : null}
                </div>
            </div>
            <div className='model-picks-strip-key'>
                <span className='model-picks-key'>
                    <span className='model-picks-key-bar' aria-hidden='true' />
                    its top 10’s gain each day
                </span>
                <span className='model-picks-key'>
                    <span className='model-picks-key-random' aria-hidden='true' />
                    a random pick’s
                </span>
                <span>{count}</span>
            </div>
        </div>
    );
}

RecordBars.propTypes = {
    record: PropTypes.shape({
        scored: PropTypes.number.isRequired,
        count: PropTypes.number.isRequired,
        days: PropTypes.arrayOf(PropTypes.object).isRequired,
    }).isRequired,
};

/**
 * the card of how a hold's top 10 has done (#290), from the model's track record:
 * undefined while it is on its way, null where it could not be had. Over the
 * hold's last `days` scored days, the listing's `average_days` (#293), the top
 * 10's average gain and how many of the 10 made money, each beside a random
 * pick's, then a bar for each day. A hold with no day scored yet says when its
 * first is.
 */
export function RecordCard({ track, hold, wide = false, days = WINDOW }) {
    const label = holdLabel(hold);
    const record = Array.isArray(track) ? recordOf(track, hold, days) : null;
    let head = null;
    let body = null;

    if (track === undefined) {
        head = <PendingRecord />;
    } else if (track === null) {
        head = <span className='model-stat-detail'>Its record could not be loaded.</span>;
    } else if (!record) {
        head = (
            <>
                <span className='model-stat-value'>None yet</span>
                <span className='model-stat-detail'>
                    {`A pick held ${label} is scored once it’s sold, ${hold + 1} trading days after the day it was made.`}
                </span>
            </>
        );
    } else {
        head = (
            <div className='model-picks-figures'>
                <div className='model-picks-figure'>
                    <span className='model-stat-value'>{gainWords(record.gain)}</span>
                    <span className='model-stat-detail'>{`average gain · a random pick ${gainWords(record.random_gain)}`}</span>
                </div>
                <div className='model-picks-figure'>
                    <span className='model-stat-value'>{`${winsWords(record.wins)} of 10`}</span>
                    <span className='model-stat-detail'>{`made money · a random pick ${winsWords(record.random_wins)}`}</span>
                </div>
            </div>
        );
        body = <RecordBars record={record} />;
    }

    return (
        <div className={`model-stat model-picks-record${wide ? ' model-picks-record-wide' : ''}`}>
            <div className='model-stat-head'>
                <span className='model-stat-label'>{`How its top 10 has done, held ${label}`}</span>
                {head}
            </div>
            {body ? <div className='model-stat-body'>{body}</div> : null}
        </div>
    );
}

RecordCard.propTypes = {
    track: PropTypes.array,
    hold: PropTypes.number.isRequired,
    wide: PropTypes.bool,
    //
    // how many of the hold's latest scored days the record takes in: the
    // listing's `average_days` (#293)
    //
    days: PropTypes.number,
};

/**
 * "How to read these picks" (#290): what each figure on the page means, under a
 * title that folds it away, as the model page's sections fold.
 */
function ReadSection({ folded, onFold }) {
    return (
        <section className='model-card model-picks-read' aria-labelledby='model-picks-read'>
            <FoldTitle as='h5' id='model-picks-read' title='How to read these picks' folded={folded} onFold={onFold} />
            {folded
                ? null
                : (
                    <dl className='model-picks-read-list'>
                        {READ.map((entry) => (
                            <div key={entry.key} className='model-picks-read-item'>
                                <dt>{entry.name}</dt>
                                <dd>{entry.text}</dd>
                            </div>
                        ))}
                    </dl>
                )}
        </section>
    );
}

ReadSection.propTypes = {
    folded: PropTypes.bool.isRequired,
    onFold: PropTypes.func.isRequired,
};

//
// what the page says in a card where there are no picks to show, under a title
//
function Message({ id, title, children }) {
    return (
        <section className='model-card model-picks-message' aria-labelledby={id}>
            <h5 id={id}>{title}</h5>
            <p>{children}</p>
        </section>
    );
}

Message.propTypes = {
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
};

function PicksPage({ name, hold = DEFAULT_HOLD, onHold = () => {} }) {
    //
    // the listing, as the model pages hold it: undefined while on its way, null
    // where it could not be had, and { tasks, models } once it is in
    //
    const [listing, setListing] = useState(undefined);

    //
    // whether a reader is signed in: null until the session has been looked at,
    // and false too once the api has refused their session
    //
    const [reader, setReader] = useState(null);

    //
    // the night's picks, every hold's: undefined while on their way, their rows,
    // or what source.js says in their place -- see loadOptionPicks
    //
    const [picks, setPicks] = useState(undefined);

    //
    // the model's track record, for its record: undefined while on its way, null
    // where it could not be had
    //
    const [track, setTrack] = useState(undefined);

    //
    // a stock looked up, { ticker, rows } with its rows as the night's are, or
    // none; and the box's words
    //
    const [lookup, setLookup] = useState(null);
    const [text, setText] = useState('');

    const [folds, toggleFold] = useFolds(FOLDS);

    //
    // whether the page is still up, and the stock last asked for, so an answer
    // that lands after the page has gone, or after another stock was asked for, is
    // let go
    //
    const alive = useRef(true);
    const asked = useRef(null);

    useEffect(() => {
        alive.current = true;

        loadListing().then((answer) => {
            if (alive.current) {
                setListing(answer);
            }
        });

        signedIn().then((answer) => {
            if (alive.current) {
                setReader(answer);
            }
        });

        return () => {
            alive.current = false;
        };
    }, []);

    const model = listing ? listing.models.find((each) => each.name === name) || null : null;
    const task = model ? listing.tasks.find((each) => each.id === model.task) || { id: model.task } : null;
    const status = model ? statusOf(model) : null;
    const options = Boolean(task) && tradesOptions(task);

    //
    // once the listing names an options model still trained, and a reader is
    // signed in: its track record, and its picks unless its live version was
    // taken down -- a reader signed out is asked for neither
    //
    const ready = options && reader === true && status !== 'retired';

    useEffect(() => {
        if (!ready) {
            return;
        }

        loadReport(name, 'track-record', averageDays(model)).then((rows) => {
            if (alive.current) {
                setTrack(rows);
            }
        });

        if (status === 'down') {
            return;
        }

        loadOptionPicks(name).then((answer) => {
            if (!alive.current) {
                return;
            }

            if (answer === PICKS_SIGNED_OUT) {
                setReader(false);
            }

            setPicks(answer);
        });
    }, [ready]);

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

        loadOptionPicks(name, ticker).then((answer) => {
            if (!alive.current || asked.current !== ticker) {
                return;
            }

            if (answer === PICKS_SIGNED_OUT) {
                setReader(false);
                return;
            }

            setLookup({ ticker: ticker, rows: answer });
        });
    };

    //
    // back to the model's own page, or to every model where there is no model by
    // this name. While the listing is on its way, the name is taken to be a
    // model's, as a link only leads to one
    //
    const back = model || listing === undefined
        ? { to: `/model/${encodeURIComponent(name)}`, label: name }
        : { to: '/model', label: 'All models' };

    const header = (
        <div className='model-intro'>
            <div className='model-heading'>
                <h4>{TITLE}</h4>
                {model ? <StatusPill model={model} /> : <PendingBar width='5.5rem' />}
            </div>
            <span className='model-lede'>{lede(name)}</span>
        </div>
    );

    const page = (body) => (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <div className='container model-layout model-picks-page'>
                <Link className='model-back' to={back.to}>&lsaquo; {back.label}</Link>
                {body}
            </div>
        </ErrorBoundary>
    );

    const pending = (
        <>
            <p className='visually-hidden' role='status'>Loading the picks&hellip;</p>
            <PendingPicks />
        </>
    );

    if (listing === undefined || reader === null) {
        return page(<>{header}{pending}</>);
    }

    if (listing === null) {
        return page(<p className='model-status model-status-empty'>No models to show yet.</p>);
    }

    if (!model) {
        return page(
            <div className='model-missing' role='status'>
                <h4>Model not found</h4>
                <p className='model-status'>{`There is no model named “${name}”.`}</p>
            </div>
        );
    }

    if (!options) {
        return page(
            <div className='model-missing' role='status'>
                <h4>No picks</h4>
                <p className='model-status'>{`${model.name} doesn’t pick options. Only an options model has picks.`}</p>
            </div>
        );
    }

    if (!reader) {
        return page(
            <>
                {header}
                <Message id='model-picks-out' title='Sign in to see the picks'>
                    An options model’s picks are for signed-in readers.
                    {' '}
                    <Link to='/login'>Sign in</Link>
                    {' or '}
                    <Link to='/register'>Sign up</Link>
                    .
                </Message>
            </>
        );
    }

    if (status === 'retired') {
        return page(
            <>
                {header}
                <Message id='model-picks-retired' title='No picks'>
                    {`${model.name} retired ${shortDay(model.retired)}. It is no longer trained, so it makes no picks.`}
                </Message>
            </>
        );
    }

    //
    // the holds the hold picker offers: those the night's picks have, or for a
    // model taken down, which has none, those its track record has. The one
    // shown is the hold picked, where it is offered, and the first otherwise
    //
    const top = Array.isArray(picks) ? picks : null;
    const offered = status === 'down' ? holdsOf(track) : holdsWith(top);
    const chosen = offered.some((each) => each.days === hold) ? hold : (offered.length ? offered[0].days : DEFAULT_HOLD);
    const label = holdLabel(chosen);
    const picker = offered.length
        ? <div className='model-controls'><HoldPicker hold={chosen} onHold={onHold} holds={offered} /></div>
        : null;

    if (status === 'down') {
        return page(
            <>
                {header}
                {picker}
                <Message id='model-picks-down' title={`No picks while ${model.name} is down`}>
                    {`${model.name} was taken down on ${shortDay(model.down.since)}: ${checkWords(model.down)}. It makes no picks until a new version beats the baseline on the days it was tested on.`}
                </Message>
                <RecordCard track={track} hold={chosen} days={averageDays(model)} wide />
            </>
        );
    }

    if (picks === undefined) {
        return page(<>{header}{pending}</>);
    }

    if (picks === NO_PICKS) {
        return page(
            <>
                {header}
                <Message id='model-picks-none' title='No picks yet'>
                    {`${model.name} hasn’t published any picks yet. Its first come the night after its first version goes live.`}
                </Message>
            </>
        );
    }

    if (picks === PICKS_FAILED) {
        return page(
            <>
                {header}
                <p className='model-status model-status-empty'>The picks could not be read. Try again in a few minutes.</p>
            </>
        );
    }

    const night = top.filter((row) => row.hold === chosen);
    const [made] = top;
    const shown = lookup ? lookup.rows : top;
    const title = lookup ? `${lookup.ticker}’s options, held ${label}` : `Top 10, held ${label}`;

    //
    // what the card holds in place of a table: a stock on its way, one with no
    // picks, or none for the hold picked, and one that could not be read
    //
    let table = null;

    if (lookup && shown === undefined) {
        table = <p className='model-status' role='status'>{`Loading ${lookup.ticker}’s options…`}</p>;
    } else if (lookup && shown === NO_PICKS) {
        table = <p className='model-status model-status-empty'>{`No picks for ${lookup.ticker}.`}</p>;
    } else if (lookup && shown === PICKS_FAILED) {
        table = <p className='model-status model-status-empty'>{`${lookup.ticker}’s options could not be read. Try again in a few minutes.`}</p>;
    } else {
        const rows = shown.filter((row) => row.hold === chosen);

        table = rows.length
            ? <PicksTable label={title} rows={rows} />
            : <p className='model-status model-status-empty'>{`No picks for ${lookup.ticker} held ${label}.`}</p>;
    }

    return page(
        <>
            {header}
            {picker}
            {pastBuyDay(made.buy_on)
                ? (
                    <p className='model-status model-picks-older' role='status'>
                        {`These picks were made from the data of ${weekDay(made.day)}, to buy on ${weekDay(made.buy_on)}. That day has passed, and ${model.name} hasn’t published newer ones yet.`}
                    </p>
                ) : null}
            <div className='model-picks-summary'>
                <WhenCard rows={night} />
                <RecordCard track={track} hold={chosen} days={averageDays(model)} />
            </div>
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
                    <p className='model-card-sub'>{RANKED}</p>
                </div>
                {table}
                <p className='model-picks-foot'>{FOOT}</p>
            </section>
            <ReadSection folded={Boolean(folds.read)} onFold={() => toggleFold('read')} />
        </>
    );
}

PicksPage.propTypes = {
    //
    // the model's name, as the address holds it
    //
    name: PropTypes.string.isRequired,
    //
    // the hold the page shows, and the way to choose another -- the store's, as
    // the model's page shares it, see redux/container/model.jsx
    //
    hold: PropTypes.number,
    onHold: PropTypes.func,
};

//
// the name is read from the address here, as model-page.jsx reads it. Keyed by the
// name, so moving from one model's picks to another's starts the page over
//
export default function PicksPageRoute(props) {
    const { model } = useParams();

    return <PicksPage key={model} {...props} name={model} />;
}

export { PicksPage };
