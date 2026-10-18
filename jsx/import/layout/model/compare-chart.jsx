/**
 * compare-chart.jsx: two or three models of one task, compared over /model's
 * lists (#243): their 20-day track records on one chart, with the know-nothing
 * baseline's.
 *
 * Each model is drawn in the color it was given when it was ticked, which it
 * keeps for as long as it stays ticked -- see ModelLayout.pick -- so unticking
 * one does not repaint the others. The legend names each in the page's own text
 * beside a swatch of its line.
 *
 * Note: the days are every day any of them was scored on. A day one of them was
 *       not running is a gap in its line, and the tooltip says why: it had not
 *       started, it had retired, or it has no score for the day.
 */

import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import { Legend, Mark, NoBox, Numbers, Readout, axisStyle, usePanelDay } from './parts.jsx';
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

//
// the chart's height, in px, at every width: a phone's chart is as tall as a
// wide screen's, and narrower
//
const HEIGHT = 300;

//
// why a model has no point on a day: before it started, after it retired, or a
// day it was running and has no score for
//
function absence(model, day) {
    if (model.started && day < model.started) {
        return 'not started yet';
    }

    if (model.retired && day > model.retired) {
        return 'retired';
    }

    return 'no score this day';
}

//
// a list of names as a sentence says it: 'a and b', 'a, b and c'
//
function together(names) {
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
}

