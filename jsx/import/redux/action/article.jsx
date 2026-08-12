/**
 * article.jsx: update redux store indicating whether article element clicked.
 *
 */

function setStockSplitProp(action) {
    return {
        type: 'SET-ARTICLE-STOCK-SPLIT',
        article: {
            type: 'article' in action && 'type' in action.article ? action.article.type : 'general',
            date: 'article' in action && 'date' in action.article ? action.article.date: null,
            ticker: 'article' in action && 'ticker' in action.article ? action.article.ticker: null,
            clicked: 'article' in action && 'clicked' in action.article ? action.article.clicked : false,
            started_on: 'article' in action && 'started_on' in action.article ? action.article.started_on : 'n/a',
            completed_on: 'article' in action && 'completed_on' in action.article ? action.article.completed_on : 'n/a',
            retry: 'article' in action && 'retry' in action.article ? action.article.retry : 'n/a',
            expected_runtime: 'article' in action && 'expected_runtime' in action.article ? action.article.expected_runtime : 'n/a',
            actual_runtime: 'article' in action && 'actual_runtime' in action.article ? action.article.actual_runtime : 'n/a'
        }
    };
}

// indicate which class can be exported, and instantiated via 'require'
export { setStockSplitProp }
