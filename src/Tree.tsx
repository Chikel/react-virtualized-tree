import * as React from 'react';
import {AutoSizer, List} from 'react-virtualized';
import {flatten, update} from 'lodash/fp';

interface Item {
  id: string | number;
  children?: Item[];
}

interface TreeProps {
  items: Item[];
  itemRenderer: (item: Item, expandCallback: () => void) => JSX.Element;
  rowHeight?: number;
  className?: string;
}

interface TreeState {
  expandedMap: { [treeLevel: number]: { [itemId: number]: boolean } };
  normalizedTreeItems: Item[];
}

class Tree extends React.Component<TreeProps, TreeState> {
  state = {
    expandedMap: {},
    normalizedTreeItems: []
  };

  componentDidMount() {
    const {items} = this.props;
    this.setState({normalizedTreeItems: this.getNormalizedTreeItems(items)});
  }

  getNormalizedTreeItems = (nodes: Item[], expandedMap: TreeState['expandedMap'] = null, level: number = 0): Item[] => {
    if (!nodes) {
      return null;
    }

    return flatten(
      nodes.map(node => node.children && expandedMap && expandedMap[level][node.id] ?
        [{...node, level}, ...flatten(this.getNormalizedTreeItems(node.children, expandedMap, level + 1))] :
        [{...node, level}])
    )
  };

  renderRow = ({key, index, style}) => {
    const {itemRenderer} = this.props;
    const {normalizedTreeItems} = this.state;
    const currentItem = normalizedTreeItems[index];

    return (
      <div key={currentItem.id} style={style}>
        {itemRenderer(currentItem, () => this.handleRowClicked(currentItem.level, currentItem.id))}
      </div>
    );
  };

  handleRowClicked = (rowLevel, rowId) => {
    const {items} = this.props;
    const expandedMap = update([rowLevel, rowId], bool => !bool, this.state.expandedMap);

    this.setState({
      expandedMap,
      normalizedTreeItems: this.getNormalizedTreeItems(items, expandedMap)
    });
  };

  render() {
    const {normalizedTreeItems} = this.state;
    const {className, rowHeight} = this.props;

    return (
      <div className={className}>
        <AutoSizer>
          {({width, height}) => (
            <List
              width={width}
              height={height}
              rowCount={normalizedTreeItems.length}
              rowHeight={rowHeight || 30}
              rowRenderer={this.renderRow}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
}

export default Tree;
