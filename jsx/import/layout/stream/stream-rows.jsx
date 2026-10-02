/**
 * stream-rows.jsx: every stream as a row of bars, with its figures beside it.
 *
 * Each row names a stream and its schedule, carries its controls, draws a bar
 * per interval of the window (see stream-bars.js), and ends with the stream's
 * Health, Coverage and Total Records over that window. The figures sort the
 * rows. A mouse pointing at a bar brings up a popup by it saying what it is
 * (#167); a finger tapping one on a phone has it said in the line under the
 * rows.
 *
 * Note: the sort is the page's to keep, so it comes in as a prop and every
 *       change goes back out through 'onSort' -- see stream.jsx, which keeps it
 *       for the reader's next visit. A heading's first click sorts largest
 *       first, the next smallest first, and the third puts the page's own order
 *       back. A phone, which has no room for the headings, gets the same
 *       choices from SortMenu, which the page puts on its line of controls.
 *
 * Note: a bar's height is on its own row's scale, so a stream bringing a few
 *       records a day reads as clearly as one bringing millions. The Total
 *       Records column is where the streams are compared.
 *
 * Note: a bar's shade says its height again (#167): one blue in five steps,
 *       darkest by day and brightest by night for the tallest fifth of its
 *       row. It used to say the interval's health, and nearly every interval
 *       is fully healthy, so nearly every bar was the same blue. Failures are
 *       still marked, by the red dot over a bar, and counted in its popup.
 *
 * Note: the bars are not tab stops. A row of up to sixty of them, five rows
 *       deep, would put three hundred stops between a keyboard and the rest of
 *       the page; each bar names itself to a screen reader instead, and the
 *       figures carry the row's summary.
 *
 * Note: a bar opens through 'onOpen', when the page offers one (#159): a click
 *       on a desktop, where pointing already described it, and on a phone a
 *       SECOND tap on the same bar, since the first is how a phone points at
 *       it. Whether this tap is a second one is read when the tap begins,
 *       before the mouse events a touch screen sends after it can describe the
 *       bar and make every tap look like a second.
 *
 * Note: each row loads on its own, and says where it is over its bars until its
 *       report is in: loading, still loading once it has taken a while, or that
 *       it could not load, with a button to ask again. A slow stream never holds
 *       up the others, and is never called failed for being slow -- see
 *       SLOW_AFTER_MS in stream.jsx.
 *
 * Note: a stream's name opens it on its own (#161) -- see stream-focus.jsx. The
 *       name is a link to the address that does, so it opens in a new tab as
 *       well, and a plain click hands the stream to 'onFocus' rather than
 *       loading the page again.
 *
 * Note: the figures sit behind a divider, the same control as /graph's
 *       columns (#161). An arrow halfway down it folds them into a green rail,
 *       which opens them again, and the line drags them wider or narrower.
 *       Dragged past the narrowest they can be, they fold. The page keeps the
 *       fold and the width -- see 'folded', 'width', 'onFold' and 'onResize'.
 *       The divider and the rail run beside the rows only, from the headings
 *       to the bottom of the last row (#167), not on past them beside the line
 *       and the key under the rows.
 *
 * Note: a phone draws the rows as a list (#161): each stream's name and
 *       schedule, and the one figure the list is sorted by, with the whole row
 *       a way into the stream's own view. The bars, the controls and the other
 *       figures are in that view, so the stylesheet hides them here.
 *
 */

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import CircularProgress from '@mui/material/CircularProgress';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { barSummary, barWhen } from '../../general/stream-bars.js';

//
// the figures, as they head their columns and as a row is sorted by them
//
export const COLUMNS = [
    { key: 'health', label: 'Health', short: 'Health', desc: 'highest first', asc: 'lowest first' },
    { key: 'coverage', label: 'Coverage', short: 'Coverage', desc: 'highest first', asc: 'lowest first' },
    { key: 'total', label: 'Total Records', short: 'Records', desc: 'most first', asc: 'fewest first' },
];

