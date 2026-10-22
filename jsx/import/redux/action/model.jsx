/**
 * model.jsx: the score the model pages show, sent to the redux store (#243).
 *
 * /model and every model's own page share one score picker per task (#279), so
 * a score picked for a task on one is the score the other opens on for that
 * task. A model page's hold picker is kept the same way, so it stays as it was
 * picked from one options model's page to the next.
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

// indicate which class can be exported, and instantiated via 'require'
export {
    setModelScore,
    setModelHold
}