function CompareChart({ picks, records, score, task, onClear }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const names = picks.map((pick) => pick.model.name);
    const lower = scoreOf(score).lower;
    const waiting = picks.filter((pick) => records[pick.model.name] === undefined);
    const missing = picks.filter((pick) => records[pick.model.name] === null);

    const held = {};

    names.forEach((name) => {
        held[name] = records[name] || [];
    });

    const aligned = alignDays(held);
    const baseline = baselineAverages(aligned, names, score);
    const data = aligned.map((entry, at) => {
        const point = { day: entry.day, baseline: baseline[at] };

        picks.forEach((pick) => {
            const row = entry[pick.model.name];

            point[`slot${pick.slot}`] = row ? row.average[score] : null;
        });

        return point;
    });

    //
    // the day its panel shows, as the model page's panels do: the day pointed
    // at, the latest until then, or on a phone the day tapped -- see
    // usePanelDay
    //
    const panel = usePanelDay(aligned.length ? aligned[aligned.length - 1].day : null);

    const tipOf = (label) => {
        const entry = aligned.find((each) => each.day === label);

        if (!entry) {
            return null;
        }

        const at = aligned.indexOf(entry);
        const scored = picks.filter((pick) => entry[pick.model.name]);
        const rows = scored
            .sort((a, b) => {
                const x = entry[a.model.name].average[score];
                const y = entry[b.model.name].average[score];

                return lower ? x - y : y - x;
            })
            .map((pick) => {
                const row = entry[pick.model.name];

                return {
                    key: pick.model.name,
                    mark: <Mark kind='line' color={COMPARE_COLORS[pick.slot]} />,
                    name: row.days < WINDOW ? `${pick.model.name} (${row.days} days)` : pick.model.name,
                    value: formatScore(row.average[score], score),
                };
            });

        if (baseline[at] !== null) {
            rows.push({
                key: 'baseline',
                mark: <Mark kind='dashed' color={colors.muted} />,
                name: 'Know-nothing baseline',
                value: formatScore(baseline[at], score),
            });
        }

        const absent = picks
            .filter((pick) => !entry[pick.model.name])
            .map((pick) => `${pick.model.name}: ${absence(pick.model, entry.day)}`);

        return { title: longDay(entry.day), rows: rows, foot: absent.length ? absent.join(' · ') : null };
    };

    //
    // a value as a cell of the table holds it: blank on a day it has none
    //
    const cell = (value) => (value === null ? '' : formatScore(value, score));

    return (
        <section className='model-card model-compare' aria-label='Comparison'>
            <div className='model-card-head'>
                <div className='model-card-title'>
                    <h5>{`Comparing ${together(names)}`}</h5>
                    <button type='button' className='model-clear' onClick={onClear}>Clear</button>
                </div>
                <p className='model-card-sub'>
                    {`${task.name}, scored on the same days. Lines are averages of the last 20 days. Up is better`}
                    {lower ? ', so the loss axis is flipped: lower is better.' : '.'}
                </p>
                <Legend
                    items={[
                        ...picks.map((pick) => ({
                            key: pick.model.name,
                            kind: 'line',
                            color: COMPARE_COLORS[pick.slot],
                            label: <span className='model-legend-name'>{pick.model.name}</span>,
                        })),
                        { key: 'baseline', kind: 'dashed', color: colors.muted, label: 'Know-nothing baseline' },
                    ]}
                />
            </div>
            {missing.length
                ? (
                    <p className='model-note'>
                        {`The track record of ${together(missing.map((pick) => pick.model.name))} could not be loaded.`}
                    </p>
                ) : null}
            {waiting.length
                ? <p className='model-status'>Loading the track records&hellip;</p>
                : (
                    <div className='model-chart' role='img' aria-label={`${scoreOf(score).label}, 20-day averages of ${together(names)} and the know-nothing baseline. The numbers are in the table below.`}>
                        <ResponsiveContainer width='100%' height={HEIGHT}>
                            <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} {...panel.events()}>
                                <CartesianGrid stroke={colors.grid} vertical={false} />
                                <XAxis
                                    dataKey='day'
                                    tickFormatter={shortDay}
                                    minTickGap={24}
                                    {...axisStyle(colors)}
                                />
                                <YAxis
                                    width={56}
                                    domain={['auto', 'auto']}
                                    reversed={lower}
                                    tickFormatter={(value) => formatTick(value, score)}
                                    {...axisStyle(colors)}
                                />
                                <Tooltip content={NoBox} cursor={{ stroke: colors.muted, strokeWidth: 1 }} />
                                <Line
                                    dataKey='baseline'
                                    stroke={colors.muted}
                                    strokeWidth={1.5}
                                    strokeDasharray={BASELINE_DASH}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                                {picks.map((pick) => (
                                    <Line
                                        key={pick.model.name}
                                        dataKey={`slot${pick.slot}`}
                                        name={pick.model.name}
                                        stroke={COMPARE_COLORS[pick.slot]}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            {waiting.length ? null : <Readout tip={tipOf(panel.dayFor())} line={!panel.phone} />}
            <Numbers
                label={`${scoreOf(score).label}, 20-day averages`}
                columns={[
                    { key: 'day', label: 'Day', text: true },
                    ...picks.map((pick) => ({ key: `slot${pick.slot}`, label: pick.model.name })),
                    { key: 'baseline', label: 'Baseline' },
                ]}
                rows={data.slice().reverse().map((point) => {
                    const row = { key: point.day, day: shortDay(point.day), baseline: cell(point.baseline) };

                    picks.forEach((pick) => {
                        row[`slot${pick.slot}`] = cell(point[`slot${pick.slot}`]);
                    });

                    return row;
                })}
            />
        </section>
    );
}

CompareChart.propTypes = {
    //
    // the models compared, each with the color slot it keeps while it is ticked
    //
    picks: PropTypes.arrayOf(PropTypes.shape({
        model: PropTypes.shape({
            name: PropTypes.string.isRequired,
            started: PropTypes.string,
            retired: PropTypes.string,
        }).isRequired,
        slot: PropTypes.number.isRequired,
    })).isRequired,
    //
    // every model's track record, by name: undefined while one is on its way,
    // null where it could not be had
    //
    records: PropTypes.object.isRequired,
    score: PropTypes.string.isRequired,
    task: PropTypes.shape({
        name: PropTypes.string.isRequired,
    }).isRequired,
    onClear: PropTypes.func.isRequired,
};

export default CompareChart;
