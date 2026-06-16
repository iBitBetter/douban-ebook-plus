/**
 * 豆瓣读书增强 — Background Service Worker
 * 
 * 职责：
 *   1. 代理 weread API 请求，将书名解析为 bookDetail 直链
 *   2. 代理 duokan API 请求，将书名解析为 reader/app.html 直链
 *   3. 代理 dedao API 请求，将书名解析为 ebook/reader 直链
 *   4. 代理 read.douban.com API 请求，将书名解析为 reader/ebook 直链
 */

// 导入 weread 编码工具
try {
  importScripts('utils/weread-encode.js');
} catch (e) {
  console.error('[DB+] Failed to load weread-encode.js:', e);
}

/**
 * 通过书名搜索微信读书，返回 bookDetail 直链
 * @param {string} title - 书名
 * @param {string} isbn - ISBN（可选，备用）
 * @returns {Promise<{url: string, found: boolean}>}
 */
async function resolveWereadUrl(title, isbn) {
  // 策略1：用书名搜索
  if (title) {
    try {
      var url = 'https://weread.qq.com/web/search/global?keyword=' + encodeURIComponent(title.trim());
      var resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (resp.ok) {
        var data = await resp.json();
        var books = data.books || [];

        if (books.length > 0) {
          var bookId = String(books[0].bookInfo.bookId);
          var encodedId = encodeWereadId(bookId);
          return {
            url: 'https://weread.qq.com/web/bookDetail/' + encodedId,
            found: true
          };
        }
      }
    } catch (e) {
      console.warn('[DB+] weread title search failed:', e.message);
    }
  }

  // 策略2：用 ISBN 搜索（weread 对 ISBN 支持有限，但尝试一下）
  if (isbn) {
    try {
      var isbnUrl = 'https://weread.qq.com/web/search/global?keyword=' + encodeURIComponent(isbn);
      var isbnResp = await fetch(isbnUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (isbnResp.ok) {
        var isbnData = await isbnResp.json();
        var isbnBooks = isbnData.books || [];

        if (isbnBooks.length > 0) {
          var isbnBookId = String(isbnBooks[0].bookInfo.bookId);
          var isbnEncodedId = encodeWereadId(isbnBookId);
          return {
            url: 'https://weread.qq.com/web/bookDetail/' + isbnEncodedId,
            found: true
          };
        }
      }
    } catch (e) {
      console.warn('[DB+] weread ISBN search failed:', e.message);
    }
  }

  // 兜底：返回搜索页链接
  var searchQuery = isbn || title || '';
  return {
    url: 'https://weread.qq.com/web/search?key=' + encodeURIComponent(searchQuery),
    found: false
  };
}

// ========================
// 消息处理
// ========================
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === 'RESOLVE_WEREAD_URL') {
    resolveWereadUrl(request.title, request.isbn).then(function (result) {
      sendResponse(result);
    });
    return true;
  }

  if (request.type === 'RESOLVE_DUOKAN_URL') {
    resolveDuokanUrl(request.title, request.isbn).then(function (result) {
      sendResponse(result);
    });
    return true;
  }

  if (request.type === 'RESOLVE_DEDAO_URL') {
    resolveDedaoUrl(request.title).then(function (result) {
      sendResponse(result);
    });
    return true;
  }

  if (request.type === 'RESOLVE_DOUBANREAD_URL') {
    resolveDoubanReadUrl(request.title).then(function (result) {
      sendResponse(result);
    });
    return true;
  }

  if (request.type === 'RESOLVE_WONIU_URL') {
    resolveWoniuUrl(request.title, request.isbn).then(function (result) {
      sendResponse(result);
    });
    return true;
  }

  if (request.type === 'PROBE_ZLIB_MIRROR') {
    probeZLibraryMirrors(request.isbn, request.title).then(function (result) {
      sendResponse(result);
    });
    return true;
  }
});

