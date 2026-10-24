/**
 * model-row.jsx: one model in /model's list (#243): a box to tick it for the
 * comparison, its name, status, address and description, its bell, which leads to
 * its alarm page (#255), when its live version went live, how many of its nightly
 * attempts did, a trend line of its score, and last its latest score, over the
 * listing's `average_days` (#293), against the know-nothing baseline -- or, in a
 * list that shows them, loss's three
 * parts in place of it (#283). A retired model has no bell. A model whose live
 * version the trainer took down says when, and why -- which check did it, or from
 * format 4 that it went live without beating the baseline, or its track record
 * showed nothing better (#295) -- in place of when it went live (#263). An options
 * model still trained, and not taken down, has a link to its picks page under its
 * description, for every reader: signed out, the page asks them to sign in, so a
 * visitor learns the picks are there without seeing any (#290). One taken down
 * has none: its last picks are still on file, and they are not this night's (#295).
 *
 * The bell comes after the name, as a stream's comes after the stream's name on
 * /stream, so the two pages put it on one side (#259). The score comes last, as it
 * does on a phone's card, so changing it moves nothing else (#283).
 *
 * A row across a wide screen, under the list's headings, and a card on a phone,
 * where each figure carries its own name instead -- see '_model.scss'. There the
 * score's name carries a note on what the score measures, as the heading over
 * its column does on a wide screen (#265). From #300 a phone's card is its name
 * and status, its description, its score, the trend line across the card, and a
 * line of when its live version went live and how many attempts did.
 *
 * From format 5 each list has a hold picker (#300), and a row's score, how it
 * stands, its days, its trend line and loss's parts are on the hold picked: the
 * listing's scores on it, and the track record's columns of it.
 *
 * Note: the trend line is drawn on the axis the list hands every row: the last
 *       60 days any model was scored on. A model that started a fortnight ago
 *       draws a fortnight at the right of it, and one retired before them draws
 *       nothing, so every row's line lines up with the row above it.
 */

import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { LineChart, Line, Tooltip as ChartTip, XAxis, YAxis } from 'recharts';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Tooltip from '@mui/material/Tooltip';
import { isMobile } from 'react-device-detect';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import InfoNote from '../../general/info-note.jsx';
import { AlarmBell, Mark, StatusPill, gapWords, usePhone } from './parts.jsx';
import { PendingBar } from '../graph/pending.jsx';
import {
    COMBINED,
    COMPARE_COLORS,
    DEFAULT_SCORE,
    LOSS_PARTS,
    TREND_DAYS,
    WINDOW,
    averageDays,
    betterBy,
    chartColors,
    checkWords,
    columnOf,
    formatScore,
    holdsOf,
    liveKind,
    lossParts,
    namedHold,
    noteOf,
    scoreIn,
    scoreOf,
    scoresOn,
    shortDay,
    standing,
    statusOf,
    takenDown,
    tradesOptions,
} from './scores.js';

//
// the trend line's size, in px: as wide as its column, and about a row's text
// tall. A phone's card draws it across the card, as wide as that is (#300)
//
const TREND_WIDTH = 132;
const TREND_HEIGHT = 36;

//
// how far above the line's top the box of the day under the pointer stands, in
// px: its own height and a few more, so it clears the row's figures beside it
//
const TIP_ABOVE = -62;

//
// how wide the trend line is drawn, in px: TREND_WIDTH, or on a phone's card
// the width of the box it is drawn in, followed as the card is resized (#300).
// TREND_WIDTH wherever the box cannot be measured, as under jsdom.
//
// The box is kept by a ref callback rather than a ref object: it is drawn only
// once the track record is in, after the line's placeholder, and an effect
// keyed on a ref object would have measured nothing and never looked again
//
function useTrendWidth(phone) {
    const [box, setBox] = useState(null);
    const [width, setWidth] = useState(TREND_WIDTH);

    useEffect(() => {
        if (!phone || !box || typeof window.ResizeObserver !== 'function') {
            setWidth(TREND_WIDTH);

            return undefined;
        }

        const observer = new window.ResizeObserver(([entry]) => {
            setWidth(Math.max(TREND_WIDTH, Math.floor(entry.contentRect.width)));
        });

        observer.observe(box);

        return () => observer.disconnect();
    }, [phone, box]);

    return [setBox, width];
}

