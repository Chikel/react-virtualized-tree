import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';
import { flatten, update, get, noop } from 'lodash/fp';

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
  itemHeight?: number;
  className?: string;
  transitionDuration: number;
}

interface TreeState {
  normalizedTreeItems: Item[];
  itemsExpandStatuses: { [treeLevel: number]: { [itemId: number]: boolean } };
  currentAnimation: {
    rowIndex: number;
    animatedChildRowItems: Item[];
    totalChildCount: number;
    isExpanding: boolean;
    duration: number;
    initialScrollHeight: number;
    initialScrollTop: number;
  };
}

/*** SORTED BY PRIORITY ***/
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

  getAnimatedChildRowItemsHeight = () =>
    this.state.currentAnimation.animatedChildRowItems.length * this.props.itemHeight;

  getAvailableHeightForSlidingDown() {
    const virtualYOffset = this.state.currentAnimation.rowIndex * this.props.itemHeight;
    const absoluteYOffset = virtualYOffset - this.getListScrollTop();

    return this.getListHeight() - absoluteYOffset - this.props.itemHeight;
  }

  getExpandingSlideUpDistance = () =>
    this.getAnimatedChildRowItemsHeight() - this.getExpandingSlideDownDistance();

  getExpandingSlideDownDistance = () =>
    Math.min(this.getAnimatedChildRowItemsHeight(), this.getAvailableHeightForSlidingDown());

  getCollapsingSlideDownDistance() {
    const { totalChildCount, initialScrollHeight, initialScrollTop } = this.state.currentAnimation;
    const { itemHeight } = this.props;
    const hiddenBelow = initialScrollHeight - initialScrollTop - this.getListHeight() || 0;

    return Math.max(totalChildCount * itemHeight - hiddenBelow, 0);
  }

  getCollapsingSlideUpDistance() {
    const { totalChildCount, initialScrollHeight, initialScrollTop } = this.state.currentAnimation;
    const hiddenBelow = initialScrollHeight - initialScrollTop - this.getListHeight() || 0;
    const totalChildCountHeight = totalChildCount * this.props.itemHeight;

    return Math.min(
      this.getAnimatedChildRowItemsHeight(),
      hiddenBelow - (totalChildCountHeight - this.getAnimatedChildRowItemsHeight())
    );
  }

  getCssAnimations = () => `
    <style>
      @keyframes expand {
        to {  
          height: ${this.getAnimatedChildRowItemsHeight()}px;
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

  getAnimatedChildRowsContainerStyle = parentRowStyle => {
    const { isExpanding, duration } = this.state.currentAnimation;

    return {
      position: 'absolute' as 'absolute',
      top: parentRowStyle.top + this.props.itemHeight,
      right: 0,
      left: 0,
      height: isExpanding ? 0 : this.getAnimatedChildRowItemsHeight(),
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

  getItemClickHandler = (rowLevel, rowId, rowIndex) => () => {
    const { list, props, state } = this;
    const { items, transitionDuration, itemHeight } = props;
    const { itemsExpandStatuses, normalizedTreeItems: treeItems } = state;
    const nextItemsExpandStatuses = this.updateItemsExpandStatuses(rowLevel, rowId);
    const nextTreeItems = this.getNormalizedTreeItems(items, nextItemsExpandStatuses);
    const deltaRowCount = Math.abs(nextTreeItems.length - treeItems.length);
    const maxAnimatedRowCount = Math.round((this.getListHeight() - itemHeight) / itemHeight);
    const animatedRowCount = Math.min(maxAnimatedRowCount, deltaRowCount);
    const isExpanding = !get([rowLevel, rowId], itemsExpandStatuses);
    const animatedItems = (isExpanding ? nextTreeItems : treeItems).slice(
      rowIndex + 1,
      rowIndex + animatedRowCount + 1
    );

    document.addEventListener('mousewheel', this.disableMouseWheelEvent);
    this.setState(
      {
        normalizedTreeItems: isExpanding ? treeItems : nextTreeItems,
        currentAnimation: {
          rowIndex,
          animatedChildRowItems: animatedItems,
          totalChildCount: deltaRowCount,
          isExpanding,
          duration: transitionDuration * (animatedRowCount / deltaRowCount),
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
    const { itemRenderer, itemHeight } = this.props;
    const { normalizedTreeItems, currentAnimation } = this.state;
    const item = normalizedTreeItems[index];
    const onClick = this.getItemClickHandler(item.level, item.id, index);
    const rowStyle = { ...style, ...this.getRowExtraStyle(index, style.top) };

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
            <div style={this.getAnimatedChildRowsContainerStyle(style)}>
              {currentAnimation.animatedChildRowItems.map((currentItem, index) => (
                <div style={{ ...style, top: index * itemHeight }} key={currentItem.id}>
                  {itemRenderer({ item: currentItem })}
                </div>
              ))}
            </div>
          )}
      </React.Fragment>
    );
  };

  render() {
    const { normalizedTreeItems, currentAnimation } = this.state;
    const { className, itemHeight } = this.props;

    return (
      <div className={className}>
        {currentAnimation && <div dangerouslySetInnerHTML={{ __html: this.getCssAnimations() }} />}
        <AutoSizer>
          {({ width, height }) => (
            <List
              rowCount={normalizedTreeItems.length}
              ref={node => (this.list = node)}
              className="virtualized-tree"
              rowRenderer={this.renderRow}
              rowHeight={itemHeight}
              height={height}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
}
