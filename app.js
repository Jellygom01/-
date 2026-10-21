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

const SUPABASE_URL = "https://snisuqcbgiemlecuhtaz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_7TiUfgpWgZxL0W42DlGg_3UnJZ6QB";

if (!window.supabase) {
  throw new Error(
    "Supabase 라이브러리를 불러오지 못했어요. index.html의 script 순서를 확인해 주세요."
  );
}

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let toastTimer;

// HTML에 표시할 텍스트를 안전하게 변환
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function categoryName(id) {
  return state.categories.find((item) => item.id === id)?.name
    || id
    || "기타";
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("ko-KR")
    .normalize("NFKC");
}

function getFilteredPrompts() {
  const query = normalize(state.query.trim());

  const result = state.prompts.filter((prompt) => {
    const categoryMatch =
      state.activeCategory === "all" ||
      prompt.category === state.activeCategory;

    const searchable = normalize([
      prompt.title,
      prompt.description,
      prompt.prompt,
      prompt.negative_prompt,
      prompt.model,
      ...(Array.isArray(prompt.tags) ? prompt.tags : []),
      categoryName(prompt.category)
    ].join(" "));

    return categoryMatch && (!query || searchable.includes(query));
  });

  result.sort((a, b) =>
    state.sort === "title"
      ? (a.title || "").localeCompare(b.title || "", "ko")
      : String(b.created_at || "").localeCompare(
          String(a.created_at || "")
        ) || (a.title || "").localeCompare(b.title || "", "ko")
  );

  return result;
}

function renderCategoryTabs() {
  const counts = state.prompts.reduce((acc, prompt) => {
    acc[prompt.category] = (acc[prompt.category] || 0) + 1;
    return acc;
  }, {});

  categoryTabs.innerHTML = state.categories.map((category) => {
    const count = category.id === "all"
      ? state.prompts.length
      : counts[category.id] || 0;

    return `
      <button
        type="button"
        role="tab"
        aria-selected="${state.activeCategory === category.id}"
        class="category-tab ${
          state.activeCategory === category.id ? "active" : ""
        }"
        data-category="${escapeHtml(category.id)}"
      >
        ${escapeHtml(category.name)}
        <span class="tab-count">${count}</span>
      </button>
    `;
  }).join("");

  $("#categoryCount").textContent = Math.max(
    0,
    state.categories.length - 1
  );
}

function renderPrompts() {
  const prompts = getFilteredPrompts();

  $("#totalCount").textContent = state.prompts.length;
  $("#clearSearch").hidden = !state.query;

  resultSummary.textContent =
    `${prompts.length}개의 프롬프트` +
    (state.query ? ` · “${state.query}” 검색 결과` : "");

  emptyState.hidden = prompts.length > 0;
  promptGrid.hidden = prompts.length === 0;

  promptGrid.innerHTML = prompts.map((prompt) => `
    <article class="prompt-card">
      ${
        prompt.image_url
          ? `
            <img
              class="card-image"
              src="${escapeHtml(prompt.image_url)}"
              alt="${escapeHtml(prompt.title || "프롬프트 이미지")}"
              loading="lazy"
            >
          `
          : ""
      }

      <div class="card-top">
        <span class="card-category">
          ${escapeHtml(categoryName(prompt.category))}
        </span>
        <span class="card-id">${escapeHtml(prompt.id || "")}</span>
      </div>

      <h3>${escapeHtml(prompt.title)}</h3>

      <p class="card-description">
        ${escapeHtml(prompt.description || "설명이 등록되지 않았어요.")}
      </p>

      <div class="card-preview">
        ${escapeHtml(prompt.prompt || "")}
      </div>

      <div class="card-tags">
        ${(Array.isArray(prompt.tags) ? prompt.tags : [])
          .slice(0, 3)
          .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
          .join("")}
      </div>

      <div class="card-bottom">
        <span class="model-label">
          ${escapeHtml(prompt.model || "MODEL N/A")}
        </span>

        <div class="card-actions">
          <button
            class="card-open"
            type="button"
            data-open="${escapeHtml(prompt.id)}"
          >자세히</button>

          <button
            class="card-copy"
            type="button"
            data-copy="${escapeHtml(prompt.id)}"
          >복사 ↗</button>
        </div>
      </div>
    </article>
  `).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
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

      if (!success) {
        throw new Error("복사하지 못했어요.");
      }
    }

    showToast("프롬프트를 복사했어요. ✳");
  } catch (error) {
    showToast("복사에 실패했어요. 프롬프트 상세에서 직접 선택해 주세요.");
  }
}

