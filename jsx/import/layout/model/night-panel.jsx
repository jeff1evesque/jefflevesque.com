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
 *                           the simple guess's, on the score picked, and under
 *                           the version in charge's, the morning it took over
 *                           (#334): the one at the top of the page may be a later
 *                           version
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
 *                           each day in the look of its kind -- trained on,
 *                           validation, test, skipped, results not in yet, or not
 *                           picked this night, by the names training, validation
 *                           and test go by (#334) -- each day fine-tuning trained
 *                           on marked by a corner of its box (#334), and a key of
 *                           the kinds drawn, validation and fine-tuning each with
 *                           a note on what it is (#324, #334). The same in words
 *                           is for a screen reader alone (#334): on the screen it
 *                           said the strip over again
 *
 * Note: which earlier days a night trained on, and which it stopped on, skipped,
 *       had no results for yet or didn't pick, are the trainer's to list. Until
 *       a history lists the days a night trained on, the strip is its test days
 *       alone, and the earlier days a count.
 */

import React from 'react';
import PropTypes from 'prop-types';
import InfoNote from '../../general/info-note.jsx';
import {
    FINE_TUNE_OLDER,
    FINE_TUNE_SLACK,
    HELD_OUT,
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
 * which version was in charge on a night, by the morning it took over, as the
 * version in charge's box says it under its score (#334): 'took over Fri Oct 30'.
 * The page's Live version card names the version in charge now, and on an older
 * night, or the night a new version took over, the one in charge was an earlier
 * one, so the box said a score with no version to it. A bare date read as the
 * market day the line over the boxes names, 'Tested after the market closed on Fri
 * Oct 30.' Nothing on a model's first night, which had none, nor where the night
 * doesn't say.
 */
export function chargeWords(point) {
    return !point.first && point.charge ? `took over ${nightName(point.charge)}` : '';
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
// name in the key, in the lists and in a day's title. The first three go by the
// names training, validation and test go by, as the Live version card's
// 'Trained on' does (#334): 'Studied' and 'Used to decide when to stop' were
// words of the strip's own. The validation days carry a note on how they decide
// when training stops (#324), after their name in the key (#334), where the lists
// are now for a screen reader alone
//
const KINDS = [
    { key: 'studied', listed: 'studied', look: 'model-day-studied', name: 'Trained on', list: 'Trained on', title: 'trained on' },
    {
        key: 'stopping',
        listed: 'stopping',
        look: 'model-day-stopping',
        name: 'Validation, never trained on',
        list: 'Validation',
        title: 'validation, never trained on',
        note: 'The model never trains on these days. After each epoch it’s scored on them, and training stops once that score stops getting better. It keeps the epoch that scored best.',
    },
    { key: 'test', listed: null, look: 'model-day-test', name: 'Test, never trained on', list: 'Test', title: 'test, never trained on' },
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

/**
 * the days fine-tuning trained on (#334), as the key, the lists and a day's title
 * name them, and the note after their name in the key. A new version that passes
 * its test is trained a little more on its test days and on a few older days it
 * already trained on, so a mark of their own would hide which of the two each day
 * was: they keep their kind's look, and a corner of the box marks them -- see
 * '.model-day-tuned' in '_model.scss'. The note says what fine-tuning is and
 * when the version from before it goes live instead, in the words the panel's
 * boxes use -- the simple guess -- by the trainer's numbers in scores.js.
 */
export const TUNED = {
    key: 'tuned',
    name: 'Fine-tuned on after the test',
    list: 'Fine-tuned on after the test',
    title: 'fine-tuned on after the test',
    note: `Once a new version beats the simple guess on its ${HELD_OUT} test days, it’s trained a little more on those days, plus ${FINE_TUNE_OLDER} `
        + 'older days it already trained on, picked at random. Then it’s scored on the validation days again. If it does more than '
        + `${formatGap(FINE_TUNE_SLACK, 'loss')} worse there than before, the version from before the fine-tune goes live instead.`,
};

//
// the strip of a night's test days alone, until its history lists the rest:
// each day a box with its date in it, after the name of its month where the
// month begins. The lists under it say the same in words, to a screen reader
//
function DayStrip({ days }) {
    return (
        <div className='model-day-strip' aria-hidden='true'>
            {days.map((day, at) => (
                <React.Fragment key={day}>
                    {!at || monthOf(day) !== monthOf(days[at - 1]) ? <span className='model-day-month'>{monthOf(day)}</span> : null}
                    <span className='model-day model-day-test' title={`${shortDay(day)}: test, never trained on`}>
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
// with its days; a day listed twice is drawn once, as the first kind it is.
// Each day of `tuned`, the days fine-tuning trained on, keeps its kind's look
// and is marked by a corner of its box, and its title says so too (#334)
//
function FullStrip({ drawn, tuned }) {
    const kindOf = {};
    const fineTuned = new Set(tuned);

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
                        <span
                            key={day}
                            className={`model-day ${kindOf[day].look}${fineTuned.has(day) ? ' model-day-tuned' : ''}`}
                            title={`${shortDay(day)}: ${kindOf[day].title}${fineTuned.has(day) ? `; ${TUNED.title}` : ''}`}
                        >
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
    tuned: PropTypes.arrayOf(PropTypes.string).isRequired,
};

/**
 * the kinds of day a night's history lists (#318), each with its days, oldest
 * first, in KINDS' order -- its test days among them -- and only those it has
 * days of. None until the history lists the days the night trained on, as a
 * history from before format 8 doesn't.
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
 * the days fine-tuning trained on (#334), oldest first, as a night's history
 * lists them: its test days and a few older days it trained on. None for a
 * night that wasn't fine-tuned, or whose history doesn't say.
 */
export function tunedDays(days) {
    return days && Array.isArray(days.tuned) ? days.tuned.slice().sort() : [];
}

//
// a kind's name in the key, after a swatch of its look, and after the name, the
// kind's note where it has one (#334). The swatch alone is hidden from a screen
// reader: the key holds the notes' icons now, which a reader must be able to
// reach, where it had been hidden whole while the lists held the one note
//
function KeyItem({ look, name, note = '' }) {
    return (
        <li>
            <span className={`model-day-swatch ${look}`} aria-hidden='true' />
            {note ? <InfoNote note={note} className='model-noted'>{name}</InfoNote> : name}
        </li>
    );
}

KeyItem.propTypes = {
    look: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    note: PropTypes.string,
};

/**
 * which days a night used (#318). Where its history lists them, every day it
 * trained on, validated on, was tested on, skipped, had no result for yet or
 * didn't pick, as a strip, and a key of the kinds drawn, the days fine-tuning
 * trained on marked in the strip and keyed last (#334). A line of each in words
 * is for a screen reader alone (#334), as the strip and its key had said it all
 * over again on the screen.
 *
 * Until the history lists them, its test days, as a strip, and how many earlier
 * days it trained on or validated on, 'Training and validation: 10 earlier days',
 * a count no strip shows. The test days' line in words is for a screen reader
 * alone, as the full strip's lines are. Nothing for a night that says none of it.
 */
function DaysUsed({ test, studied, days = null }) {
    const drawn = daysDrawn(test, days);
    const tuned = tunedDays(days);

    if (!drawn && !test.length && studied === null) {
        return null;
    }

    if (drawn) {
        return (
            <div className='model-night-days'>
                <h6 className='model-night-days-title'>Which days it used</h6>
                <FullStrip drawn={drawn} tuned={tuned} />
                <ul className='model-day-legend'>
                    {drawn.map((kind) => <KeyItem key={kind.key} look={kind.look} name={kind.name} note={kind.note} />)}
                    {tuned.length ? <KeyItem key={TUNED.key} look='model-day-swatch-tuned' name={TUNED.name} note={TUNED.note} /> : null}
                </ul>
                <dl className='model-day-lists visually-hidden'>
                    {drawn.concat(tuned.length ? [{ ...TUNED, days: tuned }] : []).map((kind) => (
                        <div key={kind.key}>
                            <dt>{kind.list}</dt>
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
                        <ul className='model-day-legend'>
                            <KeyItem look='model-day-test' name='Test, never trained on' />
                        </ul>
                    </>
                ) : null}
            <dl className={studied === null ? 'model-day-lists visually-hidden' : 'model-day-lists'}>
                {studied === null
                    ? null
                    : (
                        <div>
                            <dt>Training and validation</dt>
                            <dd>{`${studied} earlier ${studied === 1 ? 'day' : 'days'}`}</dd>
                        </div>
                    )}
                {test.length
                    ? (
                        <div className='visually-hidden'>
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
// them (#318), and the days fine-tuning trained on (#334)
//
const LISTED = PropTypes.shape({
    studied: PropTypes.arrayOf(PropTypes.string),
    stopping: PropTypes.arrayOf(PropTypes.string),
    skipped: PropTypes.arrayOf(PropTypes.string),
    pending: PropTypes.arrayOf(PropTypes.string),
    unpicked: PropTypes.arrayOf(PropTypes.string),
    tuned: PropTypes.arrayOf(PropTypes.string),
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
        {
            key: 'live',
            name: 'Version in charge',
            mark: marks.live,
            value: point.first ? 'none yet' : formatScore(point.live, score),
            since: chargeWords(point),
        },
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
                        {box.since ? <span className='model-night-box-since'>{box.since}</span> : null}
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
        charge: PropTypes.string,
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
