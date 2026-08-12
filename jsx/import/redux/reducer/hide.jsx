/**
 * hide.jsx
 *
 * Note: the triple dots is the 'object spread' syntax:
 *
 *       http://redux.js.org/docs/recipes/UsingObjectSpreadOperator.html
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import checkValidBool from '../../validator/valid-bool.js';

const hide = (state='default', action) => {
    const combined_action = {};

    if (
        action
        && 'hide_all' in action
        && checkValidBool(action.hide_all)
    ) {
        combined_action['hide_all'] = action.hide_all;
    }

    if (
        action
        && 'hide_graph' in action
        && checkValidBool(action.hide_graph)
    ) {
        combined_action['hide_graph'] = action.hide_graph;
    }

    return { ...state, ...combined_action }
}

// indicate which class can be exported, and instantiated via 'require'
export default hide
