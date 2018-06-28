import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import Tree from "./Tree";
import { range } from "lodash/fp";
const uuid = require("uuid/v4");

const items = range(0, 400).map(() => ({
  id: uuid(),
  name: uuid(),
  children: range(0, 10).map(() => ({
    id: uuid(),
    name: uuid()
  }))
}));

const renderItem = ({ item, index, expandCallback }): JSX.Element => (
  <div
    style={{
      backgroundColor: index % 2 === 0 ? "#fff" : "#f7f7f7",
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
    transitionDuration={500}
    itemRenderer={renderItem}
    className={"list"}
    itemHeight={20}
    items={items}
  />,
  document.getElementById("root")
);
