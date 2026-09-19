/* global hexo */
'use strict';

const fs = require('fs');
const path = require('path');

// Register topic layout view before generation
hexo.extend.filter.register('before_generate', () => {
  hexo.theme.setView('topic.njk', fs.readFileSync(
    path.join(hexo.base_dir, 'layouts/topic.njk'), 'utf8'));
});

// Generator for curated topic pages
hexo.extend.generator.register('curated_topics', function(locals) {
  const topicsData = locals.data && locals.data.topics;
  if (!topicsData) {
    console.warn('[topic-generator] No topics data found in source/_data/topics.yml');
    return [];
  }

  const allPosts = locals.posts;
  const allPostsArray = allPosts.toArray();
  const pages = [];

  const topicList = Array.isArray(topicsData)
    ? topicsData
    : Object.entries(topicsData).map(([key, val]) => Object.assign({ id: key }, val));

  for (const topic of topicList) {
    const topicId = topic.id;
    if (!topicId) {
      throw new Error('[topic-generator] Topic missing required "id" field');
    }

    const curatedPosts = [];
    const missingPosts = [];
    const seenPosts = new Set();

    for (const identifier of (topic.posts || [])) {
      const expectedSources = new Set([
        `_posts/${identifier}.md`,
        `_posts/${identifier}`
      ]);
      const matches = allPostsArray.filter(post => {
        const source = String(post.source || '').replace(/\\/g, '/');
        return post.slug === identifier
          || post.title === identifier
          || expectedSources.has(source);
      });

      if (matches.length === 0) {
        missingPosts.push(identifier);
        continue;
      }

      if (matches.length > 1) {
        throw new Error(`[topic-generator] Topic "${topicId}" has ambiguous post identifier "${identifier}"`);
      }

      const post = matches[0];
      const postKey = post._id || post.source || post.path || post.slug;
      if (seenPosts.has(postKey)) {
        throw new Error(`[topic-generator] Topic "${topicId}" contains duplicate post "${identifier}"`);
      }

      seenPosts.add(postKey);
      curatedPosts.push(post);
    }

    if (missingPosts.length > 0) {
      throw new Error(`[topic-generator] Topic "${topicId}" failed to resolve post(s): ${missingPosts.join(', ')}`);
    }

    // Topic membership is curated; display order is by post date descending.
    curatedPosts.sort((a, b) => {
      const timeA = a.date ? (typeof a.date.valueOf === 'function' ? a.date.valueOf() : new Date(a.date).getTime()) : 0;
      const timeB = b.date ? (typeof b.date.valueOf === 'function' ? b.date.valueOf() : new Date(b.date).getTime()) : 0;
      const diff = timeB - timeA;
      if (diff !== 0) return diff;
      return String(a.slug || a.title || '').localeCompare(String(b.slug || b.title || ''), 'zh-CN');
    });

    pages.push({
      path: `start-here/${topicId}/index.html`,
      layout: 'topic',
      data: {
        title: topic.title,
        subtitle: topic.subtitle,
        description: topic.description,
        curated_posts: curatedPosts
      }
    });
  }

  return pages;
});
