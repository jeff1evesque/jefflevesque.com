/**
 * parts.jsx: what both model pages draw alike (#243): the score picker, the hold
 * picker of an options model (#279) and from format 5 a stock model (#300), with
 * a note on its name (#311), how a score stands against the baseline's, a model's
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
import {
    BASELINE_DASH,
    COMBINED,
    DEFAULT_SCORE,
    HOLDS,
    SCORES,
    SCORING_OPACITY,
    betterBy,
    formatGap,
    formatScore,
    scoreOf,
    standing,
    statusOf,
    statusLabel,
} from './scores.js';
import { readLayout, writeLayout } from '../../general/layout-preference.js';
import InfoNote from '../../general/info-note.jsx';

//
// a choice of a few, as buttons where there is room for them and a menu on a
// phone, as /stream's rates are: `choices` are { key, label }, and `name` says
// what is chosen, over the buttons and to a screen reader. A choice `disabled`
// is offered and cannot be chosen, in either: Combined's top 10 (#300).
//
// With a `note`, the name has the info icon after it, whose note says what it
// means (#311), as a score's name does. A screen reader reads that name too,
// since the icon is focusable, and a hidden name cannot hold it
//
function Choices({ className, name, choices, chosen, onChoose, disabled = [], note = null }) {
    return (
        <div className={className}>
            {note
                ? <InfoNote note={note} className='model-control-label model-noted'>{name}</InfoNote>
                : <span className='model-control-label' aria-hidden='true'>{name}</span>}
            <div className='model-score-buttons' role='group' aria-label={name}>
                {choices.map((each) => (
                    <button
                        key={each.key}
                        type='button'
                        className='model-score'
                        aria-pressed={each.key === chosen}
                        disabled={disabled.includes(each.key)}
                        onClick={() => onChoose(each.key)}
                    >
                        {each.label}
                    </button>
                ))}
            </div>
            <label className='model-score-menu'>
                <span className='visually-hidden'>{name}</span>
                <select value={chosen} onChange={(event) => onChoose(event.target.value)}>
                    {choices.map((each) => (
                        <option key={each.key} value={each.key} disabled={disabled.includes(each.key)}>{each.label}</option>
                    ))}
                </select>
            </label>
        </div>
    );
}

Choices.propTypes = {
    className: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    choices: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
    })).isRequired,
    chosen: PropTypes.string.isRequired,
    onChoose: PropTypes.func.isRequired,
    disabled: PropTypes.arrayOf(PropTypes.string),
    note: PropTypes.string,
};

/**
 * a task's scores, `offered` -- see scores.js's scoresFor (#279) -- the four
 * stock scores unless it says otherwise. Every chart on the page, and the
 * list's figures, follow the one picked. Those `disabled` are offered and
 * cannot be picked: the top 10's on Combined, which has none (#300) -- see
 * scores.js's heldOut.
 */
export function ScorePicker({ score, onScore, offered = SCORES.map((each) => each.key), disabled = [] }) {
    return (
        <Choices
            className='model-scores'
            name='Score'
            choices={offered.map((key) => ({ key: key, label: scoreOf(key).label }))}
            chosen={score}
            onChoose={onScore}
            disabled={disabled}
        />
    );
}

ScorePicker.propTypes = {
    score: PropTypes.string.isRequired,
    onScore: PropTypes.func.isRequired,
    offered: PropTypes.arrayOf(PropTypes.string),
    disabled: PropTypes.arrayOf(PropTypes.string),
};

/**
 * how long a model's picks are held, beside the score picker (#279): the holds
 * it has, `holds` -- see scores.js's holdsOf and listedHolds -- an options
 * model's three, and from format 5 a stock model's and Combined (#300). It
 * hands a hold up as its number of days, or as COMBINED. Those `disabled` have
 * no result yet, and are offered grayed out until one comes in (#300) -- see
 * scores.js's emptyHolds. With a `note`, its name has the info icon after it
 * (#311) -- see scores.js's holdNote.
 */
export function HoldPicker({ hold, onHold, holds = HOLDS, disabled = [], note = null }) {
    return (
        <Choices
            className='model-scores model-holds'
            name='Hold'
            choices={holds.map((each) => ({ key: String(each.days), label: each.label }))}
            chosen={String(hold)}
            onChoose={(key) => onHold(key === COMBINED ? COMBINED : Number(key))}
            disabled={disabled.map(String)}
            note={note}
        />
    );
}