//
// the figures a sort can name, for whoever keeps one to check it against
//
export const SORT_KEYS = COLUMNS.map((column) => column.key);

//
// dragging the divider between the bars and the figures (#161).
//
// FIGURES_MIN is the narrowest the figures may be dragged to, in px against
// the site's 14px root: the three headings side by side, each on one line,
// with the room between them. FIGURES_FOLD is how far PAST that the pointer
// has to go before they fold instead of resisting, for the reason RAIL_FOLD
// gives in graph.jsx: a boundary that gives way the instant it is reached folds
// the column whenever someone overshoots by a pixel.
//
// Note: the widest they may go is half the row, which the stylesheet holds as
//       well as the drag, so a width kept from a wider window can never take
//       more than half of a narrower one.
//
export const FIGURES_MIN = 260;
export const FIGURES_FOLD = 40;

//
// the sort after a heading is clicked: largest first, then smallest first, then
// the page's own order again
//
export function nextSort(sort, key) {
    if (!sort || sort.key !== key) {
        return { key: key, dir: 'desc' };
    }

    return sort.dir === 'desc' ? { key: key, dir: 'asc' } : null;
}

//
// the phone's menu: one choice per figure and direction, and the page's order
//
const SORT_CHOICES = [
    { value: '', label: 'Default order' },
    ...COLUMNS.flatMap((column) => ['desc', 'asc'].map((dir) => ({
        value: `${column.key}:${dir}`,
        label: `${column.label}, ${column[dir]}`,
    }))),
];

//
// what a row says over its bars while its report is not in, by its status
//
const STATUS = {
    loading: 'Loading',
    slow: 'Still loading. This stream can take a while.',
    failed: 'Could not load this stream.',
};

