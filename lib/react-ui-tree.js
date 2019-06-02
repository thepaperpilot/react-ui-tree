import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Tree from './tree';
import Node from './node';

export default class UITree extends Component {
  static propTypes = {
    tree: PropTypes.object.isRequired,
    paddingLeft: PropTypes.number,
    renderNode: PropTypes.func.isRequired,
    canBecomeParent: PropTypes.func
  };

  static defaultProps = {
    paddingLeft: 20
  };

  constructor(props) {
    super(props);

    this.state = this.init(props);

    this.nodeRefs = {}
  }

  componentWillReceiveProps(nextProps) {
    this.setState(this.init(nextProps));
  }

  componentDidMount() {
    this.refs.scrollParent = this.getScrollParent();
  }

  init = props => {
    const tree = new Tree(props.tree);
    tree.isNodeCollapsed = props.isNodeCollapsed;
    tree.renderNode = props.renderNode;
    tree.changeNodeCollapsed = props.changeNodeCollapsed;
    tree.updateNodesPosition();

    return {
      tree: tree,
      dragging: {
        id: null,
        x: null,
        y: null,
        w: null,
        h: null
      }
    };
  };

  getScrollParent() {
    var parents = function(node, ps) {
      return null === node.parentNode ? ps : parents(node.parentNode, ps.concat([node]));
    },

    check = function(node) {
      var o = "overflow", gpv = "getPropertyValue", gcs = "getComputedStyle";
      return window[gcs](node, null)[gpv](o) + window[gcs](node, null)[gpv](o+"-y") + window[gcs](node, null)[gpv](o+"-x");
    };

    var ps = parents(this.refs.tree, []);
    for (var i = 0;i < ps.length;i += 1) {
      if (/(auto|scroll)/.test(check(ps[i]))) {
        return ps[i];
      }
    }
    return document.body;
  }

  getDraggingDom = () => {
    const { tree, dragging } = this.state;

    if (dragging && dragging.id) {
      const draggingIndex = tree.getIndex(dragging.id);
      const draggingStyles = {
        top: dragging.y,
        left: dragging.x,
        width: dragging.w
      };

      return (
        <div className="m-draggable" style={draggingStyles}>
          <Node
            tree={tree}
            nodeRefs={this.nodeRefs}
            index={draggingIndex}
            paddingLeft={this.props.paddingLeft}
          />
        </div>
      );
    }

    return null;
  };

  render() {
    const tree = this.state.tree;
    const dragging = this.state.dragging;
    const draggingDom = this.getDraggingDom();

    return (
      <div className="m-tree" ref="tree">
        {draggingDom}
        <Node
          tree={tree}
          nodeRefs={this.nodeRefs}
          index={tree.getIndex(1)}
          key={1}
          paddingLeft={this.props.paddingLeft}
          onDragStart={this.dragStart}
          onCollapse={this.toggleCollapse}
          dragging={dragging && dragging.id}
        />
      </div>
    );
  }

  dragStart = (id, dom, e) => {
    if (e.button !== 0) return;
    this.dragging = {
      id: id,
      w: dom.offsetWidth,
      h: dom.offsetHeight,
      x: dom.offsetLeft,
      y: dom.offsetTop
    };

    this._startX = dom.offsetLeft;
    this._startY = dom.offsetTop;
    this._offsetX = e.clientX + this.refs.scrollParent.scrollLeft;
    this._offsetY = e.clientY + this.refs.scrollParent.scrollTop;
    this._start = true;
    this._dragChanged = false;

    window.addEventListener('mousemove', this.drag);
    window.addEventListener('mouseup', this.dragEnd);
  };

