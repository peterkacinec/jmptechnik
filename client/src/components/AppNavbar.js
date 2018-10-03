import React, { Component } from 'react';
import {
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink
} from 'reactstrap';
import Routes from "./Routes";

export default class AppNavbar extends Component {
  constructor(props) {
    super(props);

    this.toggle = this.toggle.bind(this);
    this.state = {
      isOpen: false
    };
  }
  toggle() {
    this.setState({
      isOpen: !this.state.isOpen
    });
  }
  render() {
    return (
      <div>
         
          <Navbar color="light" light expand="md">
            <NavbarBrand href="/">JMPtechnik</NavbarBrand>
            <NavbarToggler onClick={this.toggle} />
            <Collapse isOpen={this.state.isOpen} navbar>
              <Nav className="ml-auto" navbar>
                <NavItem>
                  <NavLink href="/news">News</NavLink>
                </NavItem>
                <NavItem>
                  <NavLink href="/login">Login</NavLink>
                </NavItem>
                <NavItem>
                  <NavLink href="https://my.sportnet.online/auth/authorize?client_id=jmp_technik&redirect_uri=http%3A%2F%2Flocalhost:3000/news&response_type=token&scope=profile">Sportnet</NavLink>
                </NavItem>
              </Nav>
            </Collapse>
          </Navbar>
        <Routes />
      </div>
    );
  }
}