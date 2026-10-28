/**
 * report.js: web-worker for the model api's answers (#243): the listing of models,
 * a model's two reports, and an options model's picks (#279).
 *
 *     list            the listing, as the api's json: every task, every model
 *                     with its latest scores, and which layout every model report
 *                     follows (#248). From format 2 on, whether the trainer took a
 *                     model's live version down for doing worse than the baseline,
 *                     and how close each of its checks is to doing so (#263). From
 *                     format 4, how many scored days a model's scores average
 *                     (#293), why a live version was taken down, and what it
 *                     learned from (#295). From format 5, each model's scores on
 *                     each of its holds (#300)
 *     history         a model's csv, one row per nightly training attempt: the
 *                     attempt's scores, the live version's and the know-nothing
 *                     baseline's, on the same held-out days, and from 2026-10-15
 *                     on, when the attempt started and how long it took
 *     track-record    a model's csv, one row per day it predicted, written once
 *                     that day is scored: its scores and the baseline's, with each
 *                     day's averages worked out here, over the days it is sent
 *                     with. From format 2 on, the check that took the live version
 *                     down, on the day whose score set it off (#263), and the hold
 *                     it ran on where the model has holds (#300)
 *
 *     option-picks    an options model's csv of its nightly picks (#279): each
 *                     hold's top 10, or one stock's options best first, up to
 *                     100 for each hold
 *
 * It is handed { kind, report, name, average_days } -- `report` as the api's
 * envelope held it, and `average_days` the listing's, for a track record -- and
 * answers the same kind and name with what the pages draw: `tasks`, `models`,
 * `format_version` and `average_days` for the listing, `rows` for a report. Each
 * is null where the report is not the shape the api documents, which the page
 * shows as a report it could not load. A report with no rows yet answers none,
 * which is not a failure: a model is listed before its first day is scored. Picks
 * with no rows are, as there is nothing to show of them.
 *
 * Every set of scores carries the three loss adds up beside the four (#265) --
 * see PARTS. A history and a track record give them; the listing does not, and
 * neither would a report without their columns, so there each is null.
 *
 * From format 3 (#279) a set of scores also carries each of MORE the report
 * gives: an options model's scores, the top 10's of every model, and an options
 * model's for each hold it is held. Only where it gives them, so a report before
 * them reads exactly as it did. A task says which scores its models have, and a
 * live version taken down, and each check, which hold it was where the model
 * has holds. From format 5 a stock model has holds too, and its three averaged,
 * Combined (#300), and the listing gives each model's scores on each of them.
 *
 * A day's average is taken over a model's own scored DAYS, not the calendar. A
 * day it was not running -- before it started, after it retired, a night the
 * trainer did not run -- has no row, so it neither counts as a zero nor shortens
 * the window: the average of a day is of the rows ending at it, as many as the
 * listing's `average_days`, or every row so far while there are fewer.
 *
 * A hold's columns are averaged over the hold's own scored days, as the trainer
 * averages them (#300): a day's 5-day result is in 6 trading days after it, so
 * the newest rows of a longer hold are always empty, and its average over the
 * record's last 20 rows was of 15 days, or of none.
 *
 * Note: everything this needs is written inside the exported function. A worker
 *       is built from the function's TEXT -- see web-worker.js -- so a helper
 *       outside it, or one the build adds, is not there when it runs. That rules
 *       out syntax the build rewrites into helpers of its own: a spread, for...of,
 *       or `typeof x === 'object'` -- see model-report.test.js, which builds this
 *       file as the bundle does and runs the function's text on its own.
 *
 * Note: the csvs are read here rather than through papaparse. They hold dates,
 *       times, words and numbers, and an option's contract, whose name holds
 *       spaces -- nothing quoted, and no comma inside a cell -- and a worker
 *       cannot import the parser.
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
    // the endings of a hold's columns (#279): its picks held 1, 5 or 20 trading
    // days, and from format 5 a stock model's three holds averaged (#300)
    //
    const HOLDS = ['_1d', '_5d', '_20d'];
    const COMBINED = '_combined';
    const HOLD_ENDS = HOLDS.concat([COMBINED]);

    //
    // the scores a set carries only where the report gives them (#279): an
    // options model's chance of making money ranked against what did, and every
    // model's top 10 -- the average gain of each night's 10 best picks, and how
    // many of them made money. An options model gives its four scores again for
    // each hold, 1, 5 and 20 trading days, as `<score>_1d`, `_5d` and `_20d`.
    //
    // From format 5 a stock model gives every one of its scores for each hold
    // too, loss's three parts among them, and the four and the parts again as
    // `<score>_combined` (#300): the average of the day's 1, 5 and 20-day ones.
    // The top 10 has none of those, a 20-day gain and a 1-day gain not being the
    // same kind of number
    //
    const TRADES = ['profit_auc', 'top10_gain', 'top10_wins'];
    const MORE = TRADES.slice();

    HOLDS.forEach(function (hold) {
        READ.concat(TRADES).forEach(function (score) {
            MORE.push(score + hold);
        });
    });

    READ.forEach(function (score) {
        MORE.push(score + COMBINED);
    });

    //
    // the keys the listing gives each hold's scores under, from format 5 on
    // (#300) -- see holdScoresOf
    //
    const HOLD_KEYS = ['1d', '5d', '20d', 'combined'];

    //
    // how many of a model's scored days an average takes in, where the listing
    // does not say: before format 4, which gives it as `average_days` (#293)
    //
    const WINDOW = 20;

    //
    // how a live version came to be live: the model's first version, a nightly
    // update, or a weekly retrain
    //
    const LIVE_KINDS = ['first', 'nightly', 'weekly'];

    //
    // why the trainer took a live version down, from format 4 on (#295) -- see
    // downOf
    //
    const REASONS = ['worse', 'not_ahead', 'track_record'];

    const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

    function isRecord(value) {
        return value !== null && value !== undefined && value === Object(value) && !Array.isArray(value);
    }

    function has(source, key) {
        return Object.prototype.hasOwnProperty.call(source, key);
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
    // how many of a model's scored days its scores average, and how many it has
    // to have before it is no longer New, from format 4 on (#293): the listing's
    // `average_days`, a whole number of at least 1, or WINDOW, as the trainer
    // averaged before it said
    //
    function averageDaysOf(value) {
        const days = wholeOf(value, 1);

        return days === null ? WINDOW : days;
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
    // which hold a check is of, from format 3 on (#279): the trading days an
    // options model's picks are held, or none for a model that has no holds --
    // given as null, or not at all. Anything else is not whole, and undefined
    // here, so the check it is on is read as one that is not
    //
    function holdOf(value) {
        if (!has(value, 'hold') || value.hold === null) {
            return null;
        }

        return wholeOf(value.hold, 1) === null ? undefined : value.hold;
    }

    //
    // a check with the hold it is of, where it is of one
    //
    function withHold(check, hold) {
        if (hold !== null) {
            check.hold = hold;
        }

        return check;
    }

    //
    // a model's live version taken down by the trainer, from format 2 on (#263):
    // the night it was, and the check that did it -- `days`, 1 for each day on
    // its own or 5 or 20 for an average over its latest scored days, and
    // `in_a_row`, how many scored days in a row it was worse than the baseline --
    // and from format 3, the hold it was of (#279).
    //
    // From format 4, why (#295): `worse`, the check that `days` and `in_a_row`
    // name; `not_ahead`, a live version that went live without beating the
    // baseline; and `track_record`, a track record no better than the
    // baseline's. Neither of the last two names a check, so their counts are
    // null. Every take-down before format 4 is `worse`, and so is a reason this
    // does not know.
    //
    // Null while it is live, and for one that names no night. A night is enough
    // to be down: a count or a hold that cannot be read is none, rather than a
    // model taken down read as live
    //
    function downOf(value) {
        if (!isRecord(value)) {
            return null;
        }

        const since = dayOf(value.since);
        const hold = holdOf(value);

        if (!since) {
            return null;
        }

        return withHold({
            since: since,
            reason: REASONS.indexOf(value.reason) >= 0 ? value.reason : 'worse',
            days: wholeOf(value.days, 1),
            in_a_row: wholeOf(value.in_a_row, 1),
        }, hold === undefined ? null : hold);
    }

    //
    // what a live version learned from, from format 4 on (#295): `training`, the
    // days it trained on, `stopping`, those that decided when it stopped, and
    // `first` and `last`, the oldest and newest of all of them. None where the
    // listing gives none, as one before format 4 does, or gives them unreadable.
    // A version learns from a day at least, so none trained on is none read
    //
    function liveDaysOf(value) {
        if (!isRecord(value)) {
            return null;
        }

        const training = wholeOf(value.training, 1);
        const first = dayOf(value.first);
        const last = dayOf(value.last);

        return training !== null && first && last
            ? { training: training, stopping: wholeOf(value.stopping, 0), first: first, last: last }
            : null;
    }

    //
    // the check of the live version's fine-tune, from the trainer's format 6
    // (#315): `passed`, whether the fine-tuned model passed it, `by`, the tested
    // model's loss on its stopping days less the fine-tuned model's -- above 0
    // where the fine-tune did better -- and `slack`, how much worse it may do and
    // still pass. None where the listing gives none, as one before format 6
    // does, or gives it unreadable
    //
    function fineTuneOf(value) {
        if (!isRecord(value) || (value.passed !== true && value.passed !== false)) {
            return null;
        }

        const by = numberOf(value.by);
        const slack = numberOf(value.slack);

        return by !== null && slack !== null && slack >= 0
            ? { passed: value.passed, by: by, slack: slack }
            : null;
    }

    //
    // how close each of the trainer's checks is to taking the live version down,
    // as of the newest scored day (#263): `days`, `in_a_row` -- how many scored
    // days in a row it has been worse, or null until it has enough days -- and
    // `limit`, the count that takes it down, and from format 3 the hold it is of
    // (#279), an options model's checks running on each. A check that is not
    // whole is passed over, and a listing before format 2 gives none
    //
    function behindOf(value) {
        return (Array.isArray(value) ? value : [])
            .filter(function (check) {
                return isRecord(check)
                    && wholeOf(check.days, 1) !== null
                    && wholeOf(check.limit, 1) !== null
                    && (check.in_a_row === null || wholeOf(check.in_a_row, 0) !== null)
                    && holdOf(check) !== undefined;
            })
            .map(function (check) {
                return withHold({ days: check.days, in_a_row: check.in_a_row, limit: check.limit }, holdOf(check));
            });
    }

    //
    // the scores a task's models have, in the order the pages offer them, from
    // format 3 on (#279): each name once, as text. Undefined for a task that does
    // not say, as one before format 3 does not
    //
    function taskScoresOf(value) {
        if (!Array.isArray(value)) {
            return undefined;
        }

        const named = [];

        value.forEach(function (name) {
            const score = textOf(name);

            if (score && named.indexOf(score) < 0) {
                named.push(score);
            }
        });

        return named;
    }

    //
    // the four scores and loss's three parts, read off a csv row's columns named
    // `prefix` and the score, or off an object of them, and each of MORE that it
    // has a column or a key for (#279)
    //
    function scoresOf(source, prefix) {
        const scores = {};

        READ.forEach(function (score) {
            scores[score] = numberOf(source[prefix + score]);
        });

        MORE.forEach(function (score) {
            if (has(source, prefix + score)) {
                scores[score] = numberOf(source[prefix + score]);
            }
        });

        return scores;
    }

    //
    // a model's scores on each of its holds, from format 5 on (#300): `days`, how
    // many scored days the hold has, and `score` and `baseline`, its scores
    // averaged over its own latest `average_days` of them, each read as the
    // listing's own are, or null before the first. Only the holds the listing
    // gives, under HOLD_KEYS, and none for one before format 5, which gives none
    //
    function holdScoresOf(value) {
        if (!isRecord(value)) {
            return null;
        }

        const holds = {};

        HOLD_KEYS.forEach(function (key) {
            const hold = value[key];

            if (isRecord(hold)) {
                holds[key] = {
                    days: countOf(hold.days),
                    score: isRecord(hold.score) ? scoresOf(hold.score, '') : null,
                    baseline: isRecord(hold.baseline) ? scoresOf(hold.baseline, '') : null,
                };
            }
        });

        return Object.keys(holds).length ? holds : null;
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
    // their averages add up to loss's. Every row of one report carries the same
    // scores, its header's -- see scoresOf -- so the newest's are every row's
    //
    function averageOf(recent, field) {
        const average = {};

        Object.keys(recent[recent.length - 1][field]).forEach(function (score) {
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
    // names is left out, having nothing to list. A task keeps the scores it names
    // from format 3 on (#279). Every model carries the listing's `average_days`
    // (#293), so whatever has a model has its number, and from format 5 its
    // scores on each hold, where the listing gives them (#300)
    //
    function listing(report) {
        if (!isRecord(report) || !Array.isArray(report.models)) {
            return null;
        }

        const averageDays = averageDaysOf(report.average_days);
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
            const holds = holdScoresOf(entry.holds);

            seen[name] = true;

            const model = {
                name: name,
                task: task,
                description: textOf(entry.description),
                started: dayOf(entry.started),
                retired: dayOf(entry.retired),
                scored_days: countOf(entry.scored_days),
                average_days: averageDays,
                live: {
                    since: dayOf(live.since),
                    kind: LIVE_KINDS.indexOf(live.kind) >= 0 ? live.kind : null,
                    days: liveDaysOf(live.days),
                    fine_tune: fineTuneOf(live.fine_tune),
                },
                attempts: {
                    total: countOf(attempts.total),
                    went_live: countOf(attempts.went_live),
                },
                score: isRecord(entry.score) ? scoresOf(entry.score, '') : null,
                baseline: isRecord(entry.baseline) ? scoresOf(entry.baseline, '') : null,
                down: downOf(entry.down),
                behind: behindOf(entry.behind),
            };

            if (holds) {
                model.holds = holds;
            }

            models.push(model);
        });

        const named = {};
        const tasks = [];

        (Array.isArray(report.tasks) ? report.tasks : []).forEach(function (entry) {
            const id = isRecord(entry) ? textOf(entry.id) : '';

            if (id && !named[id]) {
                const task = { id: id, name: textOf(entry.name) || id, description: textOf(entry.description) };
                const scores = taskScoresOf(entry.scores);

                if (scores) {
                    task.scores = scores;
                }

                named[id] = true;
                tasks.push(task);
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
            average_days: averageDays,
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
    // From the trainer's format 6 (#315), a night says whether its attempt
    // trained again with its held-out days -- see trainedAgain
    //
    function history(csv) {
        return byDay(rowsOf(csv), function (row, day) {
            return {
                day: day,
                kind: String(row.kind).toLowerCase() === 'weekly' ? 'weekly' : 'nightly',
                went_live: /^(true|1)$/i.test(String(row.went_live)),
                trained_again: trainedAgain(row.trained_again),
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
    // whether a night's attempt trained again with its held-out days, from the
    // trainer's format 6 (#315): true where it passed and trained again, false
    // where it was kept back or did not, in either spelling, as went_live is. A
    // night before format 6 has an empty cell, and a history written before the
    // column has none: either way it is null, a night the live version's loss
    // judged too
    //
    function trainedAgain(value) {
        const text = textOf(value);

        if (/^(true|1)$/i.test(text)) {
            return true;
        }

        return /^(false|0)$/i.test(text) ? false : null;
    }

    //
    // whether a column's name ends as a hold's do, '_5d' or '_combined'
    //
    function endsWith(name, end) {
        return name.slice(-end.length) === end;
    }

    //
    // the endings of the holds a track record has columns for (#279): none for
    // one before format 3, nor for a stock model's before format 5 (#300). Every
    // row of one report carries the same scores, its header's
    //
    function holdsIn(rows) {
        const names = rows.length ? Object.keys(rows[0].score) : [];

        return HOLD_ENDS.filter(function (end) {
            return names.some(function (name) { return endsWith(name, end); });
        });
    }

    //
    // whether a day has a hold's result in yet: a number in any of its columns
    //
    function hasHold(row, end) {
        return Object.keys(row.score).some(function (name) {
            return endsWith(name, end) && row.score[name] !== null;
        });
    }

    //
    // each of a hold's columns in `average`, averaged over `days`, the hold's own
    // latest scored days, in place of averageOf's over the record's latest rows
    // (#300). Where none has the hold yet, each is null
    //
    function averageHold(days, field, end, average) {
        Object.keys(average).forEach(function (name) {
            if (!endsWith(name, end)) {
                return;
            }

            const values = days
                .map(function (row) { return row[field][name]; })
                .filter(function (value) { return value !== null; });

            average[name] = values.length
                ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length
                : null;
        });
    }

    //
    // the track record: every scored day, with the averages ending at it, the
    // model's and the baseline's, over `averageDays` days -- the listing's
    // `average_days` (#293) -- and how many days they take in.
    //
    // A hold's columns are averaged over its own latest `averageDays` scored days
    // up to the day, as the trainer averages them, and `hold_days` says how many
    // each hold's take in, keyed as the listing's `holds` are, `5d` or `combined`
    // (#300). A record with no hold's columns has none.
    //
    // From format 2 on, the day whose score set off a check that took the live
    // version down says which check, as the listing's `down` does (#263), and from
    // format 3 the hold whose scores set it off, for a model that has holds. Every
    // other day's cells are empty, and a track record written before the columns
    // has none: either way, each is null
    //
    function trackRecord(csv, averageDays) {
        const rows = byDay(rowsOf(csv), function (row, day) {
            return {
                day: day,
                score: scoresOf(row, ''),
                baseline: scoresOf(row, 'baseline_'),
                down_days: wholeCellOf(row.down_days),
                down_in_a_row: wholeCellOf(row.down_in_a_row),
                down_hold: wholeCellOf(row.down_hold),
            };
        });

        //
        // the days each hold has its result on so far, oldest first
        //
        const ends = holdsIn(rows);
        const held = {};

        ends.forEach(function (end) {
            held[end] = [];
        });

        rows.forEach(function (row, at) {
            const recent = rows.slice(Math.max(0, at - averageDays + 1), at + 1);

            row.days = recent.length;
            row.average = averageOf(recent, 'score');
            row.baseline_average = averageOf(recent, 'baseline');

            if (!ends.length) {
                return;
            }

            row.hold_days = {};

            ends.forEach(function (end) {
                if (hasHold(row, end)) {
                    held[end].push(row);
                }

                const latest = held[end].slice(-averageDays);

                averageHold(latest, 'score', end, row.average);
                averageHold(latest, 'baseline', end, row.baseline_average);
                row.hold_days[end.slice(1)] = latest.length;
            });
        });

        return rows;
    }

    //
    // an options model's picks (#279): a row per option, each hold's apart and
    // best first, so the pages draw each hold's in the order it was ranked. A
    // row names the night it was picked, its hold and its rank, and the stock;
    // one without them is passed over. What the option is -- its contract, call
    // or put, strike and expiry -- when it is bought and sold, its last bid and
    // ask, and the model's chance it makes money beside the usual chance for
    // options like it, and the gain it guesses, low, middle and high, are each
    // as the csv has them, or null.
    //
    // Note: a contract's name holds spaces, never a comma, so the cells split as
    //       every other csv's do, and only the ends of each are trimmed
    //
    function optionPicks(csv) {
        const rows = rowsOf(csv)
            .map(function (row) {
                return {
                    day: dayOf(row.day),
                    hold: wholeCellOf(row.hold),
                    rank: wholeCellOf(row.rank),
                    ticker: textOf(row.ticker),
                    contract: textOf(row.contract),
                    call_put: textOf(row.call_put).toLowerCase(),
                    strike: numberOf(row.strike),
                    expiry: dayOf(row.expiry),
                    buy_on: dayOf(row.buy_on),
                    sell_on: dayOf(row.sell_on),
                    last_bid: numberOf(row.last_bid),
                    last_ask: numberOf(row.last_ask),
                    chance: numberOf(row.chance),
                    usual_chance: numberOf(row.usual_chance),
                    gain_low: numberOf(row.gain_low),
                    gain_middle: numberOf(row.gain_middle),
                    gain_high: numberOf(row.gain_high),
                };
            })
            .filter(function (row) {
                return row.day && row.hold !== null && row.rank !== null && row.ticker;
            })
            .sort(function (a, b) {
                return a.hold - b.hold || a.rank - b.rank;
            });

        return rows.length ? rows : null;
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
            answer.average_days = read ? read.average_days : null;
        } else if (asked.kind === 'history') {
            answer.rows = typeof csv === 'string' ? history(csv) : null;
        } else if (asked.kind === 'track-record') {
            answer.rows = typeof csv === 'string' ? trackRecord(csv, averageDaysOf(asked.average_days)) : null;
        } else if (asked.kind === 'option-picks') {
            answer.rows = typeof csv === 'string' ? optionPicks(csv) : null;
        } else {
            answer.rows = null;
        }

        self.postMessage(answer);
    };
};