// 이미지 파일 검사
function validateImageFile(file) {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      "JPG, PNG, WebP, GIF 이미지 파일만 업로드할 수 있어요."
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("이미지는 5MB 이하로 선택해 주세요.");
  }
}

// 이미지 파일을 Supabase Storage에 올리고 공개 URL 반환
async function uploadPromptImage(file) {
  if (!file) return null;

  validateImageFile(file);

  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const path = `${Date.now()}_${safeName}`;

  const { data: uploadData, error: uploadError } = await db.storage
    .from("prompt-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (uploadError) {
    console.error("이미지 업로드 오류:", uploadError);
    throw new Error(
      "이미지 업로드에 실패했어요. Supabase Storage 권한을 확인해 주세요. " +
      uploadError.message
    );
  }

  const { data: publicData } = db.storage
    .from("prompt-images")
    .getPublicUrl(uploadData.path);

  if (!publicData?.publicUrl) {
    throw new Error("이미지 공개 주소를 가져오지 못했어요.");
  }

  return publicData.publicUrl;
}

// 프롬프트 상세 창
function openDetail(promptId) {
  const prompt = state.prompts.find(
    (item) => String(item.id) === String(promptId)
  );

  if (!prompt) return;

  state.activePrompt = prompt;

  $("#modalCategory").textContent = categoryName(prompt.category);
  $("#modalTitle").textContent = prompt.title || "";
  $("#modalDescription").textContent = prompt.description || "";

  const modalImage = $("#modalImage");

  if (prompt.image_url) {
    modalImage.src = prompt.image_url;
    modalImage.alt = prompt.title || "프롬프트 이미지";
    modalImage.hidden = false;
  } else {
    modalImage.removeAttribute("src");
    modalImage.alt = "";
    modalImage.hidden = true;
  }

  $("#modalMeta").innerHTML = [
    prompt.model
      ? `<span>${escapeHtml(prompt.model)}</span>`
      : "",
    prompt.created_at
      ? `<span>${escapeHtml(prompt.created_at)}</span>`
      : "",
    `<span>${escapeHtml(prompt.id || "")}</span>`
  ].filter(Boolean).join("");

  $("#modalPrompt").textContent = prompt.prompt || "";
  $("#modalNegative").textContent = prompt.negative_prompt || "";
  $("#negativeBlock").hidden = !prompt.negative_prompt;

  $("#modalTags").innerHTML =
    (Array.isArray(prompt.tags) ? prompt.tags : [])
      .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
      .join("");

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

// 공개 아카이브 불러오기
async function loadArchive() {
  const [promptsResult, categoriesResponse] = await Promise.all([
    db.from("prompts").select("*"),
    fetch("./data/categories.json")
  ]);

  if (promptsResult.error) {
    throw promptsResult.error;
  }

  if (!categoriesResponse.ok) {
    throw new Error("카테고리 목록을 불러오지 못했어요.");
  }

  state.prompts = promptsResult.data || [];
  state.categories = await categoriesResponse.json();

  renderCategoryTabs();
  renderPrompts();
}

async function init() {
  try {
    await loadArchive();
  } catch (error) {
    console.error("아카이브 불러오기 오류:", error);
    $("#loadError").hidden = false;
    resultSummary.textContent = "데이터를 불러오지 못했어요.";
    promptGrid.hidden = true;
  }
}

// 공개 사이트 이벤트
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

  if (openButton) {
    openDetail(openButton.dataset.open);
  }

  if (copyButton) {
    const prompt = state.prompts.find(
      (item) => String(item.id) === String(copyButton.dataset.copy)
    );

    if (prompt) {
      copyText(prompt.prompt || "");
    }
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

$("#copyPrompt").addEventListener("click", () => {
  if (state.activePrompt) {
    copyText(state.activePrompt.prompt || "");
  }
});

$("#copyNegative").addEventListener("click", () => {
  if (state.activePrompt) {
    copyText(state.activePrompt.negative_prompt || "");
  }
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeDetail();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    closeDetail();
  }

  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement.tagName
    ) &&
    modal.hidden
  ) {
    event.preventDefault();
    searchInput.focus();
  }
});

