/**
 * forgot-password.jsx: redux store for forget password.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { connect } from 'react-redux';
import ForgotPasswordForm from '../../content/forgot-password.jsx';
import { setLayout, setSpinner } from '../action/page.jsx';

// wraps each function of the object to be dispatch callable
const mapDispatchToProps = (dispatch) => {
    return {
        dispatchLayout: dispatch.bind(setLayout),
        dispatchSpinner: dispatch.bind(setSpinner)
    }
}

// pass selected properties from redux state tree to component
const ForgotPasswordState = connect(
    null,
    mapDispatchToProps
)(ForgotPasswordForm)

// indicate which class can be exported, and instantiated via 'require'
export default ForgotPasswordState
