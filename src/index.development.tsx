import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import Tree from "./Tree";

const items = [
  {id: 0, name: "Bob"},
  {
    id: 1, name: "Alice", children: [
      {id: 5, name: 'Brian'},
      {id: 16, name: 'Mary'},
      {id: 36, name: 'aMary'},
      {id: 46, name: 'cMary'},
      {id: 56, name: 'dMary'}
    ]
  },
  {id: 2, name: "Ron"},
  {id: 4, name: "Chikel", children: [
      {id: 7, name: 'Brian'},
      {id: 8, name: 'Mary'}
    ]}
];

const renderRow = (item, expandCallback): JSX.Element => (
  <div key={item.id} onClick={expandCallback}>
    {item.name}
  </div>
);

ReactDOM.render(
  <div style={{ height: "100vh", position: "relative" }}>
    <Tree
      transitionDuration={500}
      itemRenderer={renderRow}
      className={"list"}
      indentation={20}
      rowHeight={30}
      items={items}
    />
  </div>,
  document.getElementById("root")
);
