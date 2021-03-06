var dom = require('./dom');

module.exports = Doc;

function Doc(formats, options) {
  this.formats = formats;
  this.document = options.document;
  this.blockTag = options && options.blockTag || 'div';
  this.inlineTag = options && options.inlineTag || 'span';
  this.root = this.document.createElement('div');
}

Doc.prototype.getHTML = function() {
  return this.root.innerHTML;
};

Doc.prototype.writeOp = function(op) {
  if (op.insert === null || op.insert === undefined) {
    throw new Error('Cannot convert delta with non-insert operations');
  }

  var attrs = op.attributes || {};
  var text = (typeof op.insert === 'string') ?
    op.insert.replace(/\r\n?/g, '\n') : '!';
  var index = text.indexOf('\n');

  while (index >= 0) {
    this.writeText(text.slice(0, index), attrs);
    this.formatLine(attrs);
    this.line = null;
    text = text.slice(index + 1);
    index = text.indexOf('\n');
  }

  if (text.length > 0) {
    this.writeText(text, attrs);
  }

  return this;
};

Doc.prototype.writeText = function(text, attrs) {
  if (!this.line) {
    this.line = this.document.createElement(this.blockTag);
    this.root.appendChild(this.line);
  }

  if (!text.length) { return }

  var node = this.document.createTextNode(text);

  this.line.appendChild(node);

  // TODO: loop through in priority order
  // TODO: each format function returns a promise
  for (var key in attrs) {
    if (!attrs.hasOwnProperty(key)) { continue }
    var format = this.formats[key];
    if (format && format.type !== 'line') {
      node = this.applyFormat(node, format, attrs[key]);
    }
  }

  // TODO: optimize line?
  this.line = this.root.lastChild;
};

Doc.prototype.applyFormat = function(node, format, value) {
  if (format.tag) {
    if (format.type === 'line') {
      node = dom(node).switchTag(format.tag).get();
    } else {
      if (dom.VOID_TAGS[format.tag]) {
        node = dom(node).replaceWith(this.document.createElement(format.tag)).get();
      } else {
        node = dom(node).wrap(format.tag).get();
      }
    }
  }

  if (format.parentTag) {
    node = dom(node).wrap(format.parentTag).get();
    if (node.previousSibling && node.tagName === node.previousSibling.tagName) {
      dom(node.previousSibling).merge(node);
    }
    if (node.nextSibling && node.tagName === node.nextSibling.tagName) {
      dom(node).merge(node.nextSibling);
    }
  }

  if (format.attribute || format.class || format.style) {
    if (dom(node).isTextNode()) {
      node = dom(node).wrap(this.inlineTag).get();
    }
    if (format.attribute) {
      node.setAttribute(format.attribute, value);
    }
    if (format.class) {
      if (typeof node.classList === 'undefined') {
        var newClass = format.class + value;
        var className = node.className;
        node.className = className.length ? (className + ' ' + newClass) : (className + newClass);
      } else {
        node.classList.add(format.class + value);
      }
    }
    if (format.style && value !== format.default) {
      node.style[format.style] = value;
    }
  }

  if (typeof format.add === 'function') {
    node = format.add(node, value, dom);
  }

  return node;
};

Doc.prototype.formatLine = function(attrs) {
  var line = this.line;

  // TODO: loop through in priority order
  // TODO: each format function returns a promise
  for (var name in attrs) {
    if (!attrs.hasOwnProperty(name)) { continue }
    var format = this.formats[name];
    if (format && format.type === 'line') {
      line = this.applyFormat(line, format, attrs[name]);
    }
  }

  this.line = line;
};