/**
 * a model's average score over the days on `axis`, beside the baseline's: each
 * day's average of its last `days` scored days, the listing's `average_days`
 * (#293). On a `hold` (#300), the hold's own averages, each day once its result
 * on the hold is in: the newest days of a longer hold have none yet.
 *
 * On a computer, the day under the pointer has a dot on each line and, over the
 * line, a small box of its numbers: the day, the score, and the baseline's
 * (#296), the score named with its hold (#300). A day the model has no score has
 * none. A phone has no pointer, so the box is for the day tapped (#300): a tap
 * on another day moves it, and one on the same day, or anywhere else, closes it.
 *
 * `rows` is the model's track record: undefined while it is on its way, null
 * where it could not be had.
 */
export function TrendLine({ name, rows, axis, score, days = WINDOW, hold = null }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const phone = usePhone();
    const [box, width] = useTrendWidth(phone);
    const [tapped, setTapped] = useState(null);

    if (rows === undefined) {
        return <span className='model-trend-pending' aria-label='Loading the trend' />;
    }

    //
    // the hold the line is on: the list's, where the record has its columns,
    // and the score's own otherwise, as one before format 5 has (#300)
    //
    const on = hold && holdsOf(rows).some((each) => each.days === hold) ? hold : null;
    const column = columnOf(score, on);
    const byDay = {};

    (rows || []).forEach((row) => {
        byDay[row.day] = row;
    });

    const data = axis.map((day) => {
        const row = byDay[day];
        const held = Boolean(row) && (!on || scoreIn(row.score, column) !== null);

        return {
            day: day,
            value: held ? scoreIn(row.average, column) : null,
            baseline: held ? scoreIn(row.baseline_average, column) : null,
        };
    });

    if (!data.some((point) => point.value !== null)) {
        return (
            <span className='model-trend-none' title={rows ? `Not scored in the last ${TREND_DAYS} days` : 'Could not be loaded'}>
                {'–'}
            </span>
        );
    }

    const label = `${scoreOf(score).label}${namedHold(on, true)}`;

    //
    // the box of the day under the pointer, or tapped, as the model page's
    // panels say a day, each number after its line's mark (#296)
    //
    const tip = ({ active, label: pointed }) => {
        const point = active ? data.find((each) => each.day === (isMobile ? tapped : pointed)) : null;

        if (!point || point.value === null) {
            return null;
        }

        return (
            <div className='model-tip model-trend-tip'>
                <div className='model-tip-title'>{shortDay(point.day)}</div>
                <div className='model-tip-row'>
                    <Mark kind='line' color={colors.muted} />
                    <span className='model-tip-name'>{label}</span>
                    <span className='model-tip-value'>{formatScore(point.value, score)}</span>
                </div>
                {point.baseline === null ? null : (
                    <div className='model-tip-row'>
                        <Mark kind='line' color={colors.grid} />
                        <span className='model-tip-name'>Baseline</span>
                        <span className='model-tip-value'>{formatScore(point.baseline, score)}</span>
                    </div>
                )}
            </div>
        );
    };

    //
    // a tap on a phone: the day tapped, where it has a score, and none for a
    // second tap on the same day. Recharts keeps its own day under the last
    // tap, so the dots and the box are shown only while one is tapped here
    //
    const tap = (state) => {
        const day = state && state.activeLabel;
        const point = data.find((each) => each.day === day);

        setTapped(point && point.value !== null && day !== tapped ? day : null);
    };

    const showing = !isMobile || Boolean(tapped);

    const chart = (
        <span
            ref={box}
            className='model-trend'
            role='img'
            aria-label={`${name}'s ${days}-day ${label}, over the last ${TREND_DAYS} days`}
        >
            <LineChart
                width={width}
                height={TREND_HEIGHT}
                data={data}
                margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                onClick={isMobile ? tap : undefined}
            >
                <XAxis dataKey='day' hide />
                <YAxis hide domain={['dataMin', 'dataMax']} reversed={scoreOf(score).lower} />
                <ChartTip
                    content={tip}
                    cursor={false}
                    isAnimationActive={false}
                    allowEscapeViewBox={{ x: true, y: true }}
                    position={{ y: TIP_ABOVE }}
                    wrapperStyle={{ zIndex: 10, pointerEvents: 'none' }}
                    {...(isMobile ? { trigger: 'click', active: showing } : {})}
                />
                <Line
                    dataKey='baseline'
                    stroke={colors.grid}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={showing ? { r: 2.5, fill: colors.grid, stroke: 'none' } : false}
                    isAnimationActive={false}
                />
                <Line
                    dataKey='value'
                    stroke={colors.muted}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={showing ? { r: 3, fill: colors.muted, stroke: 'none' } : false}
                    isAnimationActive={false}
                />
            </LineChart>
        </span>
    );

    //
    // on a phone, a tap anywhere off the line closes its box. Always about the
    // line there, so a tap does not draw the chart over again, and lose the day
    // recharts keeps for it
    //
    return isMobile
        ? <ClickAwayListener onClickAway={() => tapped && setTapped(null)}>{chart}</ClickAwayListener>
        : chart;
}

