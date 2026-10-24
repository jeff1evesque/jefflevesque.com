/**
 * model.jsx: the score the model pages show, sent to the redux store (#243).
 *
 * /model and every model's own page share one score picker per task (#279), so
 * a score picked for a task on one is the score the other opens on for that
 * task. A model page's hold picker is kept the same way, so it stays as it was
 * picked from one options model's page to the next, and from format 5 one
 * stock model's to the next, Combined among them (#300). Each of /model's lists
 * keeps a hold of its own, by task, apart from a model page's.
 *
 */

function setModelScore(task, score) {
    return {
        type: 'SET-MODEL-SCORE',
        task: task,
        score: score
    };
}

function setModelHold(hold) {
    return {
        type: 'SET-MODEL-HOLD',
        hold: hold
    };
}

function setModelListHold(task, hold) {
    return {
        type: 'SET-MODEL-LIST-HOLD',
        task: task,
        hold: hold
    };
}

// indicate which class can be exported, and instantiated via 'require'
export {
    setModelScore,
    setModelHold,
    setModelListHold
}
