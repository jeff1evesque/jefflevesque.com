/**
 * track-chart.jsx: a model's track record, on its own page (#243): each day it
 * predicted, scored once that day's prices were in.
 *
 * Each day's score is a faint dot, and the 20-day average of them a line, beside
 * the know-nothing baseline's. A menu adds another model of the same task, as
 * its own 20-day line, so the two can be read against each other on the days
 * both were scored -- or of another task, on a score of what each one's picks
 * would have made (#279). A short tick at the foot of the chart marks each night a
 * new version went live, read from the model's history, so a step in the line
 * can be laid beside the version that made it; and a red one each day whose
 * score set off a check that took the live version down (#263), read from the
 * track record.
 *
 * An options model's track record has its scores for each hold its picks are
 * held (#279), and the chart draws the hold picked over the page: each day once
 * that hold's sell day is in, so the newest days of a longer hold have no dot
 * or line yet. Another model drawn beside it is drawn on the same hold where it
 * has holds, and on its own scores where it has none, as a stock model.
 *
 * Note: the baseline is the model's own, its record's 20-day average (#263).
 *       Each model's track record carries the baseline's scores on its own
 *       days, and they differ from one record to the next -- on 2026-10-15 the
 *       baseline's loss was 1.733 in tables-gnn's and 1.702 in pt-gnn's -- and
 *       the trainer judges each model against its own.
 */

import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Scatter,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import { FoldTitle, Legend, Mark, NoBox, Numbers, Readout, axisStyle, useFolds, usePanelDay } from './parts.jsx';
import {
    BASELINE_DASH,
    COMPARE_COLORS,
    WINDOW,
    alignDays,
    chartColors,
    checkWords,
    columnOf,
    formatScore,
    formatTick,
    holdName,
    holdsOf,
    longDay,
    scoreIn,
    scoreOf,
    shortDay,
} from './scores.js';

//
// the chart's height, in px, and the card's title, which are its placeholder's
// as well while the track record is on its way (#274) -- see pending.jsx
//
export const HEIGHT = 280;
export const TITLE = 'Track record';

//
// the color the model added from the menu is drawn in: the first of the
// compared models' colors, as it would be on /model
//
const OTHER_COLOR = COMPARE_COLORS[0];

/**
 * a single day's score, as a faint dot. Nothing on a day with none.
 */
export function DayDot({ cx, cy, payload, color }) {
    if (!payload || payload.single === null || !Number.isFinite(cx) || !Number.isFinite(cy)) {
        return null;
    }

    return <circle className='model-day-dot' cx={cx} cy={cy} r={3.5} fill={color} fillOpacity={0.25} />;
}

DayDot.propTypes = {
    cx: PropTypes.number,
    cy: PropTypes.number,
    payload: PropTypes.object,
    color: PropTypes.string.isRequired,
};

/**
 * a short upright line standing on the foot of the plot, rather than the whole
 * height a reference line runs: a night a new version went live, or a day whose
 * score took the live version down (#263), each by its own class.
 */
export function FootTick({ x1, y1, y2, color, className }) {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(y2)) {
        return null;
    }

    const foot = Math.max(y1, y2);

    return (
        <line
            className={className}
            x1={x1}
            x2={x1}
            y1={foot - 9}
            y2={foot - 2}
            stroke={color}
            strokeWidth={2}
            strokeLinecap='round'
        />
    );
}

FootTick.propTypes = {
    x1: PropTypes.number,
    y1: PropTypes.number,
    y2: PropTypes.number,
    color: PropTypes.string.isRequired,
    className: PropTypes.string.isRequired,
};

/**
 * the tick for a night a new version went live.
 */
export function WentLiveTick(props) {
    return <FootTick {...props} className='model-went-live' />;
}

WentLiveTick.propTypes = {
    x1: PropTypes.number,
    y1: PropTypes.number,
    y2: PropTypes.number,
    color: PropTypes.string.isRequired,
};

/**
 * the tick for a day whose score set off a check that took the live version
 * down (#263).
 */
export function TakenDownTick(props) {
    return <FootTick {...props} className='model-taken-down' />;
}

TakenDownTick.propTypes = WentLiveTick.propTypes;

/**
 * each day as the chart draws it: the model's score that day and its 20-day
 * average, the 20-day average of its own baseline, the other model's average
 * where one is added, and the check a day's score set off where it took the
 * live version down (#263). A day only the other model was scored on has no
 * dot and no line of this model's.
 *
 * With a `hold` (#279), each is the hold's column of the score, and a day whose
 * hold's result is not in yet has none of them: its 20-day average would be of
 * the days before it alone. The other model's is the hold's too, where its
 * record has the hold, and its score's own where it does not.
 */