TrendLine.propTypes = {
    name: PropTypes.string.isRequired,
    rows: PropTypes.array,
    axis: PropTypes.arrayOf(PropTypes.string).isRequired,
    score: PropTypes.string.isRequired,
    //
    // how many scored days each day's average takes in: the listing's
    // `average_days` (#293)
    //
    days: PropTypes.number,
    //
    // the hold the list is on, where its task has holds (#300)
    //
    hold: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])]),
};

//
// what the score's figure is called on a phone's card, where there are no
// headings: over the last of the days its scores average (#293), before it
// retired for a retired one, and so far for one with fewer scored days than that
// -- a new model, or one taken down before it had them (#263). On a hold (#300),
// named with the hold, by the hold's own days
//
function scoreLabel(model, score, hold) {
    const on = scoresOn(model, hold);
    const label = `${scoreOf(score).label}${namedHold(on.hold, true)}`;
    const days = averageDays(model);

    if (on.hold && !on.days) {
        return `${label}, no scored days yet`;
    }

    if (statusOf(model) === 'retired') {
        return `${label}, last ${days} days before retiring`;
    }

    return on.days < days
        ? `${label}, ${on.days} ${on.days === 1 ? 'day' : 'days'} so far`
        : `${label}, last ${days} days`;
}

//
// the Live version cell's figure, and the line under it: when the live version
// went live and how, when a retired model retired, or when a model's live
// version was taken down and the check that did it (#263)
//
function liveCell(model, status) {
    if (status === 'retired') {
        return { figure: `Retired ${shortDay(model.retired)}`, detail: 'no longer trained' };
    }

    if (status === 'down') {
        return { figure: takenDown(model.down.since), detail: checkWords(model.down) };
    }

    return { figure: shortDay(model.live.since) || '–', detail: liveKind(model.live.kind) };
}

//
// the same two in a line at the foot of a phone's card (#300), with how many
// attempts went live: 'Live since Oct 9 · 4 of 30 attempts went live'
//
function sinceLine(model, status) {
    const went = `${model.attempts.went_live} of ${model.attempts.total} attempts went live`;
    const figure = {
        retired: () => `Retired ${shortDay(model.retired)}`,
        down: () => takenDown(model.down.since),
    }[status];

    if (figure) {
        return `${figure()} · ${went}`;
    }

    return model.live.since ? `Live since ${shortDay(model.live.since)} · ${went}` : went;
}

//
// how a part of loss stands against the baseline's, in fewer words than the
// score's own line, since the three stand side by side: '▼ 0.013 worse'.
// Compared as the two are printed, as lossParts compares them
//
function partGap(part) {
    const printed = (value) => Number(formatScore(value, DEFAULT_SCORE));

    return gapWords(betterBy(printed(part.value), printed(part.baseline), DEFAULT_SCORE), DEFAULT_SCORE, '', 'level');
}

