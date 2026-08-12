/**
 * article.jsx: define article type.
 *
 * Note: the triple dots is the 'object spread' syntax:
 *
 *       http://redux.js.org/docs/recipes/UsingObjectSpreadOperator.html
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

const article = (state='default', action) => {
    return {
        ...state,
        type: 'article' in action && 'type' in action.article ? action.article.type : 'general',
        ticker: 'article' in action && 'ticker' in action.article ? action.article.ticker: null,
        date: 'article' in action && 'date' in action.article ? action.article.date: null,
        clicked: 'article' in action && 'clicked' in action.article ? action.article.clicked : false,
        started_on: 'article' in action && 'started_on' in action.article ? action.article.started_on : 'n/a',
        completed_on: 'article' in action && 'completed_on' in action.article ? action.article.completed_on : 'n/a',
        retry: 'article' in action && 'retry' in action.article ? action.article.retry : 'n/a',
        expected_runtime: 'article' in action && 'expected_runtime' in action.article ? action.article.expected_runtime : 'n/a',
        actual_runtime: 'article' in action && 'actual_runtime' in action.article ? action.article.actual_runtime : 'n/a'
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default article
