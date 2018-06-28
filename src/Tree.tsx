import * as React from "react";
import { AutoSizer, List } from "react-virtualized";
import { flatten, update, get, noop, isNil } from "lodash/fp";
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
      expandCallback?: () => void;
      updateCallback?: () => void;
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
  animatedItems: Item[];
  scrollTop: number;
  isExpanding: boolean;
}

class Tree extends React.Component<TreeProps, TreeState> {
  rowTopOffsets: { [key: number]: number } = {};
  listHeight: number;
  list: List;

  state = {
    normalizedTreeItems: this.getNormalizedTreeItems(this.props.items),
    expandingCollapsingRowIndex: null,
    animatedItems: [],
    expandedMap: {},
    scrollTop: 0,
    isExpanding: false
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
          height: ${this.props.itemHeight * this.state.animatedItems.length}px;
        }
      }
      
      @keyframes collapse {
        to {
          height: 0;
        }
      }
      
      @keyframes slideUp {
        to {
          transform: translateY(-${this.props.itemHeight *
            this.state.animatedItems.length}px);
        }
      }
    </style>
  `;

  /*** sorted by priority: ***/
  // todo 2.) fix timing
  // todo 3.) disable click on item without children
  // todo 4.) animate clip instead of height for better expanding/collapsing behavior
  // todo 5.) better variable names
  // todo 6.) stay awsome !
  getRowClickHandler = (rowLevel, rowId, rowIndex) => () => {
    const { rowTopOffsets, listHeight, list, props, state } = this;
    const { items, transitionDuration, itemHeight } = props;
    const { expandedMap, normalizedTreeItems: treeItems, scrollTop } = state;
    const nextExpandedMap = update(
      [rowLevel, rowId],
      bool => !bool,
      expandedMap
    );
    const nextTreeItems = this.getNormalizedTreeItems(items, nextExpandedMap);
    const offsetTop = rowTopOffsets[rowIndex] - scrollTop;
    const availableHeight = listHeight - offsetTop - itemHeight;
    const deltaRowCount = Math.abs(nextTreeItems.length - treeItems.length);
    const animatedRowCount = Math.min(
      Math.round(availableHeight / itemHeight),
      deltaRowCount
    );
    const isExpanding = !get([rowLevel, rowId], expandedMap);
    const animatedItems = (isExpanding ? nextTreeItems : treeItems).slice(
      rowIndex + 1,
      rowIndex + animatedRowCount + 1
    );

    document.addEventListener("mousewheel", this.disableMouseWheelEvent, false);
    this.setState(
      {
        isExpanding,
        normalizedTreeItems: isExpanding ? treeItems : nextTreeItems,
        expandingCollapsingRowIndex: rowIndex,
        animatedItems
      },
      () => {
        list.recomputeRowHeights();
        setTimeout(() => {
          document.removeEventListener(
            "mousewheel",
            this.disableMouseWheelEvent
          );
          this.setState(
            {
              normalizedTreeItems: nextTreeItems,
              expandedMap: nextExpandedMap,
              animatedItems: [],
              expandingCollapsingRowIndex: null
            },
            () => list.recomputeRowHeights()
          );
        }, transitionDuration);
      }
    );
  };

  getRowExtraStyle(index, style) {
    const {
      expandingCollapsingRowIndex,
      animatedItems,
      isExpanding
    } = this.state;
    const { transitionDuration, itemHeight } = this.props;

    if (
      !isNil(expandingCollapsingRowIndex) &&
      index > expandingCollapsingRowIndex
    ) {
      return isExpanding
        ? {
            top: style.top + animatedItems.length * itemHeight,
            transition: `top linear ${this.props.transitionDuration}ms`
          }
        : {
            top: style.top + animatedItems.length * itemHeight,
            animation: `slideUp ${transitionDuration}ms forwards`,
            animationTimingFunction: "linear"
          };
    }

    return null;
  }

  renderRow = ({ key, index, style }) => {
    const { itemRenderer, itemHeight, transitionDuration } = this.props;
    const {
      normalizedTreeItems,
      animatedItems,
      isExpanding,
      expandingCollapsingRowIndex
    } = this.state;
    const item = normalizedTreeItems[index];
    const expandCallback = animatedItems.length
      ? noop
      : this.getRowClickHandler(item.level, item.id, index);

    this.rowTopOffsets[index] = style.top;

    return (
      <React.Fragment key={item.id}>
        <div
          style={{
            ...style,
            ...this.getRowExtraStyle(index, style)
          }}
        >
          {itemRenderer({
            expandCallback,
            updateCallback: this.list.forceUpdateGrid,
            item
          })}
        </div>
        {index === expandingCollapsingRowIndex && (
          <div
            style={{
              position: "absolute",
              top: style.top + itemHeight,
              right: 0,
              left: 0,
              overflow: "hidden",
              height: isExpanding ? 0 : (animatedItems.length * itemHeight),
              animation: `${
                isExpanding ? "expand" : "collapse"
              } ${transitionDuration}ms forwards`,
              animationTimingFunction: "linear"
            }}
          >
            {animatedItems.map((currentItem, index) => {
              return (
                <div
                  key={currentItem.id}
                  style={{
                    ...style,
                    top: index * itemHeight
                  }}
                >
                  {itemRenderer({ item: currentItem })}
                </div>
              );
            })}
          </div>
        )}
      </React.Fragment>
    );
  };

  render() {
    const { normalizedTreeItems, animatedItems } = this.state;
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
                onScroll={({ scrollTop }) => this.setState({ scrollTop })}
                className={cx("tree-virtualized-list", {
                  animating: !!animatedItems.length
                })}
                overscanRowCount={animatedItems.length || 10}
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
