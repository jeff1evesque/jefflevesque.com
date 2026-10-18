/**
 * track-chart.jsx: a model's track record, on its own page (#243): each day it
 * predicted, scored once that day's prices were in.
 *
 * Each day's score is a faint dot, and the 20-day average of them a line, beside
 * the know-nothing baseline's. A menu adds another model of the same task, as
 * its own 20-day line, so the two can be read against each other on the days
 * both were scored. A short tick at the foot of the chart marks each night a
 * new version went live, read from the model's history, so a step in the line
 * can be laid beside the version that made it.
 *
 * Note: the baseline is averaged over the days on the chart -- see
 *       scores.js's baselineAverages -- so it is the same line /model's
 *       comparison draws, whichever model is added here.
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
    baselineAverages,
    chartColors,
    formatScore,
    formatTick,
    longDay,
    scoreOf,
    shortDay,
} from './scores.js';

const HEIGHT = 280;

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
 * the tick for a night a new version went live: a short upright line standing
 * on the foot of the plot, rather than the whole height a reference line runs.
 */
export function WentLiveTick({ x1, y1, y2, color }) {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(y2)) {
        return null;
    }

    const foot = Math.max(y1, y2);

    return (
        <line
            className='model-went-live'
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

WentLiveTick.propTypes = {
    x1: PropTypes.number,
    y1: PropTypes.number,
    y2: PropTypes.number,
    color: PropTypes.string.isRequired,
};

/**
 * each day as the chart draws it: the model's score that day and its 20-day
 * average, the baseline's average, and the other model's average where one is
 * added. A day only the other model was scored on has no dot and no line of
 * this model's.
 */
export function trackPoints(name, rows, other, otherRows, score) {
    const records = { [name]: rows };

    if (other) {
        records[other] = otherRows || [];
    }

    const names = Object.keys(records);
    const aligned = alignDays(records);
    const baseline = baselineAverages(aligned, names, score);

    return aligned.map((entry, at) => {
        const own = entry[name];
        const theirs = other ? entry[other] : null;

        return {
            day: entry.day,
            single: own ? own.score[score] : null,
            average: own ? own.average[score] : null,
            days: own ? own.days : null,
            baseline: baseline[at],
            other: theirs ? theirs.average[score] : null,
        };
    });
}

function TrackChart({ name, rows, score, others, other, otherRows, onOther, wentLive = [] }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const lower = scoreOf(score).lower;
    const label = scoreOf(score).label;
    const shown = other && otherRows ? other : null;
    const points = trackPoints(name, rows, shown, otherRows, score);
    //
    // the nights a new version went live that are days on the chart: a night
    // the record has no day for has nowhere to stand
    //
    const ticks = wentLive.filter((day) => points.some((point) => point.day === day));

    //
    // the day its panel shows, as the attempts' panels do: the day pointed at,
    // the latest until then, or on a phone the day tapped -- see usePanelDay
    //
    const panel = usePanelDay(points.length ? points[points.length - 1].day : null);

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

        return {
            title: longDay(point.day),
            rows: tipRows,
            foot: [
                point.single === null ? `${name} has no score this day` : null,
                ticks.includes(point.day) ? 'A new version went live this night' : null,
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
                        title='Track record'
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
                            {'Each day’s real predictions, scored once that day’s prices are in. Dots are single days, and lines are averages of the last 20 days. Up is better'}
                            {lower ? ', so the loss axis is flipped: lower is better.' : '.'}
                        </p>
                        <Legend
                            items={[
                                { key: 'average', kind: 'line', color: colors.live, label: 'This model' },
                                { key: 'single', kind: 'faint', color: colors.live, label: 'Single day' },
                                ...(shown ? [{ key: 'other', kind: 'line', color: OTHER_COLOR, label: <span className='model-legend-name'>{shown}</span> }] : []),
                                { key: 'baseline', kind: 'dashed', color: colors.baseline, label: 'Know-nothing baseline' },
                                ...(ticks.length ? [{ key: 'went', kind: 'tick', color: colors.better, label: 'New version went live' }] : []),
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
                        aria-label={`${label} of ${name}${shown ? ` and ${shown}` : ''} and the know-nothing baseline, as averages of the last 20 days, with single days as dots. The numbers are in the table below.`}
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
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <Readout tip={tipOf(panel.dayFor())} line={!panel.phone} />
                    <Numbers
                        label={`${label}, track record`}
                        columns={[
                            { key: 'day', label: 'Day', text: true },
                            { key: 'single', label: 'This day' },
                            { key: 'average', label: '20 days' },
                            ...(shown ? [{ key: 'other', label: `${shown}, 20 days` }] : []),
                            { key: 'baseline', label: 'Baseline, 20 days' },
                            ...(ticks.length ? [{ key: 'went', label: 'New version', text: true }] : []),
                        ]}
                        rows={points.slice().reverse().map((point) => ({
                            key: point.day,
                            day: shortDay(point.day),
                            single: cell(point.single),
                            average: cell(point.average),
                            other: cell(point.other),
                            baseline: cell(point.baseline),
                            went: ticks.includes(point.day) ? 'went live' : '',
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
    // the names of the other models of its task, which the menu offers
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
};

export default TrackChart;
