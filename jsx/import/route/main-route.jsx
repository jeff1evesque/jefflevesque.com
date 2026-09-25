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
import GraphLayout, { RetrievalGraph } from '../layout/graph/graph.jsx';
import HomePageState from '../redux/container/home-page.jsx';
import ForgotPasswordState from '../redux/container/forgot-password.jsx';
import ErrorPage from '../content/error-page.jsx';
import CanonicalStream from './canonical-stream.jsx';

//
// Note: every route that names a stream -- by its path, or by the '?item=' a
//       listing links to -- is wrapped in CanonicalStream, which replaces a url
//       naming the stream by a name it used to go by with the url naming it by
//       its id. A bookmark keeps working, and the page is only handed the id.
//
// Note: '/graph/retrieval' is a static segment, so react-router ranks it above
//       '/graph/:graph' whatever order they are written in, and it is never read
//       as a build id. A build published as 'retrieval' would be shadowed by it,
//       which no build can be: an id is '<dataset>.<YYYY-MM>.<run>.<variant>'.
//
class MainRoute extends Component {
    render() {
        return (
            <Routes>
                <Route exact path='/' element={<HomePageState />} />
                <Route path='/login' element={<LoginLayout />} />
                <Route path='/logout' element={<LoginLayout />} />
                <Route path='/register' element={<RegisterLayout />} />
                <Route path='/login/reset' element={<ForgotPasswordState />} />
                <Route path='/data' element={<CanonicalStream><DataLayoutState /></CanonicalStream>} />
                <Route path='/:user' element={<AccountLayout />} />
                <Route path='/:user/settings' element={<AccountSettingsLayout />} />
                <Route path='/stream' element={<CanonicalStream><StreamLayoutState /></CanonicalStream>} />
                <Route
                    path='/stream/:stream/trigger'
                    element={<CanonicalStream><StreamTriggerLayoutState /></CanonicalStream>}
                />
                <Route
                    path='/stream/:stream/alarm'
                    element={<CanonicalStream><StreamAlarm /></CanonicalStream>}
                />
                <Route path='/model' element={<ModelLayout />}/>
                <Route path='/graph' element={<GraphLayout />}/>
                <Route path='/graph/retrieval' element={<RetrievalGraph />}/>
                <Route path='/graph/retrieval/:day' element={<RetrievalGraph />}/>
                <Route path='/graph/:graph' element={<GraphLayout />}/>
                <Route path='/*' element={<ErrorPage />} />
            </Routes>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default MainRoute;
