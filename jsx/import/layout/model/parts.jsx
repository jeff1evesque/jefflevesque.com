/**
 * parts.jsx: what both model pages draw alike (#243): the score picker, a model's
 * status, its bell (#255), the marks a legend and a panel share, the panel under a
 * chart that holds a day's numbers (#251), and the table every chart can be read
 * as instead.
 *
 * Note: a series' color is only ever a mark's -- a line, a dot, a bar or a swatch
 *       -- and the words beside it are the page's own text. A name written in its
 *       series' color is a name some readers cannot read.
 */

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Tooltip from '@mui/material/Tooltip';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { BASELINE_DASH, SCORES, SCORING_OPACITY, statusOf, statusLabel } from './scores.js';
import { readLayout, writeLayout } from '../../general/layout-preference.js';

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
 * the names of the models whose alarms the reader holds (#255), from their
 * subscriptions as listSubscriptions answers them: none for null, which is a
 * reader signed out. A stream's subscription names no model, and is passed over.
 */
export function modelsHeld(subscriptions) {
    return Array.isArray(subscriptions)
        ? subscriptions.filter((held) => held && typeof held.model === 'string').map((held) => held.model)
        : [];
}

/**
 * a model's bell (#255), as /stream draws a stream's: a link to its alarm page,
 * ringing and green for a reader who holds its alarm, with "Subscribed" under the
 * pointer, and plain for anyone else. A retired model has none: it is no longer
 * trained, and can't go live again.
 *
 * Note: drawn with the stream bell's classes, so its grays and greens are that
 *       bell's -- see '.control-tray' in '_article.scss' -- and '_model.scss'
 *       draws only the round button about it.
 */
export function AlarmBell({ model, held }) {
    if (statusOf(model) === 'retired') {
        return null;
    }

    return (
        <div className='control-tray model-bell'>
            <Link
                className='border-circle-radius control-button'
                to={`/model/${encodeURIComponent(model.name)}/alarm`}
                aria-label={held ? `Alarm for ${model.name}: subscribed` : `Alarm for ${model.name}`}
            >
                {held
                    ? (
                        <Tooltip title='Subscribed'>
                            <NotificationsActiveIcon className='control-icon notification subscribed' />
                        </Tooltip>
                    ) : <NotificationsIcon className='control-icon notification' />}
            </Link>
        </div>
    );
}

AlarmBell.propTypes = {
    model: PropTypes.shape({
        name: PropTypes.string.isRequired,
        retired: PropTypes.string,
        scored_days: PropTypes.number.isRequired,
    }).isRequired,
    held: PropTypes.bool,
};

/**
 * one mark, as a legend or a panel draws it beside its words -- the same shape,
 * size and stroke as the chart draws it, so the two look alike:
 *
 *     line      a line, as a 20-day average or the live version is drawn
 *     dashed    the know-nothing baseline's dashed line
 *     dot       a filled dot: a nightly attempt that went live
 *     ring      a hollow dot: a nightly attempt kept back
 *     diamond   a filled diamond: a weekly retrain that went live
 *     hollow    a hollow diamond: a weekly retrain kept back
 *     faint     a faint dot: a single day of a track record
 *     bar       better or worse than the live version, or an attempt's training
 *     fade      the lighter top of an attempt's bar: its scoring
 *     stack     a whole attempt's bar: its training, with its scoring as a
 *               lighter top
 *     tick      a short upright line: a night a new version went live
 */
export function Mark({ kind, color }) {
    const diamond = (size) => `${8},${6 - size} ${8 + size},${6} ${8},${6 + size} ${8 - size},${6}`;
    const shapes = {
        line: <line x1='1' y1='6' x2='15' y2='6' stroke={color} strokeWidth='2' strokeLinecap='round' />,
        dashed: <line x1='1' y1='6' x2='15' y2='6' stroke={color} strokeWidth='2' strokeDasharray={BASELINE_DASH} />,
        dot: <circle cx='8' cy='6' r='4.5' fill={color} />,
        ring: <circle cx='8' cy='6' r='3.5' fill='none' stroke={color} strokeWidth='2' />,
        diamond: <polygon points={diamond(6.5)} fill={color} />,
        hollow: <polygon points={diamond(5.5)} fill='none' stroke={color} strokeWidth='2' />,
        faint: <circle cx='8' cy='6' r='4' fill={color} fillOpacity='0.25' />,
        bar: <rect x='4' y='1' width='8' height='10' rx='2' fill={color} />,
        fade: <rect x='4' y='1' width='8' height='10' rx='2' fill={color} fillOpacity={SCORING_OPACITY} />,
        stack: (
            <g>
                <rect x='4' y='0' width='8' height='12' rx='2' fill={color} fillOpacity={SCORING_OPACITY} />
                <rect x='4' y='4' width='8' height='8' fill={color} />
            </g>
        ),
        tick: <line x1='8' y1='2' x2='8' y2='11' stroke={color} strokeWidth='2' strokeLinecap='round' />,
    };

    return (
        <svg className='model-mark' width='16' height='12' viewBox='0 0 16 12' aria-hidden='true'>
            {shapes[kind]}
        </svg>
    );
}

Mark.propTypes = {
    kind: PropTypes.oneOf(['line', 'dashed', 'dot', 'ring', 'diamond', 'hollow', 'faint', 'bar', 'fade', 'stack', 'tick']).isRequired,
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

//
// the width the model pages lay out for a phone at -- see '_model.scss'
//
const PHONE = '(max-width: 767.98px)';

/**
 * whether the page is laid out for a phone now. Guarded, as stream.jsx's and
 * graph.jsx's readings of the width are: jsdom has no matchMedia, and reads as
 * a wide screen.
 */
export function isPhone() {
    return typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches;
}

/**
 * whether the page is laid out for a phone, followed as the window turns or is
 * resized past the width.
 */
export function usePhone() {
    const [phone, setPhone] = useState(isPhone);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const query = window.matchMedia(PHONE);
        const change = (event) => setPhone(event.matches);

        query.addEventListener('change', change);

        return () => query.removeEventListener('change', change);
    }, []);

    return phone;
}

