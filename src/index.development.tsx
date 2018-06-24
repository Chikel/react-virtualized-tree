import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import Tree from "./Tree";
import {range} from "lodash/fp";

const uuid = require("uuid/v4");

const items = range(0, 100).map(() => ({
  id: uuid(),
  name: uuid(),
  children: range(0, 10).map(() => ({
    id: uuid(),
    name: uuid(),
    children: range(0, 10).map(() => ({
      id: uuid(),
      name: uuid(),
      children: range(0, 10).map(() => ({
        id: uuid(),
        name: uuid()
      }))
    }))
  }))
}));


class Container extends React.Component {
  state = {
    rowHeight: 20
  };

  renderRow = (item, expandCallback): JSX.Element => (
    <div key={item.id} onClick={expandCallback} style={{paddingLeft: item.level * 20}}>
      {item.name}
    </div>
  );

  renderHeader = (): JSX.Element => (
    <div>Hello world</div>
  );

  render() {
    return (
      <div>
        <button onClick={() => this.setState({rowHeight: 70})}>click here</button>
        <Tree
          transitionDuration={500}
          headerRenderer={this.renderHeader}
          itemRenderer={this.renderRow}
          className={"vt-list"}
          rowHeight={this.state.rowHeight}
          items={items}
        />
      </div>
    );
  }
}

ReactDOM.render(
  <Container/>,
  document.getElementById("root")
);
