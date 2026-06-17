/**
 * Douban eBook ++ 设置页逻辑
 * — Z-Library 镜像地址 CRUD + chrome.storage.sync 持久化
 */

// ========================
// 默认配置
// ========================
var DEFAULT_MIRRORS = [
  { name: 'zlib.re', homeUrl: 'https://zh.zlib.re/', searchBase: 'https://zh.vbh101.ru' }
];

var DEFAULT_ANNAS_URL = 'https://annas-archive.gl/search?q={query}';

var mirrors = [];
var editingIndex = -1; // -1 = 新增, >=0 = 编辑

// ========================
// 初始化
// ========================
document.addEventListener('DOMContentLoaded', function () {
  loadMirrors();
  bindEvents();
});

// ========================
// 数据加载与保存
// ========================
function loadMirrors() {
  chrome.storage.sync.get(['zlib_mirrors', 'annas_base'], function (result) {
    if (result.zlib_mirrors && result.zlib_mirrors.length > 0) {
      mirrors = result.zlib_mirrors;
    } else {
      mirrors = JSON.parse(JSON.stringify(DEFAULT_MIRRORS));
    }
    renderMirrorList();

    // 加载 Anna's Archive 配置
    var annasUrl = result.annas_base || DEFAULT_ANNAS_URL;
    document.getElementById('annasUrl').value = annasUrl;
  });
}

function saveMirrors(callback) {
  chrome.storage.sync.set({ zlib_mirrors: mirrors }, function () {
    if (chrome.runtime.lastError) {
      showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('配置已保存，镜像列表将在下次打开豆瓣页面时生效', 'success');
    }
    if (callback) callback();
  });
}

function resetToDefaults() {
  mirrors = JSON.parse(JSON.stringify(DEFAULT_MIRRORS));
  chrome.storage.sync.set({ zlib_mirrors: mirrors, annas_base: DEFAULT_ANNAS_URL }, function () {
    document.getElementById('annasUrl').value = DEFAULT_ANNAS_URL;
    renderMirrorList();
    showStatus('已恢复为默认配置', 'success');
  });
}

// ========================
// 渲染
// ========================
function renderMirrorList() {
  var container = document.getElementById('mirrorList');

  if (mirrors.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无镜像，点击「添加镜像」开始</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < mirrors.length; i++) {
    var m = mirrors[i];
    html += '<div class="mirror-item" data-index="' + i + '">';
    html +=   '<span class="drag-handle" title="拖拽排序">⋮⋮</span>';
    html +=   '<span class="mirror-index">' + (i + 1) + '</span>';
    html +=   '<div class="mirror-info">';
    html +=     '<div class="mirror-name">' + escapeHtml(m.name) + '</div>';
    html +=     '<div class="mirror-urls">探测: <code>' + escapeHtml(m.homeUrl) + '</code> &nbsp; 搜索: <code>' + escapeHtml(m.searchBase) + '</code></div>';
    html +=   '</div>';
    html +=   '<div class="mirror-actions">';
    html +=     '<button class="btn btn-small btn-secondary" data-action="up" data-index="' + i + '" title="上移">↑</button>';
    html +=     '<button class="btn btn-small btn-secondary" data-action="down" data-index="' + i + '" title="下移">↓</button>';
    html +=     '<button class="btn btn-small btn-secondary" data-action="edit" data-index="' + i + '">编辑</button>';
    html +=     '<button class="btn btn-small btn-danger" data-action="remove" data-index="' + i + '">删除</button>';
    html +=   '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
  bindMirrorEvents();
}

function bindMirrorEvents() {
  document.querySelectorAll('.mirror-actions button').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var action = this.dataset.action;
      var index = parseInt(this.dataset.index, 10);

      switch (action) {
        case 'edit':
          openEditModal(index);
          break;
        case 'remove':
          removeMirror(index);
          break;
        case 'up':
          moveMirror(index, -1);
          break;
        case 'down':
          moveMirror(index, 1);
          break;
      }
    });
  });
}

function moveMirror(index, direction) {
  var newIndex = index + direction;
  if (newIndex < 0 || newIndex >= mirrors.length) return;

  var item = mirrors.splice(index, 1)[0];
  mirrors.splice(newIndex, 0, item);

  saveMirrors(function () {
    renderMirrorList();
  });
}

function removeMirror(index) {
  if (mirrors.length <= 1) {
    showStatus('至少保留一个镜像地址', 'error');
    return;
  }
  mirrors.splice(index, 1);
  saveMirrors(function () {
    renderMirrorList();
  });
}

