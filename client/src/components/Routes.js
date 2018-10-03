import React from "react";
import { Route, Switch } from "react-router-dom";
import News from "./News";
import Home from "./Home";
import Login from './Login';

export default () =>
  <Switch>
  	<Route path="/" exact component={Home} />
    <Route path="/news" exact component={News} />
    <Route path="/login" exact component={Login} />
  </Switch>;