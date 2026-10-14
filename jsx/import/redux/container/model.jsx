/**
 * model.jsx: redux store for the model pages (#243): /model, and each model's
 * own page at /model/:model.
 *
 * The two share the score their charts and figures show, so a score picked on
 * one is the score the other opens on. That is all the store holds for them:
 * everything else either page shows comes from the model api.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { connect } from 'react-redux';
import ModelLayout from '../../layout/model.jsx';
import ModelPageRoute from '../../layout/model/model-page.jsx';
import { setModelScore } from '../action/model.jsx';
import { DEFAULT_SCORE } from '../../layout/model/scores.js';

// transforms redux state tree to react properties
const mapStateToProps = (state) => ({
    score: state && state.model && state.model.score ? state.model.score : DEFAULT_SCORE,
});

const mapDispatchToProps = (dispatch) => ({
    onScore: (score) => dispatch(setModelScore(score)),
});

// pass selected properties from redux state tree to component
const ModelLayoutState = connect(
    mapStateToProps,
    mapDispatchToProps
)(ModelLayout)

const ModelPageState = connect(
    mapStateToProps,
    mapDispatchToProps
)(ModelPageRoute)

// indicate which class can be exported, and instantiated via 'require'
export default ModelLayoutState

export {
    ModelPageState
}
