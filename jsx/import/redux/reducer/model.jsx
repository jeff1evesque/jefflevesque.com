/**
 * model.jsx: what the model pages share (#243): the score their charts and
 * figures show for each task, loss until another is picked (#279), and the hold
 * a model's page shows, the 1-day hold's until another is -- from format 5 a
 * stock model's too, or Combined (#300) -- and the hold each of /model's lists
 * shows, by task, kept apart from it.
 *
 * A score the pages do not know is not taken, so the store never holds one no
 * picker has a button for; neither is a hold that is none of the four, nor a
 * score or a list's hold for no task.
 *
 */

import { DEFAULT_HOLD, isHold, isScore } from '../../layout/model/scores.js';

const model = (state = { scores: {}, hold: DEFAULT_HOLD, holds: {} }, action) => {
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
        && isHold(action.hold)
    ) {
        return { ...state, hold: action.hold };
    }

    if (
        action
        && action.type === 'SET-MODEL-LIST-HOLD'
        && typeof action.task === 'string'
        && action.task
        && isHold(action.hold)
    ) {
        return { ...state, holds: { ...(state.holds || {}), [action.task]: action.hold } };
    }

    return state;
}

// indicate which class can be exported, and instantiated via 'require'
export default model
