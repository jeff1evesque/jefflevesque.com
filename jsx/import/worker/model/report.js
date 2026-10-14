/**
 * report.js: web-worker for the model api's answers (#243): the listing of models,
 * and a model's two reports.
 *
 *     list            the listing, as the api's json: every task, and every model
 *                     with its latest scores
 *     history         a model's csv, one row per nightly training attempt: the
 *                     attempt's scores, the live version's and the know-nothing
 *                     baseline's, on the same held-out days
 *     track-record    a model's csv, one row per day it predicted, written once
 *                     that day is scored: its scores and the baseline's, with each
 *                     day's 20-day averages worked out here
 *
 * It is handed { kind, report, name } -- `report` as the api's envelope held it --
 * and answers the same kind and name with what the pages draw: `tasks` and
 * `models` for the listing, `rows` for a report. Each is null where the report is
 * not the shape the api documents, which the page shows as a report it could not
 * load. A report with no rows yet answers none, which is not a failure: a model
 * is listed before its first day is scored.
 *
 * The 20-day average is taken over a model's own scored DAYS, not the calendar. A
 * day it was not running -- before it started, after it retired, a night the
 * trainer did not run -- has no row, so it neither counts as a zero nor shortens
 * the window: the average of a day is of the 20 rows ending at it, or every row
 * so far while there are fewer.
 *
 * Note: everything this needs is written inside the exported function. A worker
 *       is built from the function's TEXT -- see web-worker.js -- so a helper
 *       outside it, or one the build adds, is not there when it runs. That rules
 *       out syntax the build rewrites into helpers of its own: a spread, for...of,
 *       or `typeof x === 'object'` -- see model-report.test.js, which builds this
 *       file as the bundle does and runs the function's text on its own.
 *
 * Note: the csvs are read here rather than through papaparse. They hold dates,
 *       two words and numbers -- nothing quoted, and no comma inside a cell -- and
 *       a worker cannot import the parser.
 */

