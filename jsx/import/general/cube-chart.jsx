/**
 * cube-chart.jsx: a month's distribution as stacked bars built from cubes.
 *
 * One bar per group of a distribution -- a stream's sectors, severities, forms,
 * series or days -- in the order the stacked bars before the sunburst ran, each
 * a stack of cubes worth a round number of records, against the same value axis,
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
 * Note: a wide screen's chart. A phone draws the sunburst instead -- see
 *       data.jsx -- since a row of bars does not fit its width.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import CloseIcon from '@mui/icons-material/Close';
import cubeLayout from './cube-layout.js';
import { share } from './sunburst.jsx';
import { CHART_X_AXIS_HEIGHT, CHART_X_AXIS_ANGLE, CHART_X_AXIS_TITLE_HEIGHT } from './chart-height.js';

//
// the plot's margins inside the chart, in px: recharts' margins around the old
// bars, with the value axis's width at the left, widened for the axis's title
//
const MARGIN = { top: 20, right: 25, bottom: 8, left: 62 };

//
// the width the chart lays out at until the page has measured it
//
const FALLBACK_WIDTH = 1100;

//
// how far the other cubes fade while a band is lit, as the sunburst fades its
// other segments, and how far a tooltip sits from its bar
//
const FADED = 0.2;
const TIP_GAP = 10;

//
// how many of a day's tickers the tooltip names before counting the rest, and
// how many columns a bar's list runs down
//
const MAX_TICKERS = 6;
const LIST_COLUMNS = 3;

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
function useWidth(ref) {
    const [width, setWidth] = useState(FALLBACK_WIDTH);

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

export default function CubeChart({ tree, names, caption, height, actions, overlay }) {
    const box = useRef(null);
    const width = useWidth(box);
    const [lit, setLit] = useState(null);
    const [open, setOpen] = useState(null);

    const layout = useMemo(() => cubeLayout(tree, {
        left: MARGIN.left,
        right: width - MARGIN.right,
        top: MARGIN.top,
        bottom: height - MARGIN.bottom - CHART_X_AXIS_HEIGHT,
    }), [tree, width, height]);

    const { plot } = layout;
    const unit = names.unit;
    const bars = new Map(layout.bars.map((bar) => [bar.key, bar]));
    const opened = open ? bars.get(open) || null : null;
    const band = lit ? layout.bands.get(lit.key) || null : null;
    const total_height = height + CHART_X_AXIS_TITLE_HEIGHT;
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
    // its bar, then the band with its color and count, and what a click does.
    // A row of the list lights its band without one, since the row reads the
    // same. It sits beside the bar, on whichever side has the room
    //
    let tip = null;
    if (band && lit.from === 'cube') {
        const bar = band.bar;
        const holds = bar.holds;
        const tickers = holds && holds.kind === 'tickers' ? holds.items : [];
        const middle = Math.min(plot.bottom - 24, Math.max(plot.top + 24, (band.top + band.bottom) / 2));
        const stack = (layout.across * layout.pitch) - 2;

        let detail = `${share(bar.value, tree.total)} of all`;
        if (holds && holds.kind === 'groups') {
            detail = `the ${holds.items.length} smallest ${names.group[1]}`;
        } else if (layout.ranked) {
            detail = `${share(band.part.value, bar.value)} of ${bar.name}`;
        }

        let hint = '';
        if (holds) {
            hint = open === bar.key
                ? 'Click again to clear the list'
                : `Click to list its ${rowNoun(holds, names)[1]}`;
        }

        tip = {
            style: bar.center > (plot.left + plot.right) / 2
                ? { right: width - bar.x0 + TIP_GAP, top: middle }
                : { left: bar.x0 + stack + TIP_GAP, top: middle },
            title: bar.name,
            color: band.color,
            name: layout.ranked ? band.part.name : capitalized(unit[1]),
            value: fmt(band.part.value),
            detail: detail,
            tickers: tickers.slice(0, MAX_TICKERS),
            more: Math.max(0, tickers.length - MAX_TICKERS),
            hint: hint,
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
        let rows;

        if (holds.kind === 'members') {
            rows = holds.items.map((member) => ({
                key: member.key,
                band: member.key,
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

        const meta = [
            `${fmt(opened.value)} ${noun(opened.value, unit)}`,
            `${holds.items.length} ${noun(holds.items.length, pair)}`,
        ];
        if (holds.kind !== 'groups') {
            meta.push(`${share(opened.value, tree.total)} of all`);
        }

        const columns = Math.min(LIST_COLUMNS, rows.length);

        list = (
            <section
                className='cube-list'
                aria-label={`${opened.name}: its ${pair[1]}`}
                onMouseLeave={() => setLit(null)}
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
                <ul
                    className='cube-list-rows'
                    style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${Math.ceil(rows.length / columns)}, auto)`,
                    }}
                >
                    {rows.map((row) => (
                        <li
                            key={row.key}
                            className={`cube-list-row${row.band && lit && lit.key === row.band ? ' is-lit' : ''}`}
                            onMouseEnter={row.band ? () => setLit({ key: row.band, from: 'row' }) : undefined}
                        >
                            <span className='cube-list-swatch' style={{ background: row.color }} />
                            <span className='cube-list-name' title={row.name}>{row.name}</span>
                            <span className='cube-list-count'>{row.value}</span>
                            {row.share === null ? null : <span className='cube-list-share'>{row.share}</span>}
                        </li>
                    ))}
                </ul>
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
            <div className='cube-chart-plot' ref={box} onMouseLeave={() => setLit(null)}>
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
                        onMouseEnter={() => setLit(null)}
                    />
                    <text className='cube-chart-caption' x={plot.left} y={12}>{legend}</text>
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
                            {/*

                                the old axis's labels, as recharts wrote them

                            */}
                            <text className='cube-chart-tick' x={plot.left - 8} y={yOf(tick)} dy='0.355em' textAnchor='end'>
                                {Number(tick).toExponential(0)}
                            </text>
                        </g>
                    ))}
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
                    <text
                        className='cube-chart-title'
                        transform={`translate(12,${(plot.top + plot.bottom) / 2}) rotate(-90)`}
                        dy='0.35em'
                        textAnchor='middle'
                    >
                        {capitalized(unit[1])}
                    </text>
                    <text
                        className='cube-chart-title'
                        x={(plot.left + plot.right) / 2}
                        y={total_height - 6}
                        textAnchor='middle'
                    >
                        {capitalized(names.group[0])}
                    </text>
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
                            onMouseEnter={() => setLit({ key: cube.key, from: 'cube' })}
                            onClick={() => toggle(bars.get(cube.bar))}
                        />
                    ))}
                </svg>
                {actions ? <div className='cube-chart-actions'>{actions}</div> : null}
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
                                {tip.more ? <div className='cube-chart-tip-more'>{`+${tip.more} more`}</div> : null}
                            </div>
                        ) : null}
                        {tip.hint ? <div className='cube-chart-tip-hint'>{tip.hint}</div> : null}
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
};