/**
 * 通过书名搜索多看阅读，返回 reader/app.html 直链
 * @param {string} title - 书名
 * @param {string} isbn - ISBN（可选，备用）
 * @returns {Promise<{url: string, found: boolean}>}
 */
async function resolveDuokanUrl(title, isbn) {
  var searchQuery = isbn || title;
  if (!searchQuery) {
    return { url: 'https://www.duokan.com/search/' + encodeURIComponent(title || ''), found: false };
  }

  try {
    var searchUrl = 'https://www.duokan.com/target/search/web?s=' + encodeURIComponent(searchQuery.trim()) + '&p=1';
    var resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Xiaomi 13) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.duokan.com/m/'
      }
    });

    if (resp.ok) {
      var data = await resp.json();
      var books = data.books || [];

      if (books.length > 0) {
        var bookId = books[0].book_id;
        return {
          url: 'https://www.duokan.com/reader/www/app.html?id=' + bookId,
          found: true
        };
      }
    }
  } catch (e) {
    console.warn('[DB+] duokan search failed:', e.message);
  }

  // 兜底：返回搜索页链接
  return {
    url: 'https://www.duokan.com/search/' + encodeURIComponent(searchQuery.trim()),
    found: false
  };
}

/**
 * 通过书名搜索得到读书，返回 ebook/reader 直链
 * @param {string} title - 书名
 * @returns {Promise<{url: string, found: boolean}>}
 */
