/**
 * parts.jsx: what both model pages draw alike (#243): the score picker, a model's
 * status, the marks a legend and a tooltip share, the box a chart's tooltip is
 * drawn in, and the table every chart can be read as instead.
 *
 * Note: a series' color is only ever a mark's -- a line, a dot, a bar or a swatch
 *       -- and the words beside it are the page's own text. A name written in its
 *       series' color is a name some readers cannot read.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { SCORES, statusOf, statusLabel } from './scores.js';

/**
 * the four scores, as buttons where there is room for them and a menu on a
 * phone, as /stream's rates are. Every chart on the page, and the list's
 * figures, follow the one picked.
 */
export function ScorePicker({ score, onScore }) {
    return (
        <div className='model-scores'>
            <span className='model-control-label' aria-hidden='true'>Score</span>
            <div className='model-score-buttons' role='group' aria-label='Score'>
                {SCORES.map((each) => (
                    <button
                        key={each.key}
                        type='button'
                        className='model-score'
                        aria-pressed={each.key === score}
                        onClick={() => onScore(each.key)}
                    >
                        {each.label}
                    </button>
                ))}
            </div>
            <label className='model-score-menu'>
                <span className='visually-hidden'>Score</span>
                <select value={score} onChange={(event) => onScore(event.target.value)}>
                    {SCORES.map((each) => (
                        <option key={each.key} value={each.key}>{each.label}</option>
                    ))}
                </select>
            </label>
        </div>
    );
}

ScorePicker.propTypes = {
    score: PropTypes.string.isRequired,
    onScore: PropTypes.func.isRequired,
};

/**
 * a model's status: Live, New with its days so far, or Retired.
 */
export function StatusPill({ model }) {
    return (
        <span className={`model-pill model-pill-${statusOf(model)}`}>
            <span className='model-pill-dot' aria-hidden='true' />
            {statusLabel(model)}
        </span>
    );
}

StatusPill.propTypes = {
    model: PropTypes.shape({
        retired: PropTypes.string,
        scored_days: PropTypes.number.isRequired,
    }).isRequired,
};

/**
 * one mark, as a legend or a tooltip draws it beside its words:
 *
 *     line      a line, as a 20-day average or the live version is drawn
 *     dot       a filled dot: an attempt that went live
 *     ring      a hollow dot: an attempt kept back
 *     diamond   a weekly retrain
 *     faint     a faint dot: a single day of a track record
 *     bar       better or worse than the live version
 *     tick      a short upright line: a night a new version went live
 */
export function Mark({ kind, color }) {
    const shapes = {
        line: <line x1='1' y1='6' x2='15' y2='6' stroke={color} strokeWidth='2' strokeLinecap='round' />,
        dot: <circle cx='8' cy='6' r='4.5' fill={color} />,
        ring: <circle cx='8' cy='6' r='3.5' fill='none' stroke={color} strokeWidth='2' />,
        diamond: <polygon points='8,1 13,6 8,11 3,6' fill='none' stroke={color} strokeWidth='1.5' />,
        faint: <circle cx='8' cy='6' r='4' fill={color} fillOpacity='0.25' />,
        bar: <rect x='4' y='1' width='8' height='10' rx='2' fill={color} />,
        tick: <line x1='8' y1='2' x2='8' y2='11' stroke={color} strokeWidth='2' strokeLinecap='round' />,
    };

    return (
        <svg className='model-mark' width='16' height='12' viewBox='0 0 16 12' aria-hidden='true'>
            {shapes[kind]}
        </svg>
    );
}

Mark.propTypes = {
    kind: PropTypes.oneOf(['line', 'dot', 'ring', 'diamond', 'faint', 'bar', 'tick']).isRequired,
    color: PropTypes.string.isRequired,
};

/**
 * a chart's legend: each mark, and what it stands for.
 */
export function Legend({ items, label = 'Legend' }) {
    return (
        <ul className='model-legend' aria-label={label}>
            {items.map((item) => (
                <li key={item.key}>
                    <Mark kind={item.kind} color={item.color} />
                    <span>{item.label}</span>
                </li>
            ))}
        </ul>
    );
}

Legend.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        kind: PropTypes.string.isRequired,
        color: PropTypes.string.isRequired,
        label: PropTypes.node.isRequired,
    })).isRequired,
    label: PropTypes.string,
};

/**
 * the box a chart's tooltip is drawn in: the day, a line for each thing drawn on
 * it with its mark, and a note under them. In the colors of every other tooltip
 * on the site -- see theme-mode.jsx -- which mui draws and these charts do not.
 */
export function TipBox({ title, rows, foot = null }) {
    return (
        <div className='model-tip'>
            <div className='model-tip-title'>{title}</div>
            {rows.map((row) => (
                <div key={row.key} className='model-tip-row'>
                    {row.mark}
                    <span className='model-tip-name'>{row.name}</span>
                    <span className='model-tip-value'>{row.value}</span>
                </div>
            ))}
            {foot ? <div className='model-tip-foot'>{foot}</div> : null}
        </div>
    );
}

TipBox.propTypes = {
    title: PropTypes.node.isRequired,
    rows: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        mark: PropTypes.node,
        name: PropTypes.node.isRequired,
        value: PropTypes.node,
    })).isRequired,
    foot: PropTypes.node,
};

/**
 * a chart as a table, folded under a button until it is asked for: every value
 * the chart draws, the newest day first.
 *
 * `columns` are { key, label, text }, `text` for a column of words, which reads
 * from the left where a number reads from the right. `rows` are keyed by the
 * columns' keys, each with a `key` of its own.
 */
export function Numbers({ label, columns, rows }) {
    const [open, setOpen] = useState(false);

    return (
        <div className='model-numbers'>
            <button
                type='button'
                className='model-numbers-toggle'
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                {open ? 'Hide the numbers' : 'Show the numbers'}
            </button>
            {open
                ? (
                    <div className='model-numbers-table'>
                        <table aria-label={label}>
                            <thead>
                                <tr>
                                    {columns.map((column) => (
                                        <th key={column.key} scope='col' className={column.text ? 'model-numbers-text' : null}>
                                            {column.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.key}>
                                        {columns.map((column) => (
                                            <td key={column.key} className={column.text ? 'model-numbers-text' : null}>
                                                {row[column.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
        </div>
    );
}

Numbers.propTypes = {
    label: PropTypes.string.isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.node.isRequired,
        text: PropTypes.bool,
    })).isRequired,
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/**
 * what an axis of these charts is drawn in: the page's grid and muted gray,
 * and no ticks standing off it.
 */
export function axisStyle(colors) {
    return {
        stroke: colors.grid,
        tick: { fill: colors.muted, fontSize: 12 },
        tickLine: false,
    };
}
