import React, { Component } from 'react';
import { Button, Form, FormGroup, Label, Input } from 'reactstrap';

export default class Login extends Component {
  render() {
    return (
      <div>
        <Form action="https://api.sportnet.online/v1/oauth/authorize?client_id=eshop_sfz&response_type=token&scope=profile%2Cprofile_issf&appSpace=eshop_sfz&redirect_uri=https%3A%2F%2Ffutbalnet.shop%2Fcallback-auth&state=%2F" method="POST">
          <FormGroup>
            <Label for="username">username</Label>
            <Input type="text" name="username" id="username" placeholder="username" />
          </FormGroup>
          <FormGroup>
            <Label for="password">Password</Label>
            <Input type="password" name="password" id="password" placeholder="password" />
          </FormGroup>
          <Button type="submit">Sign Up</Button>
        </Form>
      </div>
    );
  }
}