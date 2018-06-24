import * as React from "react";
import { AutoSizer, List } from "react-virtualized";
import { flatten, update, get, isNil } from "lodash/fp";
import cx from "classnames";

interface Item {
  id: string | number;
  children?: Item[];
}

interface TreeProps {
  items: Item[];
  itemRenderer: (item: Item, expandCallback: () => void) => JSX.Element;
  headerRenderer: () => JSX.Element;
  rowHeight?: number;
  className?: string;
  transitionDuration: number;
}

interface TreeState {
  expandedMap: { [treeLevel: number]: { [itemId: number]: boolean } };
  normalizedTreeItems: Item[];
  expandingRowIndex: number;
  collapsingRowIndex: number;
  pendingDeltaRowCount: number;
}

class Tree extends React.Component<TreeProps, TreeState> {
  list: List;

  state = {
    expandedMap: {},
    normalizedTreeItems: [],
    expandingRowIndex: null,
    collapsingRowIndex: null,
    pendingDeltaRowCount: 0
  };

  componentDidMount() {
    const { items } = this.props;
    this.setState({ normalizedTreeItems: this.getNormalizedTreeItems(items) });
  }

  componentDidUpdate(prevProps) {
    if(prevProps.rowHeight !== this.props.rowHeight) {
      this.list.recomputeRowHeights();
    }
  }

  getNormalizedTreeItems = (
    nodes: Item[],
    expandedMap: TreeState["expandedMap"] = null,
    level: number = 0
  ): Item[] => {
    if (!nodes) {
      return null;
    }

    return flatten(
      nodes.map(
        node =>
          node.children && get([level, node.id], expandedMap)
            ? [
                { ...node, level },
                ...flatten(
                  this.getNormalizedTreeItems(
                    node.children,
                    expandedMap,
                    level + 1
                  )
                )
              ]
            : [{ ...node, level }]
      )
    );
  };

  getRowHeight = ({ index }) => {
    const {
      expandingRowIndex,
      collapsingRowIndex,
      pendingDeltaRowCount
    } = this.state;
    const animatingRowIndex = isNil(expandingRowIndex)
      ? collapsingRowIndex
      : expandingRowIndex;

    if (
      !isNil(animatingRowIndex) &&
      index > animatingRowIndex &&
      index <= animatingRowIndex + Math.abs(pendingDeltaRowCount)
    ) {
      return 0;
    }

    return this.props.rowHeight;
  };

  getRowExtraStyle({ index, style }) {
    const {
      expandingRowIndex,
      collapsingRowIndex,
      pendingDeltaRowCount
    } = this.state;
    const { transitionDuration, rowHeight } = this.props;
    const animatingRowIndex = isNil(expandingRowIndex)
      ? collapsingRowIndex
      : expandingRowIndex;
    const isExpanding = !isNil(expandingRowIndex);

    if (!isNil(animatingRowIndex) && index > animatingRowIndex) {
      return index > animatingRowIndex + Math.abs(pendingDeltaRowCount)
        ? {
            top: style.top + Math.abs(pendingDeltaRowCount) * rowHeight,
            animation:
              !isExpanding && `moveUp ${transitionDuration}ms forwards`,
            transition: isExpanding && `top ease-in ${transitionDuration}ms`
          }
        : {
            top: style.top + (index - animatingRowIndex - 1) * rowHeight,
            height: rowHeight
          };
    }

    return null;
  }

  renderRow = ({ key, index, style }) => {
    const { itemRenderer } = this.props;
    const { normalizedTreeItems } = this.state;
    const currentItem = normalizedTreeItems[index];

    return (
      <div
        key={currentItem.id}
        style={{
          ...style,
          ...this.getRowExtraStyle({ index, style }),
          overflow: "hidden",
          backgroundColor: index % 2 === 0 ? "#fff" : "#f7f7f7"
        }}
      >
        {itemRenderer(currentItem, () =>
          this.handleRowClicked(currentItem.level, currentItem.id, index)
        )}
      </div>
    );
  };

  handleRowClicked = (rowLevel, rowId, rowIndex) => {
    const { items, transitionDuration } = this.props;
    const { expandedMap, normalizedTreeItems } = this.state;
    const updatedExpandedMap = update(
      [rowLevel, rowId],
      bool => !bool,
      expandedMap
    );
    const nextNormalizedTreeItems = this.getNormalizedTreeItems(
      items,
      updatedExpandedMap
    );
    const isExpanding = !get([rowLevel, rowId], expandedMap);

    this.setState(
      isExpanding
        ? {
            ...this.state,
            expandingRowIndex: rowIndex,
            pendingDeltaRowCount:
              nextNormalizedTreeItems.length - normalizedTreeItems.length,
            expandedMap: updatedExpandedMap,
            normalizedTreeItems: nextNormalizedTreeItems
          }
        : {
            ...this.state,
            collapsingRowIndex: rowIndex,
            pendingDeltaRowCount:
              nextNormalizedTreeItems.length - normalizedTreeItems.length
          },
      () => {
        this.list.recomputeRowHeights();
        setTimeout(() => {
          this.setState(
            isExpanding
              ? {
                  ...this.state,
                  expandingRowIndex: null,
                  pendingDeltaRowCount: 0
                }
              : {
                  ...this.state,
                  collapsingRowIndex: null,
                  pendingDeltaRowCount: 0,
                  expandedMap: updatedExpandedMap,
                  normalizedTreeItems: nextNormalizedTreeItems
                },
            () => this.list.recomputeRowHeights()
          );
        }, transitionDuration);
      }
    );
  };

  render() {
    const {
      normalizedTreeItems,
      expandingRowIndex,
      pendingDeltaRowCount
    } = this.state;
    const { className, rowHeight, headerRenderer } = this.props;
    const isExpanding = !isNil(expandingRowIndex);

    return (
      <div className={className}>
        {headerRenderer && headerRenderer()}
        <div
          dangerouslySetInnerHTML={{
            __html: `
              <style>
                @keyframes moveUp {
                  to {
                    transform: translateY(${pendingDeltaRowCount *
                      rowHeight}px);
                  }
                }
              </style>
        `
          }}
        />
        <AutoSizer>
          {({ width, height }) => (
            <List
              ref={node => (this.list = node)}
              rowCount={normalizedTreeItems.length}
              rowHeight={this.getRowHeight}
              rowRenderer={this.renderRow}
              height={height}
              width={width}
              className={cx("tree-virtualized-list", {
                "row-expanding": isExpanding
              })}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
}

export default Tree;
