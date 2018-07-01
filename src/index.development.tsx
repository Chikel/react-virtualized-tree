import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import Tree from "./Tree";
import { range } from "lodash/fp";
const uuid = require("uuid/v4");

const items = range(0, 200).map(() => ({
  id: uuid(),
  name: uuid(),
  children: range(0, 20).map(() => ({
    id: uuid(),
    name: uuid(),
    children: range(0, 20).map(() => ({
      id: uuid(),
      name: uuid()
    }))
  }))
}));

const renderItem = ({ item, expandCallback }): JSX.Element => (
  <div
    style={{
      border: "1px solid silver",
      paddingLeft: item.level * 20
    }}
    onClick={expandCallback}
    key={item.id}
  >
    {item.name}
  </div>
);

ReactDOM.render(
  <Tree
    transitionDuration={250}
    itemRenderer={renderItem}
    className="list"
    itemHeight={20}
    items={items}
  />,
  document.getElementById("root")
);