export function trackPoints(name, rows, other, otherRows, score, hold = null) {
    const records = { [name]: rows };
    const column = columnOf(score, hold);
    const theirs = hold && holdsOf(otherRows).some((each) => each.days === hold) ? column : score;

    if (other) {
        records[other] = otherRows || [];
    }

    return alignDays(records).map((entry) => {
        const own = entry[name];
        const their = other ? entry[other] : null;
        const single = own ? scoreIn(own.score, column) : null;
        const held = !hold || single !== null;

        return {
            day: entry.day,
            single: single,
            average: own && held ? scoreIn(own.average, column) : null,
            days: own ? own.days : null,
            baseline: own && held ? scoreIn(own.baseline_average, column) : null,
            other: their ? scoreIn(their.average, theirs) : null,
            down: own && Number.isFinite(own.down_days) ? { days: own.down_days, in_a_row: own.down_in_a_row } : null,
        };
    });
}

function TrackChart({ name, rows, score, others, other, otherRows, onOther, wentLive = [], hold = null }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const lower = scoreOf(score).lower;
    const label = scoreOf(score).label;
    const shown = other && otherRows ? other : null;
    const points = trackPoints(name, rows, shown, otherRows, score, hold);

    //
    // the hold the chart draws, as its description and its table's name say it
    // (#279): nothing for a model with no holds
    //
    const onHold = hold ? ` on the ${holdName(hold)}` : '';
    //
    // the nights a new version went live that are days on the chart: a night
    // the record has no day for has nowhere to stand
    //
    const ticks = wentLive.filter((day) => points.some((point) => point.day === day));

    //
    // the days whose score set off a check that took the live version down,
    // from the model's own record (#263)
    //
    const downs = points.filter((point) => point.down).map((point) => point.day);

    //
    // the day its panel shows, as the attempts' panels do: the day pointed at,
    // the latest until then, or on a phone the day tapped -- see usePanelDay. On
    // a hold, the latest whose result is in (#279): the newest days have none yet
    //
    const latest = hold ? points.filter((point) => point.single !== null) : points;
    const panel = usePanelDay(latest.length ? latest[latest.length - 1].day : null);

    //
    // folded down to its title by the reader, as the attempts' charts fold --
    // see useFolds
    //
    const [folds, toggle] = useFolds('model-page');

    const tipOf = (day) => {
        const point = points.find((each) => each.day === day);

        if (!point) {
            return null;
        }

        const tipRows = [];

        if (point.single !== null) {
            tipRows.push(
                { key: 'single', mark: <Mark kind='faint' color={colors.live} />, name: 'This model, this day', value: formatScore(point.single, score) },
                {
                    key: 'average',
                    mark: <Mark kind='line' color={colors.live} />,
                    name: point.days < WINDOW ? `This model, ${point.days} days` : 'This model, 20 days',
                    value: formatScore(point.average, score),
                },
            );
        }

        if (shown && point.other !== null) {
            tipRows.push({ key: 'other', mark: <Mark kind='line' color={OTHER_COLOR} />, name: `${shown}, 20 days`, value: formatScore(point.other, score) });
        }

        if (point.baseline !== null) {
            tipRows.push({ key: 'baseline', mark: <Mark kind='dashed' color={colors.baseline} />, name: 'Know-nothing baseline, 20 days', value: formatScore(point.baseline, score) });
        }

        //
        // why this model has nothing on the day: on a hold, that its result is
        // not in yet (#279)
        //
        const none = hold ? `${name}’s ${hold}-day result for this day is not in yet` : `${name} has no score this day`;

        return {
            title: longDay(point.day),
            rows: tipRows,
            foot: [
                point.single === null ? none : null,
                ticks.includes(point.day) ? 'A new version went live this night' : null,
                point.down ? `Live version taken down: ${checkWords(point.down)}` : null,
            ].filter(Boolean).join(' · ') || null,
        };
    };

    const cell = (value) => (value === null ? '' : formatScore(value, score));

    return (
        <section className='model-card model-track' aria-labelledby='model-track-title'>
            <div className='model-card-head'>
                <div className='model-card-title'>
                    <FoldTitle
                        as='h5'
                        id='model-track-title'
                        title={TITLE}
                        folded={Boolean(folds.track)}
                        onFold={() => toggle('track')}
                    />
                    {others.length && !folds.track
                        ? (
                            <label className='model-other'>
                                <span className='model-control-label'>Compare with</span>
                                <select value={other || ''} onChange={(event) => onOther(event.target.value || null)}>
                                    <option value=''>No other model</option>
                                    {others.map((each) => <option key={each} value={each}>{each}</option>)}
                                </select>
                            </label>
                        ) : null}
                </div>
                {folds.track ? null : (
                    <>
                        <p className='model-card-sub'>
                            {hold
                                ? 'Each day’s real predictions, scored once each hold’s sell day is in. '
                                : 'Each day’s real predictions, scored once that day’s prices are in. '}
                            {'Dots are single days, and lines are averages of the last 20 days. Up is better'}
                            {lower ? ', so the loss axis is flipped: lower is better.' : '.'}
                        </p>
                        <Legend
                            items={[
                                { key: 'average', kind: 'line', color: colors.live, label: 'This model' },
                                { key: 'single', kind: 'faint', color: colors.live, label: 'Single day' },
                                ...(shown ? [{ key: 'other', kind: 'line', color: OTHER_COLOR, label: <span className='model-legend-name'>{shown}</span> }] : []),
                                { key: 'baseline', kind: 'dashed', color: colors.baseline, label: 'Know-nothing baseline' },
                                ...(ticks.length ? [{ key: 'went', kind: 'tick', color: colors.better, label: 'New version went live' }] : []),
                                ...(downs.length ? [{ key: 'down', kind: 'tick', color: colors.worse, label: 'Live version taken down' }] : []),
                            ]}
                        />
                    </>
                )}
            </div>
            {folds.track ? null : (
                <>
                    {other && otherRows === undefined ? <p className='model-note'>{`Loading ${other}’s track record…`}</p> : null}
                    {other && otherRows === null ? <p className='model-note'>{`The track record of ${other} could not be loaded.`}</p> : null}
                    <div
                        className='model-chart'
                        role='img'
                        aria-label={`${label}${onHold} of ${name}${shown ? ` and ${shown}` : ''} and the know-nothing baseline, as averages of the last 20 days, with single days as dots. The numbers are in the table below.`}
                    >
                        <ResponsiveContainer width='100%' height={HEIGHT}>
                            <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} {...panel.events()}>
                                <CartesianGrid stroke={colors.grid} vertical={false} />
                                <XAxis dataKey='day' tickFormatter={shortDay} minTickGap={24} {...axisStyle(colors)} />
                                <YAxis
                                    width={56}
                                    domain={['auto', 'auto']}
                                    reversed={lower}
                                    tickFormatter={(value) => formatTick(value, score)}
                                    {...axisStyle(colors)}
                                />
                                <Tooltip content={NoBox} cursor={{ stroke: colors.muted, strokeWidth: 1 }} />
                                <Scatter
                                    dataKey='single'
                                    isAnimationActive={false}
                                    shape={(props) => <DayDot {...props} color={colors.live} />}
                                />
                                <Line dataKey='baseline' stroke={colors.baseline} strokeWidth={2} strokeDasharray={BASELINE_DASH} dot={false} isAnimationActive={false} />
                                {shown
                                    ? <Line dataKey='other' stroke={OTHER_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                                    : null}
                                <Line dataKey='average' stroke={colors.live} strokeWidth={2} dot={false} isAnimationActive={false} />
                                {ticks.map((day) => (
                                    <ReferenceLine
                                        key={day}
                                        x={day}
                                        shape={(props) => <WentLiveTick {...props} color={colors.better} />}
                                    />
                                ))}
                                {downs.map((day) => (
                                    <ReferenceLine
                                        key={`down-${day}`}
                                        x={day}
                                        shape={(props) => <TakenDownTick {...props} color={colors.worse} />}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <Readout tip={tipOf(panel.dayFor())} line={!panel.phone} />
                    <Numbers
                        label={`${label}${onHold}, track record`}
                        columns={[
                            { key: 'day', label: 'Day', text: true },
                            { key: 'single', label: 'This day' },
                            { key: 'average', label: '20 days' },
                            ...(shown ? [{ key: 'other', label: `${shown}, 20 days` }] : []),
                            { key: 'baseline', label: 'Baseline, 20 days' },
                            ...(ticks.length ? [{ key: 'went', label: 'New version', text: true }] : []),
                            ...(downs.length ? [{ key: 'down', label: 'Taken down', text: true }] : []),
                        ]}
                        rows={points.slice().reverse().map((point) => ({
                            key: point.day,
                            day: shortDay(point.day),
                            single: cell(point.single),
                            average: cell(point.average),
                            other: cell(point.other),
                            baseline: cell(point.baseline),
                            went: ticks.includes(point.day) ? 'went live' : '',
                            down: point.down ? checkWords(point.down) : '',
                        }))}
                    />
                </>
            )}
        </section>
    );
}

TrackChart.propTypes = {
    name: PropTypes.string.isRequired,
    //
    // the model's track record, oldest first -- see worker/model/report.js
    //
    rows: PropTypes.array.isRequired,
    score: PropTypes.string.isRequired,
    //
    // the names of the other models the menu offers: its task's, and other
    // tasks' too on a score of what each one's picks would have made (#279)
    //
    others: PropTypes.arrayOf(PropTypes.string).isRequired,
    //
    // the one picked, or null, and its track record: undefined while it is on
    // its way, null where it could not be had
    //
    other: PropTypes.string,
    otherRows: PropTypes.array,
    onOther: PropTypes.func.isRequired,
    //
    // the nights a new version went live, from the model's history
    //
    wentLive: PropTypes.arrayOf(PropTypes.string),
    //
    // the hold an options model's record is drawn on, in trading days, or none
    // for a model with no holds (#279)
    //
    hold: PropTypes.number,
};

export default TrackChart;
