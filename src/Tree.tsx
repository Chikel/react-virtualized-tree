import * as React from "react";
import { AutoSizer, List } from "react-virtualized";
import { flatten, update, get, noop } from "lodash/fp";
import cx from "classnames";

interface Item {
  id: string | number;
  children?: Item[];
  level?: number;
}

interface TreeProps {
  items: Item[];
  itemRenderer: (
    data: {
      item: Item;
      index: number;
      expandCallback: () => void;
      updateCallback: () => void;
    }
  ) => JSX.Element;
  itemHeight?: number;
  className?: string;
  transitionDuration: number;
}

interface TreeState {
  expandedMap: { [treeLevel: number]: { [itemId: number]: boolean } };
  normalizedTreeItems: Item[];
  expandingCollapsingRowIndex: number;
  animatedRowCount: number;
}

class Tree extends React.Component<TreeProps, TreeState> {
  rowTopOffsets: { [key: number]: number } = {};
  listHeight: number;
  list: List;

  state = {
    normalizedTreeItems: this.getNormalizedTreeItems(this.props.items),
    expandingCollapsingRowIndex: null,
    animatedRowCount: null,
    expandedMap: {}
  };

  disableMouseWheelEvent = e => {
    e.stopPropagation();
    e.preventDefault();
    e.cancelBubble = false;

    return false;
  };

  getNormalizedTreeItems(
    nodes: Item[],
    expandedMap: TreeState["expandedMap"] = null,
    level: number = 0
  ): Item[] {
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
  }

  getCssAnimationStyle = () => `
    <style>
      @keyframes expand {
        to {
          height: ${this.props.itemHeight}px;
        }
      }
    </style>
  `;

  /*** sorted by priority: ***/
  // todo 1.) fix expanding of item in the middle when scrollable (wrap parent item with Fragment and render it's children items below it, so react-virtualized list wont update it's scrollTop and harm the expanding\collapsing animation by moving the scroll thumb)
  // todo 2.) implement collapsing
  // todo 3.) disable click on item without children
  // todo 4.) animate clip instead of height for better expanding/collapsing behavior
  // todo 5.) better variable names
  // todo 6.) stay awsome !
  getRowClickHandler = (rowLevel, rowId, rowIndex) => () => {
    const { rowTopOffsets, listHeight, list, props, state } = this;
    const { items, transitionDuration, itemHeight } = props;
    const { expandedMap, normalizedTreeItems } = state;
    const nextExpandedMap = update(
      [rowLevel, rowId],
      bool => !bool,
      expandedMap
    );
    const nextTreeItems = this.getNormalizedTreeItems(items, nextExpandedMap);
    const availableHeight = listHeight - rowTopOffsets[rowIndex] - itemHeight;
    const deltaRowCount = nextTreeItems.length - normalizedTreeItems.length;
    const animatedRowCount = Math.min(
      availableHeight / itemHeight,
      deltaRowCount
    );

    document.addEventListener("mousewheel", this.disableMouseWheelEvent, false);
    this.setState(
      {
        expandingCollapsingRowIndex: rowIndex,
        animatedRowCount,
        expandedMap: nextExpandedMap,
        normalizedTreeItems: [
          ...nextTreeItems.slice(0, rowIndex + animatedRowCount + 1),
          ...nextTreeItems.slice(
            rowIndex + deltaRowCount + 1,
            nextTreeItems.length
          )
        ]
      },
      () => {
        list.recomputeRowHeights();
        setTimeout(() => {
          document.removeEventListener("mousewheel", this.disableMouseWheelEvent);
          this.setState(
            {
              expandingCollapsingRowIndex: null,
              animatedRowCount: null,
              normalizedTreeItems: nextTreeItems
            },
            () => list.recomputeRowHeights()
          );
        }, transitionDuration);
      }
    );
  };

  getRowExtraStyle(index) {
    const { expandingCollapsingRowIndex, animatedRowCount } = this.state;
    const { transitionDuration } = this.props;

    if (
      index > expandingCollapsingRowIndex &&
      index < expandingCollapsingRowIndex + animatedRowCount + 1
    ) {
      return {
        overflow: "hidden",
        height: 0,
        animationTimingFunction: "linear",
        animation: `expand ${transitionDuration /
          Math.abs(animatedRowCount)}ms forwards`,
        animationDelay: `${(index - expandingCollapsingRowIndex - 1) *
          (transitionDuration / Math.abs(animatedRowCount))}ms`
      };
    }

    return null;
  }

  renderRow = ({ key, index, style }) => {
    const { itemRenderer } = this.props;
    const { normalizedTreeItems, animatedRowCount } = this.state;
    const item = normalizedTreeItems[index];
    const expandCallback = animatedRowCount
      ? noop
      : this.getRowClickHandler(item.level, item.id, index);

    this.rowTopOffsets[index] = style.top;

    return (
      <div
        key={item.id}
        style={{
          ...style,
          ...this.getRowExtraStyle(index),
          transition: `top linear ${this.props.transitionDuration}ms`
        }}
      >
        {itemRenderer({ expandCallback, updateCallback: this.list.forceUpdateGrid, item, index })}
      </div>
    );
  };

  render() {
    const { normalizedTreeItems, animatedRowCount } = this.state;
    const { className, itemHeight } = this.props;

    return (
      <div className={className} style={{ userSelect: "none" }}>
        <div
          dangerouslySetInnerHTML={{ __html: this.getCssAnimationStyle() }}
        />
        <AutoSizer>
          {({ width, height }) => {
            this.listHeight = height;

            return (
              <List
                className={cx("tree-virtualized-list", {
                  animating: animatedRowCount
                })}
                overscanRowCount={animatedRowCount || 10}
                rowCount={normalizedTreeItems.length}
                ref={node => (this.list = node)}
                rowRenderer={this.renderRow}
                rowHeight={itemHeight}
                height={height}
                width={width}
              />
            );
          }}
        </AutoSizer>
      </div>
    );
  }
}

export default Tree;
