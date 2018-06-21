import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './index.css';
import Tree from './Tree'

const items = [
  {id: 0, name: "Bob"},
  {
    id: 1, name: "Alice", children: [
      {id: 5, name: 'Brian'},
      {id: 6, name: 'Mary'}
    ]
  },
  {id: 2, name: "Ron"},
  {id: 4, name: "Chikel"}
];

const renderRow = (item, expandCallback): JSX.Element => (
  <div className="row" key={item.id} onClick={expandCallback}>{item.name}</div>
);

ReactDOM.render(
  <div style={{height: '100vh', position: 'relative'}}>
    <Tree items={items} itemRenderer={renderRow} className={'list'} rowHeight={50}/>
  </div>,
  document.getElementById('root')
);