// 관리자 요소
const adminModal = $("#adminModal");
const adminOpen = $("#adminOpen");
const adminClose = $("#adminClose");
const adminLoginForm = $("#adminLoginForm");
const adminError = $("#adminError");
const adminLoginSubmit = $("#adminLoginSubmit");

const adminPanel = $("#adminPanel");
const adminPromptList = $("#adminPromptList");
const promptForm = $("#promptForm");
const promptIdInput = $("#promptId");
const promptTitleInput = $("#promptTitle");
const promptCategoryInput = $("#promptCategory");
const promptDescriptionInput = $("#promptDescription");
const promptTextInput = $("#promptText");
const promptNegativeInput = $("#promptNegative");
const promptModelInput = $("#promptModel");
const promptTagsInput = $("#promptTags");
const promptSave = $("#promptSave");
const promptCancel = $("#promptCancel");
const promptAdminMessage = $("#promptAdminMessage");

const promptImageInput = $("#promptImage");
const promptImageUrlInput = $("#promptImageUrl");
const promptImagePreview = $("#promptImagePreview");

function setAdminPanelVisible(visible) {
  adminPanel.hidden = !visible;
  adminPanel.style.display = visible ? "" : "none";
}

// 이미지 미리보기
promptImageInput.addEventListener("change", () => {
  const file = promptImageInput.files?.[0];

  if (!file) {
    const existingUrl = promptImageUrlInput.value.trim();

    if (existingUrl) {
      promptImagePreview.src = existingUrl;
      promptImagePreview.hidden = false;
    } else {
      promptImagePreview.removeAttribute("src");
      promptImagePreview.hidden = true;
    }

    return;
  }

  try {
    validateImageFile(file);
  } catch (error) {
    promptImageInput.value = "";
    promptAdminMessage.textContent = error.message;
    promptImagePreview.removeAttribute("src");
    promptImagePreview.hidden = true;
    return;
  }

  promptImagePreview.src = URL.createObjectURL(file);
  promptImagePreview.alt = file.name;
  promptImagePreview.hidden = false;
  promptAdminMessage.textContent = "이미지를 선택했어요. 저장하면 업로드돼요.";
});

// 관리자 로그인 상태 확인
async function updateAdminButton() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error("관리자 로그인 상태 확인 실패:", error);
    return;
  }

  const loggedIn = Boolean(data.session);

  adminOpen.textContent = loggedIn
    ? "관리자 로그아웃"
    : "관리자 로그인";

  setAdminPanelVisible(loggedIn);

  if (loggedIn) {
    await refreshAdminPanel();
  }
}

// 관리자 로그인 및 로그아웃 버튼
adminOpen.addEventListener("click", async () => {
  const { data, error } = await db.auth.getSession();

  if (error) {
    showToast("로그인 상태를 확인하지 못했어요.");
    return;
  }

  if (data.session) {
    const { error: signOutError } = await db.auth.signOut();

    if (signOutError) {
      showToast("로그아웃에 실패했어요.");
      return;
    }

    setAdminPanelVisible(false);
    await updateAdminButton();
    showToast("로그아웃했어요.");
    return;
  }

  adminError.hidden = true;
  adminModal.hidden = false;
  document.body.style.overflow = "hidden";
});

adminClose.addEventListener("click", () => {
  adminModal.hidden = true;
  document.body.style.overflow = "";
});

adminModal.addEventListener("click", (event) => {
  if (event.target === adminModal) {
    adminModal.hidden = true;
    document.body.style.overflow = "";
  }
});

