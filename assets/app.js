(function () {
  var storageKey = "cleaning-checkin-state-v1";
  var selectedDate = formatDate(new Date());

  var defaults = {
    rooms: [
      {
        id: uid(),
        area: "餐厅",
        name: "餐厅大厅",
        owner: "负责人A",
        frequency: "每日",
        standard: "地面无水渍，桌面无油污，餐椅摆放整齐。"
      },
      {
        id: uid(),
        area: "餐厅",
        name: "后厨通道",
        owner: "负责人B",
        frequency: "每日",
        standard: "通道无杂物，垃圾及时清理，地面完成拖洗。"
      },
      {
        id: uid(),
        area: "餐厅",
        name: "餐具回收区",
        owner: "负责人C",
        frequency: "每班",
        standard: "回收台擦拭干净，餐具分类归位，周边无积水。"
      },
      {
        id: uid(),
        area: "中控室",
        name: "主控台",
        owner: "负责人D",
        frequency: "每日",
        standard: "桌面、键盘、显示器表面除尘，线缆区域不堆杂物。"
      },
      {
        id: uid(),
        area: "中控室",
        name: "设备机柜区",
        owner: "负责人E",
        frequency: "每日",
        standard: "机柜外表清洁，地面无灰尘，保持通风口无遮挡。"
      },
      {
        id: uid(),
        area: "中控室",
        name: "值班休息区",
        owner: "负责人F",
        frequency: "每日",
        standard: "桌椅归位，垃圾桶清空，私人物品整理。"
      }
    ],
    records: {}
  };

  var state = loadState();

  var els = {
    todayLabel: document.getElementById("todayLabel"),
    metricTotal: document.getElementById("metricTotal"),
    metricDone: document.getElementById("metricDone"),
    metricRate: document.getElementById("metricRate"),
    summaryText: document.getElementById("summaryText"),
    progressBar: document.getElementById("progressBar"),
    roomsRoot: document.getElementById("roomsRoot"),
    historyRoot: document.getElementById("historyRoot"),
    searchInput: document.getElementById("searchInput"),
    dateInput: document.getElementById("dateInput"),
    areaFilter: document.getElementById("areaFilter"),
    statusFilter: document.getElementById("statusFilter"),
    addRoomBtn: document.getElementById("addRoomBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    resetDemoBtn: document.getElementById("resetDemoBtn"),
    checkinModal: document.getElementById("checkinModal"),
    roomModal: document.getElementById("roomModal"),
    checkinForm: document.getElementById("checkinForm"),
    roomForm: document.getElementById("roomForm"),
    toast: document.getElementById("toast")
  };

  els.dateInput.value = selectedDate;
  els.todayLabel.textContent = "今天：" + selectedDate;

  bindEvents();
  render();

  function bindEvents() {
    els.searchInput.addEventListener("input", render);
    els.areaFilter.addEventListener("change", render);
    els.statusFilter.addEventListener("change", render);
    els.dateInput.addEventListener("change", function () {
      selectedDate = els.dateInput.value || formatDate(new Date());
      render();
    });

    els.addRoomBtn.addEventListener("click", function () {
      openRoomModal();
    });

    els.exportBtn.addEventListener("click", exportData);
    els.importBtn.addEventListener("click", function () {
      els.importFile.click();
    });
    els.importFile.addEventListener("change", importData);

    els.resetDemoBtn.addEventListener("click", function () {
      var ok = window.confirm("确定恢复示例数据吗？当前房间和记录会被覆盖。");
      if (!ok) return;
      state = clone(defaults);
      saveState();
      selectedDate = formatDate(new Date());
      els.dateInput.value = selectedDate;
      render();
      toast("已恢复示例数据");
    });

    document.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeModal(document.getElementById(btn.getAttribute("data-close")));
      });
    });

    [els.checkinModal, els.roomModal].forEach(function (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeModal(modal);
      });
    });

    els.checkinForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var roomId = document.getElementById("checkinRoomId").value;
      var person = document.getElementById("checkinPerson").value.trim();
      var time = document.getElementById("checkinTime").value;
      var note = document.getElementById("checkinNote").value.trim();

      if (!state.records[selectedDate]) state.records[selectedDate] = {};
      state.records[selectedDate][roomId] = {
        person: person,
        time: time,
        note: note,
        submittedAt: new Date().toISOString()
      };
      saveState();
      closeModal(els.checkinModal);
      render();
      toast("打卡已提交");
    });

    els.roomForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var id = document.getElementById("roomId").value || uid();
      var room = {
        id: id,
        area: document.getElementById("roomArea").value.trim(),
        name: document.getElementById("roomName").value.trim(),
        owner: document.getElementById("roomOwner").value.trim(),
        frequency: document.getElementById("roomFrequency").value,
        standard: document.getElementById("roomStandard").value.trim()
      };
      var index = state.rooms.findIndex(function (item) {
        return item.id === id;
      });
      if (index >= 0) {
        state.rooms[index] = room;
      } else {
        state.rooms.push(room);
      }
      saveState();
      closeModal(els.roomModal);
      render();
      toast(index >= 0 ? "房间信息已更新" : "房间已新增");
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeModal(els.checkinModal);
      closeModal(els.roomModal);
    });
  }

  function render() {
    renderAreaFilter();
    renderMetrics();
    renderRooms();
    renderHistory();
  }

  function renderAreaFilter() {
    var current = els.areaFilter.value || "all";
    var areas = unique(state.rooms.map(function (room) {
      return room.area;
    })).sort(localeSort);
    els.areaFilter.innerHTML = '<option value="all">全部区域</option>' + areas.map(function (area) {
      return '<option value="' + escapeAttr(area) + '">' + escapeHtml(area) + '</option>';
    }).join("");
    els.areaFilter.value = areas.indexOf(current) >= 0 ? current : "all";
  }

  function renderMetrics() {
    var total = state.rooms.length;
    var done = getDoneCount(selectedDate);
    var rate = total ? Math.round(done / total * 100) : 0;
    els.metricTotal.textContent = total;
    els.metricDone.textContent = done;
    els.metricRate.textContent = rate + "%";
    els.progressBar.style.width = rate + "%";
    els.summaryText.textContent = selectedDate + " 已完成 " + done + " / " + total + " 个房间";
  }

  function renderRooms() {
    var query = els.searchInput.value.trim().toLowerCase();
    var area = els.areaFilter.value;
    var status = els.statusFilter.value;
    var records = state.records[selectedDate] || {};

    var filtered = state.rooms.filter(function (room) {
      var isDone = Boolean(records[room.id]);
      var text = [room.area, room.name, room.owner, room.frequency, room.standard].join(" ").toLowerCase();
      if (query && text.indexOf(query) < 0) return false;
      if (area !== "all" && room.area !== area) return false;
      if (status === "done" && !isDone) return false;
      if (status === "pending" && isDone) return false;
      return true;
    });

    if (!filtered.length) {
      els.roomsRoot.innerHTML = '<div class="empty">没有找到符合条件的房间。</div>';
      return;
    }

    var groups = groupBy(filtered, "area");
    els.roomsRoot.innerHTML = Object.keys(groups).sort(localeSort).map(function (groupName) {
      var rooms = groups[groupName];
      var done = rooms.filter(function (room) {
        return Boolean(records[room.id]);
      }).length;
      return '<section class="area-group">' +
        '<div class="area-header">' +
        '<h2>' + escapeHtml(groupName) + '</h2>' +
        '<span>' + done + ' / ' + rooms.length + ' 已打卡</span>' +
        '</div>' +
        '<div class="rooms-grid">' + rooms.map(renderRoomCard).join("") + '</div>' +
        '</section>';
    }).join("");

    els.roomsRoot.querySelectorAll("[data-checkin]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openCheckinModal(btn.getAttribute("data-checkin"));
      });
    });
    els.roomsRoot.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openRoomModal(btn.getAttribute("data-edit"));
      });
    });
    els.roomsRoot.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deleteRoom(btn.getAttribute("data-delete"));
      });
    });
  }

  function renderRoomCard(room) {
    var record = (state.records[selectedDate] || {})[room.id];
    var statusClass = record ? "done" : "pending";
    var statusText = record ? "已打卡" : "未打卡";
    var recordHtml = record
      ? '<strong>' + escapeHtml(record.person) + ' 于 ' + escapeHtml(record.time) + ' 提交</strong>' +
        (record.note ? escapeHtml(record.note) : "无备注")
      : '<strong>等待负责人提交</strong>完成打扫后点击“提交打卡”。';

    return '<article class="room-card">' +
      '<div class="room-top">' +
      '<div>' +
      '<h3>' + escapeHtml(room.name) + '</h3>' +
      '<div class="meta"><span>负责人：' + escapeHtml(room.owner) + '</span><span>频率：' + escapeHtml(room.frequency) + '</span></div>' +
      '</div>' +
      '<span class="status ' + statusClass + '">' + statusText + '</span>' +
      '</div>' +
      '<div class="record">' + recordHtml + '</div>' +
      '<p class="note">要求：' + escapeHtml(room.standard || "未填写") + '</p>' +
      '<div class="card-actions">' +
      '<button class="btn primary" data-checkin="' + escapeAttr(room.id) + '">' + (record ? "重新打卡" : "提交打卡") + '</button>' +
      '<div class="actions" style="margin:0">' +
      '<button class="btn" data-edit="' + escapeAttr(room.id) + '">编辑</button>' +
      '<button class="btn danger" data-delete="' + escapeAttr(room.id) + '">删除</button>' +
      '</div>' +
      '</div>' +
      '</article>';
  }

  function renderHistory() {
    var rows = [];
    Object.keys(state.records).forEach(function (date) {
      Object.keys(state.records[date]).forEach(function (roomId) {
        var room = state.rooms.find(function (item) {
          return item.id === roomId;
        });
        if (!room) return;
        var record = state.records[date][roomId];
        rows.push({
          date: date,
          room: room,
          record: record,
          sort: record.submittedAt || date + "T" + record.time
        });
      });
    });

    rows.sort(function (a, b) {
      return b.sort.localeCompare(a.sort);
    });

    if (!rows.length) {
      els.historyRoot.innerHTML = '<div class="empty">还没有打卡记录。</div>';
      return;
    }

    els.historyRoot.innerHTML = rows.slice(0, 12).map(function (item) {
      return '<div class="history-item">' +
        '<div>' +
        '<strong>' + escapeHtml(item.room.area) + ' · ' + escapeHtml(item.room.name) + '</strong>' +
        '<p>' + escapeHtml(item.date) + ' ' + escapeHtml(item.record.time) + '，' + escapeHtml(item.record.person) + ' 提交' +
        (item.record.note ? '：' + escapeHtml(item.record.note) : '') + '</p>' +
        '</div>' +
        '<span class="status done">已打卡</span>' +
        '</div>';
    }).join("");
  }

  function openCheckinModal(roomId) {
    var room = state.rooms.find(function (item) {
      return item.id === roomId;
    });
    if (!room) return;
    var record = (state.records[selectedDate] || {})[roomId];
    document.getElementById("checkinTitle").textContent = room.area + " · " + room.name;
    document.getElementById("checkinRoomId").value = roomId;
    document.getElementById("checkinPerson").value = record ? record.person : room.owner;
    document.getElementById("checkinTime").value = record ? record.time : currentTime();
    document.getElementById("checkinNote").value = record ? record.note : "";
    openModal(els.checkinModal);
  }

  function openRoomModal(roomId) {
    var room = roomId ? state.rooms.find(function (item) {
      return item.id === roomId;
    }) : null;

    document.getElementById("roomTitle").textContent = room ? "编辑房间" : "新增房间";
    document.getElementById("roomId").value = room ? room.id : "";
    document.getElementById("roomArea").value = room ? room.area : "";
    document.getElementById("roomName").value = room ? room.name : "";
    document.getElementById("roomOwner").value = room ? room.owner : "";
    document.getElementById("roomFrequency").value = room ? room.frequency : "每日";
    document.getElementById("roomStandard").value = room ? room.standard : "";
    openModal(els.roomModal);
  }

  function deleteRoom(roomId) {
    var room = state.rooms.find(function (item) {
      return item.id === roomId;
    });
    if (!room) return;
    var ok = window.confirm("确定删除“" + room.area + " · " + room.name + "”吗？相关历史记录也会删除。");
    if (!ok) return;
    state.rooms = state.rooms.filter(function (item) {
      return item.id !== roomId;
    });
    Object.keys(state.records).forEach(function (date) {
      delete state.records[date][roomId];
    });
    saveState();
    render();
    toast("房间已删除");
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "房间清洁打卡数据-" + formatDate(new Date()) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("数据已导出");
  }

  function importData(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data.rooms) || typeof data.records !== "object") {
          throw new Error("数据格式不正确");
        }
        state = data;
        saveState();
        render();
        toast("数据已导入");
      } catch (error) {
        window.alert("导入失败：" + error.message);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function getDoneCount(date) {
    var records = state.records[date] || {};
    return state.rooms.filter(function (room) {
      return Boolean(records[room.id]);
    }).length;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return clone(defaults);
      var data = JSON.parse(raw);
      if (!Array.isArray(data.rooms) || typeof data.records !== "object") {
        return clone(defaults);
      }
      return data;
    } catch (error) {
      return clone(defaults);
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function openModal(modal) {
    modal.classList.add("open");
    var firstInput = modal.querySelector("input:not([type='hidden']), textarea, select, button");
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 20);
  }

  function closeModal(modal) {
    modal.classList.remove("open");
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () {
      els.toast.classList.remove("show");
    }, 1800);
  }

  function uid() {
    return "room-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
  }

  function formatDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function currentTime() {
    var date = new Date();
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function unique(values) {
    return values.filter(function (value, index, array) {
      return value && array.indexOf(value) === index;
    });
  }

  function groupBy(items, key) {
    return items.reduce(function (result, item) {
      var group = item[key] || "未分区";
      if (!result[group]) result[group] = [];
      result[group].push(item);
      return result;
    }, {});
  }

  function localeSort(a, b) {
    return a.localeCompare(b, "zh-Hans-CN");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
