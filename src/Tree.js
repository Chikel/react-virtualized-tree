import React from 'react';
import { List } from 'react-virtualized';
import PropTypes from 'prop-types';

const persons = [
  { id: 0, name: "tohar" },
  { id: 1, name: "aran" },
  { id: 2, name: "efgefg" },
  { id: 3, name: "svdfs" },
  {
    id: 4, name: "svs", children: [
      { id: 0, name: 'Brian Vaughn' },
      { id: 1, name: 'Brian Vaughn2' }
    ]
  },
  { id: 5, name: "sgdfbgdfb" },
];

const x = (
  <Tree
    items={persons}
    itemRenderer={item => <div>{item.name}</div>}
    getChildren={item => filter({ personId: item.id }, dogs)}
  />
);

const getNormalizedTreeItems = (nodes, level = 0) => {
  if (!nodes) {
    return null;
  }

  return flatten(nodes.map(node => node.children ? [
    { ...node, level },
    ...flatten(node.children.map(node => getNormalizedTreeItems(node, level + 1)))
  ] : [{ ...node, level }]))
};

const Tree = ({ items, itemRenderer }) => {
  const { expandedMap } = state;
  const normalizedTreeItems = getNormalizedTreeItems(items);

  return (
    <List
      width={300}
      height={300}
      rowCount={normalizedTreeItems.length}
      rowHeight={30}
      rowRenderer={({
                      key,
                      index,
                      isScrolling,
                      isVisible,
                      style
                    }) => (
        <div
          key={key}
          style={style}
        >
          {expandedMap[normalizedTreeItems[index].level][item.id]
            ? itemRenderer(normalizedTreeItems[index])
            : null
          }
        </div>
      )}
    />
  );
};


Tree.propTypes = {
};

export default Tree;