// 로그인 제출
adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  adminError.hidden = true;
  adminLoginSubmit.disabled = true;
  adminLoginSubmit.textContent = "로그인 중...";

  try {
    const email = $("#adminEmail").value.trim();
    const password = $("#adminPassword").value;

    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    adminModal.hidden = true;
    document.body.style.overflow = "";
    adminLoginForm.reset();

    await updateAdminButton();

    setAdminPanelVisible(true);
    adminPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    showToast("관리자 화면을 열었어요!");
  } catch (error) {
    console.error("관리자 로그인 실패:", error);

    adminError.textContent =
      "로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.";

    adminError.hidden = false;
  } finally {
    adminLoginSubmit.disabled = false;
    adminLoginSubmit.textContent = "로그인";
  }
});

// 등록 폼 초기화
function resetPromptForm() {
  promptForm.reset();
  promptIdInput.value = "";
  promptImageUrlInput.value = "";
  promptImagePreview.removeAttribute("src");
  promptImagePreview.alt = "";
  promptImagePreview.hidden = true;
  promptSave.textContent = "프롬프트 등록";
  promptAdminMessage.textContent = "";
}

promptCancel.addEventListener("click", resetPromptForm);

// 프롬프트 등록 및 수정
promptForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  promptSave.disabled = true;

  const originalId = promptIdInput.value;
  const isEditing = Boolean(originalId);

  promptSave.textContent = isEditing ? "수정 중..." : "등록 중...";
  promptAdminMessage.textContent = "";

  try {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData.session) {
      throw new Error("먼저 관리자 로그인을 해 주세요.");
    }

    const rawCategory = promptCategoryInput.value.trim();

    const matchedCategory = state.categories.find((category) =>
      category.id === rawCategory ||
      category.name === rawCategory
    );

    // 기본값은 기존 이미지 주소.
    // 새 파일을 선택한 경우에만 새 이미지 주소로 교체.
    let imageUrl = promptImageUrlInput.value.trim();
    const selectedFile = promptImageInput.files?.[0] || null;

    if (selectedFile) {
      promptAdminMessage.textContent = "이미지를 업로드하고 있어요...";

      imageUrl = await uploadPromptImage(selectedFile);

      if (!imageUrl) {
        throw new Error("이미지 공개 주소를 가져오지 못했어요.");
      }

      promptAdminMessage.textContent =
        "이미지 업로드 완료! 프롬프트를 저장하고 있어요...";
    } else {
      promptAdminMessage.textContent = "프롬프트를 저장하고 있어요...";
    }

    const payload = {
      title: promptTitleInput.value.trim(),
      category: matchedCategory ? matchedCategory.id : rawCategory,
      description: promptDescriptionInput.value.trim(),
      prompt: promptTextInput.value.trim(),
      negative_prompt: promptNegativeInput.value.trim(),
      model: promptModelInput.value.trim(),
      tags: promptTagsInput.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      image_url: imageUrl || null
    };

    let result;

    if (isEditing) {
      result = await db
        .from("prompts")
        .update(payload)
        .eq("id", originalId)
        .select("id, image_url")
        .single();
    } else {
      result = await db
        .from("prompts")
        .insert([payload])
        .select("id, image_url")
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    if (selectedFile && !result.data?.image_url) {
      throw new Error(
        "이미지는 업로드됐지만 저장된 image_url을 확인하지 못했어요. " +
        "Supabase의 image_url 컬럼과 저장 권한을 확인해 주세요."
      );
    }

    // 저장이 끝난 다음 폼 초기화
    resetPromptForm();

    promptAdminMessage.textContent = isEditing
      ? "프롬프트를 수정했어요."
      : "프롬프트를 등록했어요.";

    showToast(isEditing ? "수정 완료!" : "등록 완료!");

    // 저장 성공과 목록 새로고침을 별도로 처리
    try {
      await loadArchive();
      await refreshAdminPanel();
    } catch (refreshError) {
      console.error("저장 후 목록 새로고침 오류:", refreshError);

      promptAdminMessage.textContent =
        "저장은 완료됐어요. 목록을 새로고침하지 못했으니 페이지를 새로고침해 주세요.";
    }
  } catch (error) {
    console.error("프롬프트 저장 오류:", error);

    promptAdminMessage.textContent =
      "저장에 실패했어요: " +
      (error.message || "알 수 없는 오류가 발생했어요.");
  } finally {
    promptSave.disabled = false;
    promptSave.textContent = promptIdInput.value
      ? "프롬프트 수정"
      : "프롬프트 등록";
  }
});

