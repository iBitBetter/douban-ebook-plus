/**
 * 豆瓣读书增强 - Douban Book+
 * 在豆瓣读书页面注入在线阅读链接面板
 *
 * 支持平台：
 *   微信读书（优先解析 bookDetail 直链）/ 多看阅读 / 网易蜗牛读书
 *   豆瓣阅读 / 得到 / Z-Library / Anna's Archive
 */

(function () {
  'use strict';

  // ========================
  // 平台图标生成
  // ========================
  function makeIcon(color, letter) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">' +
      '<rect width="24" height="24" rx="5" fill="' + color + '"/>' +
      '<text x="12" y="17" text-anchor="middle" font-size="14" font-weight="bold" fill="white" font-family="Arial,Helvetica,sans-serif">' + letter + '</text>' +
      '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  // ========================
  // 平台配置
  // ========================
  var PLATFORMS = [
    {
      id: 'weread',
      name: '微信读书',
      iconImg: makeIcon('#07C160', '微'),
      color: '#07C160',
      // 初始用搜索页兜底，后续通过 background 解析为 bookDetail 直链
      getFallbackUrl: function (title, isbn) {
        var q = isbn || title;
        return 'https://weread.qq.com/web/search?key=' + encodeURIComponent(q);
      },
      // 标记为需要异步解析
      needsResolve: true
    },
    {
      id: 'doubanread',
      name: '豆瓣阅读',
      iconImg: makeIcon('#00B51D', '豆'),
      color: '#00B51D',
      // 初始用搜索页兜底，后续通过 background 解析为 reader/ebook 直链
      getFallbackUrl: function (title, isbn) {
        var q = isbn || title;
        return 'https://read.douban.com/search?q=' + encodeURIComponent(q);
      },
      needsResolve: true
    },
    {
      id: 'dedao',
      name: '得到',
      iconImg: makeIcon('#E96900', '得'),
      color: '#E96900',
      // 初始用搜索页兜底，后续通过 background 解析为 ebook/reader 直链
      getFallbackUrl: function (title, isbn) {
        var q = isbn || title;
        return 'https://www.dedao.cn/search?keyword=' + encodeURIComponent(q);
      },
      needsResolve: true
    },
    {
      id: 'duokan',
      name: '多看阅读',
      iconImg: makeIcon('#FF6B35', '多'),
      color: '#FF6B35',
      // 初始用搜索页兜底，后续通过 background 解析为 app.html 直链
      getFallbackUrl: function (title, isbn) {
        var q = isbn || title;
        return 'https://www.duokan.com/search/' + encodeURIComponent(q);
      },
      needsResolve: true
    },
    {
      id: 'woniu',
      name: '网易蜗牛读书',
      iconImg: makeIcon('#E44C4C', '蜗'),
      color: '#E44C4C',
      // 初始用搜索页兜底，后续通过 background 解析为 share/book 直链
      getFallbackUrl: function (title, isbn) {
        var q = isbn || title;
        return 'https://du.163.com/search?keyword=' + encodeURIComponent(q);
      },
      needsResolve: true
    },
    {
      id: 'zlib',
      name: 'Z-Library',
      iconImg: makeIcon('#2B6CB0', 'Z'),
      color: '#2B6CB0',
      getFallbackUrl: function (title, isbn) {
        // 兜底链接，实际运行时会被镜像探测结果替换
        return 'https://zh.chris101.ru/';
      },
      needsResolve: false,
      needsMirrorProbe: true  // 需要探测镜像可用性
    },
    {
      id: 'annas',
      name: "Anna's Archive",
      iconImg: makeIcon('#805AD5', 'A'),
      color: '#805AD5',
      getFallbackUrl: function (title, isbn) {
        var q = isbn || title;
        return 'https://annas-archive.gl/search?q=' + encodeURIComponent(q);
      },
      needsResolve: false,
      needsConfigRefresh: true  // 从 storage 读取用户自定义搜索地址
    }
  ];

  // ========================
  // 书籍信息提取
  // ========================
  function extractBookInfo() {
    var info = { title: '', isbn: '', author: '' };

    // 提取书名 — 多种选择器兜底
    var titleSelectors = [
      'h1 span[property="v:itemreviewed"]',
      '#wrapper h1 span',
      'h1',
      '[property="v:itemreviewed"]'
    ];
    for (var i = 0; i < titleSelectors.length; i++) {
      var el = document.querySelector(titleSelectors[i]);
      if (el) {
        info.title = (el.textContent || '').trim();
        break;
      }
    }

    // 提取ISBN — 从信息区块中匹配
    var infoBlock = document.getElementById('info');
    if (infoBlock) {
      var text = infoBlock.textContent || '';
      var isbnMatch = text.match(/ISBN[:\s]*(\d[\d\-Xx]+)/i);
      if (isbnMatch) {
        info.isbn = isbnMatch[1].replace(/[-\s]/g, '').trim();
      }

      // 提取作者
      var authorEl = infoBlock.querySelector('a[href*="/author/"]');
      if (authorEl) {
        info.author = (authorEl.textContent || '').trim();
      }
    }

    // 备用：从meta标签提取
    if (!info.title) {
      var metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) {
        var ogContent = metaTitle.getAttribute('content') || '';
        info.title = ogContent.trim();
      }
    }

    return info;
  }

  // ========================
  // 异步解析微信读书直链
  // ========================
  function resolveWereadLink(bookInfo, callback) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'RESOLVE_WEREAD_URL',
          title: bookInfo.title,
          isbn: bookInfo.isbn
        },
        function (result) {
          if (chrome.runtime.lastError) {
            callback(null);
            return;
          }
          callback(result);
        }
      );
    } catch (e) {
      callback(null);
    }
  }

  // ========================
  // 异步解析多看阅读直链
  // ========================
  function resolveDuokanLink(bookInfo, callback) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'RESOLVE_DUOKAN_URL',
          title: bookInfo.title,
          isbn: bookInfo.isbn
        },
        function (result) {
          if (chrome.runtime.lastError) {
            callback(null);
            return;
          }
          callback(result);
        }
      );
    } catch (e) {
      callback(null);
    }
  }

  // ========================
  // 异步解析得到读书直链
  // ========================
  function resolveDedaoLink(bookInfo, callback) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'RESOLVE_DEDAO_URL',
          title: bookInfo.title,
          isbn: bookInfo.isbn
        },
        function (result) {
          if (chrome.runtime.lastError) {
            callback(null);
            return;
          }
          callback(result);
        }
      );
    } catch (e) {
      callback(null);
    }
  }

  // ========================
  // 异步解析豆瓣阅读直链
  // ========================
  function resolveDoubanReadLink(bookInfo, callback) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'RESOLVE_DOUBANREAD_URL',
          title: bookInfo.title,
          isbn: bookInfo.isbn
        },
        function (result) {
          if (chrome.runtime.lastError) {
            callback(null);
            return;
          }
          callback(result);
        }
      );
    } catch (e) {
      callback(null);
    }
  }

  // ========================
  // 异步解析网易蜗牛读书直链（通过 background 绕过 CORS）
  // ========================
  function resolveWoniuLink(bookInfo, callback) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'RESOLVE_WONIU_URL',
          title: bookInfo.title,
          isbn: bookInfo.isbn
        },
        function (result) {
          if (chrome.runtime.lastError) {
            console.error('[DB+] 网易蜗牛 消息发送失败:', chrome.runtime.lastError.message);
            callback(null);
            return;
          }
          console.log('[DB+] 网易蜗牛 解析结果:', result);
          callback(result);
        }
      );
    } catch (e) {
      console.error('[DB+] 网易蜗牛 发送异常:', e);
      callback(null);
    }
  }

  // ========================
  // 异步探测 Z-Library 镜像可用性
  // ========================
  function resolveZlibMirrorLink(bookInfo, callback) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'PROBE_ZLIB_MIRROR',
          isbn: bookInfo.isbn,
          title: bookInfo.title
        },
        function (result) {
          if (chrome.runtime.lastError) {
            console.error('[DB+] Z-Library 镜像探测失败:', chrome.runtime.lastError.message);
            callback(null);
            return;
          }
          console.log('[DB+] Z-Library 镜像探测结果:', result);
          callback(result);
        }
      );
    } catch (e) {
      console.error('[DB+] Z-Library 镜像探测异常:', e);
      callback(null);
    }
  }

  // ========================
  // 异步读取 Anna's Archive 自定义搜索地址
  // ========================
  function resolveAnnasConfig(bookInfo, callback) {
    try {
      chrome.storage.sync.get(['annas_base'], function (result) {
        if (chrome.runtime.lastError) {
          callback(null);
          return;
        }
        var baseUrl = result.annas_base;
        if (baseUrl) {
          var q = bookInfo.isbn || bookInfo.title;
          var url = baseUrl.replace('{query}', encodeURIComponent(q));
          callback({ url: url, custom: true });
        } else {
          callback(null);
        }
      });
    } catch (e) {
      callback(null);
    }
  }

  // ========================
  // UI 构建
  // ========================
  function buildPanel(bookInfo, onReady) {
    var container = document.createElement('div');
    container.id = 'dbplus-panel';
    container.className = 'dbplus-container';

    // 面板标题
    var header = document.createElement('div');
    header.className = 'dbplus-header';
    header.textContent = '📖 在线阅读';
    container.appendChild(header);

    // 平台链接列表
    var list = document.createElement('div');
    list.className = 'dbplus-list';

    // 为需要解析的平台创建占位引用
    var asyncItems = {};

    PLATFORMS.forEach(function (platform) {
      var url = platform.getFallbackUrl(bookInfo.title, bookInfo.isbn);

      var item = document.createElement('a');
      item.className = 'dbplus-item';
      item.href = url;
      item.target = '_blank';
      item.rel = 'noopener noreferrer';
      item.title = '在 ' + platform.name + ' 中搜索「' + bookInfo.title + '」';

      // 标记需要异步解析的平台
      if (platform.needsResolve) {
        asyncItems[platform.id] = item;
        item.dataset.platform = platform.id;
        item.dataset.fallbackUrl = url;
      }

      // 标记需要镜像探测的平台
      if (platform.needsMirrorProbe) {
        asyncItems['mirror_' + platform.id] = item;
        item.dataset.platform = platform.id;
        item.dataset.fallbackUrl = url;
      }

      // 标记需要从 storage 刷新配置的平台
      if (platform.needsConfigRefresh) {
        asyncItems['config_' + platform.id] = item;
        item.dataset.platform = platform.id;
        item.dataset.fallbackUrl = url;
      }

      var iconImg = document.createElement('img');
      iconImg.className = 'dbplus-item-icon';
      iconImg.src = platform.iconImg;
      iconImg.alt = platform.name;
      iconImg.width = 24;
      iconImg.height = 24;

      var nameSpan = document.createElement('span');
      nameSpan.className = 'dbplus-item-name';
      nameSpan.textContent = platform.name;

      // 悬停时边框颜色跟随平台色
      item.style.setProperty('--platform-color', platform.color);

      item.appendChild(iconImg);
      item.appendChild(nameSpan);
      list.appendChild(item);
    });

    container.appendChild(list);

    // 添加「直达」标记的辅助函数
    function addDirectBadge(item, platformName) {
      var badge = document.createElement('span');
      badge.className = 'dbplus-badge';
      badge.textContent = '直达';
      item.appendChild(badge);
    }

    // 添加「镜像」标记的辅助函数
    function addMirrorBadge(item, mirrorName) {
      var badge = document.createElement('span');
      badge.className = 'dbplus-mirror-badge';
      badge.textContent = '可用';
      item.appendChild(badge);
    }

    // 异步解析微信读书直链
    if (asyncItems.weread) {
      resolveWereadLink(bookInfo, function (result) {
        if (result && result.found && result.url) {
          asyncItems.weread.href = result.url;
          asyncItems.weread.title = '直达「' + bookInfo.title + '」微信读书详情页';
          addDirectBadge(asyncItems.weread);
        }
      });
    }

    // 异步解析多看阅读直链
    if (asyncItems.duokan) {
      resolveDuokanLink(bookInfo, function (result) {
        if (result && result.found && result.url) {
          asyncItems.duokan.href = result.url;
          asyncItems.duokan.title = '直达「' + bookInfo.title + '」多看阅读详情页';
          addDirectBadge(asyncItems.duokan);
        }
      });
    }

    // 异步解析得到读书直链
    if (asyncItems.dedao) {
      resolveDedaoLink(bookInfo, function (result) {
        if (result && result.found && result.url) {
          asyncItems.dedao.href = result.url;
          asyncItems.dedao.title = '直达「' + bookInfo.title + '」得到电子书阅读页';
          addDirectBadge(asyncItems.dedao);
        }
      });
    }

    // 异步解析豆瓣阅读直链
    if (asyncItems.doubanread) {
      resolveDoubanReadLink(bookInfo, function (result) {
        if (result && result.found && result.url) {
          asyncItems.doubanread.href = result.url;
          asyncItems.doubanread.title = '直达「' + bookInfo.title + '」豆瓣阅读详情页';
          addDirectBadge(asyncItems.doubanread);
        }
      });
    }

    // 异步解析网易蜗牛读书直链
    if (asyncItems.woniu) {
      console.log('[DB+] 开始解析网易蜗牛读书...', bookInfo.title);
      resolveWoniuLink(bookInfo, function (result) {
        console.log('[DB+] 网易蜗牛 解析结果:', result);
        if (result && result.found && result.url) {
          asyncItems.woniu.href = result.url;
          asyncItems.woniu.title = '直达「' + bookInfo.title + '」网易蜗牛读书详情页';
          addDirectBadge(asyncItems.woniu);
          console.log('[DB+] 网易蜗牛 直达标记已添加');
        }
      });
    }

    // 异步探测 Z-Library 镜像可用性
    if (asyncItems.mirror_zlib) {
      console.log('[DB+] 开始探测 Z-Library 镜像...');
      resolveZlibMirrorLink(bookInfo, function (result) {
        if (result && result.alive && result.url) {
          asyncItems.mirror_zlib.href = result.url;
          asyncItems.mirror_zlib.title = '直达 Z-Library「' + bookInfo.title + '」— 镜像 ' + result.mirror;
          addDirectBadge(asyncItems.mirror_zlib);
          console.log('[DB+] Z-Library 镜像可用:', result.mirror, '→', result.url);
        } else if (result && result.url) {
          // 镜像探测失败但仍返回搜索链接
          asyncItems.mirror_zlib.href = result.url;
          asyncItems.mirror_zlib.title = 'Z-Library 搜索「' + bookInfo.title + '」（镜像 ' + result.mirror + '）';
          console.log('[DB+] Z-Library 镜像不可达，使用兜底搜索链接:', result.url);
        }
      });
    }

    // 异步刷新 Anna's Archive 自定义搜索地址
    if (asyncItems.config_annas) {
      resolveAnnasConfig(bookInfo, function (result) {
        if (result && result.custom && result.url) {
          asyncItems.config_annas.href = result.url;
          console.log('[DB+] Anna\'s Archive 使用自定义搜索地址');
        }
      });
    }

    return container;
  }

  // ========================
  // 注入到页面
  // ========================
  function injectPanel() {
    // 避免重复注入
    if (document.getElementById('dbplus-panel')) {
      return;
    }

    var bookInfo = extractBookInfo();

    // 如果没有书名，说明不是有效的书籍页面
    if (!bookInfo.title) {
      return;
    }

    var panel = buildPanel(bookInfo);

    // 注入策略：优先插入右侧边栏（挨着评分/购买区域）
    var content = document.getElementById('content');
    if (content) {
      // 方案 1：豆瓣旧版布局 — 右侧 .aside
      var aside = content.querySelector('.aside');
      if (aside) {
        aside.insertBefore(panel, aside.firstChild);
      }
      // 方案 2：豆瓣新版布局 — #wrapper 下的右栏
      else {
        var wrapper = document.getElementById('wrapper');
        if (wrapper) {
          var rightCol = wrapper.querySelector('.subject-others, .rr, [class*="right"]');
          if (rightCol) {
            rightCol.insertBefore(panel, rightCol.firstChild);
          } else {
            content.appendChild(panel);
          }
        } else {
          content.appendChild(panel);
        }
      }
    } else {
      document.body.appendChild(panel);
    }

    console.log('[豆瓣读书增强] 已为《' + bookInfo.title + '》注入阅读链接面板');
  }

  // ========================
  // 启动
  // ========================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(injectPanel, 500);
    });
  } else {
    setTimeout(injectPanel, 500);
  }

})();
