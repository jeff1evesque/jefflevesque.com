/**
 * data.jsx: redux store for data article listing page.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { connect } from 'react-redux';
import DataLayout from '../../../layout/data/data.jsx';

// transforms redux state tree to react properties
const mapStateToProps = (state) => {
  // validate username
    if (state && state.user && !!state.user.name) {
        var username = state.user.name
    } else {
        var username = 'anonymous'
    }

  // fetch spinner
    if (
        state &&
        state.page &&
        state.page.effects &&
        state.page.effects.spinner
    ) {
        var spinnerBool = true;
    } else {
        var spinnerBool = false;
    }

  // fetch article-listing.jsx result from redux store
    const type = 'article' in state && !!state.article.type ? state.article.type : 'general';
    const ticker = 'article' in state && !!state.article.ticker ? state.article.ticker : null;
    const date = 'article' in state && !!state.article.date ? state.article.date : null;
    const clicked = 'article' in state && !!state.article.clicked ? state.article.clicked : false;
    const started_on = 'article' in state && !!state.article.started_on ? state.article.started_on : 'n/a';
    const completed_on = 'article' in state && !!state.article.completed_on ? state.article.completed_on : 'n/a';
    const retry = 'article' in state && !!state.article.retry ? state.article.retry : 'n/a';
    const expected_runtime = 'article' in state && !!state.article.expected_runtime ? state.article.expected_runtime : 'n/a';
    const actual_runtime = 'article' in state && !!state.article.actual_runtime ? state.article.actual_runtime : 'n/a';

  // return redux to state
    return {
        user: {
            name: username
        },
        effects: {
            spinner: spinnerBool
        },
        article: {
            type: type,
            ticker: ticker,
            date: date,
            clicked: clicked,
            started_on: started_on,
            completed_on: completed_on,
            retry: retry,
            expected_runtime: expected_runtime,
            actual_runtime: actual_runtime
        }
    }
}

// pass selected properties from redux state tree to component
const DataLayoutState = connect(
    mapStateToProps,
    null
)(DataLayout)

// indicate which class can be exported, and instantiated via 'require'
export default DataLayoutState
