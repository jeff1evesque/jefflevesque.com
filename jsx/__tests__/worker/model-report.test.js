/**
 * model-report.test.js: the model api's web-worker (#243).
 *
 * It reads the listing of models and a model's two csv reports, and works out
 * each day's averages of a track record, over the listing's `average_days`
 * (#293). Most of the cases below drive
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
// the three scores loss adds up (#265), and how a set of scores reads where it
// does not give them: the listing, and a report written before them
//
const PARTS = ['up_log_loss', 'beats_log_loss', 'move_pinball'];
const NO_PARTS = { up_log_loss: null, beats_log_loss: null, move_pinball: null };

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
            average_days: 20,
            live: { since: '2026-10-10', kind: 'nightly', days: null, fine_tune: null },
            attempts: { total: 30, went_live: 4 },
            score: { loss: 1.6, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54, ...NO_PARTS },
            baseline: { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.52, ...NO_PARTS },
            down: null,
            behind: [],
        }]);
        expect(answer.tasks).toEqual([{ id: 'direction', name: 'Next-day direction', description: 'Up or down' }]);
        expect(answer.average_days).toBe(20);
    });

    it('reads no parts of loss, which the listing does not carry (#265)', () => {
        const [model] = run({ kind: 'list', report: listingOf([entry()]) }).models;

        expect(model.score).toMatchObject(NO_PARTS);
        expect(model.baseline).toMatchObject(NO_PARTS);
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

    it('passes over a task that is not an object, and reads a model\'s scores that are not an object as none', () => {
        const answer = run({ kind: 'list', report: listingOf([entry({ score: 'high', baseline: null })], ['direction', null, { id: 'direction', name: 'Next-day direction', description: '' }]) });

        expect(answer.tasks).toEqual([{ id: 'direction', name: 'Next-day direction', description: '' }]);
        expect(answer.models[0]).toMatchObject({ score: null, baseline: null });
    });

    it('reads a live block or an attempts block that is not an object as empty', () => {
        const [model] = run({ kind: 'list', report: listingOf([entry({ live: 'x', attempts: null })]) }).models;

        expect(model.live).toEqual({ since: null, kind: null, days: null, fine_tune: null });
        expect(model.attempts).toEqual({ total: 0, went_live: 0 });
    });

    it('answers no tasks, no models, no format_version and no average_days for a listing that is not one', () => {
        [null, 'text', [], { models: 'none', format_version: 1, average_days: 30 }].forEach((report) => {
            expect(run({ kind: 'list', report: report }))
                .toEqual({ kind: 'list', name: null, tasks: null, models: null, format_version: null, average_days: null });
        });
    });

    it('lists no models for an empty listing, which is not a failure', () => {
        expect(run({ kind: 'list', report: { models: [] } }))
            .toEqual({ kind: 'list', name: null, tasks: [], models: [], format_version: 0, average_days: 20 });
    });

    describe('average_days, how many scored days a model\'s scores average, from format 4 on (#293)', () => {
        //
        // a listing of two models, giving `days` -- or not giving any at all
        // where it is undefined
        //
        function giving(days) {
            const report = listingOf([entry(), entry({ name: 'b', scored_days: 25 })]);

            if (days !== undefined) {
                report.average_days = days;
            }

            return run({ kind: 'list', report: report });
        }

        it('passes the listing\'s on, and gives it to every model, so whatever has a model has its number', () => {
            const answer = giving(30);

            expect(answer.average_days).toBe(30);
            expect(answer.models.map((model) => model.average_days)).toEqual([30, 30]);
        });

        it('passes on any whole number of 1 or more', () => {
            expect(giving(1).average_days).toBe(1);
            expect(giving(60).models[1].average_days).toBe(60);
        });

        it.each([
            ['given none, as before format 4', undefined],
            ['given as text', '30'],
            ['a fraction', 2.5],
            ['zero', 0],
            ['below zero', -20],
            ['null', null],
            ['not a number at all', { days: 30 }],
            ['infinite', Infinity],
        ])('reads one %s as 20, as the trainer averaged before it said', (name, days) => {
            const answer = giving(days);

            expect(answer.average_days).toBe(20);
            expect(answer.models.map((model) => model.average_days)).toEqual([20, 20]);
        });

        it('reads everything else the same, whatever it gives', () => {
            const without = (models) => models.map(({ average_days, ...rest }) => rest);

            expect(without(giving(30).models)).toEqual(without(giving(undefined).models));
            expect(giving(30).tasks).toEqual(giving(undefined).tasks);
        });
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

    describe('a live version taken down, and how close each check is, from format 2 on (#263)', () => {
        const DOWN = { since: '2026-10-19', days: 1, in_a_row: 5 };
        const BEHIND = [
            { days: 1, in_a_row: 5, limit: 5 },
            { days: 5, in_a_row: 0, limit: 10 },
            { days: 20, in_a_row: null, limit: 5 },
        ];

        //
        // the one model a listing of `overrides` reads as
        //
        const read = (overrides) => run({ kind: 'list', report: listingOf([entry(overrides)]) }).models[0];

        it('keeps the night it was taken down, the check that did it, and every check, as one taken down for doing worse', () => {
            const model = read({ down: DOWN, behind: BEHIND });

            expect(model.down).toEqual({ ...DOWN, reason: 'worse' });
            expect(model.behind).toEqual(BEHIND);
        });

        it('reads a model whose live version is live as none taken down, and a listing before format 2 as giving no checks', () => {
            expect(read({ down: null, behind: BEHIND }).down).toBeNull();
            expect(read({})).toMatchObject({ down: null, behind: [] });
        });

        it.each([
            ['names no night', { ...DOWN, since: null }],
            ['names a night that is not a day', { ...DOWN, since: 'last night' }],
            ['is not an object', 'yes'],
            ['is a list', [DOWN]],
        ])('reads one that %s as none, rather than as a guess', (name, down) => {
            expect(read({ down: down }).down).toBeNull();
        });

        it.each([
            ['gives its check as text', { ...DOWN, days: '1' }, { days: null }],
            ['gives a check of no days', { ...DOWN, days: 0 }, { days: null }],
            ['gives a fraction of a day', { ...DOWN, days: 1.5 }, { days: null }],
            ['gives none in a row', { ...DOWN, in_a_row: 0 }, { in_a_row: null }],
            ['gives its count as text', { ...DOWN, in_a_row: '5' }, { in_a_row: null }],
        ])('reads one that %s as taken down, with that count as none, rather than as live (#295)', (name, down, counts) => {
            expect(read({ down: down }).down).toEqual({ ...DOWN, reason: 'worse', ...counts });
        });

        it('trims the night it names, as every other day', () => {
            expect(read({ down: { ...DOWN, since: ' 2026-10-19 ' } }).down.since).toBe('2026-10-19');
        });

        it('passes over a check that is not whole, and keeps the rest in the listing\'s order', () => {
            const model = read({
                behind: [
                    BEHIND[0],
                    { days: 5, in_a_row: -1, limit: 10 },
                    { days: 5, in_a_row: 1.5, limit: 10 },
                    { days: 5, in_a_row: '2', limit: 10 },
                    { days: 5, limit: 10 },
                    { days: 0, in_a_row: 1, limit: 10 },
                    { days: 20, in_a_row: 1, limit: '5' },
                    'each day',
                    null,
                    BEHIND[2],
                ],
            });

            expect(model.behind).toEqual([BEHIND[0], BEHIND[2]]);
        });

        it('reads checks that are not a list as none', () => {
            expect(read({ behind: { days: 1, in_a_row: 2, limit: 5 } }).behind).toEqual([]);
        });
    });

    describe('why a live version was taken down, from format 4 on (#295)', () => {
        const SINCE = '2026-10-23';

        //
        // the take-down a format 4 listing of one model taken down `down` reads as
        //
        const read = (down) => run({ kind: 'list', report: { format_version: 4, ...listingOf([entry({ down: down })]) } }).models[0].down;

        it('keeps one for doing worse, with the check that did it', () => {
            expect(read({ since: SINCE, reason: 'worse', days: 5, in_a_row: 10 }))
                .toEqual({ since: SINCE, reason: 'worse', days: 5, in_a_row: 10 });
        });

        it.each(['not_ahead', 'track_record'])('keeps one for %s, which names no check', (reason) => {
            expect(read({ since: SINCE, reason: reason, days: null, in_a_row: null }))
                .toEqual({ since: SINCE, reason: reason, days: null, in_a_row: null });
        });

        it('reads one that leaves its counts out as one with none', () => {
            expect(read({ since: SINCE, reason: 'not_ahead' })).toEqual({ since: SINCE, reason: 'not_ahead', days: null, in_a_row: null });
        });

        it.each([
            ['gives none', undefined],
            ['is null', null],
            ['is one it does not know', 'bored'],
            ['is not text', 2],
            ['is in capitals', 'NOT_AHEAD'],
        ])('reads one whose reason %s as one for doing worse, as every one before format 4', (name, reason) => {
            const down = { since: SINCE, days: 1, in_a_row: 5 };

            if (reason !== undefined) {
                down.reason = reason;
            }

            expect(read(down)).toEqual({ since: SINCE, reason: 'worse', days: 1, in_a_row: 5 });
        });

        it('keeps the hold an options model\'s was of, whatever the reason', () => {
            expect(read({ since: SINCE, reason: 'track_record', days: null, in_a_row: null, hold: 5 }))
                .toEqual({ since: SINCE, reason: 'track_record', days: null, in_a_row: null, hold: 5 });
        });
    });

    describe('what a live version learned from, from format 4 on (#295)', () => {
        const DAYS = { training: 7, stopping: 3, first: '2026-10-05', last: '2026-10-19' };

        //
        // the live version a listing of one model whose live version learned from
        // `days` reads as
        //
        const read = (days) => run({ kind: 'list', report: listingOf([entry({ live: { since: '2026-10-23', kind: 'first', days: days } })]) }).models[0].live;

        it('keeps the days it trained on, those that decided when it stopped, and the first and last of them', () => {
            expect(read(DAYS)).toEqual({ since: '2026-10-23', kind: 'first', days: DAYS, fine_tune: null });
        });

        it('keeps a version that learned from one day, and trims the days it names, as every other day', () => {
            expect(read({ training: 1, stopping: 0, first: ' 2026-10-19', last: '2026-10-19 ' }).days)
                .toEqual({ training: 1, stopping: 0, first: '2026-10-19', last: '2026-10-19' });
        });

        it.each([['text', '3'], ['a fraction', 2.5], ['below zero', -1], ['left out', undefined]])(
            'reads the days that decided when it stopped, given as %s, as none, and keeps the rest',
            (name, stopping) => {
                expect(read({ ...DAYS, stopping: stopping }).days).toEqual({ ...DAYS, stopping: null });
            },
        );

        it.each([
            ['gives none, as before format 4', undefined],
            ['is null', null],
            ['is not an object', '7 days'],
            ['is a list', [DAYS]],
            ['gives the days it trained on as text', { ...DAYS, training: '7' }],
            ['gives a fraction of a day', { ...DAYS, training: 6.5 }],
            ['trained on no days', { ...DAYS, training: 0 }],
            ['names no first day', { ...DAYS, first: null }],
            ['names a last day that is not a day', { ...DAYS, last: 'yesterday' }],
        ])('reads one that %s as none, rather than as a guess', (name, days) => {
            expect(read(days).days).toBeNull();
        });
    });

    describe('the check of the live version\'s fine-tune, from format 6 on (#315)', () => {
        const CHECK = { passed: true, by: 0.0021, slack: 0.005 };

        //
        // the check a listing of one model whose live version's fine-tune was
        // checked as `check` reads as
        //
        const read = (check) => run({ kind: 'list', report: listingOf([entry({ live: { since: '2026-10-28', kind: 'nightly', fine_tune: check } })]) }).models[0].live.fine_tune;

        it('keeps whether it passed, by how much it beat the tested model, and how much worse it may do', () => {
            expect(read(CHECK)).toEqual(CHECK);
            expect(read({ passed: false, by: -0.0079, slack: 0.005 })).toEqual({ passed: false, by: -0.0079, slack: 0.005 });
            expect(read({ ...CHECK, slack: 0 })).toEqual({ ...CHECK, slack: 0 });
        });

        it.each([
            ['gives none, as before format 6', undefined],
            ['is null', null],
            ['is not an object', 'passed'],
            ['says whether it passed as text', { ...CHECK, passed: 'true' }],
            ['gives no gap', { ...CHECK, by: null }],
            ['gives a gap that is not a number', { ...CHECK, by: 'small' }],
            ['gives no slack', { ...CHECK, slack: undefined }],
            ['gives a slack below zero', { ...CHECK, slack: -0.005 }],
        ])('reads one that %s as none, rather than as a guess', (name, check) => {
            expect(read(check)).toBeNull();
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
                tested: '2026-10-13',
                from: null,
                kind: 'weekly',
                went_live: true,
                trained_again: null,
                held_out_days: [],
                training_days: null,
                studied_days: [],
                stopping_days: [],
                skipped_days: [],
                pending_days: [],
                unpicked_days: [],
                started: null,
                training_seconds: null,
                total_seconds: null,
                trained_again_seconds: null,
                attempt: { loss: 1.6, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53, ...NO_PARTS },
                live: { loss: 1.62, auc_up: 0.54, auc_beats: 0.51, acc_up: 0.52, ...NO_PARTS },
                baseline: { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.51, ...NO_PARTS },
            },
            expect.objectContaining({ day: '2026-10-13', tested: '2026-10-14', from: '2026-10-13', kind: 'nightly', went_live: false }),
        ]);
    });

    describe('each night\'s test (#318)', () => {
        const tests = ['day', 'kind', 'went_live', 'held_out_days', 'training_days', 'started', 'trained_again', 'trained_again_seconds', 'attempt_loss'];

        //
        // a night of a format 6 history, its cells as the trainer writes them,
        // each but its day overridden by name
        //
        function tested(day, cells = {}) {
            const row = {
                kind: 'nightly',
                went_live: 'false',
                held_out_days: '2026-10-20 2026-10-21 2026-10-22',
                training_days: '10',
                started: '',
                trained_again: '',
                trained_again_seconds: '',
                attempt_loss: '0.576',
                ...cells,
            };

            return [day, ...tests.slice(1).map((name) => row[name])];
        }

        const read = (...nights) => run({ kind: 'history', report: csv(tests, nights) }).rows;

        it.each([
            ['the morning after', '2026-10-27T09:32:33+00:00', '2026-10-27'],
            ['the evening before, in New York', '2026-10-28T02:30:00+00:00', '2026-10-27'],
            ['a weekend afternoon', '2026-10-17T17:46:21+00:00', '2026-10-17'],
            ['its own offset', '2026-10-27T05:32:33-04:00', '2026-10-27'],
        ])('names a night for the morning its test ran, in Eastern time: %s', (when, started, morning) => {
            const [row] = read(tested('2026-10-26', { started: started }));

            expect(row.tested).toBe(morning);
        });

        it.each([
            ['no start', ''],
            ['text that is not an instant', 'soon'],
            ['an instant with no offset', '2026-10-27T09:32:33'],
        ])('names a night with %s for the day after its own', (what, started) => {
            const [friday, monday] = read(tested('2026-10-23', { started: started }), tested('2026-10-26', { started: started }));

            expect([friday.tested, monday.tested]).toEqual(['2026-10-24', '2026-10-27']);
        });

        it('says for a nightly update the morning the version it started from took over: the newest night before it that went live', () => {
            const rows = read(
                tested('2026-10-21', { kind: 'weekly', went_live: 'true', started: '2026-10-22T09:50:05+00:00' }),
                tested('2026-10-22', { went_live: 'true', started: '2026-10-23T10:22:26+00:00' }),
                tested('2026-10-23', { kind: 'weekly', went_live: 'true', started: '2026-10-24T10:23:41+00:00' }),
                tested('2026-10-26', { went_live: 'true', started: '2026-10-27T09:32:33+00:00' }),
                tested('2026-10-27', { started: '2026-10-28T09:39:38+00:00' }),
                tested('2026-10-28', { started: '2026-10-29T09:40:00+00:00' }),
            );

            expect(rows.map((row) => row.from)).toEqual([null, '2026-10-22', null, '2026-10-24', '2026-10-27', '2026-10-27']);
        });

        it('says none for a nightly update with no night before it that went live, nor for a weekly retrain, which starts from scratch', () => {
            const rows = read(tested('2026-10-21'), tested('2026-10-22'), tested('2026-10-23', { kind: 'weekly' }));

            expect(rows.map((row) => row.from)).toEqual([null, null, null]);
        });

        it('lists its test days, oldest first, each a day, and passes over anything that is not one', () => {
            const [listed, sorted, spaced, bad, none] = read(
                tested('2026-10-26'),
                tested('2026-10-27', { held_out_days: '2026-10-23 2026-10-21 2026-10-22' }),
                tested('2026-10-28', { held_out_days: '  2026-10-22   2026-10-23 2026-10-26 ' }),
                tested('2026-10-29', { held_out_days: '2026-10-23 Oct-26 2026-10-27x 2026-10-26' }),
                tested('2026-10-30', { held_out_days: '' }),
            );

            expect(listed.held_out_days).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
            expect(sorted.held_out_days).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
            expect(spaced.held_out_days).toEqual(['2026-10-22', '2026-10-23', '2026-10-26']);
            expect(bad.held_out_days).toEqual(['2026-10-23', '2026-10-26']);
            expect(none.held_out_days).toEqual([]);
        });

        it('lists the days it studied, used to stop, skipped, had no results for yet and left unpicked, once the trainer writes them, and none until then', () => {
            const lists = ['studied_days', 'stopping_days', 'skipped_days', 'pending_days', 'unpicked_days'];
            const cells = ['2026-10-12 2026-10-06 2026-10-08', '2026-10-05 2026-10-07', '2026-10-16', '2026-10-23 2026-10-26', '2026-10-09 not-a-day'];
            const [written] = run({ kind: 'history', report: csv(tests.concat(lists), [tested('2026-10-26').concat(cells)]) }).rows;
            const [older] = read(tested('2026-10-26'));

            expect(lists.map((name) => written[name])).toEqual([
                ['2026-10-06', '2026-10-08', '2026-10-12'],
                ['2026-10-05', '2026-10-07'],
                ['2026-10-16'],
                ['2026-10-23', '2026-10-26'],
                ['2026-10-09'],
            ]);
            lists.forEach((name) => expect(older[name]).toEqual([]));
        });

        it.each([
            ['10', 10], ['1', 1], ['0', null], ['2.5', null], ['-3', null], ['', null], ['ten', null],
        ])('reads training_days %p as %p: a whole count of at least one day', (cell, days) => {
            const [row] = read(tested('2026-10-26', { training_days: cell }));

            expect(row.training_days).toBe(days);
        });

        it.each([
            ['657.7', 657.7], ['0', 0], ['4.1', 4.1], ['', null], ['-3', null], ['abc', null],
        ])('reads trained_again_seconds %p as %p: seconds, none where there was no second pass', (cell, seconds) => {
            const [row] = read(tested('2026-10-27', { trained_again: 'true', trained_again_seconds: cell }));

            expect(row.trained_again_seconds).toBe(seconds);
        });
    });

    describe('trained_again, from the trainer\'s format 6 (#315)', () => {
        const sixth = ['day', 'kind', 'went_live', 'trained_again', ...header.slice(3)];

        function judged(day, went, again) {
            return [day, 'nightly', went, again, ...night(day, 'nightly', went, 1.6).slice(3)];
        }

        it.each([
            ['true', true], ['True', true], ['1', true],
            ['false', false], ['False', false], ['0', false],
            ['', null], [' ', null], ['yes', null],
        ])('reads trained_again %p as %p', (cell, again) => {
            const [row] = run({ kind: 'history', report: csv(sixth, [judged('2026-10-27', 'true', cell)]) }).rows;

            expect(row.trained_again).toBe(again);
        });

        it('reads a night before format 6, its cell empty, as one the live version judged too', () => {
            const rows = run({
                kind: 'history',
                report: csv(sixth, [judged('2026-10-26', 'false', ''), judged('2026-10-27', 'false', 'false')]),
            }).rows;

            expect(rows.map((row) => row.trained_again)).toEqual([null, false]);
        });
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

        expect(rows[0].attempt).toEqual({ loss: null, auc_up: 0.5, auc_beats: null, acc_up: null, ...NO_PARTS });
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
                tested: '2026-10-14',
                from: null,
                kind: 'weekly',
                went_live: true,
                trained_again: null,
                held_out_days: [],
                training_days: 250,
                studied_days: [],
                stopping_days: [],
                skipped_days: [],
                pending_days: [],
                unpicked_days: [],
                started: null,
                training_seconds: null,
                total_seconds: null,
                trained_again_seconds: null,
                attempt: { loss: 1.6, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53, ...NO_PARTS },
                live: { loss: 1.62, auc_up: 0.54, auc_beats: 0.51, acc_up: 0.52, ...NO_PARTS },
                baseline: { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.51, ...NO_PARTS },
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
        expect(rows[1].score).toEqual({ loss: 1.8, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53, ...NO_PARTS });
        expect(rows[1].baseline).toEqual({ loss: 1.6, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5, ...NO_PARTS });
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

    describe('over the days the listing says, from format 4 on (#293)', () => {
        //
        // 25 days whose losses are 1 to 25, asked for with `days` -- or with
        // none at all where it is undefined
        //
        function averagedOver(days) {
            const asked = { kind: 'track-record', report: csv(TRACK_HEADER, weekdays(25).map((day, at) => trackRow(day, at + 1))) };

            if (days !== undefined) {
                asked.average_days = days;
            }

            return run(asked).rows;
        }

        it('averages each day over the last average_days rows it is sent with', () => {
            const rows = averagedOver(3);

            //
            // the last three hold losses 23 to 25, and the three ending at the
            // eleventh 9 to 11
            //
            expect(rows[24].days).toBe(3);
            expect(rows[24].average.loss).toBeCloseTo(24);
            expect(rows[10].average.loss).toBeCloseTo(10);
            expect(rows[1].days).toBe(2);
        });

        it('averages over every row so far while there are fewer than it says', () => {
            const rows = averagedOver(30);

            expect(rows[24].days).toBe(25);
            expect(rows[24].average.loss).toBeCloseTo(13);
        });

        it.each([
            ['sent with none', undefined],
            ['sent with null, as the pages send for no listing', null],
            ['sent with text', '3'],
            ['sent with zero', 0],
            ['sent with a fraction', 2.5],
        ])('averages over 20, %s', (name, days) => {
            const rows = averagedOver(days);

            expect(rows[24].days).toBe(20);
            expect(rows[24].average.loss).toBeCloseTo(15.5);
        });
    });

    describe('the check a day\'s score set off, from format 2 on (#263)', () => {
        const header = [...TRACK_HEADER, 'down_days', 'down_in_a_row'];

        it('reads the check on the day whose score set it off, and none on every other day', () => {
            const rows = run({
                kind: 'track-record',
                report: csv(header, [[...trackRow('2026-10-15', 1.8), '', ''], [...trackRow('2026-10-16', 1.8), 1, 5]]),
            }).rows;

            expect(rows[0]).toMatchObject({ day: '2026-10-15', down_days: null, down_in_a_row: null });
            expect(rows[1]).toMatchObject({ day: '2026-10-16', down_days: 1, down_in_a_row: 5 });
        });

        it('reads a track record written before the columns as no check on any day', () => {
            const [row] = run({ kind: 'track-record', report: csv(TRACK_HEADER, [trackRow('2026-10-15', 1.8)]) }).rows;

            expect(row).toMatchObject({ down_days: null, down_in_a_row: null });
        });

        it.each([['0'], ['1.5'], ['-5'], ['five']])('reads a cell of %p as none', (cell) => {
            const [row] = run({ kind: 'track-record', report: csv(header, [[...trackRow('2026-10-15', 1.8), cell, cell]]) }).rows;

            expect(row).toMatchObject({ down_days: null, down_in_a_row: null });
        });
    });
});

describe('loss\'s three parts, beside the four scores (#265)', () => {
    //
    // a track record as the trainer writes one: the four scores, the model's and
    // the baseline's, and loss's three parts, each loss their sum
    //
    const header = [...TRACK_HEADER, ...PARTS, ...PARTS.map((part) => `baseline_${part}`)];
    const BASE = [0.705, 0.693, 0.262];
    const sum = (values) => values.reduce((total, value) => total + value, 0);

    function partsDay(day, parts, base = BASE) {
        return [day, sum(parts), 0.55, 0.52, 0.53, sum(base), 0.5, 0.5, 0.5, ...parts, ...base];
    }

    //
    // `count` weekdays from 2026-09-01, as the track record's own cases count them
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

    it('reads each part from a track record, the model\'s and the baseline\'s', () => {
        const [row] = run({ kind: 'track-record', report: csv(header, [partsDay('2026-10-12', [0.72, 0.7, 0.29])]) }).rows;

        expect(row.score).toMatchObject({ auc_up: 0.55, auc_beats: 0.52, acc_up: 0.53, up_log_loss: 0.72, beats_log_loss: 0.7, move_pinball: 0.29 });
        expect(row.score.loss).toBeCloseTo(1.71);
        expect(row.baseline).toMatchObject({ up_log_loss: 0.705, beats_log_loss: 0.693, move_pinball: 0.262 });
        expect(row.average).toEqual(row.score);
    });

    it('averages each part over the same 20 days as loss, so the three add up to its average', () => {
        const parts = (at) => [0.7 + at * 0.001, 0.69 + (at % 3) * 0.01, 0.25 + (at % 5) * 0.005];
        const rows = run({
            kind: 'track-record',
            report: csv(header, weekdays(25).map((day, at) => partsDay(day, parts(at), [0.705, 0.693, 0.25 + at * 0.002]))),
        }).rows;
        const last = rows[24];
        const mean = (values) => sum(values) / values.length;

        //
        // the 20 rows ending at the 25th: the 6th to the 25th
        //
        PARTS.forEach((part, which) => {
            expect(last.average[part]).toBeCloseTo(mean([...Array(20).keys()].map((at) => parts(at + 5)[which])), 10);
        });
        expect(last.days).toBe(20);
        expect(sum(PARTS.map((part) => last.average[part]))).toBeCloseTo(last.average.loss, 10);
        expect(sum(PARTS.map((part) => last.baseline_average[part]))).toBeCloseTo(last.baseline_average.loss, 10);
    });

    it('leaves a day without a part out of that part\'s average, as it does a day without a score', () => {
        const rows = run({
            kind: 'track-record',
            report: csv(header, [
                partsDay('2026-10-12', [0.72, 0.7, 0.29]),
                partsDay('2026-10-13', [0.74, 0.7, 0.29]).map((cell, at) => (at === header.indexOf('up_log_loss') ? '' : cell)),
            ]),
        }).rows;

        expect(rows[1].score.up_log_loss).toBeNull();
        expect(rows[1].average.up_log_loss).toBeCloseTo(0.72);
        expect(rows[1].average.beats_log_loss).toBeCloseTo(0.7);
    });

    it('reads each part from a history, under each of its three prefixes', () => {
        const history = ['day', 'kind', 'went_live',
            ...['attempt_', 'live_', 'baseline_'].reduce((columns, prefix) => columns.concat([...SCORES, ...PARTS].map((score) => `${prefix}${score}`)), [])];
        const [row] = run({
            kind: 'history',
            report: csv(history, [[
                '2026-10-12', 'nightly', 'false',
                1.6, 0.55, 0.52, 0.53, 0.72, 0.62, 0.26,
                1.62, 0.54, 0.51, 0.52, 0.71, 0.64, 0.27,
                1.66, 0.5, 0.5, 0.51, 0.705, 0.693, 0.262,
            ]]),
        }).rows;

        expect(row.attempt).toMatchObject({ up_log_loss: 0.72, beats_log_loss: 0.62, move_pinball: 0.26 });
        expect(row.live).toMatchObject({ up_log_loss: 0.71, beats_log_loss: 0.64, move_pinball: 0.27 });
        expect(row.baseline).toMatchObject({ up_log_loss: 0.705, beats_log_loss: 0.693, move_pinball: 0.262 });
    });

    it('reads a track record written before them as no parts, on any day or in any average', () => {
        const [row] = run({ kind: 'track-record', report: csv(TRACK_HEADER, [trackRow('2026-10-15', 1.8)]) }).rows;

        ['score', 'baseline', 'average', 'baseline_average'].forEach((field) => expect(row[field]).toMatchObject(NO_PARTS));
        expect(row.average.loss).toBeCloseTo(1.8);
    });
});

describe('an options model, and every model\'s top 10, from format 3 on (#279)', () => {
    const OPTIONS = ['loss', 'profit_auc', 'top10_gain', 'top10_wins'];
    const HOLDS = ['_1d', '_5d', '_20d'];

    //
    // an options model's track record: its four scores, then each again for
    // every hold, the model's and the baseline's. The plain columns repeat the
    // 1-day hold's, and a day's 5 and 20-day columns are empty until they are in
    //
    const columns = (prefix) => [...OPTIONS, ...HOLDS.flatMap((hold) => OPTIONS.map((score) => `${score}${hold}`))]
        .map((score) => `${prefix}${score}`);
    const header = ['day', ...columns(''), ...columns('baseline_'), 'down_days', 'down_in_a_row'];

    function optionsDay(day, loss, held = { _1d: true, _5d: true, _20d: false }) {
        const scores = (base) => {
            const plain = [base, 0.56, 0.012, 6];

            return [...plain, ...HOLDS.flatMap((hold) => (held[hold] ? plain : ['', '', '', '']))];
        };

        return [day, ...scores(loss), ...scores(1.1), '', ''];
    }

    const read = (overrides) => run({ kind: 'list', report: listingOf([entry(overrides)]) }).models[0];

    it('reads an options model\'s scores in the listing, the four stock scores null, and passes over a name it does not know', () => {
        const model = read({
            score: { loss: 0.84, auc_up: null, auc_beats: null, acc_up: null, profit_auc: 0.55, top10_gain: 0.031, top10_wins: 6.2, sharpe: 1.4 },
        });

        expect(model.score).toEqual({
            loss: 0.84,
            auc_up: null,
            auc_beats: null,
            acc_up: null,
            ...NO_PARTS,
            profit_auc: 0.55,
            top10_gain: 0.031,
            top10_wins: 6.2,
        });
    });

    it('reads a stock model\'s top 10 beside its four scores, and nothing of what the listing does not give', () => {
        const model = read({ score: { loss: 1.6, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54, top10_gain: 0.0004, top10_wins: '5.5' } });

        expect(model.score).toMatchObject({ top10_gain: 0.0004, top10_wins: 5.5 });
        expect(model.score).not.toHaveProperty('profit_auc');
        expect(model.score).not.toHaveProperty('loss_1d');
    });

    it('reads a score the listing gives as anything but a number as none', () => {
        expect(read({ score: { loss: 1, profit_auc: 'high', top10_gain: '', top10_wins: null } }).score)
            .toMatchObject({ profit_auc: null, top10_gain: null, top10_wins: null });
    });

    it('reads every hold\'s columns of a track record, and each one\'s 20-day average over the days it has', () => {
        const rows = run({
            kind: 'track-record',
            report: csv(header, [
                optionsDay('2026-10-12', 0.8),
                optionsDay('2026-10-13', 0.9),
                optionsDay('2026-10-14', 0.7, { _1d: true, _5d: false, _20d: false }),
            ]),
        }).rows;

        expect(rows[0].score).toMatchObject({ loss: 0.8, loss_1d: 0.8, loss_5d: 0.8, profit_auc_5d: 0.56, top10_gain_1d: 0.012, top10_wins_1d: 6 });
        expect(rows[0].score).toMatchObject({ loss_20d: null, top10_gain_20d: null });
        expect(rows[2].score.loss_5d).toBeNull();
        expect(rows[2].average.loss_1d).toBeCloseTo(0.8);
        expect(rows[2].average.loss_5d).toBeCloseTo(0.85);
        expect(rows[2].average.loss_20d).toBeNull();
        expect(rows[2].baseline_average.loss_5d).toBeCloseTo(1.1);
        expect(rows[2].score).toMatchObject({ auc_up: null, ...NO_PARTS });
    });

    it('drops a column whose name it does not know, as it always has', () => {
        const [row] = run({
            kind: 'track-record',
            report: csv(['day', 'loss', 'loss_2d', 'share_up_5d', 'top10_gain_combined', 'top10_gain_1d'], [['2026-10-12', 0.8, 0.7, 0.5, 0.01, 0.01]]),
        }).rows;

        expect(Object.keys(row.score).sort()).toEqual([...SCORES, ...PARTS, 'top10_gain_1d'].sort());
    });

    it('averages each hold over its own days, and says how many, an options model\'s as a stock model\'s (#300)', () => {
        const rows = run({
            kind: 'track-record',
            average_days: 2,
            report: csv(header, [
                optionsDay('2026-10-12', 0.8),
                optionsDay('2026-10-13', 0.9),
                optionsDay('2026-10-14', 0.7, { _1d: true, _5d: false, _20d: false }),
            ]),
        }).rows;

        //
        // the last two days are the 13th's and the 14th's, but the 5-day hold's
        // last two with a result are the 12th's and the 13th's
        //
        expect(rows[2].average.loss).toBeCloseTo(0.8);
        expect(rows[2].average.loss_5d).toBeCloseTo(0.85);
        expect(rows[2].hold_days).toEqual({ '1d': 2, '5d': 2, '20d': 0 });
    });

    it('reads the top 10 in a stock model\'s history, under each prefix', () => {
        const [row] = run({
            kind: 'history',
            report: 'day,kind,went_live,attempt_loss,attempt_top10_gain,live_top10_gain,baseline_top10_wins\n2026-10-15,nightly,false,1.6,0.002,0.001,4.8',
        }).rows;

        expect(row.attempt).toMatchObject({ loss: 1.6, top10_gain: 0.002 });
        expect(row.live.top10_gain).toBe(0.001);
        expect(row.baseline.top10_wins).toBe(4.8);
        expect(row.live).not.toHaveProperty('top10_wins');
    });

    it('keeps the scores a task names, each once, in the listing\'s order', () => {
        const answer = run({
            kind: 'list',
            report: listingOf([entry(), entry({ name: 'o', task: 'options' })], [
                { id: 'direction', name: 'Next-day direction', description: '', scores: ['loss', 'auc_up', ' top10_gain ', 'loss', '', 7] },
                { id: 'options', name: 'Option picks', description: '', scores: ['loss', 'profit_auc', 'top10_gain', 'top10_wins'] },
            ]),
        });

        expect(answer.tasks).toEqual([
            { id: 'direction', name: 'Next-day direction', description: '', scores: ['loss', 'auc_up', 'top10_gain'] },
            { id: 'options', name: 'Option picks', description: '', scores: ['loss', 'profit_auc', 'top10_gain', 'top10_wins'] },
        ]);
    });

    it('gives a task no scores where the listing names none, as one before format 3', () => {
        const answer = run({
            kind: 'list',
            report: listingOf([entry()], [{ id: 'direction', name: 'Next-day direction', description: '', scores: 'loss' }]),
        });

        expect(answer.tasks[0]).not.toHaveProperty('scores');
    });

    describe('the hold a check is of', () => {
        const DOWN = { since: '2026-10-19', days: 1, in_a_row: 5 };

        it('keeps the hold of a live version taken down, and of each check', () => {
            const model = read({
                down: { ...DOWN, hold: 5 },
                behind: [{ days: 1, in_a_row: 5, limit: 5, hold: 5 }, { days: 20, in_a_row: null, limit: 5, hold: 20 }],
            });

            expect(model.down).toEqual({ ...DOWN, reason: 'worse', hold: 5 });
            expect(model.behind).toEqual([{ days: 1, in_a_row: 5, limit: 5, hold: 5 }, { days: 20, in_a_row: null, limit: 5, hold: 20 }]);
        });

        it('reads a hold given as null as no hold, as a stock model\'s checks have', () => {
            const model = read({ down: { ...DOWN, hold: null }, behind: [{ days: 1, in_a_row: 0, limit: 5, hold: null }] });

            expect(model.down).toEqual({ ...DOWN, reason: 'worse' });
            expect(model.behind).toEqual([{ days: 1, in_a_row: 0, limit: 5 }]);
        });

        it.each([['text', '5'], ['none', 0], ['a fraction', 1.5]])('reads a take-down whose hold is %s as one of no hold, still taken down (#295), and passes over such a check', (name, hold) => {
            const model = read({ down: { ...DOWN, hold: hold }, behind: [{ days: 1, in_a_row: 0, limit: 5, hold: hold }, { days: 5, in_a_row: 0, limit: 10 }] });

            expect(model.down).toEqual({ ...DOWN, reason: 'worse' });
            expect(model.behind).toEqual([{ days: 5, in_a_row: 0, limit: 10 }]);
        });
    });

    describe('the picks', () => {
        const PICKS = ['day', 'hold', 'rank', 'ticker', 'contract', 'call_put', 'strike', 'expiry', 'buy_on', 'sell_on',
            'last_bid', 'last_ask', 'chance', 'usual_chance', 'gain_low', 'gain_middle', 'gain_high'];

        function pick(hold, rank, ticker = 'AAPL') {
            return ['2026-10-21', hold, rank, ticker, `${ticker}  261120C00230000`, 'Call', 230, '2026-11-20', '2026-10-22',
                hold === 1 ? '2026-10-23' : '2026-10-29', 4.1, 4.35, 0.62, 0.48, -0.35, 0.12, 0.8];
        }

        it('reads every pick, each hold\'s apart and best first, its contract\'s name with its spaces', () => {
            const rows = run({
                kind: 'option-picks',
                name: 'pt-options',
                report: csv(PICKS, [pick(5, 2), pick(1, 2, 'MSFT'), pick(5, 1), pick(1, 1)]),
            }).rows;

            expect(rows.map((row) => [row.hold, row.rank, row.ticker])).toEqual([[1, 1, 'AAPL'], [1, 2, 'MSFT'], [5, 1, 'AAPL'], [5, 2, 'AAPL']]);
            expect(rows[0]).toEqual({
                day: '2026-10-21',
                hold: 1,
                rank: 1,
                ticker: 'AAPL',
                contract: 'AAPL  261120C00230000',
                call_put: 'call',
                strike: 230,
                expiry: '2026-11-20',
                buy_on: '2026-10-22',
                sell_on: '2026-10-23',
                last_bid: 4.1,
                last_ask: 4.35,
                chance: 0.62,
                usual_chance: 0.48,
                gain_low: -0.35,
                gain_middle: 0.12,
                gain_high: 0.8,
            });
        });

        it('reads a cell it cannot read as none, and passes over a row with no day, hold, rank or stock', () => {
            const rows = run({
                kind: 'option-picks',
                report: csv(PICKS, [
                    pick(1, 1).map((cell, at) => (['last_bid', 'expiry'].includes(PICKS[at]) ? '' : cell)),
                    pick(1, 2).map((cell, at) => (PICKS[at] === 'day' ? 'tonight' : cell)),
                    pick(0, 3),
                    pick(1, 1.5),
                    pick(1, 4, ''),
                ]),
            }).rows;

            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ rank: 1, last_bid: null, expiry: null, last_ask: 4.35 });
        });

        it.each([
            ['answered with null', null],
            ['empty', ''],
            ['a header alone', PICKS.join(',')],
            ['missing its hold and rank', 'day,ticker\n2026-10-21,AAPL'],
            ['not text', { rows: [] }],
        ])('gives none for picks %s', (name, report) => {
            expect(run({ kind: 'option-picks', report: report }).rows).toBeNull();
        });
    });
});

describe('a stock model\'s holds and Combined, from format 5 on (#300)', () => {
    //
    // a stock model's scores, in the order the trainer writes them, its top 10's
    // among them, and the ones Combined has: every one but the top 10's
    //
    const STOCK = [...SCORES, 'top10_gain', 'top10_wins', ...PARTS];
    const COMBINED = [...SCORES, ...PARTS];
    const ENDS = ['_1d', '_5d', '_20d'];

    //
    // a format 5 track record: today's columns, the 1-day hold's, then each
    // hold's again under its ending, with how many stocks it scored and their
    // average gain, which the pages do not read, then Combined's
    //
    const named = (scores) => [...scores, ...scores.map((score) => `baseline_${score}`)];
    const header = [
        'day', 'version', 'stocks', 'all_gain', 'down_days', 'down_in_a_row', 'down_hold',
        ...named(STOCK),
        ...ENDS.flatMap((end) => ['stocks', 'all_gain', ...named(STOCK)].map((name) => `${name}${end}`)),
        ...named(COMBINED).map((name) => `${name}_combined`),
    ];

    //
    // a hold's scores on a day its loss is `loss`, as `scores` lists them: loss's
    // parts add up to it, and the rest are fixed
    //
    const scoresAt = (scores, loss) => scores.map((score) => ({
        loss: loss,
        auc_up: 0.55,
        auc_beats: 0.52,
        acc_up: 0.53,
        top10_gain: 0.0012,
        top10_wins: 5.5,
        up_log_loss: 0.7,
        beats_log_loss: 0.69,
        move_pinball: loss - 1.39,
    })[score]);

    //
    // a day whose 1, 5 and 20-day losses are `losses`, each hold's null until its
    // result is in, and the baseline's 1.66 on each. Combined is in with the
    // 20-day result, the average of the three
    //
    function heldDay(day, losses, down = ['', '', '']) {
        const hold = (end) => (losses[end] === null
            ? Array(2 + 2 * STOCK.length).fill('')
            : [503, 0.001, ...scoresAt(STOCK, losses[end]), ...scoresAt(STOCK, 1.66)]);
        const combined = losses._20d === null
            ? Array(2 * COMBINED.length).fill('')
            : [...scoresAt(COMBINED, (losses._1d + losses._5d + losses._20d) / 3), ...scoresAt(COMBINED, 1.66)];

        return [day, '20261019_pt-gnn', 503, 0.001, ...down, ...scoresAt(STOCK, losses._1d), ...scoresAt(STOCK, 1.66), ...ENDS.flatMap(hold), ...combined];
    }

    //
    // `count` weekdays from 2026-09-01, as the track record's own cases count them
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

    //
    // `count` days, the 1-day loss 1 to `count`, the 5-day loss 101 on, and the
    // 20-day 201 on, each hold in on the days `in5` and `in20` say
    //
    function recordOf(count, in5, in20, averageDays = undefined) {
        const asked = {
            kind: 'track-record',
            report: csv(header, weekdays(count).map((day, at) => heldDay(day, {
                _1d: at + 1,
                _5d: in5(at) ? 101 + at : null,
                _20d: in20(at) ? 201 + at : null,
            }))),
        };

        if (averageDays !== undefined) {
            asked.average_days = averageDays;
        }

        return run(asked).rows;
    }

    const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length;
    const from = (first, last) => [...Array(last - first + 1).keys()].map((at) => first + at);

    it('reads each hold\'s scores, loss\'s parts among them, and Combined\'s, the model\'s and the baseline\'s', () => {
        const [row] = run({ kind: 'track-record', report: csv(header, [heldDay('2026-10-12', { _1d: 1.6, _5d: 1.7, _20d: 1.8 })]) }).rows;

        expect(row.score).toMatchObject({
            loss: 1.6,
            loss_1d: 1.6,
            loss_5d: 1.7,
            loss_20d: 1.8,
            auc_up_5d: 0.55,
            auc_beats_20d: 0.52,
            acc_up_1d: 0.53,
            top10_gain_5d: 0.0012,
            top10_wins_20d: 5.5,
            up_log_loss_5d: 0.7,
            beats_log_loss_20d: 0.69,
            auc_up_combined: 0.55,
            up_log_loss_combined: 0.7,
        });
        expect(row.score.loss_combined).toBeCloseTo(1.7);
        expect(row.score.move_pinball_20d).toBeCloseTo(0.41);
        expect(row.baseline).toMatchObject({ loss_5d: 1.66, loss_combined: 1.66, auc_up_20d: 0.55, up_log_loss_1d: 0.7 });
    });

    it('reads no top 10 for Combined, and none of a hold\'s stocks or gain, which the pages do not draw', () => {
        const [row] = run({ kind: 'track-record', report: csv(header, [heldDay('2026-10-12', { _1d: 1.6, _5d: 1.7, _20d: 1.8 })]) }).rows;

        expect(row.score).not.toHaveProperty('top10_gain_combined');
        expect(row.score).not.toHaveProperty('stocks_5d');
        expect(row.score).not.toHaveProperty('all_gain_5d');
    });

    it('averages each hold over its own latest 20 days with a result, not over the record\'s last 20 rows', () => {
        //
        // 25 days, the 5-day result in for the first 20: the record's last 20 rows
        // are its 6th to its 25th, and only 15 of them have a 5-day result
        //
        const rows = recordOf(25, (at) => at < 20, (at) => at < 5);
        const last = rows[24];

        expect(last.days).toBe(20);
        expect(last.average.loss).toBeCloseTo(mean(from(6, 25)));
        expect(last.average.loss_1d).toBeCloseTo(mean(from(6, 25)));
        expect(last.average.loss_5d).toBeCloseTo(mean(from(101, 120)));
        expect(last.average.loss_20d).toBeCloseTo(mean(from(201, 205)));
        expect(last.hold_days).toEqual({ '1d': 20, '5d': 20, '20d': 5, combined: 5 });
    });

    it('averages each hold over every day with a result so far, while it has fewer, as of each day', () => {
        const rows = recordOf(10, (at) => at < 6, (at) => at < 2);

        expect(rows[3].average.loss_5d).toBeCloseTo(mean(from(101, 104)));
        expect(rows[3].hold_days).toEqual({ '1d': 4, '5d': 4, '20d': 2, combined: 2 });
        expect(rows[9].average.loss_5d).toBeCloseTo(mean(from(101, 106)));
        expect(rows[9].hold_days['5d']).toBe(6);
    });

    it('averages each hold over the days the listing says, from format 4 on (#293)', () => {
        const rows = recordOf(25, (at) => at < 20, () => true, 3);

        expect(rows[24].average.loss).toBeCloseTo(24);
        expect(rows[24].average.loss_5d).toBeCloseTo(119);
        expect(rows[24].hold_days).toEqual({ '1d': 3, '5d': 3, '20d': 3, combined: 3 });
    });

    it('averages a hold no day has a result for yet to nothing, over no days', () => {
        const rows = recordOf(8, (at) => at < 3, () => false);
        const last = rows[7];

        expect(last.average.loss_20d).toBeNull();
        expect(last.average.top10_gain_20d).toBeNull();
        expect(last.average.loss_combined).toBeNull();
        expect(last.baseline_average.loss_combined).toBeNull();
        expect(last.hold_days).toEqual({ '1d': 8, '5d': 3, '20d': 0, combined: 0 });
    });

    it('averages a hold\'s parts and its baseline over the same days as its loss, so the parts add up to it', () => {
        const rows = recordOf(25, (at) => at < 20, (at) => at < 5);
        const last = rows[24];
        const parts = (average, end) => PARTS.reduce((total, part) => total + average[`${part}${end}`], 0);

        ['_1d', '_5d', '_20d', '_combined'].forEach((end) => {
            expect(parts(last.average, end)).toBeCloseTo(last.average[`loss${end}`], 10);
            expect(parts(last.baseline_average, end)).toBeCloseTo(last.baseline_average[`loss${end}`], 10);
        });
        expect(last.baseline_average.loss_5d).toBeCloseTo(1.66);
    });

    it('reads the hold whose scores set a take-down off, and none on every other day', () => {
        const rows = run({
            kind: 'track-record',
            report: csv(header, [
                heldDay('2026-10-15', { _1d: 1.7, _5d: 1.8, _20d: null }),
                heldDay('2026-10-16', { _1d: 1.7, _5d: 1.8, _20d: null }, [1, 5, 5]),
            ]),
        }).rows;

        expect(rows[0]).toMatchObject({ down_days: null, down_in_a_row: null, down_hold: null });
        expect(rows[1]).toMatchObject({ down_days: 1, down_in_a_row: 5, down_hold: 5 });
    });

    it('reads a record before format 5 as it did: no hold, no hold_days and no down_hold', () => {
        const [row] = run({
            kind: 'track-record',
            report: csv([...TRACK_HEADER, 'down_days', 'down_in_a_row'], [[...trackRow('2026-10-15', 1.8), 1, 5]]),
        }).rows;

        expect(row).not.toHaveProperty('hold_days');
        expect(row.down_hold).toBeNull();
        expect(Object.keys(row.score).sort()).toEqual([...SCORES, ...PARTS].sort());
    });

    describe('in the listing', () => {
        //
        // a format 5 stock model's holds: the 1-day hold's scores, the listing's
        // own, the 5-day hold's over its 15 days so far, and the 20-day hold and
        // Combined with none yet
        //
        const ONE = { loss: 1.6, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54, top10_gain: 0.0014, top10_wins: 5.6 };
        const BASE = { loss: 1.66, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.52, top10_gain: 0.0003, top10_wins: 5.1 };
        const HOLDS = {
            '1d': { days: 30, score: ONE, baseline: BASE },
            '5d': { days: 15, score: { ...ONE, loss: 1.65, top10_gain: 0.004 }, baseline: { ...BASE, top10_gain: 0.001 } },
            '20d': { days: 0, score: null, baseline: null },
            combined: { days: 0, score: null, baseline: null },
        };

        const read = (holds) => run({ kind: 'list', report: { format_version: 5, ...listingOf([entry({ holds: holds })]) } }).models[0];

        it('reads each hold\'s days and scores, as the listing\'s own scores are read', () => {
            expect(read(HOLDS).holds).toEqual({
                '1d': { days: 30, score: { ...ONE, ...NO_PARTS }, baseline: { ...BASE, ...NO_PARTS } },
                '5d': { days: 15, score: { ...ONE, loss: 1.65, top10_gain: 0.004, ...NO_PARTS }, baseline: { ...BASE, top10_gain: 0.001, ...NO_PARTS } },
                '20d': { days: 0, score: null, baseline: null },
                combined: { days: 0, score: null, baseline: null },
            });
        });

        it('reads Combined\'s scores, which have no top 10', () => {
            const holds = read({ combined: { days: 3, score: { loss: 1.64, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.54 }, baseline: BASE } }).holds;

            expect(holds.combined.score).toEqual({ loss: 1.64, auc_up: 0.55, auc_beats: 0.52, acc_up: 0.54, ...NO_PARTS });
            expect(holds.combined.score).not.toHaveProperty('top10_gain');
        });

        it('reads an options model\'s three holds', () => {
            const score = { loss: 0.84, auc_up: null, auc_beats: null, acc_up: null, profit_auc: 0.55, top10_gain: 0.031, top10_wins: 6.2 };
            const holds = read({ '1d': { days: 9, score: score, baseline: score }, '5d': { days: 4, score: score, baseline: score }, '20d': { days: 0, score: null, baseline: null } }).holds;

            expect(Object.keys(holds)).toEqual(['1d', '5d', '20d']);
            expect(holds['5d']).toMatchObject({ days: 4, score: { profit_auc: 0.55, top10_wins: 6.2 } });
        });

        it('reads a listing before format 5, which gives none, as it did: no holds at all', () => {
            const model = run({ kind: 'list', report: listingOf([entry()]) }).models[0];

            expect(model).not.toHaveProperty('holds');
        });

        it('passes over a hold it does not know and one that is not an object, and reads what it cannot as none', () => {
            expect(read({ '2d': HOLDS['5d'], '5d': 'soon', combined: { days: 'some', score: 'high', baseline: [1, 2] } }).holds)
                .toEqual({ combined: { days: 0, score: null, baseline: null } });
        });

        it.each([
            ['not an object', 'all three'],
            ['a list', [HOLDS['1d']]],
            ['null', null],
            ['an object of no hold it knows', { '2d': HOLDS['5d'], one: HOLDS['1d'] }],
        ])('reads holds that are %s as none', (name, holds) => {
            expect(read(holds)).not.toHaveProperty('holds');
        });

        it('keeps the hold of a stock model\'s take-down, and of each check, as an options model\'s', () => {
            const model = run({
                kind: 'list',
                report: {
                    format_version: 5,
                    ...listingOf([entry({
                        down: { since: '2026-11-12', reason: 'track_record', days: null, in_a_row: null, hold: 20 },
                        behind: [{ days: 1, in_a_row: 2, limit: 5, hold: 1 }, { days: 1, in_a_row: null, limit: 5, hold: 20 }],
                    })]),
                },
            }).models[0];

            expect(model.down).toEqual({ since: '2026-11-12', reason: 'track_record', days: null, in_a_row: null, hold: 20 });
            expect(model.behind).toEqual([{ days: 1, in_a_row: 2, limit: 5, hold: 1 }, { days: 1, in_a_row: null, limit: 5, hold: 20 }]);
        });
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
            {
                kind: 'list',
                report: {
                    format_version: 2,
                    tasks: [],
                    models: [entry({
                        down: { since: '2026-10-19', days: 1, in_a_row: 5 },
                        behind: [{ days: 1, in_a_row: 5, limit: 5 }, { days: 20, in_a_row: null, limit: 5 }, { days: 0 }],
                    }), entry({ name: 'b', down: { since: 'soon' } })],
                },
            },
            { kind: 'history', name: 'pt-gnn', report: 'day,kind,went_live,attempt_loss\n2026-10-12,weekly,True,1.6' },
            {
                kind: 'history',
                report: 'day,kind,went_live,started,training_seconds,total_seconds,attempt_loss\n2026-10-14,nightly,false,,,,1.6\n2026-10-15,nightly,true,2026-10-16T07:58:10+00:00,437.2,532.4,1.59',
            },
            { kind: 'track-record', report: csv(TRACK_HEADER, [trackRow('2026-10-12', 1.6), trackRow('2026-10-13', 1.8)]) },
            {
                kind: 'track-record',
                report: csv([...TRACK_HEADER, 'down_days', 'down_in_a_row'], [[...trackRow('2026-10-15', 1.8), '', ''], [...trackRow('2026-10-16', 1.8), 5, 10]]),
            },
            {
                kind: 'track-record',
                report: csv([...TRACK_HEADER, ...PARTS], [[...trackRow('2026-10-15', 1.71), 0.72, 0.7, 0.29], [...trackRow('2026-10-16', 1.7), 0.71, '', 0.29]]),
            },
            { kind: 'history', report: 'day,kind,went_live,attempt_loss,attempt_up_log_loss,live_move_pinball\n2026-10-15,nightly,false,1.6,0.72,0.27' },
            {
                kind: 'history',
                report: [
                    'day,kind,went_live,held_out_days,training_days,started,trained_again,trained_again_seconds,attempt_loss',
                    '2026-10-23,weekly,true,2026-10-20 2026-10-21 2026-10-22,10,2026-10-24T09:49:35+00:00,,,1.67',
                    '2026-10-26,nightly,false,2026-10-21 2026-10-22 2026-10-23,11,,,,1.68',
                    '2026-10-27,nightly,true,2026-10-26 2026-10-22 x 2026-10-23,12,2026-10-28T02:30:00+00:00,true,657.7,1.677',
                ].join('\n'),
            },
            { kind: 'track-record', report: 4 },
            {
                kind: 'list',
                report: {
                    format_version: 3,
                    tasks: [{ id: 'options', name: 'Option picks', description: '', scores: ['loss', 'profit_auc', 'loss'] }, { id: 'x', scores: 'no' }],
                    models: [entry({
                        task: 'options',
                        score: { loss: 0.8, auc_up: null, profit_auc: 0.55, top10_gain: 0.03, top10_wins: 6 },
                        down: { since: '2026-10-19', days: 1, in_a_row: 5, hold: 5 },
                        behind: [{ days: 1, in_a_row: 5, limit: 5, hold: 5 }, { days: 5, in_a_row: 0, limit: 10, hold: null }, { days: 5, in_a_row: 0, limit: 10, hold: 'x' }],
                    })],
                },
            },
            {
                kind: 'track-record',
                report: 'day,loss,loss_1d,loss_5d,top10_gain_20d,baseline_loss_5d\n2026-10-12,0.8,0.8,0.9,,1.1\n2026-10-13,0.7,0.7,,,1.2',
            },
            {
                kind: 'option-picks',
                report: 'day,hold,rank,ticker,contract,call_put,strike\n2026-10-21,5,1,AAPL,AAPL  261120C00230000,Put,230\n2026-10-21,1,1,MSFT,MSFT  261120C00500000,call,500',
            },
            { kind: 'option-picks', report: '' },
            { kind: 'list', report: { format_version: 4, average_days: 30, tasks: [], models: [entry(), entry({ name: 'b', scored_days: 25 })] } },
            { kind: 'list', report: { format_version: 4, average_days: '30', models: [entry()] } },
            {
                kind: 'list',
                report: {
                    format_version: 4,
                    average_days: 20,
                    models: [
                        entry({
                            live: { since: '2026-10-23', kind: 'first', days: { training: 7, stopping: 3, first: '2026-10-05', last: '2026-10-19' } },
                            down: { since: '2026-10-23', reason: 'not_ahead', days: null, in_a_row: null },
                        }),
                        entry({
                            name: 'b',
                            live: { since: '2026-10-23', kind: 'first', days: { training: '7', first: '2026-10-05' } },
                            down: { since: '2026-10-23', reason: 'bored', days: 'x', hold: 'y' },
                        }),
                    ],
                },
            },
            {
                kind: 'track-record',
                average_days: 2,
                report: csv(TRACK_HEADER, [trackRow('2026-10-12', 1.6), trackRow('2026-10-13', 1.8), trackRow('2026-10-14', 1.7)]),
            },
            {
                kind: 'track-record',
                average_days: 2,
                report: [
                    'day,down_days,down_in_a_row,down_hold,loss,loss_1d,loss_5d,up_log_loss_5d,loss_20d,loss_combined,auc_up_combined,baseline_loss_5d,baseline_loss_combined',
                    '2026-10-12,,,,1.6,1.6,1.7,0.7,1.8,1.7,0.55,1.66,1.66',
                    '2026-10-13,,,,1.62,1.62,1.71,0.71,,,,1.66,',
                    '2026-10-14,1,5,5,1.64,1.64,,,,,,,',
                ].join('\n'),
            },
            {
                kind: 'list',
                report: {
                    format_version: 5,
                    average_days: 20,
                    models: [
                        entry({
                            holds: {
                                '1d': { days: 30, score: { loss: 1.6, top10_gain: 0.001 }, baseline: { loss: 1.66 } },
                                '5d': { days: 15, score: { loss: 1.65 }, baseline: 'x' },
                                combined: { days: 0, score: null, baseline: null },
                                '2d': { days: 4 },
                            },
                            down: { since: '2026-11-12', reason: 'track_record', days: null, in_a_row: null, hold: 20 },
                        }),
                        entry({ name: 'b', holds: 'all' }),
                    ],
                },
            },
        ];

        messages.forEach((data) => {
            expect(runBuilt(data)).toEqual(run(data));
        });
    });
});
