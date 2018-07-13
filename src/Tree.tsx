import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';
import { flatten, update, get, noop, sumBy } from 'lodash/fp';

interface Item {
  id: string | number;
  level?: number;
  children?: Item[];
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
  itemHeight?: number | ((Item) => number);
  className?: string;
  transitionDuration: number;
}

interface TreeState {
  normalizedTreeItems: Item[];
  itemsExpandStatuses: { [treeLevel: number]: { [itemId: number]: boolean } };
  currentAnimation: {
    rowIndex: number;
    totalChildItems: Item[];
    visibleChildItems: Item[];
    visibleChildItemsHeight: number;
    isExpanding: boolean;
    duration: number;
    initialScrollHeight: number;
    initialScrollTop: number;
  };
}

/*** SORTED BY PRIORITY ***/
// TODO: Rename item to row everywhere
// TODO: Fix animations durations (and also take level into account when calculating transition durations)
// TODO: Disable click on item without children
// TODO: Add types to all the functions
export default class Tree extends React.Component<TreeProps, TreeState> {
  list: List;

  state = {
    normalizedTreeItems: this.getNormalizedTreeItems(this.props.items),
    itemsExpandStatuses: {},
    currentAnimation: null
  };

  disableMouseWheelEvent = e => {
    e.stopPropagation();
    e.preventDefault();
    e.cancelBubble = false;

    return false;
  };

  updateItemsExpandStatuses = (rowLevel, rowId) =>
    update([rowLevel, rowId], isExpanded => !isExpanded, this.state.itemsExpandStatuses);

  getNormalizedTreeItems(
    nodes: Item[],
    itemsExpandStatuses: TreeState['itemsExpandStatuses'] = null,
    level: number = 0
  ): Item[] {
    if (!nodes) {
      return null;
    }

    return flatten(
      nodes.map(node => {
        const children = this.getNormalizedTreeItems(node.children, itemsExpandStatuses, level + 1);

        return node.children && get([level, node.id], itemsExpandStatuses)
          ? [{ ...node, level }, ...flatten(children)]
          : [{ ...node, level }];
      })
    );
  }

  getListHeight = () => get(['_scrollingContainer', 'clientHeight'], this.list.Grid);

  getListScrollHeight = () => get(['_scrollingContainer', 'scrollHeight'], this.list.Grid);

  getListScrollTop = () => get(['_scrollingContainer', 'scrollTop'], this.list.Grid);

  sumItemsHeight(items) {
    const { itemHeight } = this.props;

    if (typeof itemHeight === 'number') {
      return items.length * itemHeight;
    }

    return sumBy(itemHeight, items);
  }

  getAnimatedRowTotalChildItemsHeight = () =>
    this.sumItemsHeight(this.state.currentAnimation.totalChildItems);

  // TODO: Remove
  getAnimatedRowVisibleChildItemsHeight = () => this.state.currentAnimation.visibleChildItemsHeight;

  getAvailableHeightForSlidingDown() {
    const { normalizedTreeItems, currentAnimation } = this.state;
    const virtualYOffset = this.sumItemsHeight(
      normalizedTreeItems.slice(0, currentAnimation.rowIndex)
    );
    const absoluteYOffset = virtualYOffset - this.getListScrollTop();

    return (
      this.getListHeight() -
      absoluteYOffset -
      this.getRowHeightByIndex({ index: currentAnimation.rowIndex })
    );
  }

  getExpandingSlideUpDistance = () =>
    this.getAnimatedRowVisibleChildItemsHeight() - this.getExpandingSlideDownDistance();

  getExpandingSlideDownDistance = () =>
    Math.min(this.getAnimatedRowVisibleChildItemsHeight(), this.getAvailableHeightForSlidingDown());

  getCollapsingSlideDownDistance() {
    const { initialScrollHeight, initialScrollTop } = this.state.currentAnimation;
    const hiddenBelow = initialScrollHeight - initialScrollTop - this.getListHeight() || 0;

    return Math.max(this.getAnimatedRowTotalChildItemsHeight() - hiddenBelow, 0);
  }

