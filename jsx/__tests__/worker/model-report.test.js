/**
 * model-report.test.js: the model api's web-worker (#243).
 *
 * It reads the listing of models and a model's two csv reports, and works out
 * each day's 20-day averages of a track record. Most of the cases below drive
 * the imported function in this process, the way the stream workers' tests do:
 * it assigns self.onmessage, and the handler is handed a synthetic event.
 *
 * The last block runs it as the bundle does. A worker is built from the
 * function's TEXT -- see web-worker.js -- so anything it reaches for outside
 * itself, a helper babel adds included, is not there when it runs. That block
 * builds the file with the project's own babel config, takes the function's
 * text, and runs it with nothing in scope but `self`. Under coverage the
 * imported copy carries istanbul's counters, which is why the built one is
 * transformed here rather than imported.
 */

import fs from 'fs';
import path from 'path';
import { transformSync } from '@babel/core';
import modelReport from '../../import/worker/model/report.js';

const SOURCE = path.join(__dirname, '../../import/worker/model/report.js');

//
// what the worker posts for one message, run in this process
//
function run(data) {
    const posted = [];
    const realPostMessage = self.postMessage;

    self.postMessage = (answer) => posted.push(answer);

    try {
        modelReport();
        self.onmessage({ data: data });
    } finally {
        self.postMessage = realPostMessage;
        self.onmessage = null;
    }

    return posted[0];
}

const SCORES = ['loss', 'auc_up', 'auc_beats', 'acc_up'];

