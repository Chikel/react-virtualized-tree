import * as React from 'react';
import {AutoSizer, List} from 'react-virtualized';
import {flatten, update, get, some} from 'lodash/fp';

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
  unmountingChildrenParentId: boolean;
}

class Tree extends React.Component<TreeProps, TreeState> {
  list: List;

  state = {
    expandedMap: {},
    normalizedTreeItems: [],
    unmountingChildrenParentId: null
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
      nodes.map(node => node.children && get([level, node.id], expandedMap) ?
        [{...node, level}, ...flatten(this.getNormalizedTreeItems(node.children, expandedMap, level + 1))] :
        [{...node, level}])
    )
  };

  renderRow = ({key, index, style}) => {
    const {itemRenderer} = this.props;
    const {normalizedTreeItems, unmountingChildrenParentId} = this.state;
    const currentItem = normalizedTreeItems[index];
    const parentToMinimize = normalizedTreeItems[unmountingChildrenParentId];
    const isRowUnmounting = parentToMinimize && some(c => c.id === currentItem.id, parentToMinimize.children);

    return (
      <div key={currentItem.id}
           style={{...style, opacity: 0, transition: `opacity 0.5s`}}
           ref={node => node && this.handleRowAnimation(node, isRowUnmounting)}>
        {itemRenderer(currentItem, () => this.handleRowClicked(currentItem.level, currentItem.id))}
      </div>
    );
  };

  handleRowAnimation = (node, isRowUnmounting) => {
    setTimeout(() => {
      node.style.opacity = isRowUnmounting ? '0' : '1'
    }, 0)
  };

  handleRowClicked = (rowLevel, rowId) => {
    const {items} = this.props;
    const {expandedMap} = this.state;
    const unmountingChildrenParentId = get([rowLevel, rowId], expandedMap) ? rowId : null;
    const updatedExpandedMap = update([rowLevel, rowId], bool => !bool, expandedMap);

    this.setState(
      {unmountingChildrenParentId},
      () => {

        if (unmountingChildrenParentId) {
          this.list.forceUpdateGrid();
        }

        setTimeout(() => {
          this.setState({
            expandedMap: updatedExpandedMap,
            normalizedTreeItems: this.getNormalizedTreeItems(items, updatedExpandedMap),
          })
        }, 500)
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
              ref={node => this.list = node}
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
