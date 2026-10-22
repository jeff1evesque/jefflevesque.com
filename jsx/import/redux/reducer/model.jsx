/**
 * model.jsx: what the model pages share (#243): the score their charts and
 * figures show for each task, loss until another is picked (#279), and the hold
 * an options model's track record shows, the 1-day hold's until another is.
 *
 * A score the pages do not know is not taken, so the store never holds one no
 * picker has a button for; neither is a hold that is none of the three, nor a
 * score for no task.
 *
 */

import { DEFAULT_HOLD, HOLDS, isScore } from '../../layout/model/scores.js';

const model = (state = { scores: {}, hold: DEFAULT_HOLD }, action) => {
    if (
        action
        && action.type === 'SET-MODEL-SCORE'
        && typeof action.task === 'string'
        && action.task
        && isScore(action.score)
    ) {
        return { ...state, scores: { ...state.scores, [action.task]: action.score } };
    }

    if (
        action
        && action.type === 'SET-MODEL-HOLD'
        && HOLDS.some((hold) => hold.days === action.hold)
    ) {
        return { ...state, hold: action.hold };
    }

    return state;
}

// indicate which class can be exported, and instantiated via 'require'
export default model
