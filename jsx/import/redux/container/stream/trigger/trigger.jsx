/**
 * trigger.jsx: redux store for articles.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { connect } from 'react-redux';
import StreamTriggerLayout from '../../../../layout/stream/trigger.jsx';
import checkValidBool from '../../../../validator/valid-bool.js';

// wraps each function of the object to be dispatch callable
const mapDispatchToProps = (state) => {
    var hide_all = false;

    if ('hide' in state && state.hide) {
        if ('hide_all' in state.hide && checkValidBool(state.hide.hide_all)) {
            var hide_all = state.hide.hide_all;
        }

        if ('hide_graph' in state.hide && checkValidBool(state.hide.hide_graph)) {
            var hide_graph = state.hide.hide_graph;
        }

    }

    // return redux to state
      return {
          hide: {
              all: hide_all,
              graph: hide_graph
          }
      }
}

// pass selected properties from redux state tree to component
const StreamTriggerLayoutState = connect(
    mapDispatchToProps,
    null
)(StreamTriggerLayout)

// indicate which class can be exported, and instantiated via 'require'
export default StreamTriggerLayoutState