async function resolveDedaoUrl(title) {
  if (!title) {
    return { url: 'https://www.dedao.cn/search?keyword=', found: false };
  }

  try {
    var resp = await fetch('https://www.dedao.cn/api/search/pc/suggest', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: title.trim(),
        searchType: 2  // 电子书专用
      })
    });

    if (resp.ok) {
      var data = await resp.json();
      var lists = (data.c && data.c.list) || [];

      for (var i = 0; i < lists.length; i++) {
        var items = lists[i].list || [];
        for (var j = 0; j < items.length; j++) {
          var item = items[j];
          // 只取电子书类型 (type === 2)
          if (item.type === 2 && item.extra && item.extra.enid) {
            return {
              url: 'https://www.dedao.cn/ebook/reader?id=' + item.extra.enid,
              found: true
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[DB+] dedao search failed:', e.message);
  }

  // 兜底：返回搜索页链接
  return {
    url: 'https://www.dedao.cn/search?keyword=' + encodeURIComponent(title.trim()),
    found: false
  };
}

/**
 * 通过书名搜索豆瓣阅读，返回 reader/ebook 直链
 * @param {string} title - 书名
 * @returns {Promise<{url: string, found: boolean}>}
 */
async function resolveDoubanReadUrl(title) {
  if (!title) {
    return { url: 'https://read.douban.com/search?q=', found: false };
  }

  try {
    var searchUrl = 'https://read.douban.com/j/search?query=' + encodeURIComponent(title.trim());
    var resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (resp.ok) {
      var data = await resp.json();
      // data 是一个数组，每个元素有 type 和 id
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) {
          var item = data[i];
          // 只取电子书类型 (type === 'ebook')
          if (item.type === 'ebook' && item.id) {
            return {
              url: 'https://read.douban.com/reader/ebook/' + item.id + '/',
              found: true
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[DB+] douban read search failed:', e.message);
  }

  // 兜底：返回搜索页链接
  return {
    url: 'https://read.douban.com/search?q=' + encodeURIComponent(title.trim()),
    found: false
  };
}

/**
 * 通过书名搜索网易蜗牛读书，返回 share/book 直链
 * @param {string} title - 书名
 * @param {string} isbn - ISBN（可选，备用）
 * @returns {Promise<{url: string, found: boolean}>}
 */
async function resolveWoniuUrl(title, isbn) {
  // 网易蜗牛 API 不支持 ISBN 搜索，只用书名
  var searchQuery = title;
  if (!searchQuery) {
    return { url: 'https://du.163.com/search?keyword=', found: false };
  }

  try {
    var searchUrl = 'https://du.163.com/search/book.json?word=' + encodeURIComponent(searchQuery.trim()) + '&page=1&pageSize=3';
    var resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (resp.ok) {
      var data = await resp.json();
      if (data.code === 0) {
        var bookWrappers = data.bookWrappers || [];
        if (bookWrappers.length > 0) {
          // 优先用 book.bookId（字符串），避免 BigInt 精度丢失
          var bookId = (bookWrappers[0].book && bookWrappers[0].book.bookId) || bookWrappers[0].bookId;
          console.log('[DB+] 网易蜗牛 搜索成功:', bookWrappers[0].book.title, '→', bookId);
          return {
            url: 'https://du.163.com/share/book/' + bookId,
            found: true
          };
        }
      }
    }
  } catch (e) {
    console.warn('[DB+] woniu search failed:', e.message);
  }

  // 兜底：返回搜索页链接
  return {
    url: 'https://du.163.com/search?keyword=' + encodeURIComponent(searchQuery.trim()),
    found: false
  };
}

// ========================
// Z-Library 镜像智能探测
// ========================

/**
 * Z-Library 镜像地址列表（按优先级排序）
 * homeUrl:  用于 HEAD 探测可用性
 * searchBase: /s/{isbn} 搜索的基础 URL（可能不同于 homeUrl，因为部分镜像 302 会丢弃路径）
 */
var ZLIB_MIRRORS = [
  { name: 'chris101', homeUrl: 'https://zh.chris101.ru/', searchBase: 'https://zh.vbh101.ru' },
  { name: 'zlib.ch',  homeUrl: 'https://zlib.ch/',       searchBase: 'https://zlib.ch' },
  { name: 'zlib.re',  homeUrl: 'http://zlib.re/',        searchBase: 'http://zlib.re' }
];

/**
 * 带超时的 fetch，用于快速探测镜像可用性
 * @param {string} url - 探测目标
 * @param {number} timeoutMs - 超时毫秒
 * @returns {Promise<boolean>}
 */
function fetchWithTimeout(url, timeoutMs) {
  return new Promise(function (resolve) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
      resolve(false);
    }, timeoutMs);

    fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
      .then(function () {
        clearTimeout(timer);
        resolve(true);
      })
      .catch(function () {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

/**
 * 顺序探测 Z-Library 镜像，返回第一个可用的
 * @param {string} isbn - 书籍 ISBN，用于构造搜索链接
 * @param {string} title - 书名（备用，无 ISBN 时）
 * @returns {Promise<{url: string, mirror: string, alive: boolean}>}
 */
async function probeZLibraryMirrors(isbn, title) {
  var PROBE_TIMEOUT = 3000; // 每个镜像 3 秒超时

  for (var i = 0; i < ZLIB_MIRRORS.length; i++) {
    var mirror = ZLIB_MIRRORS[i];
    console.log('[DB+] 探测 Z-Library 镜像:', mirror.name, mirror.homeUrl);

    try {
      var alive = await fetchWithTimeout(mirror.homeUrl, PROBE_TIMEOUT);
      if (alive) {
        console.log('[DB+] Z-Library 镜像可用:', mirror.name);
        // 拼接搜索链接：有 ISBN 用 /s/{isbn}，否则兜底首页
        var searchQuery = isbn || title;
        var searchUrl = mirror.searchBase;
        if (searchQuery) {
          searchUrl += '/s/' + encodeURIComponent(searchQuery.trim());
        } else {
          searchUrl += '/';
        }
        return {
          url: searchUrl,
          mirror: mirror.name,
          alive: true
        };
      }
    } catch (e) {
      console.warn('[DB+] 镜像探测异常:', mirror.name, e.message);
    }
  }

  // 全部不可用，返回第一个作为兜底
  console.warn('[DB+] 所有 Z-Library 镜像不可达，使用兜底:', ZLIB_MIRRORS[0].name);
  var fallback = ZLIB_MIRRORS[0];
  return {
    url: fallback.searchBase + '/',
    mirror: fallback.name,
    alive: false
  };
}