  // oh
  drag = e => {
    if (this._start) {
      this.setState({
        dragging: this.dragging
      });
      this._start = false;
    }

    const tree = this.state.tree;
    const dragging = this.state.dragging;
    const paddingLeft = this.props.paddingLeft;
    let newIndex = null;
    let index = tree.getIndex(dragging.id);
    const collapsed = index.node.collapsed;

    const _startX = this._startX;
    const _startY = this._startY;
    const _offsetX = this._offsetX;
    const _offsetY = this._offsetY;

    const pos = {
      x: _startX + e.clientX + this.refs.scrollParent.scrollLeft - _offsetX,
      y: _startY + e.clientY + this.refs.scrollParent.scrollTop - _offsetY
    };
    dragging.x = pos.x;
    dragging.y = pos.y;

    const diffX = dragging.x - paddingLeft / 2 - (index.left - 2) * paddingLeft;
    const diffY = dragging.y - dragging.h / 2 - (index.top - 2) * dragging.h;

    if (diffX < 0) {
      // left
      const parent = tree.getIndex(index.parent)
      const grandparent = parent ? tree.getIndex(parent.parent) : null
      if (
        index.parent &&
        !index.next &&
        (
          !this.props.canBecomeParent ||
          !grandparent ||
          this.props.canBecomeParent(grandparent.node, index.node)
        )
      ) {
        newIndex = tree.move(index.id, index.parent, 'after');
      }
    } else if (diffX > paddingLeft) {
      // right
      if (index.prev) {
        const prevNode = tree.getIndex(index.prev).node;
        if (
            !prevNode.collapsed &&
            !prevNode.leaf &&
            (!this.props.canBecomeParent ||
                this.props.canBecomeParent(prevNode, index.node))
        ) {
          newIndex = tree.move(index.id, index.prev, 'append');
        }
      }
    }

    if (newIndex) {
      index = newIndex;
      newIndex.node.collapsed = collapsed;
      dragging.id = newIndex.id;
    }

    if (diffY < 0 && this.nodeRefs[index.id] && this.nodeRefs[index.id].current) {
      // up
      let dy = -diffY;
      let above, nextAbove = above = index;
      while (
        tree.getNodeByTop(nextAbove.top - 1) &&
        this.nodeRefs[above.id].current &&
        dy > -this.nodeRefs[above.id].current.offsetHeight
      ) {
        dy -= this.nodeRefs[above.id].current.offsetHeight;
        above = nextAbove;
        nextAbove = tree.getNodeByTop(above.top - 1);
      }

      if (!this.props.canBecomeParent ||
        this.props.canBecomeParent(tree.getIndex(above.parent).node, index.node)
      ) {
        newIndex = tree.move(index.id, above.id, 'before');
      }
    } else if (diffY > dragging.h) {
      // down
      if (index.next) {
        const below = tree.getIndex(index.next);
        if (
            below.children &&
            below.children.length &&
            !below.node.collapsed &&
            (!this.props.canBecomeParent ||
                this.props.canBecomeParent(below.node, index.node))
        ) {
          newIndex = tree.move(index.id, index.next, 'prepend');
        } else {
          newIndex = tree.move(index.id, index.next, 'after');
        }
      } else {
        const below = tree.getNodeByTop(index.top + index.height);
        if (below && below.parent !== index.id) {
          if (
            below.children &&
            below.children.length &&
            !below.node.collapsed &&
            (!this.props.canBecomeParent ||
                this.props.canBecomeParent(below.node, index.node))
          ) {
            newIndex = tree.move(index.id, below.id, 'prepend');
          } else {
            newIndex = tree.move(index.id, below.id, 'after');
          }
        }
      }
    }

    if (newIndex) {
      newIndex.node.collapsed = collapsed;
      dragging.id = newIndex.id;
    }

    if(newIndex) {
      this._dragChanged = true;
    }

    this.setState({
      tree: tree,
      dragging: dragging
    });
  };

  dragEnd = () => {
    this.setState({
      dragging: {
        id: null,
        x: null,
        y: null,
        w: null,
        h: null
      }
    });

    this.change(this.state.tree);
    window.removeEventListener('mousemove', this.drag);
    window.removeEventListener('mouseup', this.dragEnd);
  };

  change = tree => {
    if(this.props.onChange && this._dragChanged) this.props.onChange(tree.obj);
  };

  toggleCollapse = nodeId => {
    const tree = this.state.tree;
    const index = tree.getIndex(nodeId);
    const node = index.node;
    node.collapsed = !node.collapsed;
    tree.updateNodesPosition();

    this.setState({
      tree: tree
    });

    this.change(tree);
  };
}