//
// a csv from a header and its rows
//
function csv(header, rows) {
    return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

const TRACK_HEADER = ['day', ...SCORES, ...SCORES.map((score) => `baseline_${score}`)];

//
// a track record row whose loss is `loss`, the other scores fixed, and the
// baseline's loss `base`
//
function trackRow(day, loss, base = 1.7) {
    return [day, loss, 0.55, 0.52, 0.53, base, 0.5, 0.5, 0.5];
}

function listingOf(models, tasks = [{ id: 'direction', name: 'Next-day direction', description: 'Up or down' }]) {
    return { tasks: tasks, models: models };
}

function entry(overrides = {}) {
    return {
        name: 'pt-gnn',
        task: 'direction',
        description: 'A graph model',
        started: '2026-09-01',
        retired: null,
        scored_days: 30,
        live: { since: '2026-10-10', kind: 'nightly' },
        attempts: { total: 30, went_live: 4 },
        score: { loss: 1.6, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54 },
        baseline: { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.52 },
        ...overrides,
    };
}

describe('the listing', () => {
    it('reads every model as the pages draw it', () => {
        const answer = run({ kind: 'list', report: listingOf([entry()]) });

        expect(answer.kind).toBe('list');
        expect(answer.name).toBeNull();
        expect(answer.models).toEqual([{
            name: 'pt-gnn',
            task: 'direction',
            description: 'A graph model',
            started: '2026-09-01',
            retired: null,
            scored_days: 30,
            live: { since: '2026-10-10', kind: 'nightly' },
            attempts: { total: 30, went_live: 4 },
            score: { loss: 1.6, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54 },
            baseline: { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.52 },
        }]);
        expect(answer.tasks).toEqual([{ id: 'direction', name: 'Next-day direction', description: 'Up or down' }]);
    });

    it('passes over a model with no name or no task, and a name listed twice', () => {
        const answer = run({
            kind: 'list',
            report: listingOf([entry(), entry({ name: '' }), entry({ name: 'x', task: ' ' }), entry({ description: 'again' }), 'junk', null]),
        });

        expect(answer.models.map((model) => model.description)).toEqual(['A graph model']);
    });

    it('keeps the listing\'s order of tasks, names one it does not describe by its id, and drops one with no models', () => {
        const answer = run({
            kind: 'list',
            report: listingOf(
                [entry({ name: 'a', task: 'beats' }), entry({ name: 'b', task: 'mystery' }), entry({ name: 'c' })],
                [
                    { id: 'direction', name: 'Next-day direction', description: '' },
                    { id: 'empty', name: 'Nothing here', description: '' },
                    { id: 'beats', name: '', description: 'Beat the average' },
                    { id: 'beats', name: 'Twice', description: '' },
                    { name: 'no id' },
                ],
            ),
        });

        expect(answer.tasks).toEqual([
            { id: 'direction', name: 'Next-day direction', description: '' },
            { id: 'beats', name: 'beats', description: 'Beat the average' },
            { id: 'mystery', name: 'mystery', description: '' },
        ]);
    });

    it('reads what is missing or malformed as nothing, rather than as a guess', () => {
        const [model] = run({
            kind: 'list',
            report: {
                models: [entry({
                    description: 7,
                    started: 'soon',
                    retired: '2026-10-01',
                    scored_days: -3,
                    live: { since: 'yesterday', kind: 'monthly' },
                    attempts: { total: 2.5, went_live: '' },
                    score: { loss: '', auc_up: 'NaN', auc_beats: null, acc_up: '0.5' },
                    baseline: [1, 2],
                })],
            },
        }).models;

        expect(model).toMatchObject({
            description: '',
            started: null,
            retired: '2026-10-01',
            scored_days: 0,
            live: { since: null, kind: null },
            attempts: { total: 0, went_live: 0 },
            score: { loss: null, auc_up: null, auc_beats: null, acc_up: 0.5 },
            baseline: null,
        });
    });

    it('reads a live block or an attempts block that is not an object as empty', () => {
        const [model] = run({ kind: 'list', report: listingOf([entry({ live: 'x', attempts: null })]) }).models;

        expect(model.live).toEqual({ since: null, kind: null });
        expect(model.attempts).toEqual({ total: 0, went_live: 0 });
    });

    it('answers no tasks, no models and no format_version for a listing that is not one', () => {
        [null, 'text', [], { models: 'none', format_version: 1 }].forEach((report) => {
            expect(run({ kind: 'list', report: report })).toEqual({ kind: 'list', name: null, tasks: null, models: null, format_version: null });
        });
    });

    it('lists no models for an empty listing, which is not a failure', () => {
        expect(run({ kind: 'list', report: { models: [] } })).toEqual({ kind: 'list', name: null, tasks: [], models: [], format_version: 0 });
    });

    describe('format_version, the layout every model report follows (#248)', () => {
        const asBefore = run({ kind: 'list', report: listingOf([entry(), entry({ name: 'b', task: 'beats' })]) });

        //
        // a listing of the same tasks and models, giving `version` -- or not
        // giving one at all where it is undefined
        //
        function giving(version) {
            const report = listingOf([entry(), entry({ name: 'b', task: 'beats' })]);

            if (version !== undefined) {
                report.format_version = version;
            }

            return run({ kind: 'list', report: report });
        }

        it.each([0, 1, 2])('passes a listing\'s format_version %p on', (version) => {
            expect(giving(version).format_version).toBe(version);
        });

        it.each([
            ['given none', undefined],
            ['given as text', '1'],
            ['a fraction', 1.5],
            ['below zero', -1],
            ['null', null],
            ['not a number at all', { version: 1 }],
            ['infinite', Infinity],
        ])('reads one %s as 0, the reports as first published', (name, version) => {
            expect(giving(version).format_version).toBe(0);
        });

        it.each([undefined, 1, '1', 1.5, -1, null])('reads the tasks and models the same, given %p', (version) => {
            const answer = giving(version);

            expect(answer.tasks).toEqual(asBefore.tasks);
            expect(answer.models).toEqual(asBefore.models);
        });
    });
});

describe('the history', () => {
    const header = ['day', 'kind', 'went_live',
        ...SCORES.map((score) => `attempt_${score}`),
        ...SCORES.map((score) => `live_${score}`),
        ...SCORES.map((score) => `baseline_${score}`)];

    function night(day, kind, went, loss) {
        return [day, kind, went, loss, 0.55, 0.52, 0.53, 1.62, 0.54, 0.51, 0.52, 1.66, 0.5, 0.5, 0.51];
    }

    it('reads every night, oldest first, and names the model it was asked for', () => {
        const answer = run({
            kind: 'history',
            name: 'pt-gnn',
            report: csv(header, [night('2026-10-13', 'nightly', 'false', 1.63), night('2026-10-12', 'weekly', 'true', 1.6)]),
        });

        expect(answer.kind).toBe('history');
        expect(answer.name).toBe('pt-gnn');
        expect(answer.rows).toEqual([
            {
                day: '2026-10-12',
                kind: 'weekly',
                went_live: true,
                started: null,
                training_seconds: null,
                total_seconds: null,
                attempt: { loss: 1.6, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53 },
                live: { loss: 1.62, auc_up: 0.54, auc_beats: 0.51, acc_up: 0.52 },
                baseline: { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.51 },
            },
            expect.objectContaining({ day: '2026-10-13', kind: 'nightly', went_live: false }),
        ]);
    });

    it.each([
        ['true', true], ['True', true], ['1', true],
        ['false', false], ['False', false], ['0', false], ['', false], ['yes', false],
    ])('reads went_live %p as %p', (cell, went) => {
        const [row] = run({ kind: 'history', report: csv(header, [night('2026-10-12', 'nightly', cell, 1.6)]) }).rows;

        expect(row.went_live).toBe(went);
    });

    it('reads a night as a weekly retrain only where it says so', () => {
        const rows = run({
            kind: 'history',
            report: csv(header, [night('2026-10-12', 'WEEKLY', 'true', 1.6), night('2026-10-13', 'retrain', 'true', 1.6)]),
        }).rows;

        expect(rows.map((row) => row.kind)).toEqual(['weekly', 'nightly']);
    });

    it('keeps the later row of a night written twice, and passes over a row with no day', () => {
        const rows = run({
            kind: 'history',
            report: csv(header, [
                night('2026-10-12', 'nightly', 'false', 1.7),
                night('not a day', 'nightly', 'true', 1.5),
                night('2026-10-12', 'nightly', 'true', 1.6),
            ]),
        }).rows;

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ went_live: true, attempt: { loss: 1.6 } });
    });

    it('reads an empty cell, and a row cut short, as no score rather than zero', () => {
        const rows = run({
            kind: 'history',
            report: `${header.join(',')}\r\n2026-10-12,nightly,false,,0.5\r\n\r\n`,
        }).rows;

        expect(rows[0].attempt).toEqual({ loss: null, auc_up: 0.5, auc_beats: null, acc_up: null });
        expect(rows[0].baseline.loss).toBeNull();
    });

    describe('as the trainer writes it from 2026-10-15 on (#247)', () => {
        //
        // today's history carries columns the pages do not read, a score they
        // do not draw among them, and from 2026-10-15 on, the attempt's times
        // right after training_days
        //
        const today = ['day', 'kind', 'went_live', 'attempt', 'held_out_days', 'training_days'];
        const extra = ['attempt_acc_beats', 'live_acc_beats', 'baseline_acc_beats'];
        const timed = [...today, 'started', 'training_seconds', 'total_seconds', ...header.slice(3), ...extra];

        function timedNight(day, started, training, total) {
            return [day, 'nightly', 'false', '1', '3', '250', started, training, total, ...night(day, 'nightly', 'false', 1.6).slice(3), 0.5, 0.5, 0.5];
        }

        it('reads when each night started, as text, and how long it trained and took, in seconds', () => {
            const [row] = run({
                kind: 'history',
                report: csv(timed, [timedNight('2026-10-15', '2026-10-16T07:58:10+00:00', '437.2', '532.4')]),
            }).rows;

            expect(row).toMatchObject({
                day: '2026-10-15',
                started: '2026-10-16T07:58:10+00:00',
                training_seconds: 437.2,
                total_seconds: 532.4,
                attempt: { loss: 1.6, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53 },
            });
        });

        it('reads an older night\'s empty cells as no times, rather than zero or empty text', () => {
            const rows = run({
                kind: 'history',
                report: csv(timed, [
                    timedNight('2026-10-14', '', '', ''),
                    timedNight('2026-10-15', '2026-10-16T07:58:10+00:00', '437.2', '532.4'),
                ]),
            }).rows;

            expect(rows[0]).toMatchObject({ day: '2026-10-14', started: null, training_seconds: null, total_seconds: null });
            expect(rows[1].total_seconds).toBe(532.4);
        });

        it('still reads today\'s history, without the columns, as it did, with no times', () => {
            const before = [...today, ...header.slice(3), ...extra];
            const [row] = run({
                kind: 'history',
                report: csv(before, [['2026-10-13', 'weekly', 'True', '1', '3', '250', ...night('2026-10-13', 'weekly', 'True', 1.6).slice(3), 0.5, 0.5, 0.5]]),
            }).rows;

            expect(row).toEqual({
                day: '2026-10-13',
                kind: 'weekly',
                went_live: true,
                started: null,
                training_seconds: null,
                total_seconds: null,
                attempt: { loss: 1.6, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53 },
                live: { loss: 1.62, auc_up: 0.54, auc_beats: 0.51, acc_up: 0.52 },
                baseline: { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.51 },
            });
        });
    });
});