HoldPicker.propTypes = {
    hold: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])]).isRequired,
    onHold: PropTypes.func.isRequired,
    holds: PropTypes.arrayOf(PropTypes.shape({
        days: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])]).isRequired,
        label: PropTypes.string.isRequired,
    })),
    disabled: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])])),
    note: PropTypes.string,
};

/**
 * how far a score is from the baseline's, and which way, after the arrow every
 * "better" and "worse" carries, on /model's list (#274) and from #300 on a
 * model's page too: '▲ 0.034 better than baseline'. Only the arrow takes the
 * color of better or worse, from the class of what holds it, 'model-gap-better'
 * or 'model-gap-worse' -- see '.model-gap-arrow' in '_model.scss' -- and the
 * words keep the page's grays.
 *
 * `than` follows the word, and is left off where the gaps stand side by side,
 * '▼ 0.013 worse'; `level` is said where the two print alike. Nothing where
 * there is no gap.
 */
export function gapWords(gap, key, than = ' than baseline', level = 'level with baseline') {
    const stands = standing(gap, key);

    if (gap === null) {
        return '';
    }

    if (stands === 'level') {
        return level;
    }

    return (
        <>
            <span className='model-gap-arrow'>{stands === 'better' ? '▲' : '▼'}</span>
            {` ${formatGap(gap, key)} ${stands}${than}`}
        </>
    );
}

/**
 * how a part of loss stands against the baseline's, in fewer words than the
 * score's own line, since the parts stand one over another on a model's page and
 * side by side on /model (#300): '▼ 0.013 worse', or 'level'. Compared as the
 * two are printed, as scores.js's lossParts compares them.
 */
export function partGap(part) {
    const printed = (value) => Number(formatScore(value, DEFAULT_SCORE));

    return gapWords(betterBy(printed(part.value), printed(part.baseline), DEFAULT_SCORE), DEFAULT_SCORE, '', 'level');
}

/**
 * a model's status: Live, New with how far it is through the days it needs,
 * 'New · day 5 of 20' (#293), Behind baseline while its live version is down
 * (#263), or Retired.
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
        average_days: PropTypes.number,
        down: PropTypes.object,
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

//
// how much of its color a single day's dot takes on a track record, and in the
// legend beside it: light enough that the average's line reads over it (#300)
//
export const FAINT_OPACITY = 0.45;

/**
 * one mark, as a legend or a panel draws it beside its words -- the same shape,
 * size and stroke as the chart draws it, so the two look alike:
 *
 *     line      a line, as an average or the live version is drawn
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
 *     band      a light block: the newest days whose result on a hold is not
 *               in yet (#300)
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
        faint: <circle cx='8' cy='6' r='4' fill={color} fillOpacity={FAINT_OPACITY} />,
        bar: <rect x='4' y='1' width='8' height='10' rx='2' fill={color} />,
        fade: <rect x='4' y='1' width='8' height='10' rx='2' fill={color} fillOpacity={SCORING_OPACITY} />,
        stack: (
            <g>
                <rect x='4' y='0' width='8' height='12' rx='2' fill={color} fillOpacity={SCORING_OPACITY} />
                <rect x='4' y='4' width='8' height='8' fill={color} />
            </g>
        ),
        tick: <line x1='8' y1='2' x2='8' y2='11' stroke={color} strokeWidth='2' strokeLinecap='round' />,
        band: <rect x='1' y='0' width='14' height='12' rx='2' fill={color} fillOpacity='0.12' />,
    };

    return (
        <svg className='model-mark' width='16' height='12' viewBox='0 0 16 12' aria-hidden='true'>
            {shapes[kind]}
        </svg>
    );
}

Mark.propTypes = {
    kind: PropTypes.oneOf(['line', 'dashed', 'dot', 'ring', 'diamond', 'hollow', 'faint', 'bar', 'fade', 'stack', 'tick', 'band']).isRequired,
    color: PropTypes.string.isRequired,
};

/**
 * a chart's legend: each mark, and what it stands for, and after them in gray,
 * `note`, which way the chart's axis runs (#300).
 */
