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
  rowHeight?: number;
  className?: string;
  transitionDuration: number;
  indentation: number;
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
    const { expandingRowIndex, pendingDeltaRowCount } = this.state;

    if (
      !isNil(expandingRowIndex) &&
      index > expandingRowIndex &&
      index <= expandingRowIndex + pendingDeltaRowCount
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

    if (!isNil(expandingRowIndex)) {
      if (index > expandingRowIndex) {
        if (index > expandingRowIndex + pendingDeltaRowCount) {
          return {
            transition: `top linear ${transitionDuration}ms`,
            top: style.top + pendingDeltaRowCount * rowHeight
          };
        }

        return {
          animation: `expand ${transitionDuration /
            pendingDeltaRowCount}ms forwards`,
          top: style.top + (index - expandingRowIndex - 1) * rowHeight,
          animationDelay: `${(index - expandingRowIndex - 1) *
            (transitionDuration / pendingDeltaRowCount)}ms`
        };
      }
    }

    if (!isNil(collapsingRowIndex)) {
      if (index > collapsingRowIndex) {
        if (index > collapsingRowIndex + Math.abs(pendingDeltaRowCount)) {
          return {
            transition: `top linear ${transitionDuration}ms`,
            top: style.top + pendingDeltaRowCount * rowHeight
          };
        }

        return {
          animation: `collapse ${transitionDuration /
            Math.abs(pendingDeltaRowCount)}ms forwards`,
          animationDelay: `${
              (transitionDuration / Math.abs(pendingDeltaRowCount))
              *
              (Math.abs(pendingDeltaRowCount) - (index - collapsingRowIndex))
          }ms`
        };
      }
    }

    return null;
  }

  renderRow = ({ key, index, style }) => {
    const { itemRenderer, indentation } = this.props;
    const { normalizedTreeItems } = this.state;
    const currentItem = normalizedTreeItems[index];

    return (
      <div
        key={currentItem.id}
        style={{
          ...style,
          ...this.getRowExtraStyle({ index, style }),
          overflow: "hidden",
          left: currentItem.level * indentation
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

    if (isExpanding) {
      this.setState(
        {
          expandingRowIndex: rowIndex,
          pendingDeltaRowCount:
            nextNormalizedTreeItems.length - normalizedTreeItems.length,
          expandedMap: updatedExpandedMap,
          normalizedTreeItems: nextNormalizedTreeItems
        },
        () => {
          this.list.recomputeRowHeights();
          setTimeout(() => {
            this.setState(
              {
                expandingRowIndex: null,
                pendingDeltaRowCount: 0
              },
              () => this.list.recomputeRowHeights()
            );
          }, transitionDuration);
        }
      );
    } else {
      this.setState(
        {
          collapsingRowIndex: rowIndex,
          pendingDeltaRowCount:
            nextNormalizedTreeItems.length - normalizedTreeItems.length
        },
        () => {
          this.list.recomputeRowHeights();
          setTimeout(() => {
            this.setState(
              {
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
    }
  };

  render() {
    const { normalizedTreeItems, expandingRowIndex } = this.state;
    const { className } = this.props;
    const isExpanding = !isNil(expandingRowIndex);

    return (
      <div className={className}>
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
