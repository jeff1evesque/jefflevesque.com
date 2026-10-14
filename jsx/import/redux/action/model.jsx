/**
 * model.jsx: the score the model pages show, sent to the redux store (#243).
 *
 * /model and every model's own page share one score picker, so a score picked
 * on one is the score the other opens on.
 *
 */

function setModelScore(score) {
    return {
        type: 'SET-MODEL-SCORE',
        score: score
    };
}

// indicate which class can be exported, and instantiated via 'require'
export {
    setModelScore
}