export function Legend({ items, label = 'Legend', note = null }) {
    return (
        <ul className='model-legend' aria-label={label}>
            {items.map((item) => (
                <li key={item.key}>
                    <Mark kind={item.kind} color={item.color} />
                    <span>{item.label}</span>
                </li>
            ))}
            {note ? <li className='model-legend-note'>{note}</li> : null}
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
    note: PropTypes.string,
};

/**
 * which way a chart's axis runs, as its legend's note says it (#300): flipped for
 * a score where lower is better, so better is up on every chart.
 */
export function axisNote(score) {
    return scoreOf(score).lower ? 'Lower is better, so the axis is flipped: better is up.' : 'Higher is better.';
}

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
 * which of a card's charts shows its popup of a day's numbers, and for which day
 * (#300), in place of a panel under the charts, which a reader on a phone did not
 * know was there:
 *
 *     a computer    the chart under the pointer, for the day recharts hands its
 *                   tooltip as the pointer moves, and none once it leaves
 *     a phone       the chart and the day tapped: a second tap on the same day
 *                   closes it, as does a tap anywhere off the chart
 *
 * Charts that share their days -- the attempts' three -- share one hook, so one
 * chart's popup shows at a time, though recharts moves the others' to the day.
 *
 *     events(chart)        the props a recharts chart takes
 *     tooltip(chart)       the props its tooltip takes, a tap's on a phone
 *     dayFor(chart, day)   the day its popup shows, or null for none, `day` being
 *                          the one recharts hands it
 *     away(chart)          what closes a phone's popup for a tap off the chart
 */
export function usePopup() {
    const phone = usePhone();
    const [hovered, setHovered] = useState(null);
    const [tapped, setTapped] = useState(null);
    const opens = (chart) => Boolean(tapped && tapped.chart === chart);

    const events = (chart) => (phone
        ? {
            onClick: (state) => {
                const day = (state && state.activeLabel) || null;

                if (day) {
                    setTapped(opens(chart) && tapped.day === day ? null : { chart: chart, day: day });
                }
            },
        } : {
            onMouseMove: () => {
                if (hovered !== chart) {
                    setHovered(chart);
                }
            },
            onMouseLeave: () => setHovered(null),
        });

    const tooltip = (chart) => (phone ? { trigger: 'click', active: opens(chart) } : {});

    const dayFor = (chart, day) => {
        if (phone) {
            return opens(chart) ? tapped.day : null;
        }

        return hovered === chart ? day || null : null;
    };

    //
    // a tap off the chart closes its popup -- but not one a tap on another chart
    // has just opened, in the same click: the first chart's tap off it is heard
    // after the second chart's tap on it
    //
    const away = (chart) => () => {
        if (opens(chart)) {
            setTapped((current) => (current && current.chart === chart ? null : current));
        }
    };

    return { phone: phone, events: events, tooltip: tooltip, dayFor: dayFor, away: away };
}

/**
 * what a chart's tooltip draws (#300): the popup of `tip(day)`, a TipBox -- see
 * below -- for the day `popup` gives the chart named `chart`, and nothing for any
 * other, so only the chart pointed at or tapped shows one.
 */
export function popupOf(popup, chart, tip) {
    return function Popup({ active, label }) {
        const box = active || popup.phone ? tip(popup.dayFor(chart, label)) : null;

        return box ? <TipBox {...box} className='model-chart-tip' /> : null;
    };
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
 * what a panel or a popup says of a day: its title, a row for each thing drawn
 * on it with its mark, and a note under them. Laid out as rows on a phone and as
 * one line on a wide screen under a chart -- see Readout -- and as rows in a
 * chart's popup, `className` 'model-chart-tip' (#300) -- see popupOf.
 */
export function TipBox({ title, rows, foot = null, className = '' }) {
    return (
        <div className={`model-tip${className ? ` ${className}` : ''}`}>
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
    className: PropTypes.string,
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
 * how far apart the days a chart's axis names stand, in px: further on a phone
 * (#300), so a narrow chart names fewer of them and none runs into the next.
 */
export function tickGap(phone) {
    return phone ? 40 : 24;
}

/**
 * a chart's values' axis (#300): on a wide screen a 56px gutter at the chart's
 * left, wide enough for 'better' and '8 min', in the axes' own style; on a phone
 * its values inside the plot instead, over its gridlines' left ends, each on a
 * halo of the page's color so a mark under it does not hide it. A gutter set a
 * phone's chart well in from its small card's edge, 56px and then 40px of 330px.
 */
export function valueAxis(phone, colors) {
    if (!phone) {
        return { width: 56, ...axisStyle(colors) };
    }

    return {
        ...axisStyle(colors),
        width: 56,
        mirror: true,
        tickMargin: 2,
        tick: { fill: colors.muted, fontSize: 11, stroke: colors.page, strokeWidth: 3, paintOrder: 'stroke' },
    };
}

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
