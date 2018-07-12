import * as React from "react";
import { AutoSizer, List } from "react-virtualized";
import { flatten, update, get, noop } from "lodash/fp";

interface Item {
  id: string | number;
  children?: Item[];
  level?: number;
  [key: number]: any;
  [key: string]: any;
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
  currentAnimation: {
    rowIndex: number;
    animatedChildRowItems: Item[];
    totalChildCount: number;
    isExpanding: boolean;
    duration: number;
  };
}

class Tree extends React.Component<TreeProps, TreeState> {
  rowTopOffsets: { [key: number]: number } = {};
  listHeight: number;
  scrollHeight: number;
  scrollTop: number;
  list: List;

  state = {
    normalizedTreeItems: this.getNormalizedTreeItems(this.props.items),
    expandedMap: {},
    currentAnimation: null
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

  getCssAnimationStyle() {
    if (!this.state.currentAnimation) {
      return null;
    }

    const animatedChildRowItemsHeight = this.getAnimatedChildRowItemsHeight();

    return `
      <style>
        @keyframes expand {
          to {  
            height: ${animatedChildRowItemsHeight}px;
          }
        }
        
        @keyframes collapse {
          to {
            height: 0;
          }
        }
        
        @keyframes expandSlideUp {
          from {
            transform: translateY(0);
          }
          
          to {
            transform: translateY(-${this.getExpandingSlideUpDistance()}px);
          }
        }
        
        @keyframes collapseSlideUp {
          from {
            transform: translateY(${this.getCollapsingSlideUpDistance()}px);
          }
          
          to {
            transform: translateY(0);
          }
        }
        
        @keyframes collapseSlideDown {
          from {
            transform: translateY(-${this.getCollapsingSlideDownDistance()}px);
          }
          
          to {
            transform: translateY(0);
          }
        }
      </style>
    `;
  }

  getAvailableHeightForExpanding() {
    if (!this.state.currentAnimation) {
      return null;
    }

    const y =
      this.rowTopOffsets[this.state.currentAnimation.rowIndex] -
      get(["_scrollingContainer", "scrollTop"], this.list.Grid);

    return this.listHeight - y - this.props.itemHeight;
  }

  getAnimatedChildRowItemsHeight() {
    if (!this.state.currentAnimation) {
      return null;
    }

    return (
      this.state.currentAnimation.animatedChildRowItems.length *
      this.props.itemHeight
    );
  }

  /*** sorted by priority: ***/
  // todo 1.) fix animations durations (and also take level into account when calculating transition durations)
  // todo 2.) disable click on item without children
  // todo 3.) add types to all the functions
  getRowClickHandler = (rowLevel, rowId, rowIndex) => () => {
    const { listHeight, list, props, state } = this;
    const { items, transitionDuration, itemHeight } = props;
    const { expandedMap, normalizedTreeItems: treeItems } = state;
    const nextExpandedMap = update(
      [rowLevel, rowId],
      bool => !bool,
      expandedMap
    );
    const nextTreeItems = this.getNormalizedTreeItems(items, nextExpandedMap);
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

    this.scrollHeight = get(
      ["_scrollingContainer", "scrollHeight"],
      this.list.Grid
    );
    this.scrollTop = get(["_scrollingContainer", "scrollTop"], this.list.Grid);
    document.addEventListener("mousewheel", this.disableMouseWheelEvent, false);
    this.setState(
      {
        normalizedTreeItems: isExpanding ? treeItems : nextTreeItems,
        currentAnimation: {
          rowIndex,
          animatedChildRowItems: animatedItems,
          totalChildCount: deltaRowCount,
          isExpanding,
          duration: transitionDuration * (animatedRowCount / deltaRowCount)
        }
      },
      () => {
        list.recomputeRowHeights();
        setTimeout(() => {
          const deltaScrollTop = this.getExpandingSlideUpDistance();
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
            () => {
              list.recomputeRowHeights();

              if (isExpanding) {
                list.scrollToPosition(
                  get(["_scrollingContainer", "scrollTop"], this.list.Grid) +
                    deltaScrollTop
                );
              }
            }
          );
        }, transitionDuration);
      }
    );
  };

  getAnimatedChildRowsContainerStyle = parentRowStyle => {
    const { isExpanding, duration } = this.state.currentAnimation;
    const { itemHeight } = this.props;
    const animatedChildRowItemsHeight = this.getAnimatedChildRowItemsHeight();

    return {
      position: "absolute" as "absolute",
      top: parentRowStyle.top + itemHeight,
      right: 0,
      left: 0,
      height: isExpanding ? 0 : animatedChildRowItemsHeight,
      overflow: "hidden",
      animation: isExpanding
        ? `expand ${duration}ms forwards, expandSlideUp ${duration}ms forwards`
        : `collapse ${duration}ms forwards, collapseSlideDown ${duration}ms forwards`,
      animationTimingFunction: "linear"
    };
  };

  getExpandingSlideUpDistance = () =>
    this.getAnimatedChildRowItemsHeight() -
    this.getExpandingSlideDownDistance();

  getExpandingSlideDownDistance = () =>
    Math.min(
      this.getAnimatedChildRowItemsHeight(),
      this.getAvailableHeightForExpanding()
    );

  getCollapsingSlideDownDistance() {
    const { scrollHeight, scrollTop, listHeight } = this;
    const { totalChildCount } = this.state.currentAnimation;
    const { itemHeight } = this.props;
    const hiddenBelow = scrollHeight - scrollTop - listHeight || 0;

    return Math.max(totalChildCount * itemHeight - hiddenBelow, 0);
  }

  getCollapsingSlideUpDistance() {
    const { scrollHeight, scrollTop, listHeight } = this;
    const hiddenBelow = scrollHeight - scrollTop - listHeight || 0;
    const totalChildCountHeight =
      this.state.currentAnimation.totalChildCount * this.props.itemHeight;

    return Math.min(
      this.getAnimatedChildRowItemsHeight(),
      hiddenBelow -
        (totalChildCountHeight - this.getAnimatedChildRowItemsHeight())
    );
  }

  getRowExtraStyle(index, style) {
    if (!this.state.currentAnimation) {
      return null;
    }

    const { currentAnimation } = this.state;
    const {
      rowIndex: animatedRowIndex,
      isExpanding,
      duration
    } = currentAnimation;

    if (index <= animatedRowIndex) {
      return isExpanding
        ? {
            top: style.top - this.getExpandingSlideUpDistance(),
            transition: `top linear ${duration}ms`
          }
        : {
            animation: `collapseSlideDown ${duration}ms forwards`,
            animationTimingFunction: "linear"
          };
    }

    if (index > animatedRowIndex) {
      return isExpanding
        ? {
            top: style.top + this.getExpandingSlideDownDistance(),
            transition: `top linear ${duration}ms`
          }
        : {
            animation: `collapseSlideUp ${duration}ms forwards`,
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
