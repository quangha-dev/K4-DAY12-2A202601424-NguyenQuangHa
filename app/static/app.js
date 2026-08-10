const els = {
  health: document.querySelector("#health-status"),
  ready: document.querySelector("#ready-status"),
  lastCheck: document.querySelector("#last-check"),
  refresh: document.querySelector("#refresh-status"),
  chatForm: document.querySelector("#chat-form"),
  input: document.querySelector("#message-input"),
  messages: document.querySelector("#messages"),
  token: document.querySelector("#api-token"),
  clientId: document.querySelector("#client-id"),
  send: document.querySelector("#send-message"),
  clear: document.querySelector("#clear-chat"),
  toggleToken: document.querySelector("#toggle-token"),
  usage: document.querySelector("#usage-bar"),
  promptUsage: document.querySelector("#prompt-usage"),
  completionUsage: document.querySelector("#completion-usage"),
  costUsage: document.querySelector("#cost-usage"),
  toast: document.querySelector("#toast"),
};

let toastTimer;

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.toggle("is-error", isError);
  els.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}

function setProbeState(element, ok, label) {
  element.textContent = label;
  element.className = ("status-pill " + (ok ? "" : "is-error")).trim();
  const iconKey = element === els.health ? "health" : "ready";
  const icon = document.querySelector('[data-state-icon="' + iconKey + '"]');
  icon.classList.toggle("is-error", !ok);
}

async function probe(path) {
  const response = await fetch(path, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

async function refreshStatus() {
  els.refresh.classList.add("is-spinning");
  els.health.textContent = "Đang kiểm tra";
  els.ready.textContent = "Đang kiểm tra";
  els.health.className = "status-pill is-loading";
  els.ready.className = "status-pill is-loading";

  const results = await Promise.allSettled([probe("/healthz"), probe("/readyz")]);
  const healthResult = results[0];
  const readyResult = results[1];

  if (healthResult.status === "fulfilled") {
    setProbeState(els.health, healthResult.value.ok, healthResult.value.ok ? "Healthy" : "Draining");
  } else {
    setProbeState(els.health, false, "Offline");
  }

  if (readyResult.status === "fulfilled") {
    setProbeState(els.ready, readyResult.value.ok, readyResult.value.ok ? "Ready" : "Not ready");
  } else {
    setProbeState(els.ready, false, "Unavailable");
  }

  const formatted = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
  els.lastCheck.textContent = "Cập nhật lúc " + formatted;
  els.refresh.classList.remove("is-spinning");
}

function appendMessage(role, text, kind = "") {
  const wrapper = document.createElement("div");
  wrapper.className = ("message " + role + " " + kind).trim();
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : kind === "error" ? "SYSTEM" : "AGENT";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  wrapper.append(label, paragraph);
  els.messages.append(wrapper);
  els.messages.scrollTop = els.messages.scrollHeight;
  return wrapper;
}

function appendTyping() {
  const wrapper = document.createElement("div");
  wrapper.className = "message assistant typing";
  wrapper.innerHTML = '<span class="message-label">AGENT</span><p><i></i><i></i><i></i></p>';
  els.messages.append(wrapper);
  els.messages.scrollTop = els.messages.scrollHeight;
  return wrapper;
}

function explainError(status, detail) {
  const messages = {
    401: "Token không hợp lệ hoặc đang bị thiếu. Hãy kiểm tra lại API token.",
    402: "Client này đã dùng hết ngân sách trong ngày.",
    429: "Bạn gửi quá nhanh. Hãy đợi token bucket được nạp lại.",
    503: "Service đang draining hoặc Redis chưa sẵn sàng.",
  };
  if (messages[status]) return messages[status];
  if (typeof detail === "string") return detail;
  return "Request thất bại với HTTP " + status + ".";
}

async function sendMessage(event) {
  event.preventDefault();
  const message = els.input.value.trim();
  const token = els.token.value.trim();
  const clientId = els.clientId.value.trim() || "anonymous";
  if (!message) return;
  if (!token) {
    showToast("Cần nhập API token trước khi gửi.", true);
    els.token.focus();
    return;
  }

  appendMessage("user", message);
  els.input.value = "";
  els.input.style.height = "auto";
  els.send.disabled = true;
  const typing = appendTyping();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "X-Client-Id": clientId,
      },
      body: JSON.stringify({ message }),
    });
    const data = await response.json().catch(() => ({}));
    typing.remove();
    if (!response.ok) {
      appendMessage("assistant", explainError(response.status, data.detail), "error");
      return;
    }

    appendMessage("assistant", data.reply || "Service không trả về nội dung.");
    els.promptUsage.textContent = data.usage?.prompt ?? 0;
    els.completionUsage.textContent = data.usage?.completion ?? 0;
    els.costUsage.textContent = "$" + Number(data.usd_cost || 0).toFixed(7);
    els.usage.hidden = false;
  } catch {
    typing.remove();
    appendMessage("assistant", "Không kết nối được tới service. Hãy kiểm tra trạng thái ở đầu trang.", "error");
  } finally {
    els.send.disabled = false;
    els.input.focus();
  }
}

els.refresh.addEventListener("click", refreshStatus);
els.chatForm.addEventListener("submit", sendMessage);
els.clear.addEventListener("click", () => {
  els.messages.innerHTML = "";
  appendMessage("assistant", "Hội thoại trên giao diện đã được xóa. Redis phía server vẫn giữ history theo Client ID.");
  els.usage.hidden = true;
});
els.toggleToken.addEventListener("click", () => {
  const shouldShow = els.token.type === "password";
  els.token.type = shouldShow ? "text" : "password";
  els.toggleToken.textContent = shouldShow ? "Ẩn" : "Hiện";
});
els.input.addEventListener("input", () => {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 120) + "px";
});
els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      showToast("Đã sao chép: " + button.dataset.copy);
    } catch {
      showToast("Trình duyệt không cho phép sao chép tự động.", true);
    }
  });
});

refreshStatus();
window.setInterval(refreshStatus, 30000);