/**
 * the day a chart's panel shows, and the chart's events that choose it (#251).
 *
 * On a wide screen, the day pointed at, and the latest day, `latest`, until the
 * reader points at one. It is kept when the pointer leaves, so the panel stays
 * where it is and nothing on the page moves under the pointer. On a phone, the
 * day tapped, and none before a tap: a second tap on the same day closes it.
 *
 * Charts that share their days -- the attempts' three -- share one hook: on a
 * wide screen they follow one day, pointed at on any of them, and on a phone
 * only the chart tapped, named by `chart`, opens its panel.
 *
 *     events(chart)   the props a recharts chart takes: onMouseMove, or onClick
 *     dayFor(chart)   the day its panel shows, or null for none
 */
export function usePanelDay(latest) {
    const phone = usePhone();
    const [pointed, setPointed] = useState(null);
    const [tapped, setTapped] = useState(null);
    const dayOf = (state) => (state && state.activeLabel) || null;

    const events = (chart = null) => (phone
        ? {
            onClick: (state) => {
                const day = dayOf(state);

                if (day) {
                    setTapped(tapped && tapped.chart === chart && tapped.day === day ? null : { chart: chart, day: day });
                }
            },
        } : {
            onMouseMove: (state) => {
                const day = dayOf(state);

                if (day && day !== pointed) {
                    setPointed(day);
                }
            },
        });

    const dayFor = (chart = null) => {
        if (phone) {
            return tapped && tapped.chart === chart ? tapped.day : null;
        }

        return pointed || latest;
    };

    return { phone: phone, events: events, dayFor: dayFor };
}

/**
 * which of a page's sections the reader has folded, kept between visits as
 * every other page keeps how it was arranged -- see layout-preference.js -- and
 * apart on a phone and a wide screen, as /graph keeps its columns.
 *
 * `toggle(name)` folds or opens one. It reads what is stored before it writes,
 * so two parts of a page keeping folds under one `surface` -- the model page's
 * two cards -- do not write over each other's.
 */
export function useFolds(surface) {
    const variant = isPhone() ? 'narrow' : 'wide';
    const [folds, setFolds] = useState(() => readLayout(surface, variant).fold);

    const toggle = (name) => {
        const stored = readLayout(surface, variant);
        const next = { ...stored.fold, [name]: !folds[name] };

        writeLayout(surface, variant, { fold: next, size: stored.size });
        setFolds({ ...folds, [name]: next[name] });
    };

    return [folds, toggle];
}

/**
 * a section's title, which folds the section away and opens it again: a
 * chevron before the words, pointing down while it is open and right while it
 * is folded, as /graph's columns' headings do.
 *
 * The button is inside the heading rather than in place of it, so a folded
 * section is still in the page's outline -- see graph.jsx's panel.
 */
export function FoldTitle({ as: Heading = 'h6', id = undefined, className = '', title, folded, onFold }) {
    return (
        <Heading id={id} className={`model-fold-title${className ? ` ${className}` : ''}`}>
            <button type='button' className='model-fold' aria-expanded={!folded} onClick={onFold}>
                {title}
            </button>
        </Heading>
    );
}

FoldTitle.propTypes = {
    as: PropTypes.string,
    id: PropTypes.string,
    className: PropTypes.string,
    title: PropTypes.node.isRequired,
    folded: PropTypes.bool.isRequired,
    onFold: PropTypes.func.isRequired,
};

/**
 * a chart's tooltip, which draws no box -- the panel under the chart holds the
 * numbers -- and leaves recharts to draw only the band or line that marks the
 * day pointed at.
 */
export function NoBox() {
    return null;
}

/**
 * a night's numbers under its chart rather than in a box over it, where a box
 * as wide as a phone's screen covered what it was about: a panel of rows on a
 * phone, and on a wide screen, `line`, one slim line across the chart.
 */
export function Readout({ tip, line = false }) {
    return tip
        ? <div className={`model-readout${line ? ' model-readout-line' : ''}`}><TipBox {...tip} /></div>
        : null;
}

Readout.propTypes = {
    tip: PropTypes.object,
    line: PropTypes.bool,
};

/**
 * what a panel says of a day: its title, a row for each thing drawn on it with
 * its mark, and a note under them. Laid out as rows on a phone and as one line
 * on a wide screen -- see Readout, which places it under its chart.
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