//
// whether a click on a link is a plain one, which the page handles itself,
// rather than one asking the browser for a new tab or window
//
function plainClick(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

//
// how many shades of the blue a reported bar can be drawn in (#167), and the
// one a bar takes from its height on its row's scale: 0, the darkest by day
// and the brightest by night, for the tallest fifth of the row, down to the
// lightest for the shortest fifth. A row with nothing reported has no scale,
// and what it draws takes the lightest.
//
// Note: the steps are colored in '_stream.scss', '--stream-shade-*'.
//
// Note: worked in the records themselves rather than in the share of the peak
//       they are, which floating point rounds: 1 - 80/100 is a hair under a
//       fifth, and put a bar at exactly four fifths of the peak in the
//       tallest step.
//
export const SHADES = 5;

export function heightShade(records, peak) {
    if (!(peak > 0)) {
        return SHADES - 1;
    }

    return Math.min(SHADES - 1, Math.max(0, Math.floor(((peak - records) * SHADES) / peak)));
}

//
// a bar's classes and height. A reported bar stands as tall as its records, on
// the row's own scale, and never shorter than a sliver, so a bar that brought
// one record is still seen to have reported.
//
function barLook(bar, peak) {
    if (bar.kind !== 'reported') {
        return { className: `stream-bar stream-bar-${bar.kind}`, style: null };
    }

    const height = peak ? Math.max(8, Math.round(100 * bar.records / peak)) : 8;

    return {
        className: `stream-bar stream-bar-reported stream-shade-${heightShade(bar.records, peak)}${bar.failed ? ' stream-bar-failed' : ''}`,
        style: { height: `${height}%` },
    };
}

//
// what a click on a bar opens, by the rate, for its popup to say (#167): a
// month its days, a day its hours, an hour its minutes. A minute opens
// nothing, so its popup says nothing about a click.
//
const OPENS = { month: 'days', day: 'hours', hour: 'minutes' };

//
// how near a row's end, in px, a bar's popup stops centering on the bar and
// lines up with the row's end instead, so it stays inside the row: about half
// the widest a popup is
//
const TIP_EDGE = 110;

/**
 * the phone's way to sort, since it has no room for the headings: the same
 * choices, from a round button at the end of the page's line of controls
 * (#173). It was a menu showing the choice in use, which took the room of four
 * buttons, and pushed onto a line of its own whenever Now joined the arrows.
 *
 * The choice in use has a check by it in the menu, and names the button for a
 * screen reader -- 'Sort: Default order'. While the list is sorted the button
 * is green, as a sort heading is lit on a wide screen, so a sorted list says so
 * without the menu being opened.
 */
export function SortMenu({ sort = null, onSort = () => {} }) {
    const [anchor, setAnchor] = useState(null);
    const value = sort ? `${sort.key}:${sort.dir}` : '';
    const current = SORT_CHOICES.find((choice) => choice.value === value) || SORT_CHOICES[0];

    return (
        <div className='stream-rows-sort-menu'>
            <button
                type='button'
                className={sort ? 'stream-sort stream-sort-on' : 'stream-sort'}
                aria-label={`Sort: ${current.label}`}
                aria-haspopup='menu'
                aria-expanded={Boolean(anchor)}
                onClick={(event) => setAnchor(event.currentTarget)}
            >
                <SwapVertIcon fontSize='inherit' />
            </button>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{ className: 'stream-sort-list' }}
            >
                {SORT_CHOICES.map((choice) => (
                    <MenuItem
                        key={choice.value}
                        selected={choice === current}
                        onClick={() => {
                            const [key, dir] = choice.value.split(':');

                            setAnchor(null);
                            onSort(key ? { key: key, dir: dir } : null);
                        }}
                    >
                        <span className='stream-sort-check' aria-hidden='true'>
                            {choice === current ? <CheckIcon fontSize='inherit' /> : null}
                        </span>
                        {choice.label}
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}

SortMenu.propTypes = {
    sort: PropTypes.shape({
        key: PropTypes.oneOf(SORT_KEYS).isRequired,
        dir: PropTypes.oneOf(['asc', 'desc']).isRequired,
    }),
    onSort: PropTypes.func,
};

/**
 * a stream's bars, and what it says over them until its report is in. A row
 * draws them, and so does a stream on its own (#161), taller -- see
 * stream-focus.jsx.
 */
export function StreamBars({ row, rate, onPoint, pointed = null, onOpen = null, className = '' }) {
    const peak = Math.max(0, ...row.bars.filter((bar) => bar.kind === 'reported').map((bar) => bar.records));
    const tap = useRef({ type: 'mouse', described: false });
    const wrap = useRef(null);
    const [tip, setTip] = useState(null);
    const opens = onOpen ? OPENS[String(rate).toLowerCase()] : null;

    //
    // the popup by a bar a mouse points at (#167): when it was, what it holds,
    // and what a click opens. It stands over the bar's top -- or just over the
    // baseline, for a bar with no height -- and at a row's two ends lines up
    // with the end rather than centering on the bar, so it stays inside the
    // row. A finger brings up no popup: a phone says what a tapped bar holds
    // in the line under the rows
    //
    function showTip(event, bar, summary) {
        if ((event.pointerType || 'mouse') !== 'mouse' || !wrap.current) {
            return;
        }

        const box = wrap.current.getBoundingClientRect();
        const slot = event.currentTarget.getBoundingClientRect();
        const mark = event.currentTarget.firstChild.getBoundingClientRect();
        const x = slot.left + (slot.width / 2) - box.left;

        let side = 'middle';
        if (x < TIP_EDGE) {
            side = 'start';
        } else if (x > box.width - TIP_EDGE) {
            side = 'end';
        }

        setTip({
            key: bar.start.valueOf(),
            when: barWhen(bar.start, rate),
            summary: summary,
            hint: opens ? `Click to see its ${opens}` : '',
            x: x,
            y: Math.min(mark.top, slot.bottom - 2) - box.top,
            side: side,
        });
    }

    return (
        <div ref={wrap} className={`stream-row-bars-wrap${row.status in STATUS ? ' stream-row-bars-waiting' : ''}${className ? ` ${className}` : ''}`}>
            <div
                className={`stream-row-bars${row.bars.length > 30 ? ' stream-row-bars-dense' : ''}${onOpen ? ' stream-row-bars-open' : ''}`}
                onPointerLeave={() => setTip(null)}
            >
                {row.bars.map((bar) => {
                    const look = barLook(bar, peak);
                    const title = `${row.name}, ${barWhen(bar.start, rate)}`;
                    const summary = barSummary(bar);
                    const key = `${row.stream}:${bar.start.valueOf()}`;

                    return (
                        <span
                            key={bar.start.valueOf()}
                            className={`stream-bar-slot${tip && tip.key === bar.start.valueOf() ? ' is-pointed' : ''}`}
                            role='img'
                            aria-label={`${title}: ${summary}`}
                            onPointerEnter={(event) => showTip(event, bar, summary)}
                            onPointerDown={(event) => {
                                tap.current = { type: event.pointerType || 'mouse', described: pointed === key };
                            }}
                            onMouseEnter={() => onPoint({ title, summary, key })}
                            onClick={() => {
                                const touched = tap.current.type === 'touch' || tap.current.type === 'pen';

                                if (onOpen && (!touched || tap.current.described)) {
                                    setTip(null);
                                    onOpen(bar);
                                } else {
                                    onPoint({ title, summary, key });
                                }
                            }}
                        >
                            <span className={look.className} style={look.style} />
                        </span>
                    );
                })}
            </div>
            {tip ? (
                <div
                    className={`stream-bar-tip stream-bar-tip-${tip.side}`}
                    style={{ left: tip.x, top: tip.y }}
                    aria-hidden='true'
                >
                    <div className='stream-bar-tip-when'>{tip.when}</div>
                    <div className='stream-bar-tip-what'>{tip.summary}</div>
                    {tip.hint ? <div className='stream-bar-tip-hint'>{tip.hint}</div> : null}
                </div>
            ) : null}
            {row.status in STATUS
                ? (
                    <div className={`stream-row-status stream-row-status-${row.status}`} role='status'>
                        <span>{STATUS[row.status]}</span>
                        {row.status === 'failed'
                            ? (
                                <button
                                    type='button'
                                    className='stream-row-retry'
                                    aria-label={`Retry ${row.name}`}
                                    onClick={row.retry}
                                >
                                    Retry
                                </button>
                            ) : null}
                    </div>
                ) : null}
        </div>
    );
}

StreamBars.propTypes = {
    row: PropTypes.object.isRequired,
    rate: PropTypes.string.isRequired,
    onPoint: PropTypes.func.isRequired,
    pointed: PropTypes.string,
    onOpen: PropTypes.func,
    className: PropTypes.string,
};

/**
 * the line under the bars that says what the one pointed at holds
 */
export function StreamReadout({ pointed = null }) {
    return (
        <div className='stream-rows-readout' aria-live='polite'>
            {pointed
                ? (<><strong>{pointed.title}</strong><span>{pointed.summary}</span></>)
                : (<span>Point at a bar, or tap it, to see what it holds.</span>)}
        </div>
    );
}

StreamReadout.propTypes = {
    pointed: PropTypes.shape({
        title: PropTypes.string,
        summary: PropTypes.string,
    }),
};

/**
 * what the shades and the kinds of bar mean.
 *
 * Note: open wherever there is room for it. A phone folds it under its own
 *       button instead (#161), since it is read once and then known -- the
 *       stylesheet shows the button, and hides the key until it is pressed.
 *
 * Note: the shades are one ramp, from the fewest records to the most (#167),
 *       lightest first by day -- the order they run in by night is the
 *       stylesheet's, so the ramp reads 'Fewer' to 'More' in either theme.
 */
export function StreamLegend() {
    const [open, setOpen] = useState(false);

    return (
        <div className={`stream-rows-legend${open ? ' stream-rows-legend-open' : ''}`}>
            <button
                type='button'
                className='stream-rows-legend-toggle'
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                What the colors mean
                {open ? <ExpandLessIcon className='stream-rows-legend-mark' fontSize='inherit' />
                    : <ExpandMoreIcon className='stream-rows-legend-mark' fontSize='inherit' />}
            </button>
            <div className='stream-rows-legend-body'>
                <span className='stream-rows-legend-title'>
                    Height and shade: records that succeeded, on each row&apos;s own scale.
                </span>
                <span className='stream-rows-key stream-rows-ramp'>
                    Fewer
                    <span className='stream-rows-ramp-steps'>
                        {Array.from({ length: SHADES }, (_, index) => SHADES - 1 - index).map((step) => (
                            <span key={step} className={`stream-rows-swatch stream-shade-${step}`} />
                        ))}
                    </span>
                    More
                </span>
                <span className='stream-rows-key'>
                    <span className='stream-rows-swatch stream-bar-missed' />
                    Missed
                </span>
                <span className='stream-rows-key'>
                    <span className='stream-rows-swatch stream-rows-swatch-failed' />
                    Some failed
                </span>
                <span className='stream-rows-key'>
                    <span className='stream-rows-swatch stream-bar-off' />
                    Not scheduled
                </span>
            </div>
        </div>
    );
}

function StreamRow({ row, rate, onPoint, pointed = null, onOpen = null, onFocus = null, pick }) {
    const picked = COLUMNS.find((column) => column.key === pick);

    return (
        <div className='stream-row' data-stream={row.stream}>
            <div className='stream-row-name'>
                <span className='stream-row-title'>
                    {row.href
                        ? (
                            <a
                                className='stream-row-link'
                                href={row.href}
                                onClick={(event) => {
                                    if (onFocus && plainClick(event)) {
                                        event.preventDefault();
                                        onFocus(row.stream);
                                    }
                                }}
                            >
                                {row.name}
                                <ChevronRightIcon className='stream-row-open' fontSize='inherit' aria-hidden='true' />
                            </a>
                        ) : row.name}
                    {row.status === 'loading' || row.status === 'slow'
                        ? (
                            <CircularProgress
                                className='stream-row-spinner'
                                size={14}
                                thickness={5}
                                aria-label={`Loading ${row.name}`}
                            />
                        ) : null}
                </span>
                <span className='stream-row-schedule'>{row.schedule}</span>
            </div>
            <div className='stream-row-controls'>{row.controls}</div>
            <StreamBars row={row} rate={rate} onPoint={onPoint} pointed={pointed} onOpen={onOpen} />
            <div className='stream-row-figures'>
                {COLUMNS.map((column) => (
                    <div key={column.key} className='stream-row-figure'>{row.figures[column.key]}</div>
                ))}
            </div>
            {/*

                the one figure a phone shows: the one the list is sorted by, so
                the order is one the reader can see, and otherwise the coverage.
                Nothing until the report is in, since its 'n/a' would read as a
                stream that has no figure rather than one still loading

            */}
            <div className='stream-row-pick'>
                <span className='stream-row-pick-value'>
                    {row.status in STATUS ? '' : row.figures[picked.key]}
                </span>
                <span className='stream-row-pick-name'>{picked.short.toLowerCase()}</span>
            </div>
            <span className='stream-row-chevron' aria-hidden='true'>
                <ChevronRightIcon fontSize='inherit' />
            </span>
        </div>
    );
}

StreamRow.propTypes = {
    row: PropTypes.object.isRequired,
    rate: PropTypes.string.isRequired,
    onPoint: PropTypes.func.isRequired,
    pointed: PropTypes.string,
    onOpen: PropTypes.func,
    onFocus: PropTypes.func,
    pick: PropTypes.oneOf(SORT_KEYS).isRequired,
};

//
// a figure to sort by: the number in it, or below every number when it has
// none ('n/a'), whichever way the column is sorted
//
function sortValue(figure) {
    const value = parseFloat(String(figure).replace(/,/g, ''));

    return Number.isFinite(value) ? value : null;
}

function StreamRows({
    rows,
    rate,
    first,
    last,
    sort = null,
    onSort = () => {},
    onOpen = null,
    onFocus = null,
    folded = false,
    width = null,
    onFold = () => {},
    onResize = () => {},
}) {
    const [pointed, setPointed] = useState(null);
    const box = useRef(null);

    //
    // the drag under way, and the listeners it put on the window -- which go on
    // the window rather than on the strip for the reason graph.jsx gives: a
    // pointer dragging a 14px target leaves it constantly
    //
    const drag = useRef(null);

    function endDrag() {
        if (drag.current) {
            window.removeEventListener('pointermove', drag.current.move);
            window.removeEventListener('pointerup', drag.current.up);
        }

        drag.current = null;
    }

    //
    // and a page that goes away mid-drag takes them with it
    //
    useEffect(() => endDrag, []);

    /**
     * the divider grabbed: the figures go wider as it goes left, narrower as
     * it goes right, and fold once it is pulled FIGURES_FOLD past the narrowest
     * they can be -- back at their own width when they are opened again, since
     * the width they folded at is not one anybody chose.
     *
     * Note: every move is handed to the page, which draws it, and only the
     *       pointer coming up is the reader settling on a width worth keeping. A
     *       grab with no move keeps nothing, so the stylesheet's own width is
     *       never pinned as a number by a click.
     */
    function startDrag(event) {
        if (event.button !== 0) {
            return;
        }

        const rows_box = box.current;
        const head = rows_box.querySelector('.stream-rows-head-figures');
        const across = rows_box.getBoundingClientRect().width;
        const start = width || (head && head.getBoundingClientRect().width) || FIGURES_MIN;

        const state = {
            from: event.clientX,
            start: start,
            at: start,
            moved: false,
            ceiling: across ? Math.max(FIGURES_MIN, across / 2) : Infinity,
        };

        state.move = (moved) => {
            const wanted = state.start + (state.from - moved.clientX);

            if (wanted < FIGURES_MIN - FIGURES_FOLD) {
                endDrag();
                onFold(true, true);
                return;
            }

            state.at = Math.min(Math.max(wanted, FIGURES_MIN), state.ceiling);
            state.moved = true;
            onResize(state.at, false);
        };

        state.up = () => {
            endDrag();

            if (state.moved) {
                onResize(state.at, true);
            }
        };

        endDrag();
        drag.current = state;
        window.addEventListener('pointermove', state.move);
        window.addEventListener('pointerup', state.up);
        event.preventDefault();
    }

    const ordered = sort && sort.key
        ? [...rows].sort((a, b) => {
            const x = sortValue(a.figures[sort.key]);
            const y = sortValue(b.figures[sort.key]);

            if (x === null || y === null) {
                return (x === null) - (y === null);
            }

            return sort.dir === 'asc' ? x - y : y - x;
        })
        : rows;

    const active = (key) => Boolean(sort) && sort.key === key;

    return (
        <div
            ref={box}
            className={`stream-rows${folded ? ' stream-rows-folded' : ''}`}
            style={width && !folded ? { '--stream-figures': `${width}px` } : undefined}
        >
            {/*

                the headings and the rows, which the divider and the rail stand
                beside, so that they stop at the last row (#167). The line under
                the rows, the key and the hint come after, beside nothing

            */}
            <div className='stream-rows-table'>
                <div className='stream-rows-head'>
                    <span className='stream-rows-head-name'>Stream</span>
                    <span className='stream-rows-axis'>
                        <span>{first}</span>
                        <span>{last}</span>
                    </span>
                    <span className='stream-rows-head-figures'>
                        {COLUMNS.map((column) => (
                            <button
                                key={column.key}
                                type='button'
                                className={`stream-rows-sort${active(column.key) ? ' stream-rows-sort-active' : ''}`}
                                aria-label={`Sort by ${column.label}`}
                                aria-pressed={active(column.key)}
                                onClick={() => onSort(nextSort(sort, column.key))}
                            >
                                {column.label}
                                <span className='stream-rows-sort-mark' aria-hidden='true'>
                                    {!active(column.key)
                                        ? <UnfoldMoreIcon fontSize='inherit' data-mark='none' />
                                        : sort.dir === 'desc'
                                            ? <ArrowDownwardIcon fontSize='inherit' data-mark='desc' />
                                            : <ArrowUpwardIcon fontSize='inherit' data-mark='asc' />}
                                </span>
                            </button>
                        ))}
                    </span>
                </div>

                {ordered.map((row) => (
                    <StreamRow
                        key={row.stream}
                        row={row}
                        rate={rate}
                        onPoint={setPointed}
                        pointed={pointed ? pointed.key : null}
                        onOpen={onOpen}
                        onFocus={onFocus}
                        pick={sort && sort.key ? sort.key : 'coverage'}
                    />
                ))}

                {/*

                    the divider, and the rail the figures fold into: one or the
                    other, from the headings down to the last row. See the note at
                    the top

                */}
                {folded
                    ? (
                        <button
                            type='button'
                            className='stream-rows-rail'
                            aria-label='Show Health, Coverage and Total Records'
                            onClick={() => onFold(false)}
                        >
                            <ChevronLeftIcon fontSize='inherit' />
                            <span>Health · Coverage · Records</span>
                        </button>
                    ) : (
                        <div className='stream-rows-divider'>
                            <div className='stream-rows-grip' aria-hidden='true' onPointerDown={startDrag} />
                            <button
                                type='button'
                                className='stream-rows-fold'
                                aria-label='Fold Health, Coverage and Total Records'
                                onClick={() => onFold(true)}
                            >
                                <ChevronRightIcon fontSize='inherit' />
                            </button>
                        </div>
                    )}
            </div>

            <StreamReadout pointed={pointed} />
            <StreamLegend />
            <p className='stream-rows-hint'>Tap a stream to see its graph.</p>
        </div>
    );
}

StreamRows.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.shape({
        stream: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        href: PropTypes.string,
        schedule: PropTypes.string,
        status: PropTypes.oneOf(['loading', 'slow', 'failed', 'done']),
        retry: PropTypes.func,
        bars: PropTypes.array.isRequired,
        figures: PropTypes.shape({
            health: PropTypes.node,
            coverage: PropTypes.node,
            total: PropTypes.node,
        }).isRequired,
        controls: PropTypes.node,
    })).isRequired,
    rate: PropTypes.string.isRequired,
    first: PropTypes.string,
    last: PropTypes.string,
    sort: PropTypes.shape({
        key: PropTypes.oneOf(SORT_KEYS).isRequired,
        dir: PropTypes.oneOf(['asc', 'desc']).isRequired,
    }),
    onSort: PropTypes.func,
    //
    // what a bar opens, when it opens anything -- see the note at the top
    //
    onOpen: PropTypes.func,
    //
    // a stream shown on its own, from its name (#161)
    //
    onFocus: PropTypes.func,
    //
    // the figures behind the divider: folded away, and the width they were
    // dragged to, in px, or null for the stylesheet's own. What a fold or a drag
    // asks for goes back out through onFold(folded, reset) and
    // onResize(width, done) -- see the note at the top
    //
    folded: PropTypes.bool,
    width: PropTypes.number,
    onFold: PropTypes.func,
    onResize: PropTypes.func,
};

export default StreamRows;
