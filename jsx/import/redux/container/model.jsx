/**
 * model.jsx: redux store for the model pages (#243): /model, each model's own
 * page at /model/:model, and an options model's picks at /model/:model/picks
 * (#290).
 *
 * The first two share the score their charts and figures show for each task
 * (#279), so a score picked for a task on one is the score the other opens on
 * for it. A model's own page keeps the hold it shows an options model's track
 * record by, too, and its picks page shares it: a hold picked on either is the
 * one the other opens on. From format 5 a stock model's page keeps it as well,
 * Combined among them (#300), which an options model's page and its picks
 * page, having no Combined, show as 1 day while it is kept. Each of /model's
 * lists keeps a hold of its own, by task, as it keeps its score. That is all
 * the store holds for them: everything else the pages show comes from the
 * model api.
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
import PicksPageRoute from '../../layout/model/picks-page.jsx';
import { setModelHold, setModelListHold, setModelScore } from '../action/model.jsx';
import { COMBINED, DEFAULT_HOLD } from '../../layout/model/scores.js';

//
// the scores picked, by task: none until one is, which every page reads as
// loss -- see scores.js's chosenScore
//
const scoresOf = (state) => (state && state.model && state.model.scores ? state.model.scores : {});

//
// the hold picked, which a model's page and an options model's picks page
// share. The picks page has no Combined (#300), and shows 1 day while it is
// kept
//
const holdOf = (state) => (state && state.model && state.model.hold ? state.model.hold : DEFAULT_HOLD);
const picksHoldOf = (state) => (holdOf(state) === COMBINED ? DEFAULT_HOLD : holdOf(state));

//
// the hold each of /model's lists is on, by task (#300): none until one is
// picked, which a list reads as 1 day
//
const holdsOf = (state) => (state && state.model && state.model.holds ? state.model.holds : {});

// transforms redux state tree to react properties
const mapStateToProps = (state) => ({
    scores: scoresOf(state),
    holds: holdsOf(state),
});

const mapPageStateToProps = (state) => ({
    scores: scoresOf(state),
    hold: holdOf(state),
});

const mapPicksStateToProps = (state) => ({
    hold: picksHoldOf(state),
});

const mapPicksDispatchToProps = (dispatch) => ({
    onHold: (hold) => dispatch(setModelHold(hold)),
});

const mapDispatchToProps = (dispatch) => ({
    onScore: (task, score) => dispatch(setModelScore(task, score)),
    onHold: (task, hold) => dispatch(setModelListHold(task, hold)),
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

const ModelPicksState = connect(
    mapPicksStateToProps,
    mapPicksDispatchToProps
)(PicksPageRoute)

// indicate which class can be exported, and instantiated via 'require'
export default ModelLayoutState

export {
    ModelPageState,
    ModelPicksState
}
