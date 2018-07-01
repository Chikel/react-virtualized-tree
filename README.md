# react-virtualized-tree
An npm library exposing a virtualized tree component

### Props

| Prop | Description |
| ------ | ------ |
| items | An array of items to display (must contain `id` for each item and optional `children`) |
| rowHeight | Row height in pixels |
| itemRenderer | A callback for rendering each item (callback arguments: current item and click callback) |
| headerRenderer | Optional header renderer |
| transitionDuration | Collapse animation duration in milliseconds |
| className | Optional root container className|