export default () => {
    //
    // the scores every report carries, as the api names them
    //
    const SCORES = ['loss', 'auc_up', 'auc_beats', 'acc_up'];

    //
    // how many of a model's scored days an average takes in
    //
    const WINDOW = 20;

    //
    // how a live version came to be live: the model's first version, a nightly
    // update, or a weekly retrain
    //
    const LIVE_KINDS = ['first', 'nightly', 'weekly'];

    const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

    function isRecord(value) {
        return value !== null && value !== undefined && value === Object(value) && !Array.isArray(value);
    }

    function dayOf(value) {
        return typeof value === 'string' && DAY.test(value.trim()) ? value.trim() : null;
    }

    function textOf(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    //
    // a number, or null for anything that is not one -- an empty csv cell
    // included, which Number would read as 0
    //
    function numberOf(value) {
        if (value === null || value === undefined || String(value).trim() === '') {
            return null;
        }

        const parsed = Number(value);

        return isFinite(parsed) ? parsed : null;
    }

    function countOf(value) {
        const parsed = numberOf(value);

        return parsed !== null && parsed >= 0 && Math.round(parsed) === parsed ? parsed : 0;
    }

    //
    // the four scores, read off a csv row's columns named `prefix` and the score,
    // or off an object of them
    //
    function scoresOf(source, prefix) {
        const scores = {};

        SCORES.forEach(function (score) {
            scores[score] = numberOf(source[prefix + score]);
        });

        return scores;
    }

    //
    // a csv's rows, each an object keyed by the header
    //
    function rowsOf(csv) {
        const lines = String(csv).split(/\r?\n/).filter(function (line) {
            return line.trim() !== '';
        });

        if (!lines.length) {
            return [];
        }

        const header = lines[0].split(',').map(function (name) {
            return name.trim();
        });

        return lines.slice(1).map(function (line) {
            const cells = line.split(',');
            const row = {};

            header.forEach(function (name, at) {
                row[name] = at < cells.length ? cells[at].trim() : '';
            });

            return row;
        });
    }

    //
    // one row per day, oldest first. A day written twice keeps the later row, as
    // a rerun night writes its day again
    //
    function byDay(rows, read) {
        const days = {};

        rows.forEach(function (row) {
            const day = dayOf(row.day);

            if (day) {
                days[day] = read(row, day);
            }
        });

        return Object.keys(days).sort().map(function (day) {
            return days[day];
        });
    }

    //
    // each score's mean over `recent`, the days that have one, or null where none
    // does
    //
    function averageOf(recent, field) {
        const average = {};

        SCORES.forEach(function (score) {
            const values = recent
                .map(function (row) { return row[field][score]; })
                .filter(function (value) { return value !== null; });

            average[score] = values.length
                ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length
                : null;
        });

        return average;
    }

    //
    // the listing: the models with a name and a task, each named once, and the
    // tasks they name, in the listing's order. A task a model names that the
    // listing does not describe is named by its id, after the rest; one no model
    // names is left out, having nothing to list
    //
    function listing(report) {
        if (!isRecord(report) || !Array.isArray(report.models)) {
            return null;
        }

        const models = [];
        const seen = {};

        report.models.forEach(function (entry) {
            if (!isRecord(entry)) {
                return;
            }

            const name = textOf(entry.name);
            const task = textOf(entry.task);

            if (!name || !task || seen[name]) {
                return;
            }

            const live = isRecord(entry.live) ? entry.live : {};
            const attempts = isRecord(entry.attempts) ? entry.attempts : {};

            seen[name] = true;
            models.push({
                name: name,
                task: task,
                description: textOf(entry.description),
                started: dayOf(entry.started),
                retired: dayOf(entry.retired),
                scored_days: countOf(entry.scored_days),
                live: {
                    since: dayOf(live.since),
                    kind: LIVE_KINDS.indexOf(live.kind) >= 0 ? live.kind : null,
                },
                attempts: {
                    total: countOf(attempts.total),
                    went_live: countOf(attempts.went_live),
                },
                score: isRecord(entry.score) ? scoresOf(entry.score, '') : null,
                baseline: isRecord(entry.baseline) ? scoresOf(entry.baseline, '') : null,
            });
        });

        const named = {};
        const tasks = [];

        (Array.isArray(report.tasks) ? report.tasks : []).forEach(function (entry) {
            const id = isRecord(entry) ? textOf(entry.id) : '';

            if (id && !named[id]) {
                named[id] = true;
                tasks.push({ id: id, name: textOf(entry.name) || id, description: textOf(entry.description) });
            }
        });

        models.forEach(function (model) {
            if (!named[model.task]) {
                named[model.task] = true;
                tasks.push({ id: model.task, name: model.task, description: '' });
            }
        });

        return {
            tasks: tasks.filter(function (task) {
                return models.some(function (model) { return model.task === task.id; });
            }),
            models: models,
        };
    }

    //
    // the history: every nightly attempt, and whether it went live. A night is a
    // weekly retrain only where it says so, and went live only where it says so --
    // in either spelling, since a trainer writing its csv from python writes True
    //
    function history(csv) {
        return byDay(rowsOf(csv), function (row, day) {
            return {
                day: day,
                kind: String(row.kind).toLowerCase() === 'weekly' ? 'weekly' : 'nightly',
                went_live: /^(true|1)$/i.test(String(row.went_live)),
                attempt: scoresOf(row, 'attempt_'),
                live: scoresOf(row, 'live_'),
                baseline: scoresOf(row, 'baseline_'),
            };
        });
    }

    //
    // the track record: every scored day, with the 20-day averages ending at it,
    // the model's and the baseline's, and how many days they take in
    //
    function trackRecord(csv) {
        const rows = byDay(rowsOf(csv), function (row, day) {
            return {
                day: day,
                score: scoresOf(row, ''),
                baseline: scoresOf(row, 'baseline_'),
            };
        });

        rows.forEach(function (row, at) {
            const recent = rows.slice(Math.max(0, at - WINDOW + 1), at + 1);

            row.days = recent.length;
            row.average = averageOf(recent, 'score');
            row.baseline_average = averageOf(recent, 'baseline');
        });

        return rows;
    }

    self.onmessage = (event) => {
        const asked = isRecord(event.data) ? event.data : {};
        const answer = { kind: asked.kind, name: asked.name || null };

        //
        // a report the api answered with null holds no rows yet. Anything that is
        // neither null nor text is not a report
        //
        const csv = asked.report === null || asked.report === undefined ? '' : asked.report;

        if (asked.kind === 'list') {
            const read = listing(asked.report);

            answer.tasks = read ? read.tasks : null;
            answer.models = read ? read.models : null;
        } else if (asked.kind === 'history') {
            answer.rows = typeof csv === 'string' ? history(csv) : null;
        } else if (asked.kind === 'track-record') {
            answer.rows = typeof csv === 'string' ? trackRecord(csv) : null;
        } else {
            answer.rows = null;
        }

        self.postMessage(answer);
    };
};
