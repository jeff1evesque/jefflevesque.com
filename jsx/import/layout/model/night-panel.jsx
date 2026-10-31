/**
 * night-panel.jsx: the night picked on a model's attempts' charts, in a panel
 * under them (#318) -- see attempts-chart.jsx, which picks it: the newest night
 * first, then the one pointed at, tapped or tabbed to. A panel rather than a
 * longer popup, since its strip of days and its lists don't fit in one, and a
 * panel is there for the keyboard and on a phone. Of the night, it says:
 *
 *     its name and kind     the morning its test ran and the kind of attempt it
 *                           was, 'Tue Oct 27 · nightly update', and the market day
 *                           it was tested after
 *     three boxes           the new version's score, the version in charge's and
 *                           the simple guess's, on the score picked
 *     what came of it       took over or kept back, and how far the new version
 *                           beat or missed the simple guess and the version in
 *                           charge on loss, which decides. Worked out from the
 *                           night rather than said by the rule of its day, as
 *                           older nights were decided by older rules
 *     where it started      the version that took over before it, for a nightly
 *                           update, or from scratch
 *     how long it took      the whole time and its parts, from format 6 its
 *                           fine-tuning among them (#324)
 *     which days it used    its days as a strip, a row for each month, a box for
 *                           each day in the look of its kind -- studied, used to
 *                           decide when to stop, test, skipped, results not in
 *                           yet, or not picked this night -- a key of the kinds
 *                           drawn, and the same in words, the days used to
 *                           decide when to stop with a note on how (#324)
 *
 * Note: which earlier days a night studied, and which it stopped on, skipped,
 *       had no results for yet or didn't pick, are the trainer's to list. Until
 *       a history lists the days a night studied, the strip is its test days
 *       alone, and the earlier days a count.
 */

import React from 'react';
import PropTypes from 'prop-types';
import InfoNote from '../../general/info-note.jsx';
import {
    formatDuration,
    formatGap,
    formatScore,
    formatStarted,
    nightName,
    shortDay,
    standing,
} from './scores.js';

/**
 * what kind of attempt a night was, as its panel and its popups name it: a
 * model's first version, which had no version in charge to beat, a weekly full
 * retrain, or a nightly update.
 */
export function kindWords(point) {
    if (point.first) {
        return 'first version';
    }

    return point.kind === 'weekly' ? 'weekly full retrain' : 'nightly update';
}

//
// how the new version stood against one it was tested beside, on loss: the
// verb, and what it beat, lost to or tied, by how much
//
function against(gap, name) {
    const stands = standing(gap, 'loss');

    if (stands === 'level') {
        return { verb: 'tied', said: name };
    }

    return { verb: stands === 'better' ? 'beat' : 'lost to', said: `${name} by ${formatGap(gap, 'loss')}` };
}

/**
 * how far a night's new version beat or missed the simple guess and the version
 * in charge, on loss, whichever score is picked, as loss decides: 'On loss it
 * beat the simple guess by 0.046 and the version in charge by 0.001.', or 'On
 * loss it lost to the simple guess by 0.013 and beat the version in charge by
 * 0.014.' A first version has no version in charge to stand against. Nothing
 * where the night has neither gap.
 */
export function resultWords(point) {
    const parts = [
        point.lossGaps.guess === null ? null : against(point.lossGaps.guess, 'the simple guess'),
        point.first || point.lossGaps.charge === null ? null : against(point.lossGaps.charge, 'the version in charge'),
    ].filter(Boolean);

    if (!parts.length) {
        return '';
    }

    const said = parts.map((part, at) => (at && part.verb === parts[at - 1].verb ? part.said : `${part.verb} ${part.said}`));

    return `On loss it ${said.join(' and ')}.`;
}

/**
 * where a night's new version started: from the version that took over before
 * it, for a nightly update -- 'Started from the version that took over Sat Oct
 * 24.' -- or from scratch, for a weekly full retrain and a first version.
 * Nothing for a nightly update with no version before it.
 */
export function startedFrom(point) {
    if (point.first || point.kind === 'weekly') {
        return 'Built from scratch.';
    }

    return point.from ? `Started from the version that took over ${nightName(point.from)}.` : '';
}

