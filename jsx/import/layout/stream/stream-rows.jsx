/**
 * stream-rows.jsx: every stream as a row of bars, with its figures beside it.
 *
 * Each row names a stream and its schedule, carries its controls, draws a bar
 * per interval of the window (see stream-bars.js), and ends with the stream's
 * Health, Coverage and Total Records over that window. The figures sort the
 * rows; pointing at a bar, or tapping one on a phone, says what it is in the
 * line under the rows.
 *
 * Note: a bar's height is on its own row's scale, so a stream bringing a few
 *       records a day reads as clearly as one bringing millions. The Total
 *       Records column is where the streams are compared.
 *
 * Note: the bars are not tab stops. A row of up to sixty of them, five rows
 *       deep, would put three hundred stops between a keyboard and the rest of
 *       the page; each bar names itself to a screen reader instead, and the
 *       figures carry the row's summary.
 *
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import PuffLoader from 'react-spinners/PuffLoader';
import { HEALTH_BANDS, barSummary, barWhen, healthBand } from '../../general/stream-bars.js';

//
// the figures, as they head their columns and as a row is sorted by them
//
const COLUMNS = [
    { key: 'health', label: 'Health', short: 'Health' },
    { key: 'coverage', label: 'Coverage', short: 'Coverage' },
    { key: 'total', label: 'Total Records', short: 'Records' },
];

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
        className: `stream-bar stream-bar-reported stream-health-${healthBand(bar.health)}${bar.failed ? ' stream-bar-failed' : ''}`,
        style: { height: `${height}%` },
    };
}

function StreamRow({ row, rate, onPoint }) {
    const peak = Math.max(0, ...row.bars.filter((bar) => bar.kind === 'reported').map((bar) => bar.records));
    //
    // the figures as a phone says them, under the name: in shorter words, so the
    // three keep to one line
    //
    const inline = COLUMNS.map((column) => `${column.short} ${row.figures[column.key]}`).join(' · ');

    return (
        <div className={`stream-row${row.current ? ' stream-row-current' : ''}`} data-stream={row.stream}>
            <div className='stream-row-name'>
                <span className='stream-row-title'>
                    {row.name}
                    {row.loading ? <span className='stream-row-loader'><PuffLoader color='#228B22' size={3} speedMultiplier='0.5' /></span> : null}
                </span>
                <span className='stream-row-schedule'>{row.schedule}</span>
                <span className='stream-row-inline'>{inline}</span>
            </div>
            <div className='stream-row-controls'>{row.controls}</div>
            <div className={`stream-row-bars${row.bars.length > 30 ? ' stream-row-bars-dense' : ''}`}>
                {row.bars.map((bar) => {
                    const look = barLook(bar, peak);
                    const title = `${row.name}, ${barWhen(bar.start, rate)}`;
                    const summary = barSummary(bar);

                    return (
                        <span
                            key={bar.start.valueOf()}
                            className='stream-bar-slot'
                            role='img'
                            aria-label={`${title}: ${summary}`}
                            onMouseEnter={() => onPoint({ title, summary })}
                            onClick={() => onPoint({ title, summary })}
                        >
                            <span className={look.className} style={look.style} />
                        </span>
                    );
                })}
            </div>
            {COLUMNS.map((column) => (
                <div key={column.key} className='stream-row-figure'>{row.figures[column.key]}</div>
            ))}
        </div>
    );
}

StreamRow.propTypes = {
    row: PropTypes.object.isRequired,
    rate: PropTypes.string.isRequired,
    onPoint: PropTypes.func.isRequired,
};

//
// a figure to sort by: the number in it, or below every number when it has
// none ('n/a'), whichever way the column is sorted
//
function sortValue(figure) {
    const value = parseFloat(String(figure).replace(/,/g, ''));

    return Number.isFinite(value) ? value : null;
}

function StreamRows({ rows, rate, first, last }) {
    const [sort, setSort] = useState({ key: null, dir: 'desc' });
    const [pointed, setPointed] = useState(null);

    const ordered = sort.key
        ? [...rows].sort((a, b) => {
            const x = sortValue(a.figures[sort.key]);
            const y = sortValue(b.figures[sort.key]);

            if (x === null || y === null) {
                return (x === null) - (y === null);
            }

            return sort.dir === 'asc' ? x - y : y - x;
        })
        : rows;

    return (
        <div className='stream-rows'>
            <div className='stream-rows-head'>
                <span className='stream-rows-head-name'>Stream</span>
                <span className='stream-rows-axis'>
                    <span>{first}</span>
                    <span>{last}</span>
                </span>
                {COLUMNS.map((column) => (
                    <button
                        key={column.key}
                        type='button'
                        className='stream-rows-sort'
                        aria-label={`Sort by ${column.label}`}
                        aria-pressed={sort.key === column.key}
                        onClick={() => setSort({
                            key: column.key,
                            dir: sort.key === column.key && sort.dir === 'desc' ? 'asc' : 'desc',
                        })}
                    >
                        {column.label}
                        <span className='stream-rows-sort-arrow' aria-hidden='true'>
                            {sort.key === column.key ? (sort.dir === 'desc' ? '↓' : '↑') : ''}
                        </span>
                    </button>
                ))}
            </div>

            {ordered.map((row) => (
                <StreamRow key={row.stream} row={row} rate={rate} onPoint={setPointed} />
            ))}

            <div className='stream-rows-readout' aria-live='polite'>
                {pointed
                    ? (<><strong>{pointed.title}</strong><span>{pointed.summary}</span></>)
                    : (<span>Point at a bar, or tap it, to see what it holds.</span>)}
            </div>

            <div className='stream-rows-legend'>
                <span className='stream-rows-legend-title'>
                    Height: records that succeeded, on each row&apos;s own scale. Shade: the share that did.
                </span>
                {HEALTH_BANDS.map((band, index) => (
                    <span key={band.label} className='stream-rows-key'>
                        <span className={`stream-rows-swatch stream-health-${index}`} />
                        {band.label}
                    </span>
                ))}
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

StreamRows.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.shape({
        stream: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        schedule: PropTypes.string,
        loading: PropTypes.bool,
        current: PropTypes.bool,
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
};

export default StreamRows;
