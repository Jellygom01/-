
const adminModal = document.querySelector("#adminModal");
const adminOpen = document.querySelector("#adminOpen");
const adminClose = document.querySelector("#adminClose");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminError = document.querySelector("#adminError");
const adminLoginSubmit = document.querySelector("#adminLoginSubmit");
const adminPanel = document.querySelector("#adminPanel");
const adminPromptList = document.querySelector("#adminPromptList");

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

  adminPanel.hidden = !loggedIn;

  if (loggedIn) {
    await refreshAdminPanel();
  }
}

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

    adminPanel.hidden = true;
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

async function refreshAdminPanel() {
  adminPanel.hidden = false;
  adminPromptList.textContent = "프롬프트 목록을 불러오는 중...";

  const { data: prompts, error } = await db
    .from("prompts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("관리자 프롬프트 목록 오류:", error);
    adminPromptList.textContent =
      "목록을 불러오지 못했어요. 데이터베이스 권한을 확인해 주세요.";
    return;
  }

  adminPromptList.replaceChildren();

  if (!prompts || prompts.length === 0) {
    adminPromptList.textContent = "등록된 프롬프트가 없어요.";
    return;
  }

  prompts.forEach((prompt) => {
    const item = document.createElement("article");
    const title = document.createElement("h3");
    const category = document.createElement("p");

    title.textContent = prompt.title || "제목 없음";
    category.textContent =
      "카테고리: " + categoryName(prompt.category);

    item.append(title, category);
    adminPromptList.append(item);
  });
}

db.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    adminOpen.textContent = session
      ? "관리자 로그아웃"
      : "관리자 로그인";

    adminPanel.hidden = !session;

    if (session) {
      refreshAdminPanel();
    }
  }, 0);
});

updateAdminButton();
