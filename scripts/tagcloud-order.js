'use strict';

const { escapeHTML, url_for } = require('hexo-util');

hexo.extend.helper.register('tagcloud', function(tags, options) {
  if (!options && (!tags || !Object.prototype.hasOwnProperty.call(tags, 'length'))) {
    options = tags;
    tags = this.site.tags;
  }

  if (!tags || !tags.length) return '';

  const settings = options || {};
  const min = settings.min_font || 10;
  const max = settings.max_font || 20;
  const unit = settings.unit || 'px';
  const className = settings.class;
  const separator = settings.separator || ' ';
  const amount = settings.amount || tags.length;
  const orderedTags = tags.toArray()
    .sort((a, b) => b.length - a.length || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .slice(0, amount);
  const counts = [...new Set(orderedTags.map(tag => tag.length))].sort((a, b) => a - b);
  const range = counts.length - 1;

  return orderedTags.map(tag => {
    const ratio = range ? counts.indexOf(tag.length) / range : 0;
    const size = min + (max - min) * ratio;
    const classAttr = className ? ` class="${className}-${Math.round(ratio * 10)}"` : '';
    return `<a href="${url_for.call(this, tag.path)}" style="font-size: ${parseFloat(size.toFixed(2))}${unit};"${classAttr}>${escapeHTML(tag.name)}</a>`;
  }).join(separator);
});