describe('the track record', () => {
    //
    // `count` trading days from 2026-09-01, a weekday each, so a weekend is a gap
    //
    function weekdays(count) {
        const days = [];
        const at = new Date('2026-09-01T12:00:00Z');

        while (days.length < count) {
            if (at.getUTCDay() !== 0 && at.getUTCDay() !== 6) {
                days.push(at.toISOString().slice(0, 10));
            }

            at.setUTCDate(at.getUTCDate() + 1);
        }

        return days;
    }

    it('averages each day over the rows so far, while there are fewer than 20', () => {
        const rows = run({
            kind: 'track-record',
            report: csv(TRACK_HEADER, [trackRow('2026-10-12', 1.6, 1.7), trackRow('2026-10-13', 1.8, 1.6)]),
        }).rows;

        expect(rows[0]).toMatchObject({ day: '2026-10-12', days: 1, average: { loss: 1.6 }, baseline_average: { loss: 1.7 } });
        expect(rows[1].days).toBe(2);
        expect(rows[1].average.loss).toBeCloseTo(1.7);
        expect(rows[1].baseline_average.loss).toBeCloseTo(1.65);
        expect(rows[1].score).toEqual({ loss: 1.8, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53 });
        expect(rows[1].baseline).toEqual({ loss: 1.6, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 });
    });

    it('averages each day over its last 20 rows once there are more', () => {
        const days = weekdays(25);
        const rows = run({
            kind: 'track-record',
            report: csv(TRACK_HEADER, days.map((day, at) => trackRow(day, at + 1))),
        }).rows;

        //
        // rows 6 to 25 hold losses 6 to 25, whose mean is 15.5
        //
        expect(rows[24].days).toBe(20);
        expect(rows[24].average.loss).toBeCloseTo(15.5);
        expect(rows[19].average.loss).toBeCloseTo(10.5);
    });

    it('counts a model\'s scored days, not the calendar: a day it was not running neither counts nor shortens the window', () => {
        //
        // a fortnight off in the middle: the 20 rows ending at the last still
        // reach back across it
        //
        const before = weekdays(10);
        const after = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
            '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
        const rows = run({
            kind: 'track-record',
            report: csv(TRACK_HEADER, before.concat(after).map((day) => trackRow(day, day < '2026-10-01' ? 1 : 3))),
        }).rows;

        expect(rows).toHaveLength(20);
        expect(rows[19].days).toBe(20);
        expect(rows[19].average.loss).toBeCloseTo(2);
    });

    it('leaves a day with no score out of the average rather than reading it as zero', () => {
        const rows = run({
            kind: 'track-record',
            report: csv(TRACK_HEADER, [trackRow('2026-10-12', 1.6), trackRow('2026-10-13', ''), trackRow('2026-10-14', 1.8)]),
        }).rows;

        expect(rows[1].score.loss).toBeNull();
        expect(rows[1].average.loss).toBeCloseTo(1.6);
        expect(rows[2].average.loss).toBeCloseTo(1.7);
        expect(rows[2].days).toBe(3);
    });

    it('averages to nothing where no day so far has the score', () => {
        const [row] = run({ kind: 'track-record', report: csv(TRACK_HEADER, [trackRow('2026-10-12', '')]) }).rows;

        expect(row.average.loss).toBeNull();
    });
});