/**
 * how long a night's attempt took, in all and in its parts, and when it started:
 * '54 min 10 s in all: 41 min 36 s training, 1 min 37 s scoring the test days,
 * then 10 min 58 s fine-tuning. Started Wed Oct 28, 4:43 AM ET.' -- the
 * fine-tuning by the name the Live version card gives its check (#324), and the
 * start with its day (#327), where the panel's title and the line under it name
 * two. A night from before the trainer kept times says so.
 */
export function tookWords(point) {
    if (point.took === null) {
        return 'No times: they are kept from Oct 15, 2026 on.';
    }

    const started = formatStarted(point.started);
    const parts = point.again === null
        ? `${formatDuration(point.took)} in all: ${formatDuration(point.training)} training, then ${formatDuration(point.scoring)} scoring the test days.`
        : `${formatDuration(point.took)} in all: ${formatDuration(point.training)} training, ${formatDuration(point.scoring)} scoring the test days, then ${formatDuration(point.again)} fine-tuning.`;

    return started ? `${parts} Started ${started}.` : parts;
}

//
// a day's month, as its short day names it: 'Oct'
//
function monthOf(day) {
    return shortDay(day).split(' ')[0];
}

//
// a day's date, without its month: '20'
//
function dateOf(day) {
    return Number(day.slice(8));
}

/**
 * days in words, oldest first, the month said once for each month they fall in:
 * 'Oct 20, 21 and 22', and across months 'Oct 7 and 22, and Nov 4'.
 */
export function dayList(days) {
    const months = [];

    days.forEach((day) => {
        const last = months[months.length - 1];

        if (last && last.month === monthOf(day)) {
            last.dates.push(dateOf(day));
        } else {
            months.push({ month: monthOf(day), dates: [dateOf(day)] });
        }
    });

    const said = (dates) => (dates.length === 1 ? String(dates[0]) : `${dates.slice(0, -1).join(', ')} and ${dates[dates.length - 1]}`);

    return months.map((each) => `${each.month} ${said(each.dates)}`).join(', and ');
}

//
// each kind of day the full strip marks (#318), in the order its key and its
// lists give them: where a night's history lists them, `listed`, its class, its
// name in the key, in the lists and in a day's title. The days used to decide
// when to stop carry a note on how they decide it, after their name in the
// lists alone (#324): the key is hidden from a screen reader, and one icon will
// do
//
const KINDS = [
    { key: 'studied', listed: 'studied', look: 'model-day-studied', name: 'Studied', list: 'Studied', title: 'studied' },
    {
        key: 'stopping',
        listed: 'stopping',
        look: 'model-day-stopping',
        name: 'Used to decide when to stop',
        list: 'Used to decide when to stop',
        title: 'used to decide when to stop',
        note: 'The model never trains on these days. After each epoch it’s scored on them, and training stops once that score stops getting better. It keeps the epoch that scored best.',
    },
    { key: 'test', listed: null, look: 'model-day-test', name: 'Test, never studied', list: 'Test', title: 'test, never studied' },
    { key: 'skipped', listed: 'skipped', look: 'model-day-skipped', name: 'Skipped, incomplete data', list: 'Skipped', title: 'skipped, incomplete data' },
    { key: 'pending', listed: 'pending', look: 'model-day-pending', name: 'Results not in yet', list: 'Results not in yet', title: 'results not in yet' },
    {
        key: 'unpicked',
        listed: 'unpicked',
        look: 'model-day-unpicked',
        name: 'Not picked this night',
        list: 'Not picked this night',
        title: 'not picked this night',
    },
];

//
// the strip of a night's test days alone, until its history lists the rest:
// each day a box with its date in it, after the name of its month where the
// month begins. The lists under it say the same in words, to a screen reader
// as well
//
function DayStrip({ days }) {
    return (
        <div className='model-day-strip' aria-hidden='true'>
            {days.map((day, at) => (
                <React.Fragment key={day}>
                    {!at || monthOf(day) !== monthOf(days[at - 1]) ? <span className='model-day-month'>{monthOf(day)}</span> : null}
                    <span className='model-day model-day-test' title={`${shortDay(day)}: test, never studied`}>
                        {dateOf(day)}
                    </span>
                </React.Fragment>
            ))}
        </div>
    );
}

