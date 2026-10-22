/**
 * model.jsx: redux store for the model pages (#243): /model, and each model's
 * own page at /model/:model.
 *
 * The two share the score their charts and figures show for each task (#279),
 * so a score picked for a task on one is the score the other opens on for it.
 * A model's own page keeps the hold it shows an options model's track record
 * by, too. That is all the store holds for them: everything else either page
 * shows comes from the model api.
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
import { setModelHold, setModelScore } from '../action/model.jsx';
import { DEFAULT_HOLD } from '../../layout/model/scores.js';

//
// the scores picked, by task: none until one is, which every page reads as
// loss -- see scores.js's chosenScore
//
const scoresOf = (state) => (state && state.model && state.model.scores ? state.model.scores : {});

// transforms redux state tree to react properties
const mapStateToProps = (state) => ({
    scores: scoresOf(state),
});

const mapPageStateToProps = (state) => ({
    scores: scoresOf(state),
    hold: state && state.model && state.model.hold ? state.model.hold : DEFAULT_HOLD,
});

const mapDispatchToProps = (dispatch) => ({
    onScore: (task, score) => dispatch(setModelScore(task, score)),
});

const mapPageDispatchToProps = (dispatch) => ({
    onScore: (task, score) => dispatch(setModelScore(task, score)),
    onHold: (hold) => dispatch(setModelHold(hold)),
});

// pass selected properties from redux state tree to component
const ModelLayoutState = connect(
    mapStateToProps,
    mapDispatchToProps
)(ModelLayout)

const ModelPageState = connect(
    mapPageStateToProps,
    mapPageDispatchToProps
)(ModelPageRoute)

// indicate which class can be exported, and instantiated via 'require'
export default ModelLayoutState

export {
    ModelPageState
}
