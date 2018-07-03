import * as React from "react";
import { AutoSizer, List } from "react-virtualized";
import { flatten, update, get, noop } from "lodash/fp";

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

  getCssAnimationStyle() {
    const { currentAnimation, scrollTop } = this.state;

    if (!this.state.currentAnimation) {
      return null;
    }

    const offsetTop =
      this.rowTopOffsets[currentAnimation.rowIndex] - scrollTop;

    return `
      <style>
        @keyframes expand {
          to {
            transform: translateY(${-offsetTop}px);  
            height: ${this.props.itemHeight *
              currentAnimation.animatedChildRowItems.length}px;
          }
        }
        
        @keyframes collapse {
          to {
            height: 0;
          }
        }
        
        @keyframes slideUp {
          to {
            transform: translateY(${-this.props.itemHeight *
              currentAnimation.animatedChildRowItems.length}px);
          }
        }
      </style>
    `;
  }

  /*** sorted by priority: ***/
  // todo 1.) smooth scroll to the expanded row (make the row positioned as most top as possible)
  // todo 2.) take level into account when calculating transition durations
  // todo 3.) disable click on item without children
  // todo 4.) add types to all the functions
  // todo .) #cleancoding
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
      Math.round((listHeight - itemHeight) / itemHeight),
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
    const { itemHeight } = this.props;

    return {
      position: "absolute" as "absolute",
      top: parentRowStyle.top + itemHeight,
      right: 0,
      left: 0,
      height: isExpanding ? 0 : animatedChildRowItems.length * itemHeight,
      overflow: "hidden",
      animation: `${
        isExpanding ? "expand" : "collapse"
      } ${duration}ms forwards`,
      animationTimingFunction: "linear"
    };
  };

  getRowExtraStyle(index, style) {
    if (!this.state.currentAnimation) {
      return null;
    }

    const { state, props, rowTopOffsets } = this;
    const { currentAnimation, scrollTop } = state;
    const { itemHeight } = props;
    const {
      rowIndex: animatedRowIndex,
      animatedChildRowItems,
      isExpanding,
      duration
    } = currentAnimation;
    const offsetTop = rowTopOffsets[animatedRowIndex] - scrollTop;

    if (index <= animatedRowIndex) {
      return isExpanding
        ? {
            top: style.top - offsetTop,
            transition: `top linear ${duration}ms`
          }
        : null;
    }

    if (index > animatedRowIndex) {
      return isExpanding
        ? {
            top: style.top + (animatedChildRowItems.length * itemHeight) - offsetTop,
            transition: `top linear ${duration}ms`
          }
        : {
            top: style.top + animatedChildRowItems.length * itemHeight,
            animation: `slideUp ${duration}ms forwards`,
            animationTimingFunction: "linear"
          };
    }

    return null;
  }

  renderRow = ({ key, index, style }) => {
    const { itemRenderer, itemHeight } = this.props;
    const { normalizedTreeItems, currentAnimation } = this.state;
    const item = normalizedTreeItems[index];
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
            updateCallback: this.list.forceUpdateGrid,
            item
          })}
        </div>
        {currentAnimation &&
          index === currentAnimation.rowIndex && (
            <div style={this.getAnimatedChildRowsContainerStyle(style)}>
              {currentAnimation.animatedChildRowItems.map(
                (currentItem, index) => (
                  <div
                    style={{ ...style, top: index * itemHeight }}
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
                rowCount={normalizedTreeItems.length}
                ref={node => (this.list = node)}
                className="virtualized-tree"
                rowRenderer={this.renderRow}
                onScroll={this.onScroll}
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
