/**
 * track-chart.jsx: a model's track record, on its own page (#243): each day it
 * predicted, scored once that day's prices were in.
 *
 * Each day's score is a faint dot, and the 20-day average of them a line, beside
 * the know-nothing baseline's. A menu adds another model of the same task, as
 * its own 20-day line, so the two can be read against each other on the days
 * both were scored.
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
    ResponsiveContainer,
    Scatter,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import { Legend, Mark, Numbers, TipBox, axisStyle } from './parts.jsx';
import {
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

function TrackChart({ name, rows, score, others, other, otherRows, onOther }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const lower = scoreOf(score).lower;
    const label = scoreOf(score).label;
    const shown = other && otherRows ? other : null;
    const points = trackPoints(name, rows, shown, otherRows, score);

    const tip = ({ active, label: day }) => {
        const point = points.find((each) => each.day === day);

        if (!active || !point) {
            return null;
        }

        const tipRows = [];

        if (point.single !== null) {
            tipRows.push(
                { key: 'single', mark: <Mark kind='faint' color={colors.ink} />, name: 'This model, this day', value: formatScore(point.single, score) },
                {
                    key: 'average',
                    mark: <Mark kind='line' color={colors.ink} />,
                    name: point.days < WINDOW ? `This model, ${point.days} days` : 'This model, 20 days',
                    value: formatScore(point.average, score),
                },
            );
        }

        if (shown && point.other !== null) {
            tipRows.push({ key: 'other', mark: <Mark kind='line' color={OTHER_COLOR} />, name: `${shown}, 20 days`, value: formatScore(point.other, score) });
        }

        if (point.baseline !== null) {
            tipRows.push({ key: 'baseline', mark: <Mark kind='line' color={colors.muted} />, name: 'Baseline, 20 days', value: formatScore(point.baseline, score) });
        }

        return (
            <TipBox
                title={longDay(point.day)}
                rows={tipRows}
                foot={point.single === null ? `${name} has no score this day` : null}
            />
        );
    };

    const cell = (value) => (value === null ? '' : formatScore(value, score));

    return (
        <section className='model-card model-track' aria-labelledby='model-track-title'>
            <div className='model-card-head'>
                <div className='model-card-title'>
                    <h5 id='model-track-title'>Track record</h5>
                    {others.length
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
                <p className='model-card-sub'>
                    {'Each day’s real predictions, scored once that day’s prices are in. Dots are single days, and lines are averages of the last 20 days. Up is better'}
                    {lower ? ', so the loss axis is flipped: lower is better.' : '.'}
                </p>
                <Legend
                    items={[
                        { key: 'average', kind: 'line', color: colors.ink, label: 'This model' },
                        { key: 'single', kind: 'faint', color: colors.ink, label: 'Single day' },
                        ...(shown ? [{ key: 'other', kind: 'line', color: OTHER_COLOR, label: <span className='model-legend-name'>{shown}</span> }] : []),
                        { key: 'baseline', kind: 'line', color: colors.muted, label: 'Know-nothing baseline' },
                    ]}
                />
            </div>
            {other && otherRows === undefined ? <p className='model-note'>{`Loading ${other}’s track record…`}</p> : null}
            {other && otherRows === null ? <p className='model-note'>{`The track record of ${other} could not be loaded.`}</p> : null}
            <div
                className='model-chart'
                role='img'
                aria-label={`${label} of ${name}${shown ? ` and ${shown}` : ''} and the know-nothing baseline, as averages of the last 20 days, with single days as dots. The numbers are in the table below.`}
            >
                <ResponsiveContainer width='100%' height={HEIGHT}>
                    <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke={colors.grid} vertical={false} />
                        <XAxis dataKey='day' tickFormatter={shortDay} minTickGap={24} {...axisStyle(colors)} />
                        <YAxis
                            width={56}
                            domain={['auto', 'auto']}
                            reversed={lower}
                            tickFormatter={(value) => formatTick(value, score)}
                            {...axisStyle(colors)}
                        />
                        <Tooltip content={tip} cursor={{ stroke: colors.muted, strokeWidth: 1 }} />
                        <Scatter
                            dataKey='single'
                            isAnimationActive={false}
                            shape={(props) => <DayDot {...props} color={colors.ink} />}
                        />
                        <Line dataKey='baseline' stroke={colors.muted} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        {shown
                            ? <Line dataKey='other' stroke={OTHER_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                            : null}
                        <Line dataKey='average' stroke={colors.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <Numbers
                label={`${label}, track record`}
                columns={[
                    { key: 'day', label: 'Day', text: true },
                    { key: 'single', label: 'This day' },
                    { key: 'average', label: '20 days' },
                    ...(shown ? [{ key: 'other', label: `${shown}, 20 days` }] : []),
                    { key: 'baseline', label: 'Baseline, 20 days' },
                ]}
                rows={points.slice().reverse().map((point) => ({
                    key: point.day,
                    day: shortDay(point.day),
                    single: cell(point.single),
                    average: cell(point.average),
                    other: cell(point.other),
                    baseline: cell(point.baseline),
                }))}
            />
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
};

export default TrackChart;
