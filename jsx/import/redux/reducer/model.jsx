/**
 * model.jsx: what the model pages share (#243): the score their charts and
 * figures show, loss until another is picked.
 *
 * A score the pages do not know is not taken, so the store never holds one the
 * picker has no button for.
 *
 */

import { DEFAULT_SCORE, SCORES } from '../../layout/model/scores.js';

const model = (state = { score: DEFAULT_SCORE }, action) => {
    if (
        action
        && action.type === 'SET-MODEL-SCORE'
        && SCORES.some((score) => score.key === action.score)
    ) {
        return { ...state, score: action.score };
    }

    return state;
}

// indicate which class can be exported, and instantiated via 'require'
export default model