  getCollapsingSlideUpDistance() {
    const { initialScrollHeight, initialScrollTop } = this.state.currentAnimation;
    const hiddenBelow = initialScrollHeight - initialScrollTop - this.getListHeight() || 0;

    return Math.min(
      this.getAnimatedRowVisibleChildItemsHeight(),
      hiddenBelow -
        (this.getAnimatedRowTotalChildItemsHeight() - this.getAnimatedRowVisibleChildItemsHeight())
    );
  }

  getCssAnimations = () => `
    <style>
      @keyframes expand {
        to {  
          height: ${this.getAnimatedRowVisibleChildItemsHeight()}px;
        }
      }
      
      @keyframes collapse {
        to {
          height: 0;
        }
      }
      
      @keyframes expandedItemAndAboveItSlideUp {
        from {
          transform: translateY(0);
        }
        
        to {
          transform: translateY(-${this.getExpandingSlideUpDistance()}px);
        }
      }
      
      @keyframes itemsBelowCollapsedItemSlideUp {
        from {
          transform: translateY(${this.getCollapsingSlideUpDistance()}px);
        }
        
        to {
          transform: translateY(0);
        }
      }
      
      @keyframes collapsedItemAndAboveItSlideDown {
        from {
          transform: translateY(-${this.getCollapsingSlideDownDistance()}px);
        }
        
        to {
          transform: translateY(0);
        }
      }
    </style>
  `;

  getAnimatedChildRowsContainerStyle = parentTop => {
    const { currentAnimation } = this.state;
    const { isExpanding, duration, rowIndex: animatedRowIndex } = currentAnimation;
    const parentHeight = this.getRowHeightByIndex({ index: animatedRowIndex });

    return {
      position: 'absolute' as 'absolute',
      top: parentTop + parentHeight,
      right: 0,
      left: 0,
      height: isExpanding ? 0 : this.getAnimatedRowVisibleChildItemsHeight(),
      overflow: 'hidden',
      animation: isExpanding
        ? `expand ${duration}ms forwards, expandedItemAndAboveItSlideUp ${duration}ms forwards`
        : `collapse ${duration}ms forwards, collapsedItemAndAboveItSlideDown ${duration}ms forwards`,
      animationTimingFunction: 'linear'
    };
  };

  getRowExtraStyle(index, originalTop) {
    if (!this.state.currentAnimation) {
      return null;
    }

    const { rowIndex: animatedRowIndex, isExpanding, duration } = this.state.currentAnimation;

    if (index <= animatedRowIndex) {
      return isExpanding
        ? {
            top: originalTop - this.getExpandingSlideUpDistance(),
            transition: `top linear ${duration}ms`
          }
        : {
            animation: `collapsedItemAndAboveItSlideDown ${duration}ms forwards`,
            animationTimingFunction: 'linear'
          };
    }

    return isExpanding
      ? {
          top: originalTop + this.getExpandingSlideDownDistance(),
          transition: `top linear ${duration}ms`
        }
      : {
          animation: `itemsBelowCollapsedItemSlideUp ${duration}ms forwards`,
          animationTimingFunction: 'linear'
        };
  }

  getRowHeight = row =>
    typeof this.props.itemHeight === 'number' ? this.props.itemHeight : this.props.itemHeight(row);

  getRowHeightByIndex = ({ index }) => this.getRowHeight(this.state.normalizedTreeItems[index]);

  getVisibleRows = (rows, availableHeight) => {
    let rowsLeft = [...rows];
    let heightLeft = availableHeight;
    const visibleRows = [];

    while (rowsLeft.length && heightLeft > 0) {
      const [poppedRow, ...restOfRows] = rowsLeft;

      rowsLeft = restOfRows;
      heightLeft -= this.getRowHeight(poppedRow);

      visibleRows.push(poppedRow);
    }

    return {
      visibleRows,
      visibleHeight: Math.min(availableHeight, availableHeight - heightLeft)
    };
  };