DayStrip.propTypes = {
    days: PropTypes.arrayOf(PropTypes.string).isRequired,
};

//
// the full strip of a night's days (#318), as the canvas's late-November boards
// draw it: a row for each month, its name before its days, oldest first, each
// day a box in the look of its kind. `drawn` are the kinds the night has, each
// with its days; a day listed twice is drawn once, as the first kind it is
//
function FullStrip({ drawn }) {
    const kindOf = {};

    drawn.forEach((kind) => {
        kind.days.forEach((day) => {
            kindOf[day] = kindOf[day] || kind;
        });
    });

    const months = [];

    Object.keys(kindOf).sort().forEach((day) => {
        const last = months[months.length - 1];

        if (last && last.month === monthOf(day)) {
            last.days.push(day);
        } else {
            months.push({ month: monthOf(day), days: [day] });
        }
    });

    return (
        <div className='model-day-strip model-day-rows' aria-hidden='true'>
            {months.map((row) => (
                <div key={row.days[0]} className='model-day-row'>
                    <span className='model-day-month'>{row.month}</span>
                    {row.days.map((day) => (
                        <span key={day} className={`model-day ${kindOf[day].look}`} title={`${shortDay(day)}: ${kindOf[day].title}`}>
                            {dateOf(day)}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

FullStrip.propTypes = {
    drawn: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        look: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        days: PropTypes.arrayOf(PropTypes.string).isRequired,
    })).isRequired,
};

/**
 * the kinds of day a night's history lists (#318), each with its days, oldest
 * first, in KINDS' order -- its test days among them -- and only those it has
 * days of. None until the history lists the days the night studied: the
 * trainer doesn't publish its lists yet.
 */
export function daysDrawn(test, days) {
    if (!days || !days.studied || !days.studied.length) {
        return null;
    }

    return KINDS
        .map((kind) => ({ ...kind, days: (kind.listed ? days[kind.listed] || [] : test).slice().sort() }))
        .filter((kind) => kind.days.length);
}

/**
 * which days a night used (#318). Where its history lists them, every day it
 * studied, used to decide when to stop, was tested on, skipped, had no result
 * for yet or didn't pick, as a strip, a key of the kinds drawn, and a line of
 * each in words. Until it does, its test days, as a strip and in words, and how
 * many earlier days it studied or used to decide when to stop, 'Studied or used
 * to stop: 10 earlier days'. Nothing for a night that says none of it.
 */
function DaysUsed({ test, studied, days = null }) {
    const drawn = daysDrawn(test, days);

    if (!drawn && !test.length && studied === null) {
        return null;
    }

    if (drawn) {
        return (
            <div className='model-night-days'>
                <h6 className='model-night-days-title'>Which days it used</h6>
                <FullStrip drawn={drawn} />
                <ul className='model-day-legend' aria-hidden='true'>
                    {drawn.map((kind) => (
                        <li key={kind.key}>
                            <span className={`model-day-swatch ${kind.look}`} />
                            {kind.name}
                        </li>
                    ))}
                </ul>
                <dl className='model-day-lists'>
                    {drawn.map((kind) => (
                        <div key={kind.key}>
                            <dt>{kind.note ? <InfoNote note={kind.note} className='model-noted'>{kind.list}</InfoNote> : kind.list}</dt>
                            <dd>{dayList(kind.days)}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        );
    }

    return (
        <div className='model-night-days'>
            <h6 className='model-night-days-title'>Which days it used</h6>
            {test.length
                ? (
                    <>
                        <DayStrip days={test} />
                        <ul className='model-day-legend' aria-hidden='true'>
                            <li>
                                <span className='model-day-swatch model-day-test' />
                                Test, never studied
                            </li>
                        </ul>
                    </>
                ) : null}
            <dl className='model-day-lists'>
                {studied === null
                    ? null
                    : (
                        <div>
                            <dt>Studied or used to stop</dt>
                            <dd>{`${studied} earlier ${studied === 1 ? 'day' : 'days'}`}</dd>
                        </div>
                    )}
                {test.length
                    ? (
                        <div>
                            <dt>Test</dt>
                            <dd>{dayList(test)}</dd>
                        </div>
                    ) : null}
            </dl>
        </div>
    );
}

//
// a night's lists of days by kind, as attempts-chart.jsx's attemptPoints gives
// them (#318)
//
const LISTED = PropTypes.shape({
    studied: PropTypes.arrayOf(PropTypes.string),
    stopping: PropTypes.arrayOf(PropTypes.string),
    skipped: PropTypes.arrayOf(PropTypes.string),
    pending: PropTypes.arrayOf(PropTypes.string),
    unpicked: PropTypes.arrayOf(PropTypes.string),
});

DaysUsed.propTypes = {
    test: PropTypes.arrayOf(PropTypes.string).isRequired,
    studied: PropTypes.number,
    days: LISTED,
};

/**
 * the panel of the night picked: `point` is attempts-chart.jsx's attemptPoints'
 * of it, on `score`, and `marks` the marks its three boxes are named after, as
 * the charts draw them -- { attempt, live, baseline }.
 */
export default function NightPanel({ point, score, marks }) {
    const from = startedFrom(point);
    const result = resultWords(point);
    const boxes = [
        { key: 'attempt', name: 'New version', mark: marks.attempt, value: formatScore(point.attempt, score) },
        { key: 'live', name: 'Version in charge', mark: marks.live, value: point.first ? 'none yet' : formatScore(point.live, score) },
        { key: 'baseline', name: 'Simple guess', mark: marks.baseline, value: formatScore(point.baseline, score) },
    ];

    return (
        <section className='model-night-panel' aria-labelledby='model-night-title'>
            <div className='model-night-head'>
                <h6 id='model-night-title' className='model-night-title'>{`${nightName(point.tested)} · ${kindWords(point)}`}</h6>
                <p className='model-night-sub'>{`Tested after the market closed on ${nightName(point.day)}.`}</p>
            </div>
            <div className='model-night-boxes'>
                {boxes.map((box) => (
                    <div key={box.key} className={`model-night-box model-night-box-${box.key}`}>
                        <span className='model-night-box-name'>
                            {box.mark}
                            {box.name}
                        </span>
                        <span className='model-night-box-value'>{box.value}</span>
                    </div>
                ))}
            </div>
            <p className='model-night-result'>
                <span className={`model-night-pill model-night-pill-${point.went_live ? 'took' : 'kept'}`}>
                    {point.went_live ? 'Took over' : 'Kept back'}
                </span>
                {result ? <><span className='visually-hidden'>.</span>{` ${result}`}</> : null}
            </p>
            {from ? <p className='model-night-line'>{from}</p> : null}
            <p className='model-night-line'>
                <span className='model-night-line-name'>How long it took:</span>
                {` ${tookWords(point)}`}
            </p>
            <DaysUsed test={point.test} studied={point.studied} days={point.days} />
        </section>
    );
}

NightPanel.propTypes = {
    point: PropTypes.shape({
        day: PropTypes.string.isRequired,
        tested: PropTypes.string,
        from: PropTypes.string,
        kind: PropTypes.string.isRequired,
        went_live: PropTypes.bool.isRequired,
        first: PropTypes.bool.isRequired,
        attempt: PropTypes.number,
        live: PropTypes.number,
        baseline: PropTypes.number,
        lossGaps: PropTypes.shape({
            guess: PropTypes.number,
            charge: PropTypes.number,
        }).isRequired,
        test: PropTypes.arrayOf(PropTypes.string).isRequired,
        studied: PropTypes.number,
        days: LISTED,
        started: PropTypes.string,
        training: PropTypes.number,
        scoring: PropTypes.number,
        again: PropTypes.number,
        took: PropTypes.number,
    }).isRequired,
    score: PropTypes.string.isRequired,
    marks: PropTypes.shape({
        attempt: PropTypes.node.isRequired,
        live: PropTypes.node.isRequired,
        baseline: PropTypes.node.isRequired,
    }).isRequired,
};
