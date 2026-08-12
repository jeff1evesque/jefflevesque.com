/**
 * main-route.jsx: upper level routes.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginLayout from '../layout/login.jsx';
import RegisterLayout from '../layout/register/register.jsx';
import AccountLayout from '../layout/user/account.jsx';
import AccountSettingsLayout from '../layout/user/settings.jsx';
import DataLayoutState from '../redux/container/data/data.jsx';
import StreamLayoutState from '../redux/container/stream/stream.jsx';
import StreamTriggerLayoutState from '../redux/container/stream/trigger/trigger.jsx';
import StreamAlarm from '../layout/stream/alarm.jsx';
import ModelLayout from '../layout/model.jsx';
import HomePageState from '../redux/container/home-page.jsx';
import ForgotPasswordState from '../redux/container/forgot-password.jsx';
import ErrorPage from '../content/error-page.jsx';

class MainRoute extends Component {
    render() {
        return (
            <Routes>
                <Route exact path='/' element={<HomePageState />} />
                <Route path='/login' element={<LoginLayout />} />
                <Route path='/logout' element={<LoginLayout />} />
                <Route path='/register' element={<RegisterLayout />} />
                <Route path='/login/reset' element={<ForgotPasswordState />} />
                <Route path='/data' element={<DataLayoutState />} />
                <Route path='/:user' element={<AccountLayout />} />
                <Route path='/:user/settings' element={<AccountSettingsLayout />} />
                <Route path='/stream' element={<StreamLayoutState />} />
                <Route path='/stream/:stream/trigger' element={<StreamTriggerLayoutState />} />
                <Route path='/stream/:stream/alarm' element={<StreamAlarm />} />
                <Route path='/model' element={<ModelLayout />}/>
                <Route path='/*' element={<ErrorPage />} />
            </Routes>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default MainRoute;