describe('a report with nothing in it, and one that is not a report', () => {
    it.each(['history', 'track-record'])('%s answered with null, or with no rows, has none yet', (kind) => {
        expect(run({ kind: kind, report: null }).rows).toEqual([]);
        expect(run({ kind: kind }).rows).toEqual([]);
        expect(run({ kind: kind, report: '' }).rows).toEqual([]);
        expect(run({ kind: kind, report: TRACK_HEADER.join(',') }).rows).toEqual([]);
    });

    it.each(['history', 'track-record'])('%s answered with something other than text is not one', (kind) => {
        expect(run({ kind: kind, report: { rows: [] } }).rows).toBeNull();
    });

    it('answers a kind it does not know with no rows', () => {
        expect(run({ kind: 'forecast', report: 'day\n2026-10-12' })).toEqual({ kind: 'forecast', name: null, rows: null });
    });

    it('answers a message that is not an object', () => {
        expect(run('history')).toEqual({ kind: undefined, name: null, rows: null });
    });
});

describe('the worker as the bundle builds it', () => {
    //
    // the file as babel-loader hands it to webpack, under the project's .babelrc,
    // and the exported function's text, as WorkerBuilder takes it
    //
    function builtText() {
        const { code } = transformSync(fs.readFileSync(SOURCE, 'utf8'), {
            filename: SOURCE,
            cwd: path.join(__dirname, '../..'),
        });
        const module = { exports: {} };

        new Function('module', 'exports', 'require', code)(module, module.exports, () => {
            throw new Error('the worker requires nothing');
        });

        return module.exports.default.toString();
    }

    //
    // the text run as a blob runs it: `(${text})()`, with only `self` in scope
    //
    function runBuilt(data) {
        const posted = [];
        const self = { postMessage: (answer) => posted.push(answer) };

        new Function('self', `(${builtText()})()`)(self);
        self.onmessage({ data: data });

        return posted[0];
    }

    it('needs nothing from outside its own text', () => {
        expect(() => runBuilt({ kind: 'list', report: listingOf([entry()]) })).not.toThrow();
    });

    it('carries none of the helpers babel writes for a spread, for...of or typeof', () => {
        expect(builtText()).not.toMatch(/_typeof|_toConsumableArray|_createForOfIteratorHelper|_objectSpread|_defineProperty/);
    });

    it('answers as the imported function does', () => {
        const messages = [
            { kind: 'list', report: listingOf([entry(), entry({ name: 'b', task: 'beats' })]) },
            { kind: 'list', report: { format_version: 1, tasks: [], models: [entry()] } },
            { kind: 'list', report: { format_version: '1', models: [] } },
            { kind: 'history', name: 'pt-gnn', report: 'day,kind,went_live,attempt_loss\n2026-10-12,weekly,True,1.6' },
            {
                kind: 'history',
                report: 'day,kind,went_live,started,training_seconds,total_seconds,attempt_loss\n2026-10-14,nightly,false,,,,1.6\n2026-10-15,nightly,true,2026-10-16T07:58:10+00:00,437.2,532.4,1.59',
            },
            { kind: 'track-record', report: csv(TRACK_HEADER, [trackRow('2026-10-12', 1.6), trackRow('2026-10-13', 1.8)]) },
            { kind: 'track-record', report: 4 },
        ];

        messages.forEach((data) => {
            expect(runBuilt(data)).toEqual(run(data));
        });
    });
});
