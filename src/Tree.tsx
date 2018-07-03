import * as React from "react";
import { AutoSizer, List } from "react-virtualized";
import { flatten, update, get, noop } from "lodash/fp";
import cx from "classnames";

interface Item {
  id: string | number;
  children?: Item[];
  level?: number;
  isExpanded?: boolean;
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
  rowHeight?: number;
  className?: string;
  transitionDuration: number;
}

interface TreeState {
  normalizedTreeItems: Item[];
  expandedMap: { [treeLevel: number]: { [itemId: number]: boolean } };
  scrollTop: number;
  currentAnimation: {
    rowIndex: number;
    animatedChildRowItems: Item[];
    isExpanding: boolean;
    duration: number;
  };
}

class Tree extends React.Component<TreeProps, TreeState> {
  rowTopOffsets: { [key: number]: number } = {};
  listHeight: number;
  list: List;

  state = {
    normalizedTreeItems: this.getNormalizedTreeItems(this.props.items),
    expandedMap: {},
    scrollTop: 0,
    currentAnimation: null
  };

  onScroll = ({ scrollTop }) => this.setState({ scrollTop });

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

  getCssAnimationStyle = () =>
    this.state.currentAnimation &&
    `
    <style>
      @keyframes expand {
        to {
          height: ${this.props.rowHeight *
            this.state.currentAnimation.animatedChildRowItems.length}px;
        }
      }
      
      @keyframes collapse {
        to {
          height: 0;
        }
      }
      
      @keyframes slideUp {
        to {
          transform: translateY(-${this.props.rowHeight *
            this.state.currentAnimation.animatedChildRowItems.length}px);
        }
      }
    </style>
  `;

  /*** sorted by priority: ***/
  // todo 1.) smooth scroll to the expanded row (make the row positioned as most top as possible)
  // todo 2.) disable click on item without children
  // todo 3.) add types to all the functions
  // todo 4.) #cleancoding
  getRowClickHandler = (rowLevel, rowId, rowIndex) => () => {
    const { rowTopOffsets, listHeight, list, props, state } = this;
    const { items, transitionDuration, rowHeight } = props;
    const { expandedMap, normalizedTreeItems: treeItems, scrollTop } = state;
    const nextExpandedMap = update(
      [rowLevel, rowId],
      bool => !bool,
      expandedMap
    );
    const nextTreeItems = this.getNormalizedTreeItems(items, nextExpandedMap);
    const offsetTop = rowTopOffsets[rowIndex] - scrollTop;
    const availableHeight = listHeight - offsetTop - rowHeight;
    const deltaRowCount = Math.abs(nextTreeItems.length - treeItems.length);
    const animatedRowCount = Math.min(
      Math.round(availableHeight / rowHeight),
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
        normalizedTreeItems: isExpanding ? treeItems : nextTreeItems,
        currentAnimation: {
          rowIndex,
          animatedChildRowItems: animatedItems,
          isExpanding,
          duration: transitionDuration * (animatedRowCount / deltaRowCount)
        }
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
              currentAnimation: null
            },
            () => list.recomputeRowHeights()
          );
        }, transitionDuration);
      }
    );
  };

  getAnimatedChildRowsContainerStyle = parentRowStyle => {
    const {
      animatedChildRowItems,
      isExpanding,
      duration
    } = this.state.currentAnimation;
    const { rowHeight } = this.props;

    return {
      position: "absolute" as "absolute",
      top: parentRowStyle.top + rowHeight,
      right: 0,
      left: 0,
      height: isExpanding ? 0 : animatedChildRowItems.length * rowHeight,
      overflow: "hidden",
      animation: `${
        isExpanding ? "expand" : "collapse"
      } ${duration}ms forwards`,
      animationTimingFunction: "ease-out"
    };
  };

  getRowExtraStyle(index, style) {
    if (!this.state.currentAnimation) {
      return null;
    }

    const {
      rowIndex: animatedRowIndex,
      animatedChildRowItems,
      isExpanding,
      duration
    } = this.state.currentAnimation;
    const { rowHeight } = this.props;

    if (index > animatedRowIndex) {
      return isExpanding
        ? {
            top: style.top + animatedChildRowItems.length * rowHeight,
            transition: `top ease-out ${duration}ms`
          }
        : {
            top: style.top + animatedChildRowItems.length * rowHeight,
            animation: `slideUp ${duration}ms forwards`,
            animationTimingFunction: "ease-out"
          };
    }

    return null;
  }

  updateList = () => this.list.forceUpdateGrid();

  isRowExpanded = (item, index) => {
    const { currentAnimation, expandedMap } = this.state;
    return (currentAnimation && currentAnimation.rowIndex === index && currentAnimation.isExpanding) ||
      get([item.level, item.id], expandedMap);
  };

  renderRow = ({ key, index, style }) => {
    const { itemRenderer, rowHeight } = this.props;
    const { normalizedTreeItems, currentAnimation } = this.state;
    const item = normalizedTreeItems[index];
    const isExpanded = this.isRowExpanded(item, index);
    const expandCallback = currentAnimation
      ? noop
      : this.getRowClickHandler(item.level, item.id, index);
    const rowStyle = {
      ...style,
      ...this.getRowExtraStyle(index, style)
    };

    this.rowTopOffsets[index] = style.top;

    return (
      <React.Fragment key={item.id}>
        <div style={rowStyle}>
          {itemRenderer({
            expandCallback,
            // todo check why we need this
            updateCallback: this.updateList,
            item: {...item, isExpanded}
          })}
        </div>
        {currentAnimation &&
          index === currentAnimation.rowIndex && (
            <div style={this.getAnimatedChildRowsContainerStyle(style)}>
              {currentAnimation.animatedChildRowItems.map(
                (currentItem, index) => (
                  <div
                    style={{ ...style, top: index * rowHeight }}
                    key={currentItem.id}
                  >
                    {itemRenderer({ item: currentItem })}
                  </div>
                )
              )}
            </div>
          )}
      </React.Fragment>
    );
  };

  render() {
    const { normalizedTreeItems } = this.state;
    const { className, rowHeight } = this.props;

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
                rowCount={normalizedTreeItems.length}
                ref={node => (this.list = node)}
                className="virtualized-tree"
                rowRenderer={this.renderRow}
                onScroll={this.onScroll}
                rowHeight={rowHeight}
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
