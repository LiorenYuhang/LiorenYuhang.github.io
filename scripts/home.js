/* global hexo */
'use strict';

const fs = require('fs');
const path = require('path');

// Project-local view override. NexT's layout and sidebar remain authoritative.
hexo.extend.filter.register('before_generate', () => {
  hexo.theme.setView('index.njk', fs.readFileSync(
    path.join(hexo.base_dir, 'layouts/home.njk'), 'utf8'));
});
