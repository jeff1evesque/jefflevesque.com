/**
 * cube-chart.jsx: a month's distribution as stacked bars built from cubes.
 *
 * One bar per group of a distribution -- a stream's sectors, severities, forms,
 * series or days -- in the order recharts' stacked bars ran before #154, each a
 * stack of cubes worth a round number of records, against the same value axis,
 * dashed grid and slanted names. cube-layout.js places every cube, from the
 * groups, members and colors distribution-tree.js builds.
 *
 * Pointing at a cube lights up its band -- that member's cubes in that bar --
 * fades the rest, and names it in a tooltip. Clicking a bar that holds more than
 * itself lists what it holds under the chart: its members, the tickers that
 * split that day, or the groups 'Other' rolled up. Clicking the bar again, or
 * the list's ×, clears the list, and pointing at a row lights its band as its
 * cubes would.
 *
 * Note: a wide screen's chart. A phone draws the same bars laid on their side,
 *       a row each, since a row of bars standing up does not fit its width --
 *       see cube-rows.jsx (#188).
 *
 * Note: the axes (#167). The value axis is written in short figures -- '3.5M',
 *       '14M' -- where recharts' 'toExponential(0)' wrote 3.5M as '4e+6' and
 *       10.5M and 14M both as '1e+7', and it never folds. Neither axis has a
 *       title: the caption on the plot says what a cube is worth, and the names
 *       say what a bar is. The names start folded into a green bar under the
 *       plot, which shows them again; shown, a click anywhere on them folds
 *       them, and the page keeps which -- see 'namesShown' and 'onNames'.
 *
 * Note: the chart runs from the value axis's figures, at the page's left edge,
 *       to the listing's right edge (#167): the left margin is the figures' own
 *       width, and there is none at the right.
 *
 * Note: what a cube is worth, and the api icons, sit inside the plot on one
 *       line, set in from its top corners (#169). The caption had a line of its
 *       own over the plot, which the chart gives back -- see CAPTION_ROOM.
 *
 * Note: a day of stock splits the api names the companies of is banded by
 *       sector, each in its own color, which a legend over the chart names
 *       (#190). Pointing at a band names its sector and that sector's tickers,
 *       and the day's list heads its tickers with their sectors.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import cubeLayout, { barsOf, ticksOf } from './cube-layout.js';
import { share } from './distribution-tree.js';
import { CHART_X_AXIS_HEIGHT, CHART_X_AXIS_ANGLE } from './chart-height.js';

//
// the plot's margins inside the chart, in px: over the plot, the room the value
// axis's top figure needs, centered on the top line; none at the right, so the
// plot runs to the listing's edge; and under the names the band recharts kept.
// The left is the value axis's own figures -- see axisRoom
//
const MARGIN = { top: 8, right: 0, bottom: 8 };

//
// what the chart gives back of the height it is given, now the caption sits on
// the plot (#169): the 34px over the plot that held the caption's line, less
// the 8 still over it. The plot keeps its height, and what is under the chart
// comes up by it
//
const CAPTION_ROOM = 26;

//
// where the caption and the api icons sit, set in from the plot's top left and
// top right corners. The caption is down a little further, so its words center
// on the icons' line
//
const CAPTION_INSET = { left: 10, top: 8 };
const ACTIONS_INSET = { right: 8, top: 4 };

//
// the green bar the names fold into, and the room between it and the plot
//
const RAIL = 28;
const RAIL_GAP = 10;

//
// the value axis's figures, short: '3.5M', '14M', '250'
//
const TICK = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

//
// the room the value axis's figures take at the left of the plot: the widest
// of them, at about 6.8px a digit, 3.4px a point and 9.5px a letter in the 12px
// they are drawn in, then the gap and the tick to the axis. Measured from the
// figures rather than fixed, so a month of tens of millions and one of a few
// splits each start the plot just clear of their own figures
//
export function axisRoom(tree) {
    const ticks = ticksOf(Math.max(0, ...barsOf(tree).bars.map((bar) => bar.value)));
    const widest = Math.max(...ticks.map((tick) => [...TICK.format(tick)].reduce(
        (sum, char) => sum + (/[0-9]/.test(char) ? 6.8 : (char === '.' ? 3.4 : 9.5)), 0
    )));

    return Math.ceil(widest) + 10;
}

//
// the width the chart lays out at until the page has measured it
//
const FALLBACK_WIDTH = 1100;

//
// how far the other cubes fade while a band is lit, and how far a tooltip sits
// from its bar
//
const FADED = 0.2;
const TIP_GAP = 10;

//
// how many of a day's tickers the tooltip names before its button for the rest,
// and how many columns a bar's list runs down
//
const MAX_TICKERS = 6;
const LIST_COLUMNS = 3;

//
// a long list takes more columns, so a day of 45 tickers stands in 5 columns of
// 9 rather than 3 of 15: as many columns as rows of this many need, up to these
//
const LIST_ROWS = 9;
const MAX_LIST_COLUMNS = 6;

//
// how long a tooltip stays once the pointer leaves its bar: time enough to cross
// to its '+N more', which is the one thing on it that takes a click
//
const TIP_LINGER_MS = 250;

function fmt(value) {
    return Number(value).toLocaleString('en-US');
}

function noun(count, pair) {
    return count === 1 ? pair[0] : pair[1];
}

function capitalized(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

//
// a share in the list's narrow column, where 'under 1%' does not fit
//
function listShare(part, whole) {
    const text = share(part, whole);

    return text === 'under 1%' ? '<1%' : text;
}

//
// what a bar's list counts its rows as: what a group holds -- industries, event
// types, tickers -- or, for 'Other', the groups it rolled up
//
function rowNoun(holds, names) {
    return holds.kind === 'groups' ? names.group : names.member;
}

//
// the chart's width as the page lays it out, measured again whenever it
// changes: by a ResizeObserver where there is one, and on the window's resize
// where there is not
//
export function useWidth(ref, fallback = FALLBACK_WIDTH) {
    const [width, setWidth] = useState(fallback);

    useEffect(() => {
        const node = ref.current;
        const measure = () => {
            if (node.clientWidth > 0) {
                setWidth(node.clientWidth);
            }
        };

        measure();

        if (typeof window.ResizeObserver === 'function') {
            const observer = new window.ResizeObserver(measure);
            observer.observe(node);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [ref]);

    return width;
}

export default function CubeChart({ tree, names, caption, height, actions, overlay, namesShown = false, onNames = () => {} }) {
    const box = useRef(null);
    const width = useWidth(box);
    const [lit, setLit] = useState(null);
    const [open, setOpen] = useState(null);
    const [shownNames, setShownNames] = useState(namesShown);
    const linger = useRef(null);

    useEffect(() => () => window.clearTimeout(linger.current), []);

    //
    // a band lit at once, or none after a moment: the pointer off its bar
    // leaves the tooltip up for TIP_LINGER_MS, long enough to reach '+N more'
    //
    function light(next) {
        window.clearTimeout(linger.current);
        linger.current = null;
        setLit(next);
    }

    function letGo() {
        window.clearTimeout(linger.current);
        linger.current = window.setTimeout(() => {
            linger.current = null;
            setLit(null);
        }, TIP_LINGER_MS);
    }

    //
    // the names shown or folded, and the page told, so it can keep which
    //
    function showNames(shown) {
        setShownNames(shown);
        onNames(shown);
    }

    //
    // the plot is the same height either way. The names folded leave the green
    // bar under it in their place, and the chart is that much shorter, so what
    // is under the chart moves up. Shown, they take their band back, and a
    // click anywhere in it folds them again. Either way the chart is
    // CAPTION_ROOM short of the height it is given
    //
    const shown_height = height - CAPTION_ROOM;
    const plot_bottom = shown_height - MARGIN.bottom - CHART_X_AXIS_HEIGHT;
    const total_height = shownNames ? shown_height : plot_bottom + RAIL_GAP + RAIL;

    const layout = useMemo(() => cubeLayout(tree, {
        left: axisRoom(tree),
        right: width - MARGIN.right,
        top: MARGIN.top,
        bottom: plot_bottom,
    }), [tree, width, plot_bottom]);

    const { plot } = layout;
    const unit = names.unit;
    const bars = new Map(layout.bars.map((bar) => [bar.key, bar]));
    const opened = open ? bars.get(open) || null : null;
    const band = lit ? layout.bands.get(lit.key) || null : null;
    const yOf = (value) => plot.bottom - ((value / layout.top) * (plot.bottom - plot.top));

    //
    // a click on a bar lists what it holds, and a second click on the same bar
    // clears the list again
    //
    function toggle(bar) {
        if (bar.holds) {
            setOpen(open === bar.key ? null : bar.key);
        }
    }

    //
    // what is lit: the band pointed at, else the bar whose list is open, else
    // every cube
    //
    const shown = (cube) => (band ? cube.key === band.key : !opened || cube.bar === opened.key);

    const legend = layout.unit === 1
        ? `Each cube is 1 ${unit[0]}`
        : `Each cube ≈ ${fmt(layout.unit)} ${unit[1]}`;

    //
    // the tooltip, in the old bars' style, for the band a cube is pointed at:
    // its bar, then the band with its color and count. A row of the list
    // lights its band without one, since the row reads the same. It sits
    // beside the bar, on whichever side has the room
    //
    // Note: it says nothing about a click (#179). The hand cursor over a
    //       listable bar says it can be clicked, and an open list has its own
    //       way out. Its '+N more' is the one thing on it that takes a click:
    //       it opens the day's whole list under the chart, as a click on the
    //       bar does, and the tooltip stays a moment after the pointer leaves
    //       the bar, so the pointer can reach it. The rest of it lets the
    //       pointer through to the cubes under it.
    //
    let tip = null;
    if (band && lit.from === 'cube') {
        const bar = band.bar;
        const holds = bar.holds;

        //
        // the day's tickers, or the band's own where the day is banded by
        // sector (#190)
        //
        const tickers = band.part.tickers || (holds && holds.kind === 'tickers' ? holds.items : []);
        const middle = Math.min(plot.bottom - 24, Math.max(plot.top + 24, (band.top + band.bottom) / 2));
        const stack = (layout.across * layout.pitch) - 2;

        let detail = `${share(bar.value, tree.total)} of all`;
        if (holds && holds.kind === 'groups') {
            detail = `the ${holds.items.length} smallest ${names.group[1]}`;
        } else if (layout.ranked) {
            detail = `${share(band.part.value, bar.value)} of ${bar.name}`;
        }

        tip = {
            style: bar.center > (plot.left + plot.right) / 2
                ? { right: width - bar.x0 + TIP_GAP, top: middle }
                : { left: bar.x0 + stack + TIP_GAP, top: middle },
            bar: bar.key,
            title: bar.name,
            color: band.color,
            name: layout.ranked ? band.part.name : capitalized(unit[1]),
            value: fmt(band.part.value),
            detail: detail,
            tickers: tickers.slice(0, MAX_TICKERS),
            more: Math.max(0, tickers.length - MAX_TICKERS),
        };
    }

    //
    // the open bar's list, under the chart: what it holds, largest first, down
    // the columns, with a caret over the bar it belongs to
    //
    let list = null;
    if (opened) {
        const holds = opened.holds;
        const pair = rowNoun(holds, names);
        let rows = [];
        let sections = null;

        if (holds.sectors) {
            //
            // a day banded by sector heads its tickers with their sectors, in
            // the bar's order, each ticker in its sector's color. Pointing at a
            // heading or a ticker lights the sector's band, and the heading
            // marks it (#190)
            //
            sections = holds.sectors.map((sector) => ({
                sector: sector,
                rows: sector.tickers.map((ticker) => ({
                    key: ticker.key,
                    band: sector.key,
                    marked: false,
                    name: ticker.name,
                    value: ticker.note,
                    share: null,
                    color: sector.shade,
                })),
            }));
            rows = sections.reduce((all, section) => all.concat(section.rows), []);
        } else if (holds.kind === 'members') {
            rows = holds.items.map((member) => ({
                key: member.key,
                band: member.key,
                marked: true,
                name: member.name,
                value: fmt(member.value),
                share: listShare(member.value, opened.value),
                color: member.shade,
            }));
        } else if (holds.kind === 'tickers') {
            rows = holds.items.map((member) => ({
                key: member.key,
                band: null,
                name: member.name,
                value: member.note,
                share: null,
                color: opened.parts[0].color,
            }));
        } else {
            rows = holds.items.map((group) => ({
                key: group.key,
                band: null,
                name: group.name,
                value: fmt(group.value),
                share: listShare(group.value, opened.value),
                color: opened.parts[0].color,
            }));
        }

        //
        // what the bar holds, counted. A day's splits are its tickers, so it
        // counts them once (#188): '24 splits · 26% of all'
        //
        const meta = [`${fmt(opened.value)} ${noun(opened.value, unit)}`];
        if (holds.kind !== 'tickers') {
            meta.push(`${holds.items.length} ${noun(holds.items.length, pair)}`);
        }
        if (holds.kind !== 'groups') {
            meta.push(`${share(opened.value, tree.total)} of all`);
        }

        //
        // as many columns as rows of LIST_ROWS need, 3 to 6. A day banded by
        // sector counts its sectors' heads as rows as well
        //
        const count = rows.length + (sections ? sections.length : 0);
        const columns = Math.min(
            count,
            Math.max(LIST_COLUMNS, Math.min(MAX_LIST_COLUMNS, Math.ceil(count / LIST_ROWS))),
        );

        //
        // rows down `across` columns, the list's own unless it is told
        //
        const rowsOf = (listed, label, across = columns) => (
            <ul
                className='cube-list-rows'
                aria-label={label}
                style={{
                    gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${Math.ceil(listed.length / across)}, auto)`,
                }}
            >
                {listed.map((row) => (
                    <li
                        key={row.key}
                        className={`cube-list-row${row.marked && lit && lit.key === row.band ? ' is-lit' : ''}`}
                        onMouseEnter={row.band ? () => light({ key: row.band, from: 'row' }) : undefined}
                    >
                        <span className='cube-list-swatch' style={{ background: row.color }} />
                        <span className='cube-list-name' title={row.name}>{row.name}</span>
                        <span className='cube-list-count'>{row.value}</span>
                        {row.share === null ? null : <span className='cube-list-share'>{row.share}</span>}
                    </li>
                ))}
            </ul>
        );

        list = (
            <section
                className='cube-list'
                aria-label={`${opened.name}: its ${pair[1]}`}
                onMouseLeave={() => light(null)}
            >
                <span className='cube-list-caret' style={{ left: opened.center - 6 }} aria-hidden='true' />
                <div className='cube-list-head'>
                    <div className='cube-list-heading'>
                        <span className='cube-list-title'>{opened.name}</span>
                        <span className='cube-list-meta'>{meta.join(' · ')}</span>
                    </div>
                    <button
                        type='button'
                        className='cube-list-close'
                        aria-label='Clear the list'
                        title='Clear the list'
                        onClick={() => setOpen(null)}
                    >
                        <CloseIcon fontSize='small' />
                    </button>
                </div>
                {/*

                    a day's sectors run down the list's columns, as its rows
                    would, each heading a column of its own tickers. One longer
                    than a column runs on into the next, so a day of one large
                    sector still stands in columns

                */}
                {sections ? (
                    <div className='cube-list-sectors' style={{ columnCount: columns }}>
                        {sections.map(({ sector, rows: listed }) => (
                            <div key={sector.key} className={`cube-list-sector${listed.length > LIST_ROWS ? ' is-long' : ''}`}>
                                <div
                                    className={`cube-list-sector-head${lit && lit.key === sector.key ? ' is-lit' : ''}`}
                                    onMouseEnter={() => light({ key: sector.key, from: 'row' })}
                                >
                                    <span className='cube-list-swatch' style={{ background: sector.shade }} />
                                    <span className='cube-list-name'>{sector.name}</span>
                                    <span className='cube-list-count'>{fmt(sector.value)}</span>
                                </div>
                                {rowsOf(listed, sector.name, 1)}
                            </div>
                        ))}
                    </div>
                ) : rowsOf(rows)}
            </section>
        );
    }

    const radius = Math.min(4, layout.size * 0.21);

    return (
        <div
            className='cube-chart'
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    setOpen(null);
                }
            }}
        >
            {/*

                the sectors a month of stock splits is banded by, each in its
                color, on a line over the chart, set in to the caption's left
                edge (#190)

            */}
            {tree.sectors && tree.sectors.length ? (
                <ul
                    className='cube-chart-legend'
                    aria-label='Sectors'
                    style={{ paddingLeft: plot.left + CAPTION_INSET.left }}
                >
                    {tree.sectors.map((sector) => (
                        <li key={sector.key} className='cube-chart-legend-item'>
                            <span className='cube-chart-legend-swatch' style={{ background: sector.shade }} />
                            {sector.name}
                        </li>
                    ))}
                </ul>
            ) : null}
            <div className='cube-chart-plot' ref={box} onMouseLeave={() => light(null)}>
                <svg
                    width={width}
                    height={total_height}
                    role='group'
                    aria-label={`${capitalized(unit[1])} by ${names.group[0]}, ${caption}. ${legend}.`}
                >
                    <rect
                        className='cube-chart-backdrop'
                        x={0}
                        y={0}
                        width={width}
                        height={total_height}
                        onMouseEnter={letGo}
                    />
                    {layout.ticks.map((tick) => (
                        <line
                            key={`grid-${tick}`}
                            className='cube-chart-grid'
                            x1={plot.left}
                            x2={plot.right}
                            y1={yOf(tick)}
                            y2={yOf(tick)}
                        />
                    ))}
                    {layout.bars.map((bar) => (
                        <line
                            key={`grid-${bar.key}`}
                            className='cube-chart-grid'
                            x1={bar.center}
                            x2={bar.center}
                            y1={plot.top}
                            y2={plot.bottom}
                        />
                    ))}
                    <line className='cube-chart-axis' x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} />
                    <line className='cube-chart-axis' x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} />
                    {layout.ticks.map((tick) => (
                        <g key={`tick-${tick}`}>
                            <line className='cube-chart-axis' x1={plot.left - 6} x2={plot.left} y1={yOf(tick)} y2={yOf(tick)} />
                            <text className='cube-chart-tick' x={plot.left - 8} y={yOf(tick)} dy='0.355em' textAnchor='end'>
                                {TICK.format(tick)}
                            </text>
                        </g>
                    ))}
                    {shownNames ? (
                        <g className='cube-chart-names'>
                            {layout.bars.map((bar) => (
                                <g key={`name-${bar.key}`}>
                                    <line className='cube-chart-axis' x1={bar.center} x2={bar.center} y1={plot.bottom} y2={plot.bottom + 6} />
                                    <text
                                        className='cube-chart-name'
                                        transform={`translate(${bar.center},${plot.bottom + 8}) rotate(${CHART_X_AXIS_ANGLE})`}
                                        dy='0.71em'
                                        textAnchor='end'
                                    >
                                        {bar.name}
                                    </text>
                                </g>
                            ))}
                        </g>
                    ) : null}
                    {/*

                        each bar's stack, under its cubes: it keeps a band lit
                        across the gaps between them, takes a click there, and is
                        what the keyboard moves between

                    */}
                    {layout.bars.map((bar) => (
                        <rect
                            key={`bar-${bar.key}`}
                            className={`cube-chart-bar${bar.holds ? ' is-listable' : ''}`}
                            data-name={bar.name}
                            x={bar.x0 - 3}
                            y={plot.bottom - (bar.rows * layout.pitch) - 1}
                            width={(layout.across * layout.pitch) + 4}
                            height={(bar.rows * layout.pitch) + 4}
                            onClick={() => toggle(bar)}
                            {...(bar.holds ? {
                                tabIndex: 0,
                                role: 'button',
                                'aria-expanded': open === bar.key,
                                'aria-label': `${bar.name}, ${fmt(bar.value)} ${noun(bar.value, unit)}, `
                                    + `${share(bar.value, tree.total)} of all. Lists its `
                                    + `${bar.holds.items.length} ${noun(bar.holds.items.length, rowNoun(bar.holds, names))}`,
                                onKeyDown: (event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        toggle(bar);
                                    }
                                },
                            } : {})}
                        />
                    ))}
                    {layout.cubes.map((cube, index) => (
                        <rect
                            key={index}
                            className={`cube-chart-cube${bars.get(cube.bar).holds ? ' is-listable' : ''}`}
                            data-band={cube.key}
                            x={cube.x}
                            y={cube.y}
                            width={layout.size}
                            height={layout.size}
                            rx={radius}
                            fill={cube.color}
                            style={{ opacity: shown(cube) ? 1 : FADED }}
                            onMouseEnter={() => light({ key: cube.key, from: 'cube' })}
                            onClick={() => toggle(bars.get(cube.bar))}
                        />
                    ))}
                </svg>
                {/*

                    the names, shown, fold at a click anywhere on them. Under the
                    pointer their band takes a pale green fading to the page,
                    and /graph's fold arrow appears on its foot, where the green
                    bar they fold into will be. The arrow is the button a
                    keyboard reaches; the band is the mouse's larger target for
                    the same thing

                */}
                {shownNames ? (
                    <div
                        className='cube-chart-names-hit'
                        style={{ left: 0, top: plot.bottom + 2, width: width, height: total_height - plot.bottom - 2 }}
                        onClick={() => showNames(false)}
                    >
                        <button
                            type='button'
                            className='cube-chart-fold'
                            aria-label={`Hide the ${names.group[0]} names`}
                            title={`Hide the ${names.group[0]} names`}
                        >
                            <ExpandLessIcon fontSize='inherit' />
                        </button>
                    </div>
                ) : null}
                {shownNames ? null : (
                    <button
                        type='button'
                        className='cube-chart-rail'
                        style={{ left: 0, top: plot.bottom + RAIL_GAP, width: width, height: RAIL }}
                        aria-label={`Show the ${names.group[0]} names`}
                        title={`Show the ${names.group[0]} names`}
                        onClick={() => showNames(true)}
                    >
                        <ExpandMoreIcon fontSize='inherit' />
                        <span>{capitalized(names.group[1])}</span>
                    </button>
                )}
                {/*

                    what a cube is worth, and the api icons, inside the plot on
                    one line, set in from its top corners (#169). The caption is
                    hidden from a screen reader, which hears it in the chart's
                    own label

                */}
                <div
                    className='cube-chart-caption'
                    style={{ left: plot.left + CAPTION_INSET.left, top: plot.top + CAPTION_INSET.top }}
                    aria-hidden='true'
                >
                    {legend}
                </div>
                {actions ? (
                    <div
                        className='cube-chart-actions'
                        style={{ right: width - plot.right + ACTIONS_INSET.right, top: plot.top + ACTIONS_INSET.top }}
                    >
                        {actions}
                    </div>
                ) : null}
                {tip ? (
                    <div className='cube-chart-tip' style={tip.style} aria-hidden='true'>
                        <div className='cube-chart-tip-title'>{tip.title}</div>
                        <div className='cube-chart-tip-row'>
                            <span className='cube-chart-tip-swatch' style={{ background: tip.color }} />
                            <span className='cube-chart-tip-name'>{tip.name}</span>
                            <span className='cube-chart-tip-value'>{tip.value}</span>
                        </div>
                        <div className='cube-chart-tip-detail'>{tip.detail}</div>
                        {tip.tickers.length ? (
                            <div className='cube-chart-tip-tickers'>
                                {tip.tickers.map((member) => (
                                    <div key={member.key} className='cube-chart-tip-ticker'>
                                        <span>{member.name}</span>
                                        <span>{member.note}</span>
                                    </div>
                                ))}
                                {tip.more ? (
                                    <button
                                        type='button'
                                        className='cube-chart-tip-more'
                                        tabIndex={-1}
                                        onMouseEnter={() => light(lit)}
                                        onMouseLeave={letGo}
                                        onClick={() => {
                                            light(null);
                                            setOpen(tip.bar);
                                        }}
                                    >
                                        {`+${tip.more} more`}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {overlay}
            </div>
            {list}
        </div>
    );
}

CubeChart.propTypes = {
    tree: PropTypes.shape({
        groups: PropTypes.arrayOf(PropTypes.object).isRequired,
        total: PropTypes.number.isRequired,
        nested: PropTypes.bool.isRequired,
        sectors: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            shade: PropTypes.string.isRequired,
        })),
    }).isRequired,
    names: PropTypes.shape({
        group: PropTypes.arrayOf(PropTypes.string).isRequired,
        member: PropTypes.arrayOf(PropTypes.string).isRequired,
        unit: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    caption: PropTypes.string.isRequired,
    height: PropTypes.number.isRequired,
    actions: PropTypes.node,
    overlay: PropTypes.node,
    //
    // whether the names start shown, and what is told when they are shown or
    // folded -- the page keeps it, so a chart drawn again starts the same way
    //
    namesShown: PropTypes.bool,
    onNames: PropTypes.func,
};
