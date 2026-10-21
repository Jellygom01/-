const state = {
  prompts: [],
  categories: [],
  activeCategory: "all",
  query: "",
  sort: "newest",
  activePrompt: null
};

const $ = (selector) => document.querySelector(selector);
const searchInput = $("#searchInput");
const categoryTabs = $("#categoryTabs");
const promptGrid = $("#promptGrid");
const emptyState = $("#emptyState");
const resultSummary = $("#resultSummary");
const toast = $("#toast");
const modal = $("#detailModal");
let toastTimer;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function categoryName(id) {
  return state.categories.find((item) => item.id === id)?.name || "기타";
}
function normalize(value) {
  return String(value || "").toLocaleLowerCase("ko-KR").normalize("NFKC");
}
function getFilteredPrompts() {
  const query = normalize(state.query.trim());
  let result = state.prompts.filter((prompt) => {
    const categoryMatch = state.activeCategory === "all" || prompt.category === state.activeCategory;
    const searchable = normalize([
      prompt.title, prompt.description, prompt.prompt, prompt.negative_prompt,
      prompt.model, ...(prompt.tags || []), categoryName(prompt.category)
    ].join(" "));
    return categoryMatch && (!query || searchable.includes(query));
  });
  result.sort((a, b) => state.sort === "title"
    ? a.title.localeCompare(b.title, "ko")
    : String(b.created_at || "").localeCompare(String(a.created_at || "")) || a.title.localeCompare(b.title, "ko"));
  return result;
}
function renderCategoryTabs() {
  const counts = state.prompts.reduce((acc, prompt) => {
    acc[prompt.category] = (acc[prompt.category] || 0) + 1;
    return acc;
  }, {});
  categoryTabs.innerHTML = state.categories.map((category) => {
    const count = category.id === "all" ? state.prompts.length : (counts[category.id] || 0);
    return `<button type="button" role="tab" aria-selected="${state.activeCategory === category.id}" class="category-tab ${state.activeCategory === category.id ? "active" : ""}" data-category="${escapeHtml(category.id)}">${escapeHtml(category.name)}<span class="tab-count">${count}</span></button>`;
  }).join("");
  $("#categoryCount").textContent = Math.max(0, state.categories.length - 1);
}
function renderPrompts() {
  const prompts = getFilteredPrompts();
  $("#totalCount").textContent = state.prompts.length;
  $("#clearSearch").hidden = !state.query;
  resultSummary.textContent = `${prompts.length}개의 프롬프트${state.query ? ` · “${state.query}” 검색 결과` : ""}`;
  emptyState.hidden = prompts.length > 0;
  promptGrid.hidden = prompts.length === 0;
  promptGrid.innerHTML = prompts.map((prompt) => `
    <article class="prompt-card">
      <div class="card-top">
        <span class="card-category">${escapeHtml(categoryName(prompt.category))}</span>
        <span class="card-id">${escapeHtml(prompt.id || "")}</span>
      </div>
      <h3>${escapeHtml(prompt.title)}</h3>
      <p class="card-description">${escapeHtml(prompt.description || "설명이 등록되지 않았어요.")}</p>
      <div class="card-preview">${escapeHtml(prompt.prompt || "")}</div>
      <div class="card-tags">${(prompt.tags || []).slice(0, 3).map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="card-bottom">
        <span class="model-label">${escapeHtml(prompt.model || "MODEL N/A")}</span>
        <div class="card-actions">
          <button class="card-open" type="button" data-open="${escapeHtml(prompt.id)}">자세히</button>
          <button class="card-copy" type="button" data-copy="${escapeHtml(prompt.id)}">복사 ↗</button>
        </div>
      </div>
    </article>`).join("");
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const success = document.execCommand("copy");
      area.remove();
      if (!success) throw new Error("copy failed");
    }
    showToast("프롬프트를 복사했어요. ✳");
  } catch {
    showToast("복사에 실패했어요. 프롬프트 상세에서 직접 선택해 주세요.");
  }
}
function openDetail(promptId) {
  const prompt = state.prompts.find((item) => item.id === promptId);
  if (!prompt) return;
  state.activePrompt = prompt;
  $("#modalCategory").textContent = categoryName(prompt.category);
  $("#modalTitle").textContent = prompt.title;
  $("#modalDescription").textContent = prompt.description || "";
  $("#modalMeta").innerHTML = [
    prompt.model ? `<span>${escapeHtml(prompt.model)}</span>` : "",
    prompt.created_at ? `<span>${escapeHtml(prompt.created_at)}</span>` : "",
    `<span>${escapeHtml(prompt.id)}</span>`
  ].filter(Boolean).join("");
  $("#modalPrompt").textContent = prompt.prompt || "";
  $("#modalNegative").textContent = prompt.negative_prompt || "";
  $("#negativeBlock").hidden = !prompt.negative_prompt;
  $("#modalTags").innerHTML = (prompt.tags || []).map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  $("#closeModal").focus();
}
function closeDetail() {
  modal.hidden = true;
  document.body.style.overflow = "";
  state.activePrompt = null;
}
function resetFilters() {
  state.activeCategory = "all";
  state.query = "";
  searchInput.value = "";
  $("#sortSelect").value = "newest";
  state.sort = "newest";
  renderCategoryTabs();
  renderPrompts();
}
async function init() {
  try {
    const [promptsResponse, categoriesResponse] = await Promise.all([
      fetch("./data/prompts.json"),
      fetch("./data/categories.json")
    ]);
    if (!promptsResponse.ok || !categoriesResponse.ok) throw new Error("Could not load archive data");
    state.prompts = await promptsResponse.json();
    state.categories = await categoriesResponse.json();
    renderCategoryTabs();
    renderPrompts();
  } catch (error) {
    console.error(error);
    $("#loadError").hidden = false;
    $("#resultSummary").textContent = "데이터를 불러오지 못했어요.";
    promptGrid.hidden = true;
  }
}
categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  renderCategoryTabs();
  renderPrompts();
});
promptGrid.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open]");
  const copyButton = event.target.closest("[data-copy]");
  if (openButton) openDetail(openButton.dataset.open);
  if (copyButton) {
    const prompt = state.prompts.find((item) => item.id === copyButton.dataset.copy);
    if (prompt) copyText(prompt.prompt || "");
  }
});
searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderPrompts();
});
$("#clearSearch").addEventListener("click", () => {
  searchInput.value = "";
  state.query = "";
  renderPrompts();
  searchInput.focus();
});
$("#sortSelect").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderPrompts();
});
$("#resetFilters").addEventListener("click", resetFilters);
$("#emptyReset").addEventListener("click", resetFilters);
$("#closeModal").addEventListener("click", closeDetail);
$("#copyPrompt").addEventListener("click", () => state.activePrompt && copyText(state.activePrompt.prompt || ""));
$("#copyNegative").addEventListener("click", () => state.activePrompt && copyText(state.activePrompt.negative_prompt || ""));
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeDetail();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeDetail();
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && modal.hidden) {
    event.preventDefault();
    searchInput.focus();
  }
});
init();