// ========================
// 编辑弹窗
// ========================
function openEditModal(index) {
  var modal = document.getElementById('editModal');
  var title = document.getElementById('modalTitle');
  var nameInput = document.getElementById('mirrorName');
  var homeInput = document.getElementById('mirrorHomeUrl');
  var searchInput = document.getElementById('mirrorSearchBase');
  var msg = document.getElementById('modalMsg');

  if (index >= 0) {
    title.textContent = '编辑镜像';
    nameInput.value = mirrors[index].name;
    homeInput.value = mirrors[index].homeUrl;
    searchInput.value = mirrors[index].searchBase;
    editingIndex = index;
  } else {
    title.textContent = '添加镜像';
    nameInput.value = '';
    homeInput.value = '';
    searchInput.value = '';
    editingIndex = -1;
  }

  msg.style.display = 'none';
  modal.style.display = 'flex';
  nameInput.focus();
}

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
  editingIndex = -1;
}

function saveMirror() {
  var name = document.getElementById('mirrorName').value.trim();
  var homeUrl = document.getElementById('mirrorHomeUrl').value.trim();
  var searchBase = document.getElementById('mirrorSearchBase').value.trim();
  var msg = document.getElementById('modalMsg');

  // 验证
  if (!name) {
    showModalError('名称不能为空');
    return;
  }
  if (!homeUrl) {
    showModalError('探测地址不能为空');
    return;
  }
  if (!searchBase) {
    showModalError('搜索基础地址不能为空');
    return;
  }

  // 检查名称唯一性
  for (var i = 0; i < mirrors.length; i++) {
    if (i !== editingIndex && mirrors[i].name === name) {
      showModalError('镜像名称「' + name + '」已存在');
      return;
    }
  }

  var mirror = {
    name: name,
    homeUrl: homeUrl,
    searchBase: searchBase
  };

  if (editingIndex >= 0) {
    mirrors[editingIndex] = mirror;
  } else {
    mirrors.push(mirror);
  }

  saveMirrors(function () {
    closeModal();
    renderMirrorList();
  });
}

function showModalError(text) {
  var msg = document.getElementById('modalMsg');
  msg.textContent = text;
  msg.style.display = 'block';
}

// ========================
// 事件绑定
// ========================
function bindEvents() {
  document.getElementById('btnAdd').addEventListener('click', function () {
    openEditModal(-1);
  });

  document.getElementById('btnReset').addEventListener('click', function () {
    if (confirm('确定要恢复为默认配置吗？当前配置将被覆盖。')) {
      resetToDefaults();
    }
  });

  document.getElementById('btnSave').addEventListener('click', saveMirror);

  document.getElementById('btnCancel').addEventListener('click', closeModal);

  // Anna's Archive 保存
  document.getElementById('btnSaveAnnas').addEventListener('click', saveAnnasUrl);

  // 点击遮罩关闭
  document.getElementById('editModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // Enter 保存
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && document.getElementById('editModal').style.display === 'flex') {
      saveMirror();
    }
    if (e.key === 'Escape' && document.getElementById('editModal').style.display === 'flex') {
      closeModal();
    }
  });
}

// ========================
// 工具函数
// ========================
function showStatus(msg, type) {
  var el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'status-msg ' + (type || 'success');
  el.style.display = 'block';

  setTimeout(function () {
    el.style.display = 'none';
  }, 4000);
}

// ========================
// Anna's Archive 配置
// ========================
function saveAnnasUrl() {
  var url = document.getElementById('annasUrl').value.trim();
  var statusEl = document.getElementById('annasStatus');

  if (!url) {
    statusEl.textContent = '地址不能为空';
    statusEl.className = 'status-msg error';
    statusEl.style.display = 'block';
    return;
  }

  if (!url.includes('{query}')) {
    statusEl.textContent = '地址必须包含 {query} 占位符';
    statusEl.className = 'status-msg error';
    statusEl.style.display = 'block';
    return;
  }

  chrome.storage.sync.set({ annas_base: url }, function () {
    if (chrome.runtime.lastError) {
      statusEl.textContent = '保存失败: ' + chrome.runtime.lastError.message;
      statusEl.className = 'status-msg error';
    } else {
      statusEl.textContent = 'Anna\'s Archive 搜索地址已保存，下次打开豆瓣页面时生效';
      statusEl.className = 'status-msg success';
    }
    statusEl.style.display = 'block';
    setTimeout(function () {
      statusEl.style.display = 'none';
    }, 4000);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