/**
 * loss's three parts in place of its sum (#283): a cell each across a wide
 * screen, under one heading -- see model.jsx -- and on a phone's card, or in a
 * list too narrow for the three columns, a line each, naming its part. Each is
 * the part's average, and how it stands against the baseline's, from the
 * newest day of the model's track record, as its own page has them (#265), on
 * the hold the list is on (#300). Bars while the record is on its way, and
 * dashes where it could not be had or has no parts.
 */
export function PartCells({ model, rows, task = undefined, hold = undefined }) {
    const on = scoresOn(model, hold);
    const parts = Array.isArray(rows) && rows.length ? lossParts(rows[rows.length - 1], on.hold) : [];

    return (
        <div className='model-cell model-cell-parts'>
            <InfoNote note={noteOf(DEFAULT_SCORE, task, on.hold)} className='model-cell-label model-noted'>{scoreLabel(model, DEFAULT_SCORE, hold)}</InfoNote>
            <ul className='model-part-cells' aria-label='Loss, part by part'>
                {LOSS_PARTS.map((each) => {
                    const part = parts.find((one) => one.key === each.key);

                    return (
                        <li key={each.key} className='model-part-cell'>
                            <span className='model-part-cell-name'>{each.label}</span>
                            <span className='model-part-cell-value'>
                                {rows === undefined ? <PendingBar width='2.5rem' /> : formatScore(part ? part.value : null, DEFAULT_SCORE)}
                            </span>
                            <span className={`model-gap model-gap-${part && part.stands ? part.stands : 'level'}`}>
                                {part && part.stands ? partGap(part) : ''}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

PartCells.propTypes = {
    model: PropTypes.shape({
        retired: PropTypes.string,
        scored_days: PropTypes.number.isRequired,
    }).isRequired,
    //
    // the model's track record: undefined while it is on its way, null where it
    // could not be had
    //
    rows: PropTypes.array,
    task: PropTypes.shape({
        id: PropTypes.string.isRequired,
        scores: PropTypes.arrayOf(PropTypes.string),
    }),
    //
    // the hold the list is on, where its task has holds (#300)
    //
    hold: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])]),
};

function ModelRow({ model, score, rows, axis, picked, blocked, onPick, held = false, task = undefined, parts = false, hold = null }) {
    const status = statusOf(model);
    const live = liveCell(model, status);
    const on = scoresOn(model, hold);
    const value = scoreIn(on.score, score);
    const gap = betterBy(value, scoreIn(on.baseline, score), score);
    const ticked = picked !== null;
    const address = `/model/${encodeURIComponent(model.name)}`;

    //
    // the box, in a span so its tooltip still shows while it is disabled -- a
    // disabled input hears no pointer, and says why it cannot be ticked only
    // through what is around it
    //
    const box = (
        <span className='model-compare-box'>
            <input
                type='checkbox'
                checked={ticked}
                disabled={Boolean(blocked)}
                aria-label={`Compare ${model.name}`}
                onChange={() => onPick(model)}
            />
        </span>
    );

    return (
        <div className={`model-row${status === 'retired' ? ' model-row-retired' : ''}`} role='listitem'>
            <div className='model-cell model-cell-compare'>
                {blocked ? <Tooltip title={blocked}>{box}</Tooltip> : box}
                {ticked
                    ? <span className='model-swatch' style={{ backgroundColor: COMPARE_COLORS[picked] }} aria-hidden='true' />
                    : null}
            </div>
            <div className='model-cell model-cell-model'>
                <div className='model-name-line'>
                    <Link className='model-name' to={address}>{model.name}</Link>
                    <StatusPill model={model} />
                </div>
                <span className='model-address'>{address}</span>
                {model.description ? <p className='model-description'>{model.description}</p> : null}
                {tradesOptions(task) && status !== 'retired' && status !== 'down'
                    ? <Link className='model-picks-link' to={`${address}/picks`}>See its picks &rsaquo;</Link>
                    : null}
            </div>
            <div className='model-cell model-cell-alarm'>
                <AlarmBell model={model} held={held} />
            </div>
            <div className='model-cell model-cell-live'>
                <span className='model-cell-label'>Live version</span>
                <span className='model-figure'>{live.figure}</span>
                <span className='model-figure-detail'>{live.detail}</span>
            </div>
            <div className='model-cell model-cell-went'>
                <span className='model-cell-label'>Went live</span>
                <span className='model-figure'>{`${model.attempts.went_live} of ${model.attempts.total}`}</span>
                <span className='model-figure-detail'>attempts</span>
            </div>
            <div className='model-cell model-cell-trend'>
                <span className='model-cell-label'>{`Last ${TREND_DAYS} days`}</span>
                <TrendLine name={model.name} rows={rows} axis={axis} score={score} days={averageDays(model)} hold={hold} />
            </div>
            {parts
                ? <PartCells model={model} rows={rows} task={task} hold={hold} />
                : (
                    <div className='model-cell model-cell-score'>
                        <InfoNote note={noteOf(score, task, on.hold)} className='model-cell-label model-noted'>{scoreLabel(model, score, hold)}</InfoNote>
                        <span className='model-score-value'>{formatScore(value, score)}</span>
                        <span className={`model-gap model-gap-${standing(gap, score)}`}>{gapWords(gap, score)}</span>
                    </div>
                )}
            <div className='model-cell model-cell-since'>
                <span className='model-figure-detail'>{sinceLine(model, status)}</span>
                {status === 'down'
                    ? <span className='model-figure-detail'>{`${live.detail.charAt(0).toUpperCase()}${live.detail.slice(1)}.`}</span>
                    : null}
            </div>
        </div>
    );
}

ModelRow.propTypes = {
    model: PropTypes.shape({
        name: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        description: PropTypes.string,
        retired: PropTypes.string,
        scored_days: PropTypes.number.isRequired,
        //
        // how many scored days its scores average, the listing's (#293)
        //
        average_days: PropTypes.number,
        live: PropTypes.shape({
            since: PropTypes.string,
            kind: PropTypes.string,
        }).isRequired,
        attempts: PropTypes.shape({
            total: PropTypes.number.isRequired,
            went_live: PropTypes.number.isRequired,
        }).isRequired,
        score: PropTypes.object,
        baseline: PropTypes.object,
        //
        // the night the trainer took its live version down, why, and the check
        // that did it, none for a take-down no check did (#295), or null while
        // it is live -- see worker/model/report.js
        //
        down: PropTypes.shape({
            since: PropTypes.string.isRequired,
            reason: PropTypes.string,
            days: PropTypes.number,
            in_a_row: PropTypes.number,
        }),
    }).isRequired,
    score: PropTypes.string.isRequired,
    //
    // the model's track record: undefined while it is on its way, null where it
    // could not be had
    //
    rows: PropTypes.array,
    axis: PropTypes.arrayOf(PropTypes.string).isRequired,
    //
    // the color slot it holds in the comparison, or null where it is not ticked
    //
    picked: PropTypes.number,
    //
    // why it cannot be ticked, or null where it can
    //
    blocked: PropTypes.string,
    onPick: PropTypes.func.isRequired,
    //
    // whether the reader holds the model's alarm, which rings its bell
    //
    held: PropTypes.bool,
    //
    // the task it predicts, as the listing describes it, whose note on the
    // score is the one the score's name carries (#279) -- see scores.js's
    // noteOf
    //
    task: PropTypes.shape({
        id: PropTypes.string.isRequired,
        scores: PropTypes.arrayOf(PropTypes.string),
    }),
    //
    // whether the list shows loss's three parts in place of its sum (#283) --
    // see scores.js's showsParts
    //
    parts: PropTypes.bool,
    //
    // the hold the list is on, where its task has holds (#300): its score, how
    // it stands, its days, its trend line and loss's parts follow it
    //
    hold: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([COMBINED])]),
};

export default ModelRow;