  getItemClickHandler = (rowLevel, rowId, rowIndex) => () => {
    const { list, props, state } = this;
    const { items, transitionDuration } = props;
    const { itemsExpandStatuses, normalizedTreeItems: treeItems } = state;
    const nextItemsExpandStatuses = this.updateItemsExpandStatuses(rowLevel, rowId);
    const nextTreeItems = this.getNormalizedTreeItems(items, nextItemsExpandStatuses);
    const deltaRowCount = Math.abs(nextTreeItems.length - treeItems.length);
    const isExpanding = !get([rowLevel, rowId], itemsExpandStatuses);
    const availableHeight = this.getListHeight() - this.getRowHeightByIndex({ index: rowIndex });
    const totalChildItems = (isExpanding ? nextTreeItems : treeItems).slice(
      rowIndex + 1,
      rowIndex + deltaRowCount + 1
    );
    const { visibleRows: visibleChildItems, visibleHeight } = this.getVisibleRows(
      totalChildItems,
      availableHeight
    );

    document.addEventListener('mousewheel', this.disableMouseWheelEvent);
    this.setState(
      {
        normalizedTreeItems: isExpanding ? treeItems : nextTreeItems,
        currentAnimation: {
          rowIndex,
          totalChildItems,
          visibleChildItems,
          visibleChildItemsHeight: visibleHeight,
          isExpanding,
          duration: transitionDuration,
          initialScrollHeight: this.getListScrollHeight(),
          initialScrollTop: this.getListScrollTop()
        }
      },
      () => {
        list.recomputeRowHeights();
        setTimeout(() => {
          const deltaScrollTop = this.getExpandingSlideUpDistance();

          document.removeEventListener('mousewheel', this.disableMouseWheelEvent);
          this.setState(
            {
              normalizedTreeItems: nextTreeItems,
              itemsExpandStatuses: nextItemsExpandStatuses,
              currentAnimation: null
            },
            () => {
              list.recomputeRowHeights();

              if (isExpanding) {
                list.scrollToPosition(this.getListScrollTop() + deltaScrollTop);
              }
            }
          );
        }, transitionDuration);
      }
    );
  };

  renderRow = ({ key, index, style }) => {
    const { itemRenderer } = this.props;
    const { normalizedTreeItems, currentAnimation } = this.state;
    const item = normalizedTreeItems[index];
    const onClick = this.getItemClickHandler(item.level, item.id, index);
    const rowStyle = { ...style, ...this.getRowExtraStyle(index, style.top) };

    // TODO: Move from here
    let top = 0;

    return (
      <React.Fragment key={item.id}>
        <div style={rowStyle}>
          {itemRenderer({
            expandCallback: currentAnimation ? noop : onClick,
            updateCallback: this.list.forceUpdateGrid,
            item
          })}
        </div>
        {currentAnimation &&
          index === currentAnimation.rowIndex && (
            <div style={this.getAnimatedChildRowsContainerStyle(style.top)}>
              {currentAnimation.visibleChildItems.map(currentItem => {
                const currentRowHeight = this.getRowHeight(currentItem);

                const row = (
                  <div style={{ top, height: currentRowHeight }} key={currentItem.id}>
                    {itemRenderer({ item: currentItem })}
                  </div>
                );

                top += currentRowHeight;

                return row;
              })}
            </div>
          )}
      </React.Fragment>
    );
  };

  render() {
    const { normalizedTreeItems, currentAnimation } = this.state;

    return (
      <div className={this.props.className}>
        {currentAnimation && <div dangerouslySetInnerHTML={{ __html: this.getCssAnimations() }} />}
        <AutoSizer>
          {({ width, height }) => (
            <List
              rowCount={normalizedTreeItems.length}
              ref={node => (this.list = node)}
              rowHeight={this.getRowHeightByIndex}
              rowRenderer={this.renderRow}
              className="virtualized-tree"
              height={height}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
}
