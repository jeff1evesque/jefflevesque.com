/**
 * register.jsx: redux store for general page settings, login, and logout
 *               processes.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { connect } from 'react-redux';
import RegisterForm from '../../layout/register/content/webform.jsx';
import { setLayout, setSpinner } from '../action/page.jsx';

// transforms redux state tree to react properties
const mapStateToProps = (state) => {
  // validate username
  let username = 'anonymous';

  if (state && state.user) {
      username = !!state.user.name ? state.user.name : 'anonymous';
  }

  // return redux to state
    return {
        user: {
            name: username
        }
    }
}

// wraps each function of the object to be dispatch callable
const mapDispatchToProps = (dispatch) => {
    return {
        dispatchLayout: dispatch.bind(setLayout),
        dispatchSpinner: dispatch.bind(setSpinner)
    }
}

// pass selected properties from redux state tree to component
const RegisterState = connect(
    mapStateToProps,
    mapDispatchToProps
)(RegisterForm)

// indicate which class can be exported, and instantiated via 'require'
export default RegisterState