// 관리자 프롬프트 목록
async function refreshAdminPanel() {
  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();

  if (sessionError || !sessionData.session) {
    setAdminPanelVisible(false);
    return;
  }

  setAdminPanelVisible(true);
  adminPromptList.textContent = "프롬프트 목록을 불러오는 중...";

  const { data: prompts, error } = await db
    .from("prompts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("관리자 목록 오류:", error);
    adminPromptList.textContent =
      "목록을 불러오지 못했어요: " + error.message;
    return;
  }

  adminPromptList.replaceChildren();

  if (!prompts || prompts.length === 0) {
    adminPromptList.textContent = "등록된 프롬프트가 없어요.";
    return;
  }

  prompts.forEach((prompt) => {
    const item = document.createElement("article");
    item.className = "admin-prompt-item";

    const title = document.createElement("h3");
    title.textContent = prompt.title || "제목 없음";

    const category = document.createElement("p");
    category.textContent =
      "카테고리: " + categoryName(prompt.category);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "수정";
    editButton.dataset.adminEdit = prompt.id;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "삭제";
    deleteButton.dataset.adminDelete = prompt.id;

    item.append(title, category, editButton, deleteButton);
    adminPromptList.append(item);
  });
}

// 관리자 목록의 수정 및 삭제
adminPromptList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-admin-edit]");
  const deleteButton = event.target.closest("[data-admin-delete]");

  if (editButton) {
    const prompt = state.prompts.find(
      (item) => String(item.id) === String(editButton.dataset.adminEdit)
    );

    if (!prompt) {
      showToast("자료를 찾지 못했어요. 목록을 새로고침해 주세요.");
      return;
    }

    promptIdInput.value = prompt.id;
    promptTitleInput.value = prompt.title || "";
    promptCategoryInput.value = prompt.category || "";
    promptDescriptionInput.value = prompt.description || "";
    promptTextInput.value = prompt.prompt || "";
    promptNegativeInput.value = prompt.negative_prompt || "";
    promptModelInput.value = prompt.model || "";
    promptTagsInput.value = Array.isArray(prompt.tags)
      ? prompt.tags.join(", ")
      : "";

    promptImageInput.value = "";
    promptImageUrlInput.value = prompt.image_url || "";

    if (prompt.image_url) {
      promptImagePreview.src = prompt.image_url;
      promptImagePreview.alt = prompt.title || "프롬프트 이미지";
      promptImagePreview.hidden = false;
    } else {
      promptImagePreview.removeAttribute("src");
      promptImagePreview.alt = "";
      promptImagePreview.hidden = true;
    }

    promptSave.textContent = "프롬프트 수정";
    promptAdminMessage.textContent =
      "수정할 내용을 입력해 주세요. 새 이미지를 선택하지 않으면 기존 이미지가 유지돼요.";

    promptForm.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    promptTitleInput.focus();
    return;
  }

  if (deleteButton) {
    const id = deleteButton.dataset.adminDelete;

    if (!window.confirm(
      "이 프롬프트를 삭제할까요? 이 작업은 되돌릴 수 없어요."
    )) {
      return;
    }

    deleteButton.disabled = true;

    try {
      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error("관리자 로그인이 필요해요.");
      }

      const { error } = await db
        .from("prompts")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      resetPromptForm();
      await loadArchive();
      await refreshAdminPanel();

      showToast("프롬프트를 삭제했어요.");
    } catch (error) {
      console.error("프롬프트 삭제 오류:", error);

      showToast(
        "삭제 실패: " + (error.message || "오류가 발생했어요.")
      );

      deleteButton.disabled = false;
    }
  }
});

// 로그인 상태 변경 감지
db.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    adminOpen.textContent = session
      ? "관리자 로그아웃"
      : "관리자 로그인";

    setAdminPanelVisible(Boolean(session));

    if (session) {
      await refreshAdminPanel();
    }
  }, 0);
});

// 초기 실행
init();
updateAdminButton();
