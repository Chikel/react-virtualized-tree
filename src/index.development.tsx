import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import Tree from "./Tree";
import { range } from "lodash/fp";
const uuid = require("uuid/v4");

const items = range(0, 100).map(() => ({
  id: uuid(),
  name: uuid(),
  children: range(0, 1).map(() => ({
    id: uuid(),
    name: uuid()
  }))
}));

const renderItem = ({ item, index, toggleChildren }): JSX.Element => (
  <div
    style={{
      backgroundColor: index % 2 === 0 ? "#fff" : "#f7f7f7",
      paddingLeft: item.level * 20
    }}
    onClick={toggleChildren}
    key={item.id}
  >
    {item.name}
  </div>
);

ReactDOM.render(
  <Tree
    transitionDuration={500}
    itemRenderer={renderItem}
    className={"list"}
    itemHeight={20}
    items={items}
  />,
  document.getElementById("root")
);
