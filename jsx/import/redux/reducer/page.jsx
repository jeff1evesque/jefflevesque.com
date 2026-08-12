/**
 * page.jsx: describe page attributes.
 *
 * Note: the triple dots is the 'object spread' syntax:
 *
 *       http://redux.js.org/docs/recipes/UsingObjectSpreadOperator.html
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

const page = (state='default', action) => {

  // assign elements from action
    switch(action.type) {
        case 'SET-CONTENT-TYPE':
            var contentType = action.content_type;

            return {
                ...state,
                content_type: contentType
            }
        case 'SET-SPINNER':
            var spinnerBool = action.spinner;

            return {
                ...state,
                effects: {
                    ...state.effects,
                    spinner: spinnerBool
                }
            }
        default:
            return state;
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default page
