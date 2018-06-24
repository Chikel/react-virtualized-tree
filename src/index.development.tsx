import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import Tree from "./Tree";
import { range } from "lodash/fp";
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

const renderRow = (item, expandCallback): JSX.Element => (
  <div key={item.id} onClick={expandCallback}>
    {item.name}
  </div>
);

const renderHeader = (): JSX.Element => (
  <div>Hello world</div>
);

ReactDOM.render(
  <Tree
    transitionDuration={500}
    headerRenderer={renderHeader}
    itemRenderer={renderRow}
    className={"vt-list"}
    indentation={20}
    rowHeight={20}
    items={items}
  />,
  document.getElementById("root")
);
