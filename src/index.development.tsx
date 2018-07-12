import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import Tree from "./Tree";
import { range } from "lodash/fp";
const uuid = require("uuid/v4");

const items = range(0, 100).map(() => ({
  id: uuid(),
  name: uuid(),
  backgroundColor: `rgb(${Math.random() * 0xff}, ${Math.random() *
    0xff}, ${Math.random() * 0xff})`,
    children: range(0, Math.round(Math.random() * 20)).map(() => ({
    id: uuid(),
    name: uuid(),
    backgroundColor: `rgb(${Math.random() * 0xff}, ${Math.random() *
      0xff}, ${Math.random() * 0xff})`,
    children: range(0, Math.round(Math.random() * 20)).map(() => ({
      id: uuid(),
      name: uuid(),
      backgroundColor: `rgb(${Math.random() * 0xff}, ${Math.random() *
        0xff}, ${Math.random() * 0xff})`
    }))
  }))
}));

const renderItem = ({ item, expandCallback }): JSX.Element => (
  <div
    style={{
      width: 100,
      height: "100%",
      border: "1px solid black",
      backgroundColor: item.backgroundColor,
      marginLeft: item.level * 20
    }}
    onClick={expandCallback}
    key={item.id}
  />
);

ReactDOM.render(
  <Tree
    transitionDuration={2000}
    itemRenderer={renderItem}
    className="list"
    itemHeight={20}
    items={items}
  />,
  document.getElementById("root")
);
