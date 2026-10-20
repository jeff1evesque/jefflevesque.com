/**
 * report.js: web-worker for the model api's answers (#243): the listing of models,
 * and a model's two reports.
 *
 *     list            the listing, as the api's json: every task, every model
 *                     with its latest scores, and which layout every model report
 *                     follows (#248). From format 2 on, whether the trainer took a
 *                     model's live version down for doing worse than the baseline,
 *                     and how close each of its checks is to doing so (#263)
 *     history         a model's csv, one row per nightly training attempt: the
 *                     attempt's scores, the live version's and the know-nothing
 *                     baseline's, on the same held-out days, and from 2026-10-15
 *                     on, when the attempt started and how long it took
 *     track-record    a model's csv, one row per day it predicted, written once
 *                     that day is scored: its scores and the baseline's, with each
 *                     day's 20-day averages worked out here. From format 2 on, the
 *                     check that took the live version down, on the day whose
 *                     score set it off (#263)
 *
 * It is handed { kind, report, name } -- `report` as the api's envelope held it --
 * and answers the same kind and name with what the pages draw: `tasks`, `models`
 * and `format_version` for the listing, `rows` for a report. Each is null where
 * the report is not the shape the api documents, which the page shows as a report
 * it could not load. A report with no rows yet answers none, which is not a failure: a model
 * is listed before its first day is scored.
 *
 * Every set of scores carries the three loss adds up beside the four (#265) --
 * see PARTS. A history and a track record give them; the listing does not, and
 * neither would a report without their columns, so there each is null.
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
 *       times, two words and numbers -- nothing quoted, and no comma inside a
 *       cell -- and a worker cannot import the parser.
 */

export default () => {
    //
    // the scores every report carries, as the api names them
    //
    const SCORES = ['loss', 'auc_up', 'auc_beats', 'acc_up'];

    //
    // the three scores loss adds up (#265): the log loss of whether each stock
    // went up, and of whether it beat the average stock, and the pinball loss of
    // the size of its move. A history and a track record carry each one under
    // every prefix they carry a score under
    //
    const PARTS = ['up_log_loss', 'beats_log_loss', 'move_pinball'];

    //
    // every score a set of scores is read for, and averaged for
    //
    const READ = SCORES.concat(PARTS);

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
    // which layout every model report follows (#248): the whole number the
    // listing gives, or 0, the reports as first published, for a listing that
    // gives none or gives something else. Unlike a count, text is not read as a
    // number: the api writes the version as one
    //
    function formatOf(value) {
        return typeof value === 'number' && isFinite(value) && Math.round(value) === value && value >= 0 ? value : 0;
    }

    //
    // a whole number of at least `least`, as the listing writes one, or null.
    // Text is not read as a number, as the format_version's is not
    //
    function wholeOf(value, least) {
        return typeof value === 'number' && isFinite(value) && Math.round(value) === value && value >= least ? value : null;
    }

    //
    // a csv cell's whole number of at least 1, or null for an empty cell and
    // anything that is not one
    //
    function wholeCellOf(value) {
        const parsed = numberOf(value);

        return parsed !== null && Math.round(parsed) === parsed && parsed >= 1 ? parsed : null;
    }

    //
    // a model's live version taken down by the trainer, from format 2 on (#263):
    // the night it was, and the check that did it -- `days`, 1 for each day on
    // its own or 5 or 20 for an average over its latest scored days, and
    // `in_a_row`, how many scored days in a row it was worse than the baseline.
    // Null while it is live, and for one that names no night or no whole numbers
    //
    function downOf(value) {
        if (!isRecord(value)) {
            return null;
        }

        const since = dayOf(value.since);
        const days = wholeOf(value.days, 1);
        const inARow = wholeOf(value.in_a_row, 1);

        return since && days !== null && inARow !== null ? { since: since, days: days, in_a_row: inARow } : null;
    }

    //
    // how close each of the trainer's checks is to taking the live version down,
    // as of the newest scored day (#263): `days`, `in_a_row` -- how many scored
    // days in a row it has been worse, or null until it has enough days -- and
    // `limit`, the count that takes it down. A check that is not whole is
    // passed over, and a listing before format 2 gives none
    //
    function behindOf(value) {
        return (Array.isArray(value) ? value : [])
            .filter(function (check) {
                return isRecord(check)
                    && wholeOf(check.days, 1) !== null
                    && wholeOf(check.limit, 1) !== null
                    && (check.in_a_row === null || wholeOf(check.in_a_row, 0) !== null);
            })
            .map(function (check) {
                return { days: check.days, in_a_row: check.in_a_row, limit: check.limit };
            });
    }

    //
    // the four scores and loss's three parts, read off a csv row's columns named
    // `prefix` and the score, or off an object of them
    //
    function scoresOf(source, prefix) {
        const scores = {};

        READ.forEach(function (score) {
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
    // does. Loss's three parts are averaged alike, so where every day has them,
    // their averages add up to loss's
    //
    function averageOf(recent, field) {
        const average = {};

        READ.forEach(function (score) {
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
                down: downOf(entry.down),
                behind: behindOf(entry.behind),
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
            format_version: formatOf(report.format_version),
        };
    }

    //
    // the history: every nightly attempt, and whether it went live. A night is a
    // weekly retrain only where it says so, and went live only where it says so --
    // in either spelling, since a trainer writing its csv from python writes True.
    //
    // From 2026-10-15 on, a night also says when it started, kept as the text it
    // is, and how long it took in seconds: training, and the whole attempt. An
    // older night's cells are empty, and a history written before the columns has
    // none: either way, each is null
    //
    function history(csv) {
        return byDay(rowsOf(csv), function (row, day) {
            return {
                day: day,
                kind: String(row.kind).toLowerCase() === 'weekly' ? 'weekly' : 'nightly',
                went_live: /^(true|1)$/i.test(String(row.went_live)),
                started: textOf(row.started) || null,
                training_seconds: numberOf(row.training_seconds),
                total_seconds: numberOf(row.total_seconds),
                attempt: scoresOf(row, 'attempt_'),
                live: scoresOf(row, 'live_'),
                baseline: scoresOf(row, 'baseline_'),
            };
        });
    }

    //
    // the track record: every scored day, with the 20-day averages ending at it,
    // the model's and the baseline's, and how many days they take in.
    //
    // From format 2 on, the day whose score set off a check that took the live
    // version down says which check, as the listing's `down` does (#263). Every
    // other day's cells are empty, and a track record written before the columns
    // has none: either way, each is null
    //
    function trackRecord(csv) {
        const rows = byDay(rowsOf(csv), function (row, day) {
            return {
                day: day,
                score: scoresOf(row, ''),
                baseline: scoresOf(row, 'baseline_'),
                down_days: wholeCellOf(row.down_days),
                down_in_a_row: wholeCellOf(row.down_in_a_row),
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
            answer.format_version = read ? read.format_version : null;
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
