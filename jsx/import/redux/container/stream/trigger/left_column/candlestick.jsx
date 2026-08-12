/**
 * candlestick.jsx: redux store for candlestick left-column content.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { connect } from 'react-redux';
import CandlestickLeftColumn from '../../../../../layout/stream/trigger/left_column/candlestick.jsx';
import { setHide } from '../../../../action/hide.jsx';

// transforms redux state tree to react properties
const mapDispatchToProps = (dispatch) => {
    return {
        dispatchHide: dispatch.bind(setHide)
    }
}

// pass selected properties from redux state tree to component
const CandlestickLeftColumnState = connect(
    null,
    mapDispatchToProps
)(CandlestickLeftColumn)

// indicate which class can be exported, and instantiated via 'require'
export default CandlestickLeftColumnState
