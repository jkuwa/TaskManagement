// 画面イメージ確認用の最小限の動き（保存・編集の反映はしない）

const detail = document.getElementById("detail");
const detailTitle = document.getElementById("detail-title");
const detailDescription = document.getElementById("detail-description");
const detailDue = document.getElementById("detail-due");
const detailPriority = document.getElementById("detail-priority");

// カードをクリックすると詳細画面を開く（［閉じる］・Esc・外側のクリックで閉じる）
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("click", () => {
    detailTitle.value = card.dataset.title;
    detailDescription.value = card.dataset.description;
    detailDue.value = card.dataset.due;
    detailPriority.value = card.dataset.priority;
    detail.showModal();
  });
});

document.getElementById("detail-close").addEventListener("click", () => {
  detail.close();
});

// 外側（背景）のクリックで閉じる。
// 入力欄で文字を選択しながら外までドラッグしたときに閉じないよう、押した位置も外側のときだけ閉じる
function isOutsideDetail(event) {
  const rect = detail.getBoundingClientRect();
  return (
    event.clientX < rect.left || event.clientX > rect.right ||
    event.clientY < rect.top || event.clientY > rect.bottom
  );
}

let pressedOutside = false;
detail.addEventListener("mousedown", (event) => {
  pressedOutside = event.target === detail && isOutsideDetail(event);
});
detail.addEventListener("click", (event) => {
  if (pressedOutside && event.target === detail && isOutsideDetail(event)) {
    detail.close();
  }
  pressedOutside = false;
});

document.getElementById("detail-delete").addEventListener("click", () => {
  if (confirm("このカードを削除しますか？")) {
    alert("モックアップのため、実際には削除されません。");
  }
});

// ドラッグ&ドロップで列の移動・列内の並べ替えをする（落とした位置に入る）
let draggingCard = null;

// カードが入る位置を示す線
const indicator = document.createElement("div");
indicator.className = "drop-indicator";

// マウスの高さより下にある最初のカード（なければ null ＝ 一番下）
function findCardBelow(list, y) {
  const cards = [...list.querySelectorAll(".card:not(.is-dragging)")];
  return cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return y < rect.top + rect.height / 2;
  }) || null;
}

function clearDropState() {
  indicator.remove();
  document.querySelectorAll(".column").forEach((c) => c.classList.remove("is-drop-target"));
}

document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("dragstart", () => {
    draggingCard = card;
    card.classList.add("is-dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
    draggingCard = null;
    clearDropState();
  });
});

document.querySelectorAll(".column").forEach((column) => {
  const list = column.querySelector(".card-list");

  column.addEventListener("dragover", (event) => {
    if (!draggingCard) return;
    event.preventDefault();
    column.classList.add("is-drop-target");
    list.insertBefore(indicator, findCardBelow(list, event.clientY));
  });
  column.addEventListener("dragleave", (event) => {
    if (!column.contains(event.relatedTarget)) {
      column.classList.remove("is-drop-target");
      if (indicator.parentElement === list) indicator.remove();
    }
  });
  column.addEventListener("drop", (event) => {
    event.preventDefault();
    if (draggingCard && indicator.parentElement === list) {
      list.insertBefore(draggingCard, indicator);
    }
    clearDropState();
  });
});
